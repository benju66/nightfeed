import { useState } from 'react'
import { joinFamily } from '../data.js'
import { VITD_DEFAULTS, FEED_ALERT_DEFAULTS, scheduleText } from '../lib/reminders.js'
import { pushSupported, enablePush, disablePush } from '../lib/push.js'

export default function SettingsDialog({ family, code, onChange, onClose, onSwitchFamily, onClearData }) {
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [clearing, setClearing] = useState(false)

  const u = family.units || 'oz'
  const timeFormat = family.timeFormat || '12h'
  const bottleKind = family.bottleKind || 'milk'
  const vitd = { ...VITD_DEFAULTS, ...(family.vitdReminder || {}) }
  const feedAlert = { ...FEED_ALERT_DEFAULTS, ...(family.feedAlert || {}) }
  const reminders = family.reminders || []

  // Add-reminder mini-form
  const [remLabel, setRemLabel] = useState('')
  const [remWho, setRemWho] = useState('baby')
  const [remMode, setRemMode] = useState('interval')
  const [remHours, setRemHours] = useState('4')
  const [remTime, setRemTime] = useState('09:00')
  const [notifyOn, setNotifyOn] = useState(
    () => localStorage.getItem('nightfeed-notify') === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted'
  )
  const [testState, setTestState] = useState('')

  const sendTest = async () => {
    setTestState('sending')
    try {
      const r = await fetch('https://us-central1-nightfeed-al972.cloudfunctions.net/testPush?code=' + encodeURIComponent(code))
      const j = await r.json()
      setTestState(j.sent > 0 ? 'sent' : 'none')
    } catch (e) {
      setTestState('error')
    }
    setTimeout(() => setTestState(''), 5000)
  }

  const addReminder = () => {
    const label = remLabel.trim()
    if (!label) return
    const r = {
      id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      label,
      who: remWho,
      mode: remMode,
      enabled: true,
      lastDone: Date.now(),
    }
    if (remMode === 'daily') r.time = remTime || '09:00'
    else r.hours = Math.max(0.5, parseFloat(remHours) || 4)
    onChange({ reminders: [...reminders, r] })
    setRemLabel('')
  }
  const toggleReminder = (id) => onChange({ reminders: reminders.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) })
  const removeReminder = (id) => onChange({ reminders: reminders.filter((r) => r.id !== id) })

  const toggleNotify = async () => {
    if (notifyOn) {
      localStorage.setItem('nightfeed-notify', '0')
      setNotifyOn(false)
      disablePush(code)
      return
    }
    if (!pushSupported()) return
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return
    try {
      await enablePush(code)
      localStorage.setItem('nightfeed-notify', '1')
      setNotifyOn(true)
    } catch (e) {
      /* subscribe failed — leave toggle off */
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      /* clipboard unavailable — code is selectable by tap */
    }
  }

  const join = async () => {
    const c = joinCode.trim().toUpperCase()
    if (!c || c === code) return
    setJoinError('')
    try {
      if (await joinFamily(c)) onSwitchFamily(c)
      else setJoinError('No family found with that code.')
    } catch (e) {
      setJoinError('Could not reach the server — try again.')
    }
  }

  const clearAll = async () => {
    if (!window.confirm('Delete ALL logged entries and reset timers for this family? This cannot be undone.')) return
    setClearing(true)
    try {
      await onClearData()
    } finally {
      setClearing(false)
    }
  }

  const seg = (name, options, value, set) => (
    <div className="seg" style={{ width: '100%' }}>
      {options.map(([k, label]) => (
        <label key={k} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
          <input type="radio" name={name} checked={value === k} onChange={() => set(k)} />{label}
        </label>
      ))}
    </div>
  )

  return (
    <div className="dialog-backdrop dialog-overlay" onClick={onClose}>
      <div className="dialog elev-lg settings-dialog" onClick={(ev) => ev.stopPropagation()}>
        <div className="dialog-title" style={{ fontSize: 17 }}>Settings</div>
        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="set-kicker">Baby</span>
          <div className="field">
            <label htmlFor="set-name">Baby's name</label>
            <input id="set-name" className="input" type="text" placeholder="e.g. Ava" value={family.babyName || ''} onChange={(ev) => onChange({ babyName: ev.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="set-birth">Born (date &amp; time)</label>
            <input id="set-birth" className="input" type="datetime-local" value={family.birth || ''} onChange={(ev) => onChange({ birth: ev.target.value })} style={{ colorScheme: 'dark' }} />
          </div>
          <div className="hr" />
          <span className="set-kicker">Display</span>
          <div className="field">
            <label>Volume units</label>
            {seg('set-units', [['oz', 'oz'], ['ml', 'ml']], u, (k) => onChange({ units: k }))}
          </div>
          <div className="field">
            <label>Time format</label>
            {seg('set-timefmt', [['12h', '12-hour'], ['24h', '24-hour']], timeFormat, (k) => onChange({ timeFormat: k }))}
          </div>
          <div className="field">
            <label>Default bottle contents</label>
            {seg('set-bkind', [['milk', 'Milk'], ['formula', 'Formula']], bottleKind, (k) => onChange({ bottleKind: k }))}
          </div>

          <div className="hr" />
          <span className="set-kicker">Family</span>
          <div className="field">
            <label>Share with partner — they enter this code when joining</label>
            <div className="code-row">
              <span className="family-code">{code}</span>
              <button className="btn btn-secondary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="set-join">Join a different family</label>
            <div className="code-row">
              <input
                id="set-join" className="input" type="text" placeholder="Family code"
                autoCapitalize="characters" autoComplete="off" spellCheck="false"
                style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
                value={joinCode} onChange={(ev) => setJoinCode(ev.target.value)}
                onKeyDown={(ev) => ev.key === 'Enter' && join()}
              />
              <button className="btn btn-secondary" onClick={join}>Join</button>
            </div>
            {joinError && <p className="pair-error" style={{ marginTop: 5 }}>{joinError}</p>}
          </div>

          <div className="hr" />
          <span className="set-kicker">Reminders</span>
          <div className="field">
            <div className="reminder-settings">
              <div className="reminder-row">
                <button
                  className={'btn rem-toggle' + (feedAlert.enabled ? ' btn-primary' : ' btn-secondary')}
                  onClick={() => onChange({ feedAlert: { ...feedAlert, enabled: !feedAlert.enabled } })}
                >{feedAlert.enabled ? 'On' : 'Off'}</button>
                <span className="reminder-label">Feeding gap alert</span>
                <div className="rem-hours" style={{ flex: 'none', width: 74 }}>
                  <input
                    className="input" type="number" min="0.5" step="0.5" inputMode="decimal"
                    value={feedAlert.hours}
                    onChange={(ev) => onChange({ feedAlert: { ...feedAlert, hours: Math.max(0.5, parseFloat(ev.target.value) || 3) } })}
                  />
                  <span className="unit-label">h</span>
                </div>
              </div>
              <div className="reminder-row">
                <button
                  className={'btn rem-toggle' + (vitd.enabled ? ' btn-primary' : ' btn-secondary')}
                  onClick={() => onChange({ vitdReminder: { ...vitd, enabled: !vitd.enabled } })}
                >{vitd.enabled ? 'On' : 'Off'}</button>
                <span className="reminder-label">Vitamin D</span>
                <input
                  className="input rem-time" type="time" value={vitd.time}
                  onChange={(ev) => onChange({ vitdReminder: { ...vitd, time: ev.target.value || '09:00' } })}
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              {reminders.map((r) => (
                <div key={r.id} className="reminder-row">
                  <button className={'btn rem-toggle' + (r.enabled ? ' btn-primary' : ' btn-secondary')} onClick={() => toggleReminder(r.id)}>
                    {r.enabled ? 'On' : 'Off'}
                  </button>
                  <span className="reminder-label">
                    {r.label}
                    {r.who === 'mom' && <span className="reminder-who"> · mom</span>}
                  </span>
                  <span className="reminder-sched">{scheduleText(r, timeFormat)}</span>
                  <button className="btn btn-icon btn-ghost entry-delete" title="Remove reminder" onClick={() => removeReminder(r.id)}>×</button>
                </div>
              ))}
              <div className="rem-add">
                <input className="input" type="text" placeholder="Medication reminder — e.g. Tylenol" value={remLabel} onChange={(ev) => setRemLabel(ev.target.value)} />
                <div className="rem-add-row">
                  <div className="seg">
                    <label className="seg-opt rem-seg-opt"><input type="radio" name="rem-who" checked={remWho === 'baby'} onChange={() => setRemWho('baby')} />Baby</label>
                    <label className="seg-opt rem-seg-opt"><input type="radio" name="rem-who" checked={remWho === 'mom'} onChange={() => setRemWho('mom')} />Mom</label>
                  </div>
                  <div className="seg">
                    <label className="seg-opt rem-seg-opt"><input type="radio" name="rem-mode" checked={remMode === 'interval'} onChange={() => setRemMode('interval')} />Every</label>
                    <label className="seg-opt rem-seg-opt"><input type="radio" name="rem-mode" checked={remMode === 'daily'} onChange={() => setRemMode('daily')} />Daily at</label>
                  </div>
                  {remMode === 'interval' ? (
                    <div className="rem-hours">
                      <input className="input" type="number" min="0.5" step="0.5" inputMode="decimal" value={remHours} onChange={(ev) => setRemHours(ev.target.value)} />
                      <span className="unit-label">h</span>
                    </div>
                  ) : (
                    <input className="input rem-time" type="time" value={remTime} onChange={(ev) => setRemTime(ev.target.value)} style={{ colorScheme: 'dark' }} />
                  )}
                </div>
                <button className="btn btn-secondary" style={{ width: '100%', minHeight: 32, fontSize: 13 }} onClick={addReminder}>Add reminder</button>
              </div>
              <button className={'btn' + (notifyOn ? ' btn-primary' : ' btn-secondary')} style={{ width: '100%', minHeight: 36 }} onClick={toggleNotify}>
                {notifyOn ? 'Notifications on (this phone)' : 'Enable notifications on this phone'}
              </button>
              {notifyOn && (
                <button className="btn btn-secondary" style={{ width: '100%', minHeight: 32, fontSize: 13 }} disabled={testState === 'sending'} onClick={sendTest}>
                  {testState === 'sending' ? 'Sending…'
                    : testState === 'sent' ? 'Sent — check your status bar'
                    : testState === 'none' ? 'No subscribed phones found'
                    : testState === 'error' ? 'Could not reach the server'
                    : 'Send test notification'}
                </button>
              )}
              <p className="rem-hint">Due reminders show above the Track tab, and phones with notifications on get an alert even when the app is closed.</p>
            </div>
          </div>

          <div className="hr" />
          <span className="set-kicker">Testing</span>
          <div className="field">
            <button className="btn btn-danger" style={{ width: '100%' }} disabled={clearing} onClick={clearAll}>
              {clearing ? 'Clearing…' : 'Clear all data'}
            </button>
          </div>
        </div>
        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
