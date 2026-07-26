// Web-push subscription management. Each phone that opts in stores its push
// subscription under families/{code}/pushSubs/{deviceId}; the Cloud Function
// sends due-reminder notifications to every stored subscription.
import { doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

export const VAPID_PUBLIC_KEY = 'BDcPBYTNUMTrOiFbbNiqmoOHco2z-mWH1d49oi9CWPUVPFBOdRs2Jn0jkAwvlSxFDtIYmOJwsqaav6C2b2z4gMM'

const DEVICE_KEY = 'nightfeed-push-device'

function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'
}

export async function enablePush(code) {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
  await setDoc(doc(db, 'families', code, 'pushSubs', deviceId()), {
    sub: sub.toJSON(),
    ua: navigator.userAgent.slice(0, 120),
    updated: Date.now(),
  })
}

export async function disablePush(code) {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
  } catch (e) {
    /* best effort */
  }
  await deleteDoc(doc(db, 'families', code, 'pushSubs', deviceId()))
}
