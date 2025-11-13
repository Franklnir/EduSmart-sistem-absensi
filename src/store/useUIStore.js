import { create } from 'zustand'

export const useUI = create((set) => ({
  loading: false,
  error: null,
  success: null,
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  setSuccess: (s) => set({ success: s }),
  clear: () => set({ error: null, success: null }),
  toasts: [],
  pushToast: (t) => set((s) => ({ toasts: [...s.toasts, { id: crypto.randomUUID(), ...t }] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(x=>x.id!==id) }))
}))
