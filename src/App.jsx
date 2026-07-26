import { useEffect, useRef, useState } from 'react'
import {
  savedFamilyCode, saveFamilyCode, createFamily, joinFamily,
  watchFamily, watchEntries, updateFamily, addEntry, overwriteEntry, deleteEntry, clearAllData,
} from './data.js'
import { ageLabel, fmtMins, weightUnitFor, heightUnitFor, tempUnitFor } from './lib/format.js'
import { statVals, statDetail } from './lib/derive.js'
import { reminderStates } from './lib/reminders.js'
import TrackTab from './components/TrackTab.jsx'
import HealthTab from './components/HealthTab.jsx'
import HistoryTab from './components/HistoryTab.jsx'
import SettingsDialog from './components/SettingsDialog.jsx'
import EntryDialog from './components/EntryDialog.jsx'
import FeedFocus from './components/FeedFocus.jsx'

export default function App() {
  const [code, setCode] = useState(savedFamilyCode)
  const switchFamily = (c) => {
    saveFamilyCode(c)
    setCode(c)
  }
  if (!code) return <Pairing onJoined={switchFamily} />
  return <Main key={code} code={code} onSwitchFamily={switchFamily} />
}

function Pairing({ onJoined }) {
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      onJoined(await createFamily())
    } catch (e) {
      setError('Could not create a family — check your connection and try again.')
      setBusy(false)
    }
  }
  const join = async () => {
    const c = joinCode.trim().toUpperCase()
    if (c.length < 4) return setError('Enter the code shown on your partner’s phone.')
    setBusy(true)
    setError('')
    try {
      if (await joinFamily(c)) onJoined(c)
      else {
        setError('No family found with that code — double-check it.')
        setBusy(false)
      }
    } catch (e) {
      setError('Could not reach the server — check your connection and try again.')
      setBusy(false)
    }
  }

  const stars = [
    [8, 12, 0], [22, 32, 1.3], [15, 68, 2.1], [34, 9, 0.6], [48, 22, 2.8],
    [63, 7, 1.7], [72, 30, 0.3], [86, 14, 2.4], [91, 44, 1.1], [80, 72, 0.8],
    [64, 88, 1.9], [38, 84, 2.6], [10, 88, 1.5], [55, 55, 3.2],
  ]
  return (
    <div className="pair-viewport">
      <div className="pair-sky" aria-hidden="true">
        {stars.map(([x, y, d], i) => (
          <span key={i} className="pair-star" style={{ left: x + '%', top: y + '%', animationDelay: d + 's' }} />
        ))}
      </div>
      <div className="pair-card card elev-sm">
        <div className="pair-glyph" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 512 512">
            <circle cx="240" cy="256" r="150" fill="var(--color-accent)" />
            <circle cx="298" cy="212" r="138" fill="var(--color-surface)" />
            <path d="M352 300C352 300 316 350 316 378A36 36 0 0 0 388 378C388 350 352 300 352 300Z" fill="var(--color-accent)" />
          </svg>
        </div>
        <div className="pair-head">
          <div className="pair-title">Nightfeed</div>
          <p className="pair-sub">Newborn feeding &amp; care, shared between both parents in realtime.</p>
        </div>
        <button className="btn btn-primary" style={{ minHeight: 48 }} disabled={busy} onClick={create}>
          Create a family
        </button>
        <div className="pair-divider">or join your partner</div>
        <div className="field">
          <label htmlFor="join-code">Family code</label>
          <div className="code-row">
            <input
              id="join-code" className="input" type="text" placeholder="e.g. QK7DM2PX"
              autoCapitalize="characters" autoComplete="off" spellCheck="false"
              style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
              value={joinCode}
              onChange={(ev) => setJoinCode(ev.target.value)}
              onKeyDown={(ev) => ev.key === 'Enter' && join()}
            />
            <button className="btn btn-secondary" disabled={busy} onClick={join}>Join</button>
          </div>
        </div>
        {error && <p className="pair-error">{error}</p>}
      </div>
    </div>
  )
}

function Main({ code, onSwitchFamily }) {
  const [family, setFamily] = useState(undefined) // undefined = loading, null = missing
  const [entries, setEntries] = useState([])
  const [now, setNow] = useState(Date.now())
  const [tab, setTab] = useState('track')
  const [scope, setScope] = useState('today')
  const [detailKey, setDetailKey] = useState(null)
  const touchRef = useRef(null) // swipe tracking — must sit above the loading returns
  const [filter, setFilter] = useState('all')
  const [showSettings, setShowSettings] = useState(false)
  // In-progress inputs stay local to this phone until an entry is logged.
  const [amount, setAmount] = useState('')
  const [pumpAmount, setPumpAmount] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [temp, setTemp] = useState('')
  const [med, setMed] = useState('')
  const [medWho, setMedWho] = useState('baby')
  const [note, setNote] = useState('')
  const [editingEntry, setEditingEntry] = useState(null)
  const [showAddEntry, setShowAddEntry] = useState(false)
  // Full-screen feeding mode is local to this phone; the feed itself is shared.
  const [feedFocus, setFeedFocus] = useState(false)
  const [justLogged, setJustLogged] = useState(null) // {id, secs, prev} for undo
  // Extra-dim overlay for night use — per-phone, not synced.
  const [dim, setDim] = useState(() => localStorage.getItem('nightfeed-dim') === '1')
  const toggleDim = () => {
    const d = !dim
    setDim(d)
    localStorage.setItem('nightfeed-dim', d ? '1' : '0')
  }

  useEffect(() => watchFamily(code, setFamily), [code])
  useEffect(() => watchEntries(code, setEntries), [code])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Keep the family doc stamped with this phone's timezone (the push backend
  // needs it for daily-at-time reminders) and refresh this device's push
  // subscription — browsers rotate them.
  useEffect(() => {
    if (!family) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && family.tz !== tz) updateFamily(code, { tz })
    if (localStorage.getItem('nightfeed-notify') === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      import('./lib/push.js').then((m) => m.enablePush(code)).catch(() => {})
    }
  }, [family === undefined, code]) // eslint-disable-line react-hooks/exhaustive-deps

  // Exit feeding mode when the feed *ends* elsewhere (partner's phone) or
  // turns into a bottle feed. Transition-based: closing on plain absence would
  // race the snapshot that follows our own start-write and kill the overlay.
  const prevFeedRef = useRef(null)
  useEffect(() => {
    if (family === undefined) return
    const cur = family ? family.activeFeed : null
    const wasBreast = prevFeedRef.current && prevFeedRef.current.type !== 'bottle'
    const isBreastNow = cur && cur.type !== 'bottle'
    if (feedFocus && wasBreast && !isBreastNow) setFeedFocus(false)
    prevFeedRef.current = cur
  }, [family]) // eslint-disable-line react-hooks/exhaustive-deps

  // Android back minimizes feeding mode instead of leaving the app.
  useEffect(() => {
    if (!feedFocus) return
    const onPop = () => setFeedFocus(false)
    window.history.pushState({ nf: 'feed' }, '')
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (window.history.state?.nf === 'feed') window.history.back()
    }
  }, [feedFocus])

  // Undo window for a just-finished feed.
  useEffect(() => {
    if (!justLogged) return
    const t = setTimeout(() => setJustLogged(null), 6000)
    return () => clearTimeout(t)
  }, [justLogged])

  // Home-screen shortcut launches (?action=...) — handled once the family
  // doc is loaded, then stripped from the URL so a refresh doesn't repeat it.
  useEffect(() => {
    if (!family) return
    const action = new URLSearchParams(window.location.search).get('action')
    if (!action) return
    window.history.replaceState({}, '', '/')
    if (action === 'feed-left') tapSide('left')
    else if (action === 'feed-right') tapSide('right')
    else if (action === 'diaper-wet') logDiaper('wet')
    else if (action === 'sleep' && !family.sleepStart) tapSleep()
  }, [family === undefined]) // eslint-disable-line react-hooks/exhaustive-deps

  if (family === undefined) {
    return (
      <div className="pair-viewport">
        <p className="pair-sub">Connecting…</p>
      </div>
    )
  }
  if (family === null) {
    return (
      <div className="pair-viewport">
        <div className="pair-card card elev-sm">
          <div className="pair-title">Family not found</div>
          <p className="pair-sub">The family “{code}” no longer exists.</p>
          <button className="btn btn-primary" onClick={() => onSwitchFamily('')}>Start over</button>
        </div>
      </div>
    )
  }

  const u = family.units || 'oz'
  const timeFormat = family.timeFormat || '12h'
  const takeNote = (e) => {
    const n = note.trim()
    if (n) e.note = n
    return e
  }
  const logged = (e) => {
    const id = addEntry(code, takeNote(e))
    setNote('')
    return id
  }

  const finishFeedEntry = () => {
    const a = family.activeFeed
    if (!a) return null
    const end = Date.now()
    if (a.type === 'bottle') {
      const e = { kind: 'feed', type: 'bottle', ts: a.start, end, secs: Math.round((end - a.start) / 1000), bottleKind: a.bottleKind || family.bottleKind || 'milk' }
      const amt = parseFloat(amount)
      if (!isNaN(amt) && amt > 0) {
        e.amount = amt
        e.unit = u
      }
      return e
    }
    // Breast feed: fold the running segment into the per-side totals. A paused
    // segment contributes nothing — pauses are not feeding time.
    const segSecs = a.paused ? 0 : Math.round((end - a.start) / 1000)
    const left = (a.leftSecs || 0) + (a.type === 'left' ? segSecs : 0)
    const right = (a.rightSecs || 0) + (a.type === 'right' ? segSecs : 0)
    const e = { kind: 'feed', ts: a.feedStart || a.start, end, secs: left + right, type: left && right ? 'both' : right ? 'right' : 'left' }
    if (left) e.leftSecs = left
    if (right) e.rightSecs = right
    return e
  }

  const isBreast = (t) => t === 'left' || t === 'right'
  const tapSide = (side) => {
    const a = family.activeFeed
    if (a && isBreast(a.type) && isBreast(side)) {
      // Tapping the ticking side re-opens feeding mode; stopping happens there.
      if (a.type === side) {
        setFeedFocus(true)
        return
      }
      // Switching breast sides mid-feed continues the same session (and
      // resumes it if it was paused).
      const segSecs = a.paused ? 0 : Math.round((Date.now() - a.start) / 1000)
      updateFamily(code, {
        activeFeed: {
          type: side,
          start: Date.now(),
          feedStart: a.feedStart || a.start,
          leftSecs: (a.leftSecs || 0) + (a.type === 'left' ? segSecs : 0),
          rightSecs: (a.rightSecs || 0) + (a.type === 'right' ? segSecs : 0),
        },
      })
      setFeedFocus(true)
      return
    }
    const done = finishFeedEntry()
    if (done) {
      logged(done)
      if (done.amount) setAmount('')
    }
    if (a && a.type === side) updateFamily(code, { activeFeed: null })
    else if (side === 'bottle') updateFamily(code, { activeFeed: { type: 'bottle', start: Date.now(), bottleKind: family.bottleKind || 'milk' } })
    else {
      updateFamily(code, { activeFeed: { type: side, start: Date.now(), feedStart: Date.now(), leftSecs: 0, rightSecs: 0 } })
      setFeedFocus(true)
    }
  }

  // Pause (burping, re-latching) freezes the timers without ending the
  // session; the state lives on the family doc so both phones agree.
  const togglePauseFeed = () => {
    const a = family.activeFeed
    if (!a || a.type === 'bottle') return
    if (a.paused) {
      updateFamily(code, { activeFeed: { ...a, paused: false, start: Date.now() } })
    } else {
      const segSecs = Math.round((Date.now() - a.start) / 1000)
      updateFamily(code, {
        activeFeed: {
          ...a,
          paused: true,
          start: Date.now(),
          leftSecs: (a.leftSecs || 0) + (a.type === 'left' ? segSecs : 0),
          rightSecs: (a.rightSecs || 0) + (a.type === 'right' ? segSecs : 0),
        },
      })
    }
  }

  // Finish from feeding mode: log the entry, keep a 6s undo that can restore
  // the running session exactly as it was.
  const finishBreastFeed = () => {
    const prev = family.activeFeed
    const done = finishFeedEntry()
    setFeedFocus(false)
    if (!done) return
    const id = logged(done)
    updateFamily(code, { activeFeed: null })
    setJustLogged({ id, secs: done.secs, prev })
  }
  const undoFinish = () => {
    if (!justLogged) return
    deleteEntry(code, justLogged.id)
    updateFamily(code, { activeFeed: justLogged.prev })
    setJustLogged(null)
    setFeedFocus(true)
  }

  const tapPump = (side) => {
    const p = family.activePump
    if (p) {
      const end = Date.now()
      const e = { kind: 'pump', type: p.side, ts: p.start, end, secs: Math.round((end - p.start) / 1000) }
      const amt = parseFloat(pumpAmount)
      if (!isNaN(amt) && amt > 0) {
        e.amount = amt
        e.unit = u
      }
      logged(e)
      setPumpAmount('')
    }
    if (p && p.side === side) updateFamily(code, { activePump: null })
    else updateFamily(code, { activePump: { side, start: Date.now() } })
  }

  const tapSleep = () => {
    if (family.sleepStart) {
      const end = Date.now()
      logged({ kind: 'sleep', ts: family.sleepStart, end, secs: Math.round((end - family.sleepStart) / 1000) })
      updateFamily(code, { sleepStart: null })
    } else updateFamily(code, { sleepStart: Date.now() })
  }

  const logDiaper = (type) => logged({ kind: 'diaper', type, ts: Date.now() })
  const logVitD = () => logged({ kind: 'health', type: 'vitd', ts: Date.now() })
  const logWeight = () => {
    const v = parseFloat(weight)
    if (isNaN(v) || v <= 0) return
    logged({ kind: 'health', type: 'weight', ts: Date.now(), value: v, wunit: weightUnitFor(u) })
    setWeight('')
  }
  const logHeight = () => {
    const v = parseFloat(height)
    if (isNaN(v) || v <= 0) return
    logged({ kind: 'health', type: 'height', ts: Date.now(), value: v, hunit: heightUnitFor(u) })
    setHeight('')
  }
  const logTemp = () => {
    const v = parseFloat(temp)
    if (isNaN(v) || v <= 0) return
    logged({ kind: 'health', type: 'temp', ts: Date.now(), value: v, tunit: tempUnitFor(u) })
    setTemp('')
  }
  const logMed = () => {
    const m = med.trim()
    if (!m) return
    const e = { kind: 'health', type: 'med', ts: Date.now(), med: m }
    if (medWho === 'mom') e.who = 'mom'
    logged(e)
    setMed('')
  }

  // Reminders — config lives on the family doc; states derive from now.
  const reminders = reminderStates(family, entries, now, timeFormat)
  const logReminder = (r) => {
    if (r.builtin) return logVitD()
    const e = { kind: 'health', type: 'med', ts: Date.now(), med: r.label }
    if (r.who === 'mom') e.who = 'mom'
    addEntry(code, e)
    updateFamily(code, {
      reminders: (family.reminders || []).map((x) => (x.id === r.reminder.id ? { ...x, lastDone: Date.now() } : x)),
    })
  }


  // Swipe left/right on the main area to move between tabs.
  const TAB_ORDER = ['track', 'health', 'history']
  const onTouchStart = (e) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e) => {
    const t = touchRef.current
    touchRef.current = null
    if (!t) return
    const dx = e.changedTouches[0].clientX - t.x
    const dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) < 70 || Math.abs(dy) > 60) return
    const idx = TAB_ORDER.indexOf(tab) + (dx < 0 ? 1 : -1)
    if (idx >= 0 && idx < TAB_ORDER.length) setTab(TAB_ORDER[idx])
  }

  const stats = statVals(entries, scope, u, now, family.sleepStart)
  const headerSub = [
    ageLabel(family.birth, now),
    new Date(now).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
  ].filter(Boolean).join(' · ')

  return (
    <div className="app-viewport">
      <div className="app-shell">
        <header className="app-header">
          <div className="app-title-col">
            <span className="app-title">{(family.babyName || '').trim() || 'Nightfeed'}</span>
            <span className="app-subtitle">{headerSub}</span>
          </div>
          <button className={'btn btn-icon dim-btn' + (dim ? ' active btn-primary' : ' btn-secondary')} title={dim ? 'Normal brightness' : 'Extra dim (night)'} style={{ flex: 'none' }} onClick={toggleDim}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
            </svg>
          </button>
          <button className="btn btn-icon btn-secondary" title="Settings" style={{ flex: 'none' }} onClick={() => setShowSettings(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
            </svg>
          </button>
        </header>

        <div className="scope-row">
          {[['today', 'Today'], ['avg', '7-day avg'], ['all', 'All time']].map(([k, label]) => (
            <button key={k} className={'btn btn-ghost scope-btn' + (scope === k ? ' active' : '')} onClick={() => setScope(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="stat-strip">
          {[[stats.feeds, 'Feeds', 'feeds'], [stats.bottle, 'Bottle', 'bottle'], [stats.pumped, 'Pumped', 'pumped'], [stats.diapers, 'Diapers', 'diapers'], [stats.sleep, 'Sleep', 'sleep']].map(([v, label, key]) => (
            <div
              key={label}
              className={'stat-tile stat-tile-tappable' + (detailKey === key ? ' selected' : '')}
              onClick={() => setDetailKey(detailKey === key ? null : key)}
            >
              <span className="stat-value">{v}</span>
              <span className="tile-label">{label}</span>
            </div>
          ))}
        </div>
        {detailKey && <div className="stat-detail">{statDetail(detailKey, entries, scope, u, now)}</div>}

        <main className="app-main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {tab === 'track' ? (
            <TrackTab
              family={family} entries={entries} now={now} u={u} timeFormat={timeFormat}
              amount={amount} setAmount={setAmount}
              pumpAmount={pumpAmount} setPumpAmount={setPumpAmount}
              note={note} setNote={setNote}
              reminders={reminders} logReminder={logReminder}
              tapSide={tapSide} tapPump={tapPump} tapSleep={tapSleep}
              logDiaper={logDiaper}
              setBottleKind={(k) => updateFamily(code, { bottleKind: k })}
            />
          ) : tab === 'health' ? (
            <HealthTab
              entries={entries} u={u} timeFormat={timeFormat} now={now}
              weight={weight} setWeight={setWeight}
              height={height} setHeight={setHeight}
              temp={temp} setTemp={setTemp}
              med={med} setMed={setMed}
              medWho={medWho} setMedWho={setMedWho}
              logVitD={logVitD} logWeight={logWeight}
              logHeight={logHeight} logTemp={logTemp} logMed={logMed}
              onEdit={(entry) => setEditingEntry(entry)}
              onDelete={(id) => {
                if (window.confirm('Delete this entry?')) deleteEntry(code, id)
              }}
            />
          ) : (
            <HistoryTab
              entries={entries} u={u} timeFormat={timeFormat} now={now}
              filter={filter} setFilter={setFilter}
              babyName={family.babyName} birth={family.birth}
              onDelete={(id) => {
                if (window.confirm('Delete this entry?')) deleteEntry(code, id)
              }}
              onEdit={(entry) => setEditingEntry(entry)}
              onAdd={() => setShowAddEntry(true)}
            />
          )}
        </main>

        <nav className="tab-bar">
          <button className={'btn tab-btn' + (tab === 'track' ? ' active' : '')} onClick={() => setTab('track')}>Track</button>
          <button className={'btn tab-btn' + (tab === 'health' ? ' active' : '')} onClick={() => setTab('health')}>Health</button>
          <button className={'btn tab-btn' + (tab === 'history' ? ' active' : '')} onClick={() => setTab('history')}>History</button>
        </nav>

        {feedFocus && family.activeFeed && family.activeFeed.type !== 'bottle' && (
          <FeedFocus
            family={family}
            now={now}
            onFinish={finishBreastFeed}
            onSwitch={(s) => tapSide(s)}
            onTogglePause={togglePauseFeed}
            onMinimize={() => setFeedFocus(false)}
          />
        )}
        {justLogged && (
          <div className="snackbar">
            <span>Feed logged · {fmtMins(justLogged.secs)}</span>
            <button className="btn btn-ghost" style={{ minHeight: 30, fontSize: 13 }} onClick={undoFinish}>Undo</button>
          </div>
        )}
        {dim && <div className="dim-overlay" />}
        {(showAddEntry || editingEntry) && (
          <EntryDialog
            entry={editingEntry}
            now={now}
            u={u}
            defaultBottleKind={family.bottleKind || 'milk'}
            onSave={(e) => {
              if (editingEntry) overwriteEntry(code, editingEntry.id, e)
              else addEntry(code, e)
            }}
            onClose={() => {
              setShowAddEntry(false)
              setEditingEntry(null)
            }}
          />
        )}
        {showSettings && (
          <SettingsDialog
            family={family} code={code}
            onChange={(fields) => updateFamily(code, fields)}
            onClose={() => setShowSettings(false)}
            onSwitchFamily={onSwitchFamily}
            onClearData={() => clearAllData(code)}
          />
        )}
      </div>
    </div>
  )
}
