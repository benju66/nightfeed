import { fmtClock, dayKey, heightUnitFor, tempUnitFor, weightUnitFor, convWeight, convHeight } from '../lib/format.js'
import { groupDays } from '../lib/derive.js'

function Sparkline({ points, id }) {
  const w = 240, h = 44, pad = 4
  const xs = points.map((p) => p.ts)
  const ys = points.map((p) => p.value)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const sx = (ts) => pad + (maxX === minX ? 0.5 : (ts - minX) / (maxX - minX)) * (w - 2 * pad)
  const sy = (v) => h - pad - (maxY === minY ? 0.5 : (v - minY) / (maxY - minY)) * (h - 2 * pad)
  const d = points.map((p, i) => (i ? 'L' : 'M') + sx(p.ts).toFixed(1) + ' ' + sy(p.value).toFixed(1)).join(' ')
  const area = d + ` L ${sx(maxX).toFixed(1)} ${h} L ${sx(minX).toFixed(1)} ${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="growth-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.ts)} cy={sy(p.value)} r="2.2" fill={i === points.length - 1 ? 'var(--color-accent)' : 'var(--color-accent-700)'} />
      ))}
    </svg>
  )
}

function GrowthRow({ label, points, unit }) {
  if (!points.length) return null
  const latest = points[points.length - 1]
  const fmtDate = (ts) => new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
  const fmtVal = (v) => (Math.round(v * 10) / 10) + ' ' + unit
  return (
    <div className="growth-row">
      <div className="growth-head">
        <span className="trend-label">{label}</span>
        <span className="growth-latest">
          {points.length > 1 && <span className="growth-from">{fmtVal(points[0].value)} → </span>}
          {fmtVal(latest.value)}
        </span>
      </div>
      {points.length > 1 ? (
        <>
          <Sparkline points={points} id={'growth-' + label.toLowerCase()} />
          <div className="growth-dates">
            <span>{fmtDate(points[0].ts)}</span>
            <span>{fmtDate(latest.ts)}</span>
          </div>
        </>
      ) : (
        <p className="growth-hint">Log another {label.toLowerCase()} to see a trend.</p>
      )}
    </div>
  )
}

export default function HealthTab({
  entries, u, timeFormat, now,
  weight, setWeight, height, setHeight, temp, setTemp, med, setMed, medWho, setMedWho,
  logVitD, logWeight, logHeight, logTemp, logMed,
  onEdit, onDelete,
}) {
  const todayK = dayKey(now)
  const lastOf = (type) => entries.filter((e) => e.kind === 'health' && e.type === type).sort((x, y) => y.ts - x.ts)[0]
  const vitd = entries.filter((e) => e.kind === 'health' && e.type === 'vitd' && dayKey(e.ts) === todayK).sort((x, y) => y.ts - x.ts)[0]
  const lastW = lastOf('weight')
  const lastH = lastOf('height')

  const wu = weightUnitFor(u)
  const hu = heightUnitFor(u)
  const series = (type, conv, unit) =>
    entries
      .filter((e) => e.kind === 'health' && e.type === type)
      .sort((a, b) => a.ts - b.ts)
      .map((e) => ({ ts: e.ts, value: conv(e.value, e[type === 'weight' ? 'wunit' : 'hunit'], unit) }))
  const weights = series('weight', convWeight, wu)
  const heights = series('height', convHeight, hu)

  const healthEntries = entries.filter((e) => e.kind === 'health')
  const days = groupDays(healthEntries, 'health', timeFormat, now)

  return (
    <>
      <section className="card elev-sm" style={{ gap: 10 }}>
        <span className="card-kicker">Log</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className={'btn timer-btn' + (vitd ? ' vitd-done' : '')} style={{ minHeight: 64 }} onClick={logVitD}>
            <span className="timer-name-sm">Vitamin D</span>
            <span className="timer-sub-sm">{vitd ? 'Given ' + fmtClock(vitd.ts, timeFormat) : 'Tap when given'}</span>
          </button>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
            <div className="amount-row">
              <input
                className="input" type="number" min="0" inputMode="decimal"
                placeholder={lastW ? 'Last ' + lastW.value + ' ' + lastW.wunit : 'Weight'}
                value={weight} onChange={(ev) => setWeight(ev.target.value)} style={{ flex: 1 }}
              />
              <span className="unit-label">{wu}</span>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', minHeight: 32, fontSize: 13 }} onClick={logWeight}>Log weight</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="amount-row">
              <input
                className="input" type="number" min="0" inputMode="decimal"
                placeholder={lastH ? 'Last ' + lastH.value + ' ' + lastH.hunit : 'Height'}
                value={height} onChange={(ev) => setHeight(ev.target.value)} style={{ flex: 1 }}
              />
              <span className="unit-label">{hu}</span>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', minHeight: 32, fontSize: 13 }} onClick={logHeight}>Log height</button>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="amount-row">
              <input
                className="input" type="number" min="0" inputMode="decimal" placeholder="Temp"
                value={temp} onChange={(ev) => setTemp(ev.target.value)} style={{ flex: 1 }}
              />
              <span className="unit-label">{tempUnitFor(u)}</span>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', minHeight: 32, fontSize: 13 }} onClick={logTemp}>Log temp</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            className="input" type="text" placeholder="Medicine — e.g. Tylenol 2.5 ml"
            value={med} onChange={(ev) => setMed(ev.target.value)}
            onKeyDown={(ev) => ev.key === 'Enter' && logMed()}
          />
          <div className="amount-row">
            <div className="seg" style={{ flex: 1 }}>
              <label className="seg-opt" style={{ flex: 1, justifyContent: 'center', padding: '6px 10px' }}>
                <input type="radio" name="med-who" checked={medWho === 'baby'} onChange={() => setMedWho('baby')} />Baby
              </label>
              <label className="seg-opt" style={{ flex: 1, justifyContent: 'center', padding: '6px 10px' }}>
                <input type="radio" name="med-who" checked={medWho === 'mom'} onChange={() => setMedWho('mom')} />Mom
              </label>
            </div>
            <button className="btn btn-secondary" style={{ flex: 1, minHeight: 32, fontSize: 13 }} onClick={logMed}>Log medicine</button>
          </div>
        </div>
      </section>

      <section className="card elev-sm" style={{ gap: 12 }}>
        <span className="card-kicker">Growth</span>
        {weights.length === 0 && heights.length === 0 ? (
          <p className="growth-hint" style={{ padding: '4px 0' }}>Log a weight or height above to start growth tracking.</p>
        ) : (
          <>
            <GrowthRow label="Weight" points={weights} unit={wu} />
            <GrowthRow label="Height" points={heights} unit={hu} />
          </>
        )}
      </section>

      {healthEntries.length === 0 && <p className="empty-state">No health events yet — vitamin D, measurements, and medicines will appear here.</p>}

      {days.map((day) => (
        <section key={day.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="day-header">
            <span className="day-label">{day.label}</span>
          </div>
          {day.rows.map((row) => (
            <div key={row.id} className="entry-row entry-row-editable" title="Tap to edit" onClick={() => onEdit(row.entry)}>
              <span className="entry-time">{row.time}</span>
              <span className={'tag ' + row.tagClass} style={{ flex: 'none' }}>{row.tag}</span>
              <div className="entry-detail-col">
                <span className="entry-detail">{row.detail}</span>
                {row.note && <span className="entry-note">{row.note}</span>}
              </div>
              <button
                className="btn btn-icon btn-ghost entry-delete" title="Delete entry"
                onClick={(ev) => {
                  ev.stopPropagation()
                  onDelete(row.id)
                }}
              >×</button>
            </div>
          ))}
        </section>
      ))}
    </>
  )
}
