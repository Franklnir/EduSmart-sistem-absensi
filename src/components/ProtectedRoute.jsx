import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

export function ProtectedRoute(){
  const { user, loading } = useAuthStore()
  if(loading) return <div className="p-8">Memuat...</div>
  if(!user) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RoleGate({ allow=[] }){
  const { profile, loading } = useAuthStore()
  if(loading) return <div className="p-8">Memuat...</div>
  if(!profile) return null
  if(!allow.includes(profile.role)) return <div className="p-8">Akses ditolak.</div>
  return <Outlet />
}
