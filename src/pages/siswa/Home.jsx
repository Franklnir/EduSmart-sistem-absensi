import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { rOn, rGet, rSet } from '../../lib/firebase'
import Badge from '../../components/Badge'
import { todayKey } from '../../lib/time'
import { useUI } from '../../store/useUIStore'

// BARU: Helper untuk merender link (dari TugasGuru.jsx)
const renderLink = (url, text) => {
  if (!url) return null;
  try {
    if (/\.(jpeg|jpg|gif|png|webp)$/i.test(url)) {
      return <img src={url} alt="lampiran" className="max-w-xs max-h-40 rounded-lg mt-2" />
    }
    return <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-sm bg-blue-100 text-blue-700 mt-2">{text}</a>
  } catch (e) { return null }
}

export default function SHome(){
  const { profile, user } = useAuthStore()
  const [ringkas, setRingkas] = React.useState({ H:0, I:0, A:0 })
  const [statusUser, setStatusUser] = React.useState('-')
  const [tugas, setTugas] = React.useState([])
  
  // MODIFIKASI: State 'ex' (ekskul) diubah
  const [exkul, setExkul] = React.useState([]) // Daftar semua eskul
  const [myExkul, setMyExkul] = React.useState({}) // Daftar eskul yang diikuti user

  // BARU: State untuk pengumuman
  const [pengumuman, setPengumuman] = React.useState([])
  
  const { pushToast } = useUI()

  React.useEffect(() => {
    if(!profile?.kelas || !user?.uid) return
    
    const tgl = todayKey()
    
    // 1. BARU: Listener untuk Pengumuman
    const unsubPengumuman = rOn('pengumuman', (val) => {
      const arr = Object.values(val || {})
      // Filter hanya untuk "semua" atau "siswa"
      const filtered = arr.filter(p => p.target === 'semua' || p.target === 'siswa')
      setPengumuman(filtered.sort((a,b) => b.createdAt - a.createdAt)) // Terbaru di atas
    })
    
    // 2. Listener untuk Ringkasan Absensi Kelas
    const unsubAbsensi = rOn(`absensi/${profile.kelas}/${tgl}`, (val) => {
      const agg = { H:0, I:0, A:0 }
      if(val){
        Object.values(val).forEach(v=>{
          if(v.status==='H') agg.H++
          if(v.status==='I') agg.I++
          if(v.status==='A') agg.A++
        })
      }
      setRingkas(agg)
      setStatusUser(val?.[user.uid]?.status ?? '-')
    })
    
    // 3. Listener untuk Tugas
    const unsubTugas = rOn(`tugas/${profile.kelas}`, (val) => {
      const arr = Object.entries(val || {}).map(([id, v])=>({ id, ...v }))
      const now = Date.now()
      setTugas(arr.filter(t => (new Date(t.deadline).getTime()) >= now).slice(0,5))
    })
    
    // 4. MODIFIKASI: Listener untuk Ekskul (data & jumlah anggota)
    const unsubEkskul = rOn(`ekskul`, (val) => {
      const arr = Object.entries(val || {}).map(([id,v])=>({ 
        id, 
        ...v,
        // BARU: Hitung jumlah anggota
        jumlahAnggota: v.anggota ? Object.keys(v.anggota).length : 0
      }))
      setExkul(arr)
    })
    
    // 5. BARU: Listener untuk daftar ekskul yang SAYA ikuti
    const unsubMyEkskul = rOn(`users/${user.uid}/ekskul`, (val) => {
      setMyExkul(val || {})
    })

    return () => {
      unsubPengumuman()
      unsubAbsensi()
      unsubTugas()
      unsubEkskul()
      unsubMyEkskul()
    }
  }, [profile?.kelas, user?.uid]) // MODIFIKASI: Tambah user.uid

  // MODIFIKASI: Logika toggleEkskul disederhanakan
  async function toggleEkskul(item){
    const joined = !!myExkul[item.id]
    
    // Cek limit HANYA jika mau bergabung (bukan batal)
    if (!joined) {
      const active = Object.keys(myExkul).filter(k => myExkul[k]).length
      if (active >= 3) return pushToast({ title: "Maksimal 3 ekskul aktif" })
    }
    
    // Hapus (null) jika sudah bergabung, set (true) jika belum
    await rSet(`users/${user.uid}/ekskul/${item.id}`, joined ? null : true)
    
    // BARU: Update jumlah anggota di data ekskul secara real-time
    const currentAnggota = await rGet(`ekskul/${item.id}/anggota`) || {}
    if (joined) {
      delete currentAnggota[user.uid] // Hapus
    } else {
      currentAnggota[user.uid] = true // Tambah
    }
    await rSet(`ekskul/${item.id}/anggota`, currentAnggota)
    
    pushToast({ title: joined ? 'Berhasil membatalkan' : 'Berhasil bergabung!' })
  }

  return (
    <div className="space-y-6">
      
      {/* --- BARU: Card Pengumuman --- */}
      <div className="card">
        <div className="font-bold mb-2">Pengumuman Terbaru</div>
        <div className="space-y-3">
          {pengumuman.map(p => (
            <div key={p.id} className="border-b pb-3">
              <div className="flex justify-between items-center">
                <div className="font-semibold">{p.judul}</div>
                <div className="text-xs muted">{new Date(p.createdAt).toLocaleDateString('id-ID')}</div>
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap">{p.keterangan}</p>
            </div>
          ))}
          {!pengumuman.length && <div className="muted">Tidak ada pengumuman baru.</div>}
        </div>
      </div>
      
      {/* --- Card Absensi --- */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Ringkasan Absensi Kelas (Live)</h2>
            <Badge variant="live">Live</Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="card"><div className="muted">Hadir</div><div className="text-2xl text-hadir font-bold">{ringkas.H}</div></div>
            <div className="card"><div className="muted">Izin</div><div className="text-2xl text-izin font-bold">{ringkas.I}</div></div>
            <div className="card"><div className="muted">Alpha</div><div className="text-2xl text-alpha font-bold">{ringkas.A}</div></div>
          </div>
        </div>
        <div className="card">
          <div className="font-bold">Status Absensi Anda</div>
          <div className="text-3xl mt-2">{statusUser}</div>
        </div>
      </div>

      {/* --- Card Tugas --- */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="font-bold">Tugas Akan Datang</div>
        </div>
        <div className="mt-3 grid md:grid-cols-2 gap-2">
          {tugas.map(t => (
            <div key={t.id} className="border rounded-xl p-3">
              <div className="font-medium">{t.judul}</div>
              <div className="muted">{t.mapel} • deadline {new Date(t.deadline).toLocaleString('id-ID')}</div>
              {/* MODIFIKASI: Tampilkan keterangan & lampiran */}
              <p className="text-sm my-2 whitespace-pre-wrap truncate">{t.keterangan || '(Tanpa keterangan)'}</p>
              <div className='flex flex-wrap gap-2'>
                {renderLink(t.fileURL, "Lihat File/Foto")}
                {renderLink(t.link, "Buka Link Eksternal")}
              </div>
            </div>
          ))}
          {!tugas.length && <div className="muted">Tidak ada tugas baru.</div>}
        </div>
      </div>

      {/* --- Card Ekskul --- */}
      <div className="card">
        <div className="font-bold mb-2">Ekskul</div>
        <div className="grid md:grid-cols-3 gap-3">
          {exkul.map(x => {
            // Cek apakah siswa sudah join
            const isJoined = !!myExkul[x.id]
            return (
              <div key={x.id} className="border rounded-xl p-3">
                <div className="font-semibold">{x.nama}</div>
                {/* MODIFIKASI: Tampilkan data dari eskul */}
                <div className="muted text-sm">Pembina: {x.pembinaGuruNama || '—'}</div>
                <div className="muted text-sm">Jadwal: {x.hari || 'TBA'} / {x.jamMulai || 'TBA'} - {x.jamSelesai || 'TBA'}</div>
                <div className="muted text-sm">{x.jumlahAnggota} siswa mengikuti</div>
                <button 
                  onClick={()=>toggleEkskul(x)} 
                  // MODIFIKASI: Ubah style & teks tombol
                  className={`btn mt-2 ${isJoined ? 'btn-danger' : 'btn-primary'}`}
                >
                  {isJoined ? 'Batalkan' : 'Ikuti'}
                </button>
              </div>
            )
          })}
          {!exkul.length && <div className="muted">Belum ada data ekskul.</div>}
        </div>
      </div>
    </div>
  )
}