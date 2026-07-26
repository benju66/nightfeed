// CSV export + printable summary, ported from the design prototype.
import { fmtClock } from './format.js'
import { groupDays } from './derive.js'
import { ageLabel } from './format.js'

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
        detail = { vitd: 'vitamin D', weight: 'weight', height: 'height', temp: 'temperature' }[e.type] || (e.who === 'mom' ? 'mom - ' : '') + (e.med || 'medicine')
      else if (e.kind === 'diaper') detail = e.type === 'both' ? 'wet + solid' : e.type
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
  const blob = new Blob([buildCsv(entries, timeFormat)], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'nightfeed-log.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

export function printSummary(entries, babyName, birth, timeFormat, now) {
  const days = groupDays(entries, 'all', timeFormat, now)
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  let html =
    '<html><head><title>Nightfeed summary</title><style>body{font-family:system-ui,sans-serif;color:#1a1c28;margin:32px;font-size:13px}h1{font-size:20px;font-weight:600}h2{font-size:14px;margin:22px 0 4px}p.sum{margin:0 0 8px;color:#555}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:4px 8px;border-bottom:1px solid #ddd;font-size:12px}th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#777}</style></head><body>'
  const who = (babyName || '').trim()
  const age = ageLabel(birth, now)
  html +=
    '<h1>' +
    (who ? esc(who) + ' — feeding &amp; care summary' : 'Feeding &amp; care summary') +
    '</h1><p class="sum">' +
    [age && esc(age), 'Generated ' + new Date(now).toLocaleString()].filter(Boolean).join(' · ') +
    '</p>'
  days.forEach((d) => {
    html += '<h2>' + esc(d.label) + '</h2><p class="sum">' + esc(d.summary) + '</p><table><tr><th>Time</th><th>Type</th><th>Detail</th><th>Note</th></tr>'
    d.rows.forEach((r) => {
      html += '<tr><td>' + esc(r.time) + '</td><td>' + esc(r.tag) + '</td><td>' + esc(r.detail) + '</td><td>' + (r.note ? esc(r.note) : '') + '</td></tr>'
    })
    html += '</table>'
  })
  html += '</body></html>'
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  if (!w) return
  setTimeout(() => {
    w.print()
    URL.revokeObjectURL(url)
  }, 400)
}
