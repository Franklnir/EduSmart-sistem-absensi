import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

function NavLink({ to, children }) {
  const loc = useLocation()
  const active = loc.pathname === to
  return (
    <Link
      to={to}
      className={
        'px-3 py-2 rounded-xl ' +
        (active ? 'bg-primary text-white' : 'hover:bg-slate-100')
      }
    >
      {children}
    </Link>
  )
}

export default function Navbar() {
  const { profile, settings } = useAuthStore()
  const role = profile?.role

  const avatarUrl =
    profile?.photoURL || profile?.avatar || profile?.foto || ''

  const displayName = profile?.nama ?? profile?.username ?? 'Pengguna'
  const firstInitial = displayName.charAt(0).toUpperCase()
  const schoolName = settings?.namaSekolah || 'EduSmart'

  const homePath =
    role === 'siswa'
      ? '/home'
      : role === 'guru'
      ? '/guru/jadwal'
      : '/admin/kelas'

  return (
    <header className="bg-white sticky top-0 z-40 border-b">
      {/* brand kiri, menu + profil di kanan */}
      <div className="w-full flex items-center justify-between px-4 py-3 gap-4">
        
        {/* KIRI: Logo + Nama Sekolah */}
        <Link
          to={homePath}
          className="font-bold text-primary text-lg flex items-center gap-2.5"
        >
          {settings?.logoUrl && (
            <img
              src={settings.logoUrl}
              alt="Logo Sekolah"
              className="h-8 w-8 object-contain rounded-full"
            />
          )}
          <span>{schoolName}</span>
        </Link>

        {/* KANAN: Header menu + profil bersebelahan */}
        <div className="flex items-center gap-4">
          {/* Menu desktop, tepat di kiri profil */}
          <nav className="hidden md:flex items-center gap-1">
            {role === 'siswa' && (
              <>
                <NavLink to="/home">Home</NavLink>
                <NavLink to="/jadwal">Jadwal</NavLink>
                <NavLink to="/absensi">Absensi</NavLink>
                <NavLink to="/tugas">Tugas</NavLink>
                <NavLink to="/tanya-tugas">Tanya Tugas</NavLink>
                <NavLink to="/edit-profile">Edit Profile</NavLink>
              </>
            )}
            {role === 'guru' && (
              <>
                <NavLink to="/guru/jadwal">Input Jadwal</NavLink>
                <NavLink to="/guru/absensi">Kehadiran</NavLink>
                <NavLink to="/guru/tugas">Tugas</NavLink>
                <NavLink to="/guru/profile">profile</NavLink>
              </>
            )}
            {role === 'admin' && (
              <>
                <NavLink to="/admin/home">Home</NavLink>
                <NavLink to="/admin/kelas">Data Kelas</NavLink>
                <NavLink to="/admin/siswa">Data Siswa</NavLink>
                <NavLink to="/admin/guru">Data Guru</NavLink>
                <NavLink to="/admin/pengaturan">Data Pengaturan</NavLink>
              </>
            )}
          </nav>

          {/* Profil (foto + nama + status) paling kanan */}
          <div className="flex items-center gap-2">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Foto profil"
                className="w-9 h-9 rounded-full object-cover border"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                {firstInitial}
              </div>
            )}

            <div className="text-sm text-right leading-tight">
              <div className="font-semibold uppercase">
                {displayName}
              </div>
              <div className="muted capitalize">{role}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
