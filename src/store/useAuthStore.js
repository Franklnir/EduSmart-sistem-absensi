import { create } from 'zustand'
import { auth, rGet, rSet } from '../lib/firebase' 
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { useUI } from './useUIStore'

const DEFAULT_ROLE = 'siswa'
const ALLOW_ADMIN_SELF_REGISTER = true 
const SETTINGS_PATH = 'pengaturan' // Path pengaturan Anda

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  settings: {}, // State awal
  loading: true,

  async initAuthListener(){
    // --- MODIFIKASI DIMULAI ---
    // 1. Ambil settings global terlebih dahulu, di luar auth listener
    let settings = {}
    try {
      settings = await rGet(SETTINGS_PATH) || {}
    } catch (err) {
      console.error("Gagal memuat settings global:", err)
    }
    // Set settings ke state
    set({ settings }) 
    // --- MODIFIKASI SELESAI ---

    onAuthStateChanged(auth, async (user) => {
      if(user){
        // 2. Jika user login, baru ambil profile-nya
        try {
          const profile = await rGet(`users/${user.uid}`)
          // Set user & profile, loading selesai
          set({ user, profile, loading: false }) 
        } catch (err) {
          console.error("Gagal memuat profile:", err)
          set({ user: null, profile: null, loading: false }) 
          await signOut(auth)
        }
      } else {
        // 3. Jika tidak ada user, set user/profile null, loading selesai
        set({ user: null, profile: null, loading: false })
      }
    })
  },

  // (Fungsi login, logout, register Anda tidak berubah)
  async login(email, password){
    const ui = useUI.getState()
    try{
      ui.setLoading(true)
      await signInWithEmailAndPassword(auth, email, password)
      ui.pushToast({ title: "Berhasil masuk" })
    }catch(e){
      ui.pushToast({ title: "Email atau kata sandi salah.", desc: e.message })
      throw e
    }finally{
      ui.setLoading(false)
    }
  },

  async logout(){
    await signOut(auth)
  },

  async register(payload){
    const { email, password, role = DEFAULT_ROLE, profile } = payload
    const ui = useUI.getState()
    if(role === 'admin' && !ALLOW_ADMIN_SELF_REGISTER){
      ui.pushToast({ title: "Pendaftaran admin dibatasi", desc: "Hubungi admin super/developer." })
      throw new Error("Admin self-register disabled")
    }
    try{
      ui.setLoading(true)
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      const uid = cred.user.uid
      await rSet(`users/${uid}`, {
        uid,
        email,
        role,
        ...profile,
        createdAt: Date.now(),
        status: 'active'
      })
      ui.pushToast({ title: "Registrasi berhasil", desc: "Silakan login." })
      await signOut(auth)
      return uid
    }catch(e){
      ui.pushToast({ title: "Registrasi gagal", desc: e.message })
      throw e
    }finally{
      ui.setLoading(false)
    }
  }
}))