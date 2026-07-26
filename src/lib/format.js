// Formatting + derived-metric helpers, ported from the design prototype.

export function fmtDur(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss
}

export function fmtMins(secs) {
  const m = Math.round(secs / 60)
  const h = Math.floor(m / 60)
  return h ? h + 'h ' + (m % 60) + 'm' : m + 'm'
}

export function fmtClock(ts, timeFormat) {
  const h24 = timeFormat === '24h'
  return new Date(ts).toLocaleTimeString([], { hour: h24 ? '2-digit' : 'numeric', minute: '2-digit', hour12: !h24 })
}

export function dayKey(ts) {
  const d = new Date(ts)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

// Volumes are stored with the unit they were entered in; convert at display time.
export function toUnits(amount, unit, u) {
  if (amount == null) return 0
  if (unit === u) return amount
  return unit === 'oz' ? amount * 29.5735 : amount / 29.5735
}

export function fmtVol(v, u) {
  return (u === 'oz' ? v.toFixed(1) : String(Math.round(v))) + ' ' + u
}

export function weightUnitFor(u) {
  return u === 'oz' ? 'lb' : 'kg'
}

export function heightUnitFor(u) {
  return u === 'oz' ? 'in' : 'cm'
}

export function tempUnitFor(u) {
  return u === 'oz' ? '°F' : '°C'
}

export function convWeight(v, from, to) {
  if (from === to) return v
  return from === 'lb' ? v * 0.45359237 : v / 0.45359237
}

export function convHeight(v, from, to) {
  if (from === to) return v
  return from === 'in' ? v * 2.54 : v / 2.54
}

export function ageLabel(birth, now) {
  if (!birth) return ''
  const ts = new Date(birth).getTime()
  if (isNaN(ts) || ts > now) return ''
  const d = Math.floor((now - ts) / 86400000)
  if (d < 1) return 'born today'
  if (d < 7) return d + (d === 1 ? ' day old' : ' days old')
  const w = Math.floor(d / 7)
  return w + (w === 1 ? ' week' : ' weeks') + ' (' + d + ' days) old'
}

// Epoch ms → value for <input type="datetime-local"> in local time.
export function toLocalDT(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes())
}

export function fmtAgo(ms) {
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  const h = Math.floor(m / 60)
  return (h ? h + 'h ' + (m % 60) + 'm' : m + 'm') + ' ago'
}
