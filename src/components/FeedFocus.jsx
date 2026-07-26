import { fmtDur } from '../lib/format.js'

// Full-screen breast-feeding mode: the timer zone is one giant finish target,
// the side tiles keep the dashboard's left/right muscle memory for switching,
// and the chevron minimizes without stopping.
export default function FeedFocus({ family, now, onFinish, onSwitch, onTogglePause, onMinimize }) {
  const a = family.activeFeed
  if (!a || a.type === 'bottle') return null

  const sideSecs = (side) => {
    let s = side === 'left' ? a.leftSecs || 0 : a.rightSecs || 0
    if (a.type === side && !a.paused) s += Math.floor((now - a.start) / 1000)
    return s
  }
  const totalSecs = sideSecs('left') + sideSecs('right')

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
        <span className="feed-focus-kicker">{a.paused ? 'Feeding · paused' : 'Feeding · ' + a.type + ' side'}</span>
        <span style={{ width: 36, flex: 'none' }} />
      </div>
      <button className={'feed-finish' + (a.paused ? ' paused' : '')} onClick={onFinish}>
        <span className="feed-finish-time">{fmtDur(sideSecs(a.type) * 1000)}</span>
        <span className="feed-finish-detail">
          L {fmtDur(sideSecs('left') * 1000)} · R {fmtDur(sideSecs('right') * 1000)} · total {fmtDur(totalSecs * 1000)}
        </span>
        <span className="feed-finish-hint">Tap anywhere here to finish</span>
      </button>
      <button className={'btn timer-btn' + (a.paused ? ' active' : '')} style={{ minHeight: 56, width: '100%' }} onClick={onTogglePause}>
        <span className="timer-name-sm">{a.paused ? 'Resume' : 'Pause'}</span>
        <span className="timer-sub-sm">{a.paused ? 'Timer stopped — tap when latched again' : 'Burping or a little break'}</span>
      </button>
      <div className="feed-sides">
        {sideTile('left', 'Left')}
        {sideTile('right', 'Right')}
      </div>
    </div>
  )
}
