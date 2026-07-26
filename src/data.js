import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase.js'

const CODE_KEY = 'nightfeed-family'
// No ambiguous chars (0/O, 1/I/L) — the code gets read aloud between phones.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const savedFamilyCode = () => localStorage.getItem(CODE_KEY) || ''
export const saveFamilyCode = (code) => localStorage.setItem(CODE_KEY, code)
export const forgetFamilyCode = () => localStorage.removeItem(CODE_KEY)

export const familyRef = (code) => doc(db, 'families', code)
export const entriesRef = (code) => collection(db, 'families', code, 'entries')

export const FAMILY_DEFAULTS = {
  babyName: '',
  birth: '',
  units: 'oz',
  timeFormat: '12h',
  bottleKind: 'milk',
  feedAlert: { enabled: false, hours: 3 },
  activeFeed: null,
  activePump: null,
  sleepStart: null,
}

export async function createFamily() {
  let code = ''
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  await setDoc(familyRef(code), { ...FAMILY_DEFAULTS, createdAt: Date.now() })
  return code
}

export async function joinFamily(code) {
  const snap = await getDoc(familyRef(code))
  return snap.exists()
}

export function watchFamily(code, cb) {
  return onSnapshot(familyRef(code), (snap) => cb(snap.exists() ? snap.data() : null))
}

export function watchEntries(code, cb) {
  const q = query(entriesRef(code), orderBy('ts', 'desc'), limit(1000))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

export function updateFamily(code, fields) {
  return updateDoc(familyRef(code), fields)
}

export function addEntry(code, entry) {
  const ref = doc(entriesRef(code)) // client-generated id so offline writes work
  setDoc(ref, entry)
  return ref.id
}

// Full replace: the editor rebuilds the entry, so dropped fields (e.g. a
// cleared note) disappear rather than lingering.
export function overwriteEntry(code, id, entry) {
  return setDoc(doc(entriesRef(code), id), entry)
}

export function deleteEntry(code, id) {
  return deleteDoc(doc(entriesRef(code), id))
}

// Testing helper: wipe every entry and reset any running timers.
export async function clearAllData(code) {
  const snap = await getDocs(entriesRef(code))
  const docs = snap.docs
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db)
    docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  await updateDoc(familyRef(code), { activeFeed: null, activePump: null, sleepStart: null })
}
