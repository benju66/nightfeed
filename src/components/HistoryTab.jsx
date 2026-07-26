import { groupDays, trendRows, trendDayLabels } from '../lib/derive.js'
import { exportCsv, printSummary } from '../lib/export.js'

const FILTERS = [
  ['all', 'All'], ['feed', 'Feeds'], ['diaper', 'Diapers'],
  ['sleep', 'Sleep'], ['pump', 'Pump'], ['health', 'Health'],
]

export default function HistoryTab({ entries, u, timeFormat, now, filter, setFilter, babyName, birth, onDelete, onEdit, onAdd }) {
  const rows = trendRows(entries, u, now)
  const dayLabels = trendDayLabels(now)
  const days = groupDays(entries, filter, timeFormat, now)

  return (
    <>
      <section className="card elev-sm" style={{ gap: 12 }}>
        <span className="card-kicker">Last 7 days</span>
        {rows.map((tr) => (
          <div key={tr.label} className="trend-row">
            <span className="trend-label">{tr.label}</span>
            <div className="trend-bars">
              {tr.bars.map((bar, i) => (
                <div key={i} className="trend-bar-slot" title={bar.title}>
                  <div className="trend-bar" style={{ background: bar.bg, height: bar.h }} />
                </div>
              ))}
            </div>
            <span className="trend-total">{tr.total}</span>
          </div>
        ))}
        <div className="trend-days">
          <span style={{ width: 52, flex: 'none' }} />
          <div style={{ flex: 1, display: 'flex', gap: 5 }}>
            {dayLabels.map((d, i) => (
              <span key={i} className="trend-day">{d}</span>
            ))}
          </div>
          <span style={{ width: 48, flex: 'none' }} />
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onAdd}>+ Add entry</button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => exportCsv(entries, timeFormat)}>Export CSV</button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => printSummary(entries, babyName, birth, timeFormat, now)}>Print</button>
      </div>

      <div className="seg" style={{ width: '100%' }}>
        {FILTERS.map(([k, label]) => (
          <label key={k} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
            <input type="radio" name="hist-filter" checked={filter === k} onChange={() => setFilter(k)} />{label}
          </label>
        ))}
      </div>

      {entries.length === 0 && <p className="empty-state">Nothing logged yet — entries will appear here.</p>}

      {days.map((day) => (
        <section key={day.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="day-header">
            <span className="day-label">{day.label}</span>
            <span className="day-summary">{day.summary}</span>
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
