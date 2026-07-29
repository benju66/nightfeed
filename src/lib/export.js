// CSV export + printable summary, ported from the design prototype.
import { fmtClock, fmtMins, toUnits, fmtVol, ageLabel } from './format.js'
import { groupDays } from './derive.js'

export function buildCsv(entries, timeFormat) {
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'
  const rows = [['Date', 'Time', 'Category', 'Detail', 'Duration (min)', 'Amount', 'Unit', 'Note']]
  ;[...entries]
    .sort((a, b) => a.ts - b.ts)
    .forEach((e) => {
      const d = new Date(e.ts)
      let detail = ''
      if (e.kind === 'feed')
        detail = e.type === 'bottle' ? 'Bottle - ' + (e.bottleKind || 'milk') : e.type === 'both' ? 'both breasts' : e.type + ' breast'
      else if (e.kind === 'pump') detail = e.type === 'both' ? 'both sides' : e.type
      else if (e.kind === 'health')
        detail = { vitd: 'vitamin D', weight: 'weight', height: 'height', head: 'head circumference', temp: 'temperature' }[e.type] || (e.who === 'mom' ? 'mom - ' : '') + (e.med || 'medicine')
      else if (e.kind === 'diaper') detail = e.type === 'both' ? 'wet + solid' : e.type
      else if (e.kind === 'note') detail = 'note'
      rows.push([
        d.toLocaleDateString(),
        fmtClock(e.ts, timeFormat),
        e.kind,
        detail,
        e.secs ? (e.secs / 60).toFixed(1) : '',
        e.amount || e.value || '',
        e.unit || e.wunit || e.hunit || e.tunit || '',
        e.note || '',
      ])
    })
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}

export function exportCsv(entries, timeFormat) {
  // BOM so Excel reads the UTF-8 (°F etc.) correctly.
  const blob = new Blob(['\uFEFF' + buildCsv(entries, timeFormat)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'nightfeed-log.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

// Per-day rollup for the printed summary — fuller than the History header.
function daySummary(es, u) {
  const parts = []
  const feeds = es.filter((e) => e.kind === 'feed')
  const breast = feeds.filter((e) => e.type !== 'bottle')
  const bottles = feeds.filter((e) => e.type === 'bottle')
  if (feeds.length) {
    const sub = []
    if (breast.length) sub.push(breast.length + ' breast · ' + fmtMins(breast.reduce((s, e) => s + (e.secs || 0), 0)))
    if (bottles.length) {
      const vol = bottles.filter((e) => e.amount).reduce((s, e) => s + toUnits(e.amount, e.unit, u), 0)
      sub.push(bottles.length + ' bottle' + (vol ? ' · ' + fmtVol(vol, u) : ''))
    }
    parts.push(feeds.length + ' feed' + (feeds.length > 1 ? 's' : '') + (sub.length ? ' (' + sub.join(', ') + ')' : ''))
  }
  const diapers = es.filter((e) => e.kind === 'diaper')
  if (diapers.length) {
    const c = (t) => diapers.filter((e) => e.type === t).length
    const sub = [[c('wet'), 'wet'], [c('solid'), 'solid'], [c('both'), 'wet+solid']].filter(([n]) => n).map(([n, l]) => n + ' ' + l)
    parts.push(diapers.length + ' diaper' + (diapers.length > 1 ? 's' : '') + ' (' + sub.join(', ') + ')')
  }
  const sleeps = es.filter((e) => e.kind === 'sleep')
  if (sleeps.length) parts.push(fmtMins(sleeps.reduce((s, e) => s + (e.secs || 0), 0)) + ' sleep in ' + sleeps.length + ' nap' + (sleeps.length > 1 ? 's' : ''))
  const pumps = es.filter((e) => e.kind === 'pump')
  if (pumps.length) {
    const vol = pumps.filter((e) => e.amount).reduce((s, e) => s + toUnits(e.amount, e.unit, u), 0)
    parts.push('pumped ' + (vol ? fmtVol(vol, u) + ' in ' : '') + pumps.length + ' session' + (pumps.length > 1 ? 's' : ''))
  }
  const meds = es.filter((e) => e.kind === 'health' && !['vitd', 'weight', 'height', 'head', 'temp'].includes(e.type))
  if (meds.length) parts.push(meds.length + ' medicine' + (meds.length > 1 ? 's' : ''))
  return parts.join(' · ')
}

export function printSummary(entries, babyName, birth, timeFormat, now, rangeLabel, u) {
  const days = groupDays(entries, 'all', timeFormat, now)
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  let html =
    '<html><head><meta charset="utf-8"><title>Nightfeed summary</title><style>body{font-family:system-ui,sans-serif;color:#1a1c28;margin:32px;font-size:13px}h1{font-size:20px;font-weight:600}h2{font-size:14px;margin:22px 0 4px}p.sum{margin:0 0 8px;color:#555}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:4px 8px;border-bottom:1px solid #ddd;font-size:12px}th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#777}</style></head><body>'
  const who = (babyName || '').trim()
  const age = ageLabel(birth, now)
  html +=
    '<h1>' +
    (who ? esc(who) + ' — feeding &amp; care summary' : 'Feeding &amp; care summary') +
    '</h1><p class="sum">' +
    [age && esc(age), rangeLabel && esc(rangeLabel), 'Generated ' + new Date(now).toLocaleString()].filter(Boolean).join(' · ') +
    '</p>'
  days.forEach((d) => {
    html += '<h2>' + esc(d.label) + '</h2><p class="sum">' + esc(daySummary(d.rows.map((r) => r.entry), u)) + '</p><table><tr><th>Time</th><th>Type</th><th>Detail</th><th>Note</th></tr>'
    d.rows.forEach((r) => {
      html += '<tr><td>' + esc(r.time) + '</td><td>' + esc(r.tag) + '</td><td>' + esc(r.detail) + '</td><td>' + (r.note ? esc(r.note) : '') + '</td></tr>'
    })
    html += '</table>'
  })
  html += '</body></html>'
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  if (!w) return
  setTimeout(() => {
    w.print()
    URL.revokeObjectURL(url)
  }, 400)
}
