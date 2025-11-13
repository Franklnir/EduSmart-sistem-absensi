import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import { useUI } from '../../store/useUIStore'

export default function Login(){
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  
  // 1. Ambil 'login' dan 'settings' dari store
  const { login, settings } = useAuthStore() 
  const { loading } = useUI()
  const nav = useNavigate()

  async function onSubmit(e){
    e.preventDefault()
    try{
      await login(email, password)
      setTimeout(()=>{
        const role = useAuthStore.getState().profile?.role
        if(role==='siswa') nav('/home')
        else if(role==='guru') nav('/guru/jadwal')
        else nav('/admin/kelas')
      }, 300)
    }catch{}
  }

  return (
    <div className="max-w-md mx-auto mt-16 card">
      
      {/* --- 2. TAMBAHKAN LOGO DISINI --- */}
      {settings?.logoUrl && (
        <img 
          src={settings.logoUrl} 
          alt="Logo Sekolah" 
          // Logo bulat, ukuran 20, margin-bottom, dan di tengah
          className="h-20 w-20 object-contain mx-auto mb-4 rounded-full" 
        />
      )}
      {/* --- SELESAI PENAMBAHAN LOGO --- */}

      {/* 3. Tambahkan 'text-center' agar judul juga di tengah */}
      <h1 className="text-2xl font-bold mb-4 text-center">Masuk</h1> 
      
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">Email</label>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} required type="email" />
        </div>
        <div>
          <label className="label">Kata Sandi</label>
          <input className="input" value={password} onChange={e=>setPassword(e.target.value)} required type="password" />
        </div>
        <button className="btn btn-primary w-full" disabled={loading}>
          {loading? 'Memuat...' : 'Masuk'}
        </button>
      </form>
      <div className="mt-4 text-center text-sm">
        Belum punya akun? <Link to="/register" className="text-primary">Daftar</Link>
      </div>
    </div>
  )
}