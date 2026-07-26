// Reminder engine. The vitamin D reminder is built in (done = a vitd entry
// logged today); custom medication reminders track their own lastDone and can
// be for the baby or for mom. All reminder config lives on the family doc so
// both phones agree; whether a given phone shows system notifications is a
// local, per-device choice.
import { dayKey, fmtClock, fmtAgo } from './format.js'

export const VITD_DEFAULTS = { enabled: false, time: '09:00' }
export const FEED_ALERT_DEFAULTS = { enabled: false, hours: 3 }

function todayAt(time, now) {
  const [h, m] = (time || '09:00').split(':').map(Number)
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

function untilText(ms) {
  const mins = Math.ceil(ms / 60000)
  const h = Math.floor(mins / 60)
  return 'in ' + (h ? h + 'h ' + (mins % 60) + 'm' : mins + 'm')
}

// Returns [{key, label, who, due, dueAt, status, builtin, reminder}] for every
// enabled reminder. `status` is display text; `due` means actionable now.
export function reminderStates(family, entries, now, timeFormat) {
  const out = []

  // Feeding-gap alert: due when it's been more than N hours since the last
  // feed STARTED and no feed is running. Display-only — the "action" is
  // feeding, done via the feed buttons.
  const fa = { ...FEED_ALERT_DEFAULTS, ...(family.feedAlert || {}) }
  if (fa.enabled) {
    const af = family.activeFeed
    let last = entries.filter((e) => e.kind === 'feed').reduce((m, e) => Math.max(m, e.ts), 0) || null
    const activeStart = af ? af.feedStart || af.start : null
    if (activeStart && (!last || activeStart > last)) last = activeStart
    if (last) {
      const hours = Math.max(0.5, fa.hours || 3)
      const dueAt = last + hours * 3600000
      const due = !af && now >= dueAt
      out.push({
        key: 'feedalert',
        label: 'Feeding',
        who: 'baby',
        builtin: true,
        noLog: true,
        due,
        dueAt,
        takenAt: last,
        takenLabel: 'last fed',
        status: af ? 'feeding now' : due ? 'Due — ' + fmtAgo(now - last) : untilText(dueAt - now),
      })
    }
  }

  const vitd = { ...VITD_DEFAULTS, ...(family.vitdReminder || {}) }
  if (vitd.enabled) {
    const doneToday = entries.some((e) => e.kind === 'health' && e.type === 'vitd' && dayKey(e.ts) === dayKey(now))
    const at = todayAt(vitd.time, now)
    const due = !doneToday && now >= at
    out.push({
      key: 'vitd',
      label: 'Vitamin D',
      who: 'baby',
      builtin: true,
      due,
      dueAt: at,
      status: doneToday ? 'done today' : due ? 'Due now' : untilText(at - now),
    })
  }
  for (const r of family.reminders || []) {
    if (!r.enabled) continue
    let due, dueAt, status
    if (r.mode === 'daily') {
      const at = todayAt(r.time, now)
      const doneToday = r.lastDone && dayKey(r.lastDone) === dayKey(now)
      dueAt = at
      due = !doneToday && now >= at
      status = doneToday ? 'done today' : due ? 'Due now' : untilText(at - now)
    } else {
      const hours = Math.max(0.5, r.hours || 4)
      dueAt = (r.lastDone || 0) + hours * 3600000
      due = now >= dueAt
      status = due ? 'Due now' : 'next ' + untilText(dueAt - now)
    }
    out.push({ key: r.id, label: r.label, who: r.who || 'baby', builtin: false, due, dueAt, status, takenAt: r.lastDone, reminder: r })
  }
  return out
}

export function scheduleText(r, timeFormat) {
  if (r.mode === 'daily') {
    const [h, m] = (r.time || '09:00').split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return 'daily ' + fmtClock(d.getTime(), timeFormat)
  }
  return 'every ' + (r.hours || 4) + 'h'
}
