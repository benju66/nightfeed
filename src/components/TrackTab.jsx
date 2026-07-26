import { fmtDur, fmtClock, fmtAgo } from '../lib/format.js'

export default function TrackTab({
  family, entries, now, u, timeFormat,
  amount, setAmount, pumpAmount, setPumpAmount, note, setNote,
  reminders, logReminder, logNote,
  tapSide, tapPump, tapSleep, logDiaper, setBottleKind,
}) {
  const a = family.activeFeed
  const p = family.activePump
  const el = (t) => fmtDur(now - t)
  const bottleKind = family.bottleKind || 'milk'
  const breastActive = a && (a.type === 'left' || a.type === 'right')
  // Per-side accumulated seconds for the current feed session.
  const sideSecs = (side) => {
    let s = side === 'left' ? a.leftSecs || 0 : a.rightSecs || 0
    if (a.type === side && !a.paused) s += Math.floor((now - a.start) / 1000)
    return s
  }

  // Time-since row. "Last fed" counts from the feed's START (standard
  // feeding-interval convention); "Awake" counts from the sleep's end.
  const last = (kind) => entries.filter((e) => e.kind === kind).sort((x, y) => (y.end || y.ts) - (x.end || x.ts))[0]
  const lf = entries.filter((e) => e.kind === 'feed').sort((x, y) => y.ts - x.ts)[0]
  const lastFed = a ? 'feeding now' : lf ? fmtAgo(now - lf.ts) : '—'
  const ld = last('diaper')
  const ls = last('sleep')
  const awake = family.sleepStart ? 'sleeping now' : ls ? fmtAgo(now - ls.end).replace(' ago', '') : '—'

  // Suggest the starting side: opposite of the last feed's side; after a
  // both-sides feed, the side that got less time (start where less drained).
  const lastBreast = entries.filter((e) => e.kind === 'feed' && e.type !== 'bottle').sort((x, y) => y.ts - x.ts)[0]
  let suggested = null
  if (!a && lastBreast) {
    if (lastBreast.type === 'left') suggested = 'right'
    else if (lastBreast.type === 'right') suggested = 'left'
    else suggested = (lastBreast.leftSecs || 0) <= (lastBreast.rightSecs || 0) ? 'left' : 'right'
  }

  const bottleSecs = a && a.type === 'bottle' ? (a.doneSecs || 0) + (a.paused ? 0 : Math.floor((now - a.start) / 1000)) : 0

  const feedBtn = (side, label) => {
    let sub = side === suggested ? 'Tap to start · suggested' : 'Tap to start'
    if (a && a.type === side) sub = fmtDur(sideSecs(side) * 1000) + (a.paused ? ' · paused' : '')
    else if (breastActive) sub = sideSecs(side) ? fmtDur(sideSecs(side) * 1000) + ' · switch' : 'Switch side'
    return (
      <button className={'btn timer-btn' + (a && a.type === side ? ' active' : '')} style={{ minHeight: 78 }} onClick={() => tapSide(side)}>
        <span className="timer-name">{label}</span>
        <span className={'timer-sub' + (!a && side === suggested ? ' suggested' : '')}>{sub}</span>
      </button>
    )
  }
  const pumpBtn = (side, label) => (
    <button className={'btn timer-btn' + (p && p.side === side ? ' active' : '')} style={{ minHeight: 60 }} onClick={() => tapPump(side)}>
      <span className="timer-name-sm">{label}</span>
      <span className="timer-sub-sm">{p && p.side === side ? el(p.start) : 'Start'}</span>
    </button>
  )

  return (
    <>
      <div className="since-row">
        <div className="since-tile">
          <span className="tile-label">Last fed</span>
          <span className={'since-value' + (a ? ' now' : '')}>{lastFed}</span>
        </div>
        <div className="since-tile">
          <span className="tile-label">Last diaper</span>
          <span className="since-value">{ld ? fmtAgo(now - ld.ts) : '—'}</span>
        </div>
        <div className="since-tile">
          <span className="tile-label">Awake</span>
          <span className={'since-value' + (family.sleepStart ? ' now' : '')}>{awake}</span>
        </div>
      </div>

      {reminders.length > 0 && (
        <section className="card elev-sm" style={{ gap: 8 }}>
          <span className="card-kicker">Reminders</span>
          {reminders.map((r) => (
            <div key={r.key} className={'reminder-row' + (r.due ? ' due-row' : '')}>
              {r.due && <span className="reminder-dot" aria-hidden="true" />}
              <div className="reminder-main">
                <span className="reminder-label">
                  {r.label}
                  {r.who === 'mom' && <span className="reminder-who"> · mom</span>}
                </span>
                {r.takenAt != null && <span className="reminder-taken">{r.takenLabel || 'taken'} {fmtClock(r.takenAt, timeFormat)}</span>}
              </div>
              <span className={'reminder-status' + (r.due ? ' due' : '')}>{r.status}</span>
              {!r.noLog && (r.due || !r.builtin) && (
                <button
                  className={'btn' + (r.due ? ' btn-primary' : ' btn-secondary')}
                  style={{ minHeight: 30, fontSize: 12.5, padding: '3px 12px' }}
                  onClick={() => logReminder(r)}
                >
                  Log
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="card elev-sm" style={{ gap: 10 }}>
        <span className="card-kicker">Feeding{breastActive ? ' · ' + fmtDur((sideSecs('left') + sideSecs('right')) * 1000) + ' total' + (a.paused ? ' · paused' : '') : ''}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          {feedBtn('left', 'Left')}
          {feedBtn('right', 'Right')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className={'btn timer-btn' + (a && a.type === 'bottle' ? ' active' : '')} style={{ minHeight: 64 }} onClick={() => tapSide('bottle')}>
            <span className="timer-name">Bottle</span>
            <span className="timer-sub">{a && a.type === 'bottle' ? fmtDur(bottleSecs * 1000) + (a.paused ? ' · paused' : '') : 'Tap to start'}</span>
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <div className="seg" style={{ width: '100%' }}>
              <label className="seg-opt" style={{ flex: 1, justifyContent: 'center', padding: '6px 8px' }}>
                <input type="radio" name="bkind" checked={bottleKind === 'milk'} onChange={() => setBottleKind('milk')} />Milk
              </label>
              <label className="seg-opt" style={{ flex: 1, justifyContent: 'center', padding: '6px 8px' }}>
                <input type="radio" name="bkind" checked={bottleKind === 'formula'} onChange={() => setBottleKind('formula')} />Formula
              </label>
            </div>
            <div className="amount-row">
              <input
                className="input" type="number" min="0" inputMode="decimal"
                placeholder={(() => {
                  const lastBottle = entries.filter((e) => e.kind === 'feed' && e.type === 'bottle' && e.amount).sort((x, y) => y.ts - x.ts)[0]
                  return lastBottle ? 'Last ' + lastBottle.amount + ' ' + lastBottle.unit : 'Amount'
                })()}
                value={amount} onChange={(ev) => setAmount(ev.target.value)} style={{ flex: 1 }}
              />
              <span className="unit-label">{u}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card elev-sm" style={{ gap: 10 }}>
        <span className="card-kicker">Diaper</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1, minHeight: 48 }} onClick={() => logDiaper('wet')}>Wet</button>
          <button className="btn btn-secondary" style={{ flex: 1, minHeight: 48 }} onClick={() => logDiaper('solid')}>Solid</button>
          <button className="btn btn-secondary" style={{ flex: 1, minHeight: 48 }} onClick={() => logDiaper('both')}>Wet + Solid</button>
        </div>
      </section>

      <section className="card elev-sm" style={{ gap: 10 }}>
        <span className="card-kicker">Sleep</span>
        <button className={'btn timer-btn' + (family.sleepStart ? ' active' : '')} style={{ width: '100%', minHeight: 64 }} onClick={tapSleep}>
          <span className="timer-name">{family.sleepStart ? 'Sleeping…' : 'Start sleep'}</span>
          <span className="timer-sub">{family.sleepStart ? el(family.sleepStart) : 'Tap when baby falls asleep'}</span>
        </button>
      </section>

      <section className="card elev-sm" style={{ gap: 10 }}>
        <span className="card-kicker">Pumping</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {pumpBtn('left', 'Left')}
          {pumpBtn('right', 'Right')}
          {pumpBtn('both', 'Both')}
        </div>
        <div className="amount-row">
          <input className="input" type="number" min="0" inputMode="decimal" placeholder="Total pumped" value={pumpAmount} onChange={(ev) => setPumpAmount(ev.target.value)} style={{ flex: 1 }} />
          <span className="unit-label">{u}</span>
        </div>
      </section>

      <section className="field" style={{ padding: '2px 2px 0' }}>
        <label htmlFor="nf-note">Quick note — attaches to the next entry, or log it on its own</label>
        <input id="nf-note" className="input" type="text" placeholder="e.g. spit up a little, ask doctor about…" value={note} onChange={(ev) => setNote(ev.target.value)} />
        {note.trim() && (
          <button className="btn btn-secondary" style={{ width: '100%', minHeight: 32, fontSize: 13, marginTop: 6 }} onClick={logNote}>
            Log note on its own
          </button>
        )}
      </section>
    </>
  )
}
