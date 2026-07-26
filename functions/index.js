// Nightfeed push backend. Every 5 minutes: for each family with subscribed
// phones, work out which reminders are due (in the family's own timezone) and
// send a web-push to every subscription. Sends are deduped via notifState on
// the family doc so a due reminder notifies once, not every 5 minutes.
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onRequest } = require('firebase-functions/v2/https')
const { onDocumentWritten } = require('firebase-functions/v2/firestore')
const admin = require('firebase-admin')
const webpush = require('web-push')

admin.initializeApp()

const dayKeyTz = (ts, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(ts))
const minutesOfDayTz = (ts, tz) => {
  const s = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts))
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}
const parseHHMM = (t) => {
  const [h, m] = (t || '09:00').split(':').map(Number)
  return h * 60 + m
}

// Returns [{key, body, stateValue}] — stateValue marks this send in notifState.
function dueReminders(family, vitdDoneToday, now) {
  const out = []
  const state = family.notifState || {}
  const tz = family.tz
  const today = tz ? dayKeyTz(now, tz) : null
  const minsNow = tz ? minutesOfDayTz(now, tz) : null

  // Dedupe keys include the configured time, so editing a reminder's time
  // re-arms it the same day instead of staying suppressed until tomorrow.
  const vitd = family.vitdReminder || {}
  if (vitd.enabled && tz && !vitdDoneToday && minsNow >= parseHHMM(vitd.time)) {
    const key = 'vitd:' + today + '@' + (vitd.time || '09:00')
    if (state['vitd'] !== key) out.push({ key: 'vitd', body: 'Vitamin D is due', stateValue: key })
  }

  for (const r of family.reminders || []) {
    if (!r.enabled) continue
    const who = r.who === 'mom' ? ' (mom)' : ''
    if (r.mode === 'daily') {
      if (!tz) continue // daily times need a timezone; the app records one on launch
      const doneToday = r.lastDone && dayKeyTz(r.lastDone, tz) === today
      if (!doneToday && minsNow >= parseHHMM(r.time)) {
        const key = r.id + ':' + today + '@' + (r.time || '09:00')
        if (state[r.id] !== key) out.push({ key: r.id, body: r.label + who + ' is due', stateValue: key })
      }
    } else {
      const hours = Math.max(0.5, r.hours || 4)
      const dueAt = (r.lastDone || 0) + hours * 3600000
      if (now >= dueAt && state[r.id] !== dueAt) out.push({ key: r.id, body: r.label + who + ' is due', stateValue: dueAt })
    }
  }
  return out
}

async function processFamilies() {
  webpush.setVapidDetails('mailto:benj.urness@gmail.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
  const db = admin.firestore()
  const now = Date.now()
  const families = await db.collection('families').get()
  const report = []

  for (const fam of families.docs) {
    const family = fam.data()
    const subsSnap = await fam.ref.collection('pushSubs').get()
    if (subsSnap.empty) continue

    let vitdDoneToday = false
    if (family.vitdReminder && family.vitdReminder.enabled && family.tz) {
      const today = dayKeyTz(now, family.tz)
      const recent = await fam.ref.collection('entries').where('ts', '>=', now - 36 * 3600000).get()
      vitdDoneToday = recent.docs.some((d) => {
        const e = d.data()
        return e.kind === 'health' && e.type === 'vitd' && dayKeyTz(e.ts, family.tz) === today
      })
    }

    const due = dueReminders(family, vitdDoneToday, now)
    if (!due.length) continue

    for (const d of due) {
      const payload = JSON.stringify({ title: 'Nightfeed', body: d.body, tag: 'nightfeed-' + d.key })
      for (const subDoc of subsSnap.docs) {
        try {
          await webpush.sendNotification(subDoc.data().sub, payload)
        } catch (err) {
          // 404/410 = subscription expired or revoked — clean it up.
          if (err.statusCode === 404 || err.statusCode === 410) await subDoc.ref.delete()
          else console.error('push failed', fam.id, err.statusCode, err.message)
        }
      }
      await fam.ref.update({ ['notifState.' + d.key]: d.stateValue })
      report.push(fam.id + ': ' + d.body)
    }
  }
  return report
}

exports.reminderPush = onSchedule({ schedule: 'every 5 minutes', region: 'us-central1' }, async () => {
  const sent = await processFamilies()
  if (sent.length) console.log('sent:', sent.join(' | '))
})

// "Send test notification" — called from Settings; the family code (the app's
// only secret) authorizes it. Pushes immediately to every subscribed phone.
exports.testPush = onRequest({ region: 'us-central1', cors: true }, async (req, res) => {
  const code = String(req.query.code || '').toUpperCase()
  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    res.status(400).json({ error: 'bad code' })
    return
  }
  webpush.setVapidDetails('mailto:benj.urness@gmail.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
  const subs = await admin.firestore().collection('families').doc(code).collection('pushSubs').get()
  let sent = 0
  const payload = JSON.stringify({ title: 'Nightfeed', body: 'Test notification — push is working on this family', tag: 'nightfeed-test' })
  for (const s of subs.docs) {
    try {
      await webpush.sendNotification(s.data().sub, payload)
      sent++
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await s.ref.delete()
    }
  }
  res.json({ sent })
})

// Whenever family data changes, ping the companion widget app (FCM topic per
// family) so home-screen widgets refresh within seconds instead of on the
// 15-minute poll. Data-only + high priority so it wakes the widget silently.
const pingWidgets = async (code) => {
  try {
    await admin.messaging().send({
      topic: 'family-' + code,
      android: { priority: 'high' },
      data: { kind: 'refresh' },
    })
  } catch (e) {
    console.error('widget ping failed', code, e.message)
  }
}

exports.familyChanged = onDocumentWritten({ document: 'families/{code}', region: 'us-central1' }, (event) =>
  pingWidgets(event.params.code)
)
exports.entryChanged = onDocumentWritten({ document: 'families/{code}/entries/{id}', region: 'us-central1' }, (event) =>
  pingWidgets(event.params.code)
)

// Manual trigger for testing: GET /reminderPushNow?key=<TEST_TRIGGER_KEY>.
exports.reminderPushNow = onRequest({ region: 'us-central1' }, async (req, res) => {
  if (req.query.key !== (process.env.TEST_TRIGGER_KEY || 'nf-test-8231')) {
    res.status(403).send('forbidden')
    return
  }
  const sent = await processFamilies()
  res.json({ sent })
})
