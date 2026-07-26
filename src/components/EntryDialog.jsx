import { useState } from 'react'
import { toLocalDT, weightUnitFor, heightUnitFor, tempUnitFor } from '../lib/format.js'

const KINDS = [
  ['feed', 'Feed'], ['bottle', 'Bottle'], ['pump', 'Pump'],
  ['diaper', 'Diaper'], ['sleep', 'Sleep'], ['health', 'Health'], ['note', 'Note'],
]
const HEALTH_TYPES = [
  ['vitd', 'Vit D'], ['weight', 'Weight'], ['height', 'Height'], ['temp', 'Temp'], ['med', 'Med'],
]

// Maps a stored entry onto the dialog's field state.
function fromEntry(e) {
  const mins = (s) => (s ? String(Math.round(s / 60)) : '')
  const base = {
    when: toLocalDT(e.ts),
    note: e.note || '',
    kind: e.kind,
    healthType: 'weight',
    feedSide: 'left',
    pumpSide: 'left',
    diaperType: e.kind === 'diaper' ? e.type : 'wet',
    bottleKind: 'milk',
    mins: '',
    leftMins: '',
    rightMins: '',
    amount: '',
    value: '',
    med: '',
    who: 'baby',
  }
  if (e.kind === 'feed') {
    if (e.type === 'bottle') {
      base.kind = 'bottle'
      base.bottleKind = e.bottleKind || 'milk'
      base.mins = mins(e.secs)
      base.amount = e.amount != null ? String(e.amount) : ''
    } else {
      base.feedSide = e.type
      if (e.type === 'both') {
        base.leftMins = mins(e.leftSecs)
        base.rightMins = mins(e.rightSecs)
      } else base.mins = mins(e.secs)
    }
  } else if (e.kind === 'pump') {
    base.pumpSide = e.type
    base.mins = mins(e.secs)
    base.amount = e.amount != null ? String(e.amount) : ''
  } else if (e.kind === 'sleep') {
    base.mins = mins(e.secs)
  } else if (e.kind === 'health') {
    base.healthType = e.type
    base.value = e.value != null ? String(e.value) : ''
    base.med = e.med || ''
    base.who = e.who || 'baby'
  }
  return base
}

function newDefaults(now) {
  return fromEntry({ kind: 'feed', type: 'left', ts: now })
}

export default function EntryDialog({ entry, now, u, defaultBottleKind, onSave, onClose }) {
  const editing = !!entry
  const [f, setF] = useState(() => (editing ? fromEntry(entry) : { ...newDefaults(now), bottleKind: defaultBottleKind || 'milk' }))
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))
  const setEv = (k) => (ev) => setF((s) => ({ ...s, [k]: ev.target.value }))

  const build = () => {
    const ts = new Date(f.when).getTime()
    if (isNaN(ts)) return null
    const num = (s) => {
      const v = parseFloat(s)
      return isNaN(v) || v < 0 ? null : v
    }
    const secsFromMins = (s) => Math.round((num(s) || 0) * 60)
    const e = { ts }
    const note = f.note.trim()
    if (note) e.note = note

    if (f.kind === 'feed') {
      e.kind = 'feed'
      if (f.feedSide === 'both') {
        const left = secsFromMins(f.leftMins)
        const right = secsFromMins(f.rightMins)
        e.type = left && right ? 'both' : right ? 'right' : 'left'
        if (left) e.leftSecs = left
        if (right) e.rightSecs = right
        e.secs = left + right
      } else {
        e.type = f.feedSide
        e.secs = secsFromMins(f.mins)
      }
      e.end = ts + e.secs * 1000
    } else if (f.kind === 'bottle') {
      e.kind = 'feed'
      e.type = 'bottle'
      e.bottleKind = f.bottleKind
      e.secs = secsFromMins(f.mins)
      e.end = ts + e.secs * 1000
      const amt = num(f.amount)
      if (amt) {
        e.amount = amt
        e.unit = u
      }
    } else if (f.kind === 'pump') {
      e.kind = 'pump'
      e.type = f.pumpSide
      e.secs = secsFromMins(f.mins)
      e.end = ts + e.secs * 1000
      const amt = num(f.amount)
      if (amt) {
        e.amount = amt
        e.unit = u
      }
    } else if (f.kind === 'diaper') {
      e.kind = 'diaper'
      e.type = f.diaperType
    } else if (f.kind === 'sleep') {
      e.kind = 'sleep'
      e.secs = secsFromMins(f.mins)
      e.end = ts + e.secs * 1000
    } else if (f.kind === 'note') {
      if (!note) return null
      e.kind = 'note'
    } else {
      e.kind = 'health'
      e.type = f.healthType
      if (f.healthType === 'med') {
        const m = f.med.trim()
        if (!m) return null
        e.med = m
        if (f.who === 'mom') e.who = 'mom'
      } else if (f.healthType !== 'vitd') {
        const v = num(f.value)
        if (!v) return null
        e.value = v
        if (f.healthType === 'weight') e.wunit = weightUnitFor(u)
        else if (f.healthType === 'height') e.hunit = heightUnitFor(u)
        else e.tunit = tempUnitFor(u)
      }
    }
    return e
  }

  const save = () => {
    const e = build()
    if (!e) return
    onSave(e)
    onClose()
  }

  const seg = (options, value, setVal, compact) => (
    <div className={'seg' + (compact ? ' seg-compact' : '')} style={{ width: '100%' }}>
      {options.map(([k, label]) => (
        <label key={k} className="seg-opt" style={{ flex: 1, justifyContent: 'center', padding: compact ? undefined : '6px 4px' }}>
          <input type="radio" checked={value === k} onChange={() => setVal(k)} />{label}
        </label>
      ))}
    </div>
  )
  const minsField = (label, key) => (
    <div className="field" style={{ flex: 1 }}>
      <label>{label}</label>
      <input className="input" type="number" min="0" inputMode="numeric" placeholder="0" value={f[key]} onChange={setEv(key)} />
    </div>
  )

  return (
    <div className="dialog-backdrop dialog-overlay" onClick={onClose}>
      <div className="dialog elev-lg settings-dialog" onClick={(ev) => ev.stopPropagation()}>
        <div className="dialog-title" style={{ fontSize: 17 }}>{editing ? 'Edit entry' : 'Add entry'}</div>
        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!editing && (
            <div className="field">
              <label>Type</label>
              {seg(KINDS, f.kind, set('kind'), true)}
            </div>
          )}

          {f.kind === 'feed' && (
            <>
              <div className="field">
                <label>Side</label>
                {seg([['left', 'Left'], ['right', 'Right'], ['both', 'Both']], f.feedSide, set('feedSide'))}
              </div>
              {f.feedSide === 'both' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {minsField('Left (min)', 'leftMins')}
                  {minsField('Right (min)', 'rightMins')}
                </div>
              ) : (
                minsField('Duration (min)', 'mins')
              )}
            </>
          )}

          {f.kind === 'bottle' && (
            <>
              <div className="field">
                <label>Contents</label>
                {seg([['milk', 'Milk'], ['formula', 'Formula']], f.bottleKind, set('bottleKind'))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {minsField('Duration (min)', 'mins')}
                <div className="field" style={{ flex: 1 }}>
                  <label>Amount ({u})</label>
                  <input className="input" type="number" min="0" inputMode="decimal" placeholder="—" value={f.amount} onChange={setEv('amount')} />
                </div>
              </div>
            </>
          )}

          {f.kind === 'pump' && (
            <>
              <div className="field">
                <label>Side</label>
                {seg([['left', 'Left'], ['right', 'Right'], ['both', 'Both']], f.pumpSide, set('pumpSide'))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {minsField('Duration (min)', 'mins')}
                <div className="field" style={{ flex: 1 }}>
                  <label>Amount ({u})</label>
                  <input className="input" type="number" min="0" inputMode="decimal" placeholder="—" value={f.amount} onChange={setEv('amount')} />
                </div>
              </div>
            </>
          )}

          {f.kind === 'diaper' && (
            <div className="field">
              <label>Diaper</label>
              {seg([['wet', 'Wet'], ['solid', 'Solid'], ['both', 'Wet + Solid']], f.diaperType, set('diaperType'))}
            </div>
          )}

          {f.kind === 'sleep' && minsField('Duration (min)', 'mins')}

          {f.kind === 'health' && (
            <>
              <div className="field">
                <label>Health</label>
                {seg(HEALTH_TYPES, f.healthType, set('healthType'), true)}
              </div>
              {f.healthType === 'med' && (
                <>
                  <div className="field">
                    <label>Medicine</label>
                    <input className="input" type="text" placeholder="e.g. Tylenol 2.5 ml" value={f.med} onChange={setEv('med')} />
                  </div>
                  <div className="field">
                    <label>For</label>
                    {seg([['baby', 'Baby'], ['mom', 'Mom']], f.who, set('who'))}
                  </div>
                </>
              )}
              {f.healthType !== 'med' && f.healthType !== 'vitd' && (
                <div className="field">
                  <label>
                    {f.healthType === 'weight' ? 'Weight (' + weightUnitFor(u) + ')' : f.healthType === 'height' ? 'Height (' + heightUnitFor(u) + ')' : 'Temp (' + tempUnitFor(u) + ')'}
                  </label>
                  <input className="input" type="number" min="0" inputMode="decimal" value={f.value} onChange={setEv('value')} />
                </div>
              )}
            </>
          )}

          <div className="field">
            <label>{f.kind === 'sleep' ? 'Fell asleep (date & time)' : 'When (date & time)'}</label>
            <input className="input" type="datetime-local" value={f.when} onChange={setEv('when')} style={{ colorScheme: 'dark' }} />
          </div>
          <div className="field">
            <label>Note</label>
            <input className="input" type="text" placeholder={f.kind === 'note' ? 'What do you want to remember?' : 'optional'} value={f.note} onChange={setEv('note')} />
          </div>
        </div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
