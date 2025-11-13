import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase, ref, onValue, get, set, update, push, remove, serverTimestamp } from 'firebase/database'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getDatabase(app)

export const rtdb = getDatabase(app);

export const r = (path) => ref(db, path)
export const rSet = (path, value) => set(r(path), value)
export const rUpdate = (path, value) => update(r(path), value)
export const rPush = (path, value) => push(r(path), value)
export const rGet = async (path) => (await get(r(path))).val()
export const rOn = (path, cb) => onValue(r(path), (snap) => cb(snap.val()))
export const now = () => Date.now()
export const ts = serverTimestamp
