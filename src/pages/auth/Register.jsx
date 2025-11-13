import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import { useUI } from '../../store/useUIStore'
import { rOn } from '../../lib/firebase'

// Tentukan role default berdasarkan settings
const getDefaultRole = (settings) => {
  const isSiswaOpen = settings?.registrasiSiswaAktif !== false   // default: true
  const isGuruOpen  = settings?.registrasiGuruAktif  !== false   // default: true
  const isAdminOpen = settings?.registrasiAdminAktif === true    // default: false

  if (isSiswaOpen) return 'siswa'
  if (isGuruOpen)  return 'guru'
  if (isAdminOpen) return 'admin'
  return '' // semua ditutup
}

export default function Register(){
  const { register, settings } = useAuthStore()
  const { loading } = useUI()
  const nav = useNavigate()

  // role mengikuti settings
  const [role, setRole] = useState(() => getDefaultRole(settings))

  // form umum
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  // profil per-role
  const [siswa, setSiswa] = useState({ nik:'', kelas:'', nama:'', jk:'', usia:'' })
  const [guru, setGuru]   = useState({ nama:'', jk:'', agama:'', jabatan:'' })
  const [adm, setAdm]     = useState({ username:'', telp:'', alamat:'' })

  // data kelas (untuk siswa)
  const [kelasList, setKelasList] = useState([])
  const [isLoadingKelas, setIsLoadingKelas] = useState(false)

  /* ====== Hitung status buka/tutup dari settings ====== */
  const isSiswaOpen = settings?.registrasiSiswaAktif !== false   // undefined => dianggap buka
  const isGuruOpen  = settings?.registrasiGuruAktif  !== false
  const isAdminOpen = settings?.registrasiAdminAktif === true    // harus explicit true

  const allClosed = !isSiswaOpen && !isGuruOpen && !isAdminOpen

  // apakah role yang sekarang boleh daftar?
  const canRegisterCurrentRole =
    role === 'siswa' ? isSiswaOpen :
    role === 'guru'  ? isGuruOpen  :
    role === 'admin' ? isAdminOpen :
    false

  /* ====== Sinkronkan role kalau settings berubah ====== */
  useEffect(() => {
    if (!settings) return

    setRole(prev => {
      const current = prev || ''

      // kalau role sekarang ditutup, pindah ke role lain yang masih buka
      if (current === 'siswa' && !isSiswaOpen) {
        if (isGuruOpen)  return 'guru'
        if (isAdminOpen) return 'admin'
        return ''
      }
      if (current === 'guru' && !isGuruOpen) {
        if (isSiswaOpen) return 'siswa'
        if (isAdminOpen) return 'admin'
        return ''
      }
      if (current === 'admin' && !isAdminOpen) {
        if (isSiswaOpen) return 'siswa'
        if (isGuruOpen)  return 'guru'
        return ''
      }

      // kalau belum ada role, pilih default
      if (!current) return getDefaultRole(settings)

      return current
    })
  }, [settings, isSiswaOpen, isGuruOpen, isAdminOpen])

  /* ====== Listener daftar kelas kalau role siswa ====== */
  useEffect(() => {
    let unsub = () => {}
    if (role === 'siswa') {
      setIsLoadingKelas(true)
      setKelasList([])

      unsub = rOn('kelas', (val) => {
        if (val) {
          setKelasList(Object.keys(val).sort())
        } else {
          setKelasList([])
        }
        setIsLoadingKelas(false)
      })
    } else {
      setKelasList([])
      setIsLoadingKelas(false)
    }
    return () => unsub && unsub()
  }, [role])

  /* ====== Submit ====== */
  async function onSubmit(e){
    e.preventDefault()

    // blok kalau role ditutup
    if (!canRegisterCurrentRole) {
      alert('Pendaftaran untuk role ini sedang ditutup oleh Admin.')
      return
    }

    if(password !== confirm) {
      return alert('Konfirmasi password tidak cocok')
    }

    if(role === 'siswa' && !siswa.kelas) {
      return alert('Silakan pilih kelas Anda.')
    }

    let profile = {}
    if(role==='siswa') profile = siswa
    if(role==='guru')  profile = guru
    if(role==='admin') profile = adm

    try{
      await register({ email, password, role, profile })
      nav('/login')
    }catch(err){
      console.error(err)
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 mb-12 card">
      {/* Logo kalau ada di settings */}
      {settings?.logoUrl && (
        <img
          src={settings.logoUrl}
          alt="Logo Sekolah"
          className="h-20 w-20 object-contain mx-auto mb-4 rounded-full"
        />
      )}

      <h1 className="text-2xl font-bold mb-4 text-center">Daftar Akun</h1>

      {/* Pilihan role */}
      <div className="mb-4 flex items-center gap-2">
        <label className="label">Saya ingin mendaftar sebagai:</label>
        <select
          className="input max-w-xs"
          value={role}
          onChange={e=>setRole(e.target.value)}
          disabled={allClosed}
        >
          {isSiswaOpen && <option value="siswa">Siswa</option>}
          {isGuruOpen  && <option value="guru">Guru</option>}
          {isAdminOpen && <option value="admin">Admin</option>}
          {allClosed && <option value="">(Semua pendaftaran ditutup)</option>}
        </select>
      </div>

      {/* Info kalau semua ditutup */}
      {allClosed && (
        <div className="p-3 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-200 text-sm mb-4">
          Pendaftaran akun baru saat ini <b>ditutup</b> oleh Admin.
        </div>
      )}

      {/* Info kalau role sekarang ditutup */}
      {!allClosed && !canRegisterCurrentRole && (
        <div className="p-3 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-200 text-sm mb-4">
          Pendaftaran untuk role <b>{role}</b> sedang dinonaktifkan. Silakan pilih role lain.
        </div>
      )}

      <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-x-4 gap-y-2">
        {/* Email selalu ada */}
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
            type="email"
          />
        </div>

        {/* =========== FORM SISWA =========== */}
        {role==='siswa' && (
          <>
            <div>
              <label className="label">NIK</label>
              <input
                className="input"
                value={siswa.nik}
                onChange={e=>setSiswa({...siswa, nik:e.target.value})}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                required
                type="password"
              />
            </div>
            <div>
              <label className="label">Nama</label>
              <input
                className="input"
                value={siswa.nama}
                onChange={e=>setSiswa({...siswa, nama:e.target.value})}
                required
              />
            </div>
            <div>
              <label className="label">Konfirmasi Password</label>
              <input
                className="input"
                value={confirm}
                onChange={e=>setConfirm(e.target.value)}
                required
                type="password"
              />
            </div>
            <div>
              <label className="label">Kelas</label>
              <select
                className="input"
                value={siswa.kelas}
                onChange={e=>setSiswa({...siswa, kelas:e.target.value})}
                required
                disabled={isLoadingKelas}
              >
                <option value="">— Pilih Kelas —</option>
                {isLoadingKelas && <option disabled>Memuat...</option>}
                {!isLoadingKelas && kelasList.length === 0 && (
                  <option disabled>Belum ada kelas.</option>
                )}
                {!isLoadingKelas && kelasList.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Jenis Kelamin</label>
              <select
                className="input"
                value={siswa.jk}
                onChange={e=>setSiswa({...siswa, jk:e.target.value})}
              >
                <option value="">Pilih</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="label">Usia</label>
              <input
                className="input"
                type="number"
                value={siswa.usia}
                onChange={e=>setSiswa({...siswa, usia:e.target.value})}
              />
            </div>
          </>
        )}

        {/* =========== FORM GURU =========== */}
        {role==='guru' && (
          <>
            <div>
              <label className="label">Nama Guru</label>
              <input
                className="input"
                value={guru.nama}
                onChange={e=>setGuru({...guru, nama:e.target.value})}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                required
                type="password"
              />
            </div>
            <div>
              <label className="label">Jenis Kelamin</label>
              <select
                className="input"
                value={guru.jk}
                onChange={e=>setGuru({...guru, jk:e.target.value})}
              >
                <option value="">Pilih</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="label">Konfirmasi Password</label>
              <input
                className="input"
                value={confirm}
                onChange={e=>setConfirm(e.target.value)}
                required
                type="password"
              />
            </div>
            <div>
              <label className="label">Agama</label>
              <input
                className="input"
                value={guru.agama}
                onChange={e=>setGuru({...guru, agama:e.target.value})}
              />
            </div>
            <div>
              <label className="label">Jabatan (diisi admin)</label>
              <input
                className="input"
                value={guru.jabatan}
                onChange={e=>setGuru({...guru, jabatan:e.target.value})}
                readOnly
                placeholder="Akan diisi oleh Admin"
              />
            </div>
          </>
        )}

        {/* =========== FORM ADMIN =========== */}
        {role==='admin' && (
          <>
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                value={adm.username}
                onChange={e=>setAdm({...adm, username:e.target.value})}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                required
                type="password"
              />
            </div>
            <div>
              <label className="label">Nomor Telepon</label>
              <input
                className="input"
                value={adm.telp}
                onChange={e=>setAdm({...adm, telp:e.target.value})}
              />
            </div>
            <div>
              <label className="label">Konfirmasi Password</label>
              <input
                className="input"
                value={confirm}
                onChange={e=>setConfirm(e.target.value)}
                required
                type="password"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Alamat</label>
              <input
                className="input"
                value={adm.alamat}
                onChange={e=>setAdm({...adm, alamat:e.target.value})}
              />
            </div>
          </>
        )}

        {/* Tombol Submit */}
        <div className="md:col-span-2 mt-4">
          <button
            className="btn btn-primary w-full"
            disabled={loading || !canRegisterCurrentRole || allClosed}
          >
            {loading
              ? 'Memuat...'
              : allClosed
                ? 'Pendaftaran Ditutup'
                : !canRegisterCurrentRole
                  ? 'Role Ini Ditutup'
                  : 'Daftar'}
          </button>
          <div className="mt-3 text-sm text-center">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-primary">Masuk</Link>
          </div>
        </div>
      </form>
    </div>
  )
}
