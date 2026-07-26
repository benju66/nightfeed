// Derived views over the entry list — history rows, day groups, 7-day trend,
// stat-strip values. Ported from the design prototype's Component class.
import { fmtMins, fmtClock, dayKey, toUnits, fmtVol } from './format.js'

export function rowFor(e, timeFormat) {
  let tag, tagClass, detail
  if (e.kind === 'feed') {
    tag = 'Feed'
    tagClass = 'tag-accent'
    if (e.type === 'bottle')
      detail = 'Bottle (' + (e.bottleKind || 'milk') + ') · ' + fmtMins(e.secs) + (e.amount ? ' · ' + e.amount + ' ' + e.unit : '')
    else if (e.type === 'both')
      detail = 'Both breasts · ' + fmtMins(e.secs) + ' (L ' + fmtMins(e.leftSecs || 0) + ' / R ' + fmtMins(e.rightSecs || 0) + ')'
    else detail = (e.type === 'left' ? 'Left' : 'Right') + ' breast · ' + fmtMins(e.secs)
  } else if (e.kind === 'pump') {
    tag = 'Pump'
    tagClass = 'tag-accent-2'
    detail = (e.type === 'both' ? 'Both sides' : e.type === 'left' ? 'Left' : 'Right') + ' · ' + fmtMins(e.secs) + (e.amount ? ' · ' + e.amount + ' ' + e.unit : '')
  } else if (e.kind === 'health') {
    tag = 'Health'
    tagClass = 'tag-neutral'
    if (e.type === 'vitd') detail = 'Vitamin D given'
    else if (e.type === 'weight') detail = 'Weight · ' + e.value + ' ' + e.wunit
    else if (e.type === 'height') detail = 'Height · ' + e.value + ' ' + e.hunit
    else if (e.type === 'temp') detail = 'Temp · ' + e.value + ' ' + e.tunit
    else detail = (e.who === 'mom' ? 'Mom · ' : '') + (e.med || 'Medicine')
  } else if (e.kind === 'diaper') {
    tag = 'Diaper'
    tagClass = 'tag-neutral'
    detail = e.type === 'both' ? 'Wet + solid' : e.type === 'wet' ? 'Wet' : 'Solid'
  } else if (e.kind === 'note') {
    tag = 'Note'
    tagClass = 'tag-neutral'
    detail = e.note || ''
  } else {
    tag = 'Sleep'
    tagClass = 'tag-outline'
    detail = fmtMins(e.secs) + ' · woke ' + fmtClock(e.end, timeFormat)
  }
  // Standalone notes show their text as the detail line, not duplicated below.
  return { id: e.id, time: fmtClock(e.ts, timeFormat), tag, tagClass, detail, note: e.kind === 'note' ? '' : e.note || '', entry: e }
}

export function groupDays(entries, filter, timeFormat, now) {
  const byDay = {}
  const f = filter || 'all'
  ;[...entries]
    .filter((e) => f === 'all' || e.kind === f)
    .sort((a, b) => b.ts - a.ts)
    .forEach((e) => {
      const k = dayKey(e.ts)
      ;(byDay[k] = byDay[k] || []).push(e)
    })
  return Object.keys(byDay)
    .sort()
    .reverse()
    .map((k) => {
      const es = byDay[k]
      const feeds = es.filter((e) => e.kind === 'feed').length
      const diapers = es.filter((e) => e.kind === 'diaper').length
      const sleep = es.filter((e) => e.kind === 'sleep').reduce((s, e) => s + e.secs, 0)
      const parts = []
      if (feeds) parts.push(feeds + ' feed' + (feeds > 1 ? 's' : ''))
      if (diapers) parts.push(diapers + ' diaper' + (diapers > 1 ? 's' : ''))
      if (sleep) parts.push(fmtMins(sleep) + ' sleep')
      const d = new Date(es[0].ts)
      const today = dayKey(now) === k
      const label = today ? 'Today' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      return { key: k, label, summary: parts.join(' · '), rows: es.map((e) => rowFor(e, timeFormat)) }
    })
}

export function trendKeys(now) {
  return [...Array(7)].map((_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - 6 + i)
    return dayKey(d.getTime())
  })
}

export function trendDayLabels(now) {
  return [...Array(7)].map((_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - 6 + i)
    return d.toLocaleDateString([], { weekday: 'narrow' })
  })
}

export function trendRows(entries, u, now) {
  const keys = trendKeys(now)
  const perDay = keys.map((k) => entries.filter((e) => dayKey(e.ts) === k))
  const mk = (label, vals, fmtTotal, fmtDay) => {
    const max = Math.max(1, ...vals)
    return {
      label,
      total: fmtTotal(vals.reduce((a, b) => a + b, 0)),
      bars: vals.map((v, i) => ({
        h: Math.round((v / max) * 100) + '%',
        bg: i === 6 ? 'var(--color-accent)' : 'var(--color-accent-700)',
        title: keys[i] + ': ' + fmtDay(v),
      })),
    }
  }
  return [
    mk('Feeds', perDay.map((es) => es.filter((e) => e.kind === 'feed').length), (t) => t + ' total', (v) => v + ' feeds'),
    mk('Pumped', perDay.map((es) => es.filter((e) => e.kind === 'pump' && e.amount).reduce((s, e) => s + toUnits(e.amount, e.unit, u), 0)), (t) => fmtVol(t, u), (v) => fmtVol(v, u)),
    mk('Diapers', perDay.map((es) => es.filter((e) => e.kind === 'diaper').length), (t) => t + ' total', (v) => v + ' diapers'),
    mk('Sleep', perDay.map((es) => es.filter((e) => e.kind === 'sleep').reduce((s, e) => s + e.secs, 0)), (t) => (t / 3600).toFixed(1) + 'h', (v) => fmtMins(v)),
  ]
}

// Breakdown line shown when a stat tile is tapped. Scope-aware: today and
// all-time show totals, 7-day avg shows per-day averages over active days.
export function statDetail(key, entries, scope, u, now) {
  const todayK = dayKey(now)
  let es
  let denom = 1
  let per = ''
  if (scope === 'today') es = entries.filter((e) => dayKey(e.ts) === todayK)
  else if (scope === 'all') es = entries
  else {
    const keys = trendKeys(now)
    es = entries.filter((e) => keys.includes(dayKey(e.ts)))
    denom = Math.max(1, new Set(es.map((e) => dayKey(e.ts))).size)
    per = '/day'
  }
  const n = (x) => (denom === 1 ? String(x) : (x / denom).toFixed(1)) + per
  const vol = (list) => list.filter((e) => e.amount).reduce((s, e) => s + toUnits(e.amount, e.unit, u), 0)

  if (key === 'diapers') {
    const d = es.filter((e) => e.kind === 'diaper')
    const c = (t) => d.filter((e) => e.type === t).length
    return n(c('wet')) + ' wet · ' + n(c('solid')) + ' solid · ' + n(c('both')) + ' wet+solid'
  }
  if (key === 'feeds') {
    const f = es.filter((e) => e.kind === 'feed')
    const bottle = f.filter((e) => e.type === 'bottle')
    const secs = f.reduce((s, e) => s + (e.secs || 0), 0)
    return n(f.length - bottle.length) + ' breast · ' + n(bottle.length) + ' bottle · ' + fmtMins(secs / denom) + per + ' feeding'
  }
  if (key === 'bottle') {
    const b = es.filter((e) => e.kind === 'feed' && e.type === 'bottle' && e.amount)
    if (!b.length) return 'No bottle volumes logged'
    return n(b.length) + ' with volume · avg ' + fmtVol(vol(b) / b.length, u) + ' each'
  }
  if (key === 'pumped') {
    const p = es.filter((e) => e.kind === 'pump')
    const withVol = p.filter((e) => e.amount)
    return n(p.length) + ' sessions' + (withVol.length ? ' · avg ' + fmtVol(vol(withVol) / withVol.length, u) + ' each' : '')
  }
  if (key === 'sleep') {
    const s = es.filter((e) => e.kind === 'sleep')
    if (!s.length) return 'No sleep logged'
    const longest = Math.max(...s.map((e) => e.secs || 0))
    return n(s.length) + ' naps · longest ' + fmtMins(longest)
  }
  return ''
}

export function statVals(entries, scope, u, now, sleepStart) {
  const todayK = dayKey(now)
  const today = entries.filter((e) => dayKey(e.ts) === todayK)
  const vol = (es) => es.filter((e) => e.amount).reduce((s, e) => s + toUnits(e.amount, e.unit, u), 0)

  if (scope === 'all') {
    const allFeeds = entries.filter((e) => e.kind === 'feed')
    const allVol = vol(allFeeds)
    const allSleep = entries.filter((e) => e.kind === 'sleep').reduce((s, e) => s + e.secs, 0)
    const allPump = vol(entries.filter((e) => e.kind === 'pump'))
    return {
      feeds: String(allFeeds.length),
      bottle: allVol ? fmtVol(allVol, u) : '—',
      pumped: allPump ? fmtVol(allPump, u) : '—',
      diapers: String(entries.filter((e) => e.kind === 'diaper').length),
      sleep: allSleep ? fmtMins(allSleep) : '—',
    }
  }

  if (scope === 'avg') {
    const keys = trendKeys(now)
    const perDay = keys.map((k) => entries.filter((e) => dayKey(e.ts) === k))
    // Average over days that actually have entries, not a flat 7.
    const activeDays = Math.max(1, perDay.filter((es) => es.length).length)
    const sum = (fn) => perDay.reduce((s, es) => s + fn(es), 0)
    const avgFeeds = sum((es) => es.filter((e) => e.kind === 'feed').length) / activeDays
    const avgVol = sum((es) => vol(es.filter((e) => e.kind === 'feed'))) / activeDays
    const avgDiapers = sum((es) => es.filter((e) => e.kind === 'diaper').length) / activeDays
    const avgSleep = sum((es) => es.filter((e) => e.kind === 'sleep').reduce((s, e) => s + e.secs, 0)) / activeDays
    const avgPump = sum((es) => vol(es.filter((e) => e.kind === 'pump'))) / activeDays
    return {
      feeds: avgFeeds ? avgFeeds.toFixed(1) : '—',
      bottle: avgVol ? fmtVol(avgVol, u) : '—',
      pumped: avgPump ? fmtVol(avgPump, u) : '—',
      diapers: avgDiapers ? avgDiapers.toFixed(1) : '—',
      sleep: avgSleep ? fmtMins(avgSleep) : '—',
    }
  }

  const feeds = today.filter((e) => e.kind === 'feed')
  const bottleVol = vol(feeds)
  const todayPump = vol(today.filter((e) => e.kind === 'pump'))
  let sleepSecs = today.filter((e) => e.kind === 'sleep').reduce((s, e) => s + e.secs, 0)
  if (sleepStart) sleepSecs += Math.floor((now - sleepStart) / 1000)
  return {
    feeds: String(feeds.length),
    bottle: bottleVol ? fmtVol(bottleVol, u) : '—',
    pumped: todayPump ? fmtVol(todayPump, u) : '—',
    diapers: String(today.filter((e) => e.kind === 'diaper').length),
    sleep: sleepSecs ? fmtMins(sleepSecs) : '—',
  }
}
