import { useState } from 'react'
import { groupDays, trendRows, trendDayLabels } from '../lib/derive.js'
import { exportCsv, printSummary } from '../lib/export.js'

const FILTERS = [
  ['all', 'All'], ['feed', 'Feeds'], ['diaper', 'Diapers'],
  ['sleep', 'Sleep'], ['pump', 'Pump'], ['health', 'Health'], ['note', 'Notes'],
]

const PRINT_RANGES = [
  [7, 'Last 7 days'], [14, 'Last 14 days'], [30, 'Last 30 days'], [0, 'Everything'],
]

export default function HistoryTab({
  entries, u, timeFormat, now, filter, setFilter, babyName, birth,
  onDelete, onEdit, onAdd, getAllEntries, onLoadOlder, canLoadOlder,
}) {
  const rows = trendRows(entries, u, now)
  const dayLabels = trendDayLabels(now)
  const days = groupDays(entries, filter, timeFormat, now)
  const [busy, setBusy] = useState('')
  const [showPrint, setShowPrint] = useState(false)

  // Exports always fetch the complete collection, so they never truncate to
  // the live window.
  const doExport = async () => {
    setBusy('csv')
    try {
      exportCsv(await getAllEntries(), timeFormat)
    } finally {
      setBusy('')
    }
  }
  const doPrint = async (daysBack, label) => {
    setShowPrint(false)
    setBusy('print')
    try {
      const all = await getAllEntries()
      const cutoff = daysBack ? now - daysBack * 86400000 : 0
      printSummary(all.filter((e) => e.ts >= cutoff), babyName, birth, timeFormat, now, daysBack ? label : '', u)
    } finally {
      setBusy('')
    }
  }
  const doLoadOlder = async () => {
    setBusy('older')
    try {
      await onLoadOlder()
    } finally {
      setBusy('')
    }
  }

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
        <button className="btn btn-secondary" style={{ flex: 1 }} disabled={busy === 'csv'} onClick={doExport}>
          {busy === 'csv' ? 'Exporting…' : 'Export CSV'}
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} disabled={busy === 'print'} onClick={() => setShowPrint(true)}>
          {busy === 'print' ? 'Preparing…' : 'Print'}
        </button>
      </div>

      {showPrint && (
        <div className="dialog-backdrop dialog-overlay" onClick={() => setShowPrint(false)}>
          <div className="dialog elev-lg" style={{ maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 10 }} onClick={(ev) => ev.stopPropagation()}>
            <div className="dialog-title" style={{ fontSize: 17 }}>Print summary</div>
            {PRINT_RANGES.map(([d, label]) => (
              <button key={d} className="btn btn-secondary" style={{ width: '100%', minHeight: 40 }} onClick={() => doPrint(d, label)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="seg seg-roomy" style={{ width: '100%' }}>
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

      {canLoadOlder && (
        <button className="btn btn-secondary" style={{ width: '100%', minHeight: 40, marginTop: 4 }} disabled={busy === 'older'} onClick={doLoadOlder}>
          {busy === 'older' ? 'Loading…' : 'Load older entries'}
        </button>
      )}
    </>
  )
}
