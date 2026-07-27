import { useEffect } from 'react'
import { fmtDur, fmtClock } from '../lib/format.js'

// Full-screen breast-feeding mode: the timer zone is one giant finish target,
// the side tiles keep the dashboard's left/right muscle memory for switching,
// and the chevron minimizes without stopping.
export default function FeedFocus({ family, now, u, timeFormat, amount, setAmount, onFinish, onSwitch, onTogglePause, onAdjustStart, onMinimize }) {
  // Keep the screen awake for the whole session; the OS releases wake locks
  // when the page hides, so re-acquire on return.
  useEffect(() => {
    let lock = null
    let closed = false
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock?.request('screen')
      } catch (e) {
        /* unsupported or denied — screen just sleeps as usual */
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible' && !closed) acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      closed = true
      document.removeEventListener('visibilitychange', onVis)
      try {
        lock?.release()
      } catch (e) {
        /* already released */
      }
    }
  }, [])

  const a = family.activeFeed
  if (!a) return null

  const isBottle = a.type === 'bottle'
  const sideSecs = (side) => {
    let s = side === 'left' ? a.leftSecs || 0 : a.rightSecs || 0
    if (a.type === side && !a.paused) s += Math.floor((now - a.start) / 1000)
    return s
  }
  const totalSecs = isBottle
    ? (a.doneSecs || 0) + (a.paused ? 0 : Math.floor((now - a.start) / 1000))
    : sideSecs('left') + sideSecs('right')

  const sideTile = (side, label) => {
    const active = a.type === side
    const secs = sideSecs(side)
    return (
      <button
        className={'btn timer-btn' + (active ? ' active' : '')}
        style={{ minHeight: 76 }}
        onClick={() => !active && onSwitch(side)}
      >
        <span className="timer-name">{label}</span>
        <span className="timer-sub">
          {active ? fmtDur(secs * 1000) + (a.paused ? ' · paused' : ' · now') : secs ? fmtDur(secs * 1000) + ' · switch' : 'Switch side'}
        </span>
      </button>
    )
  }

  return (
    <div className="feed-focus">
      <div className="feed-focus-top">
        <button className="btn btn-icon btn-ghost" title="Back to dashboard" onClick={onMinimize}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <span className="feed-focus-kicker">
          {isBottle
            ? 'Bottle · ' + (a.bottleKind || 'milk') + (a.paused ? ' · paused' : '')
            : a.paused ? 'Feeding · paused' : 'Feeding · ' + a.type + ' side'}
        </span>
        <span style={{ width: 36, flex: 'none' }} />
      </div>
      <button className={'feed-finish' + (a.paused ? ' paused' : '')} onClick={onFinish}>
        <span className="feed-finish-time">{fmtDur((isBottle ? totalSecs : sideSecs(a.type)) * 1000)}</span>
        {!isBottle && (
          <span className="feed-finish-detail">
            L {fmtDur(sideSecs('left') * 1000)} · R {fmtDur(sideSecs('right') * 1000)} · total {fmtDur(totalSecs * 1000)}
          </span>
        )}
        <span className="feed-finish-hint">Tap anywhere here to finish{isBottle && amount ? ' · logs ' + amount + ' ' + u : ''}</span>
      </button>
      <div className="feed-start-row">
        <span className="feed-start-label">Started {fmtClock(a.feedStart || a.start, timeFormat)}</span>
        <button className="btn btn-secondary feed-start-nudge" onClick={() => onAdjustStart(-15)}>−15m</button>
        <button className="btn btn-secondary feed-start-nudge" onClick={() => onAdjustStart(-5)}>−5m</button>
        <button className="btn btn-secondary feed-start-nudge" onClick={() => onAdjustStart(5)}>+5m</button>
      </div>
      {isBottle && (
        <div className="amount-row">
          <input
            className="input" type="number" min="0" inputMode="decimal" placeholder="Amount taken"
            value={amount} onChange={(ev) => setAmount(ev.target.value)}
            onClick={(ev) => ev.stopPropagation()} style={{ flex: 1, minHeight: 44 }}
          />
          <span className="unit-label">{u}</span>
        </div>
      )}
      <button className={'btn timer-btn' + (a.paused ? ' active' : '')} style={{ minHeight: 56, width: '100%' }} onClick={onTogglePause}>
        <span className="timer-name-sm">{a.paused ? 'Resume' : 'Pause'}</span>
        <span className="timer-sub-sm">{a.paused ? 'Timer stopped — tap to continue' : 'Burping or a little break'}</span>
      </button>
      {!isBottle && (
        <div className="feed-sides">
          {sideTile('left', 'Left')}
          {sideTile('right', 'Right')}
        </div>
      )}
    </div>
  )
}
