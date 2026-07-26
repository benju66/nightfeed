import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore'
import { firebaseConfig, USE_EMULATOR } from './firebase-config.js'

const app = initializeApp(firebaseConfig)

// Offline persistence: writes queue locally and sync when back online; the
// multi-tab manager lets several open tabs share one cache.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (USE_EMULATOR) {
  connectFirestoreEmulator(db, location.hostname, 8080)
}
