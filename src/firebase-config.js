// Firebase web app config for the production project (nightfeed-al972).
// A "demo-" projectId would route everything to the local Firestore emulator
// instead — handy for development: run `npm run emulators` and swap projectId
// to "demo-nightfeed".
export const firebaseConfig = {
  apiKey: 'AIzaSyCxua3Lyi8woL3MitD34G4Q-TEpR1Goa4I',
  authDomain: 'nightfeed-al972.firebaseapp.com',
  projectId: 'nightfeed-al972',
  storageBucket: 'nightfeed-al972.firebasestorage.app',
  messagingSenderId: '787756951741',
  appId: '1:787756951741:web:0a92c749f1b04fe5e9efd4',
}

export const USE_EMULATOR = firebaseConfig.projectId.startsWith('demo-')
