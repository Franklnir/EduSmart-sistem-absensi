import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import { ProtectedRoute, RoleGate } from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Toast from './components/Toast'

// Auth
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

// Siswa
import SHome from './pages/siswa/Home'
import SJadwal from './pages/siswa/Jadwal'
import SAbsensi from './pages/siswa/Absensi'
import STugas from './pages/siswa/Tugas'
import SEditProfile from './pages/siswa/EditProfile'
import STanyaTugas from './pages/siswa/TanyaTugas' 

// Guru
import GJadwal from './pages/guru/JadwalGuru'
import GAbsensi from './pages/guru/AbsensiGuru'
import GTugas from './pages/guru/TugasGuru'
import Gprofile from './pages/guru/profile'

// Admin
import AHome from './pages/admin/Home'
import AKelas from './pages/admin/Kelas'
import ASiswa from './pages/admin/Siswa'
import AGuru from './pages/admin/Guru'
import Apengaturan from './pages/admin/pengaturan'

function WithNav({ children }){
  const { user } = useAuthStore()
  return (
    <div className="min-h-screen">
      {user && <Navbar />}
      <div className="max-w-6xl mx-auto p-4">{children}</div>
      <Toast />
    </div>
  )
}

export default function App(){
  const initRef = React.useRef(false)
  const { initAuthListener } = useAuthStore()

  React.useEffect(() => {
    if(!initRef.current){
      initAuthListener()
      initRef.current = true
    }
  }, [])

  return (
    <WithNav>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Siswa */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleGate allow={['siswa']} />}>
            <Route path="/home" element={<SHome />} />
            <Route path="/jadwal" element={<SJadwal />} />
            <Route path="/absensi" element={<SAbsensi />} />
            <Route path="/tugas" element={<STugas />} />
            <Route path="/edit-profile" element={<SEditProfile />} />
            <Route path="/tanya-tugas" element={<STanyaTugas />} />  {/* BARU */}
          </Route>

          {/* Guru */}
          <Route element={<RoleGate allow={['guru']} />}>
            <Route path="/guru/jadwal" element={<GJadwal />} />
            <Route path="/guru/absensi" element={<GAbsensi />} />
            <Route path="/guru/tugas" element={<GTugas />} />
            <Route path="/guru/profile" element={<Gprofile />} />
          </Route>

          {/* Admin */}
          <Route element={<RoleGate allow={['admin']} />}>
            <Route path="/admin/home" element={<AHome />} />
            <Route path="/admin/kelas" element={<AKelas />} />
            <Route path="/admin/siswa" element={<ASiswa />} />
            <Route path="/admin/guru" element={<AGuru />} />
            <Route path="/admin/pengaturan" element={<Apengaturan />} />
          </Route>
        </Route>

        <Route path="*" element={<div className="p-8">Halaman tidak ditemukan.</div>} />
      </Routes>
    </WithNav>
  )
}
