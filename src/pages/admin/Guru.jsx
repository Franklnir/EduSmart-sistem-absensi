import React, { useMemo } from 'react'
import { rOn, rSet } from '../../lib/firebase'

/* ===== Helpers ===== */
function initials(name='?'){
  const parts = (name||'').trim().split(/\s+/).slice(0,2)
  return parts.map(p=>p[0]?.toUpperCase()||'').join('')
}
function normToArray(x){
  if(!x) return []
  if(Array.isArray(x)) return x.map(v=>String(v).trim()).filter(Boolean)
  if(typeof x === 'string') return x.split(/[,;|/]+/).map(s=>s.trim()).filter(Boolean)
  if(typeof x === 'object') return Object.keys(x).map(s=>String(s).trim()).filter(Boolean)
  return []
}
function listPreview(arr, max=4){
  const a = Array.isArray(arr) ? arr : normToArray(arr)
  if(!a.length) return {text:'—', title:''}
  const text = a.slice(0,max).join(', ') + (a.length>max ? `, +${a.length-max}` : '')
  const title = a.join(', ')
  return { text, title }
}

export default function AGuru(){
  const [loadingInit, setLoadingInit] = React.useState(true)

  const [guruRaw, setGuruRaw] = React.useState([]) // Data asli dari 'users'
  const [guru, setGuru] = React.useState([])       // Data yang sudah diproses & difilter

  const [jadwalAll, setJadwalAll] = React.useState({})
  const [strukturKelasAll, setStrukturKelasAll] = React.useState({})
  const [strukturSekolah, setStrukturSekolah] = React.useState({})

  // pencarian
  const [qNama, setQNama] = React.useState('')
  const [qMapel, setQMapel] = React.useState('')
  const [qJabatan, setQJabatan] = React.useState('')
  const [isSearching, setIsSearching] = React.useState(false)

  // modal nonaktif
  const [disableUID, setDisableUID] = React.useState(null)
  const [alasanNonaktif, setAlasanNonaktif] = React.useState('')
  
  const [detailModalOpen, setDetailModalOpen] = React.useState(false)
  const [selectedGuru, setSelectedGuru] = React.useState(null)

  React.useEffect(()=>{
    const unsubUsers = rOn('users', (val)=>{
      const arr = Object.entries(val || {})
        .map(([uid,u])=>({ uid, ...u }))
        .filter(u=>u.role==='guru')
        .sort((a,b)=> (a.nama||'').localeCompare(b.nama||'', 'id'))
      setGuruRaw(arr)
      setLoadingInit(false)
    })
    
    const unsubJadwal = rOn('jadwal', (val) => {
      setJadwalAll(val || {})
    })
    
    const unsubStrukturKelas = rOn('kelasStruktur', (val) => {
      setStrukturKelasAll(val || {})
    })
    
    const unsubStrukturSekolah = rOn('strukturSekolah', (val) => {
      setStrukturSekolah(val || {})
    })

    return ()=>{
      unsubUsers && unsubUsers()
      unsubJadwal && unsubJadwal()
      unsubStrukturKelas && unsubStrukturKelas()
      unsubStrukturSekolah && unsubStrukturSekolah()
    }
  }, [])
  
  const guruProcessed = useMemo(() => {
    return guruRaw.map(g => {
      const mapelSet = new Set()
      const kelasSet = new Set()
      const jabatanSet = new Set()

      if (g.jabatan) {
        jabatanSet.add(String(g.jabatan).trim())
      }
      Object.entries(jadwalAll).forEach(([kelasId, jadwalEntries]) => {
        Object.values(jadwalEntries || {}).forEach(j => {
          if (j.guruId === g.uid) {
            if (j.mapel) mapelSet.add(j.mapel)
            kelasSet.add(kelasId)
          }
        })
      })
      Object.entries(strukturKelasAll).forEach(([kelasId, struktur]) => {
        if (struktur?.waliGuruId === g.uid) {
          jabatanSet.add(`Wali Kelas ${kelasId}`)
        }
      })
      Object.values(strukturSekolah || {}).forEach(posisi => {
        if (posisi?.guruId === g.uid) {
          if (posisi.jabatan) jabatanSet.add(posisi.jabatan)
        }
      })
      
      const jabatanList = Array.from(jabatanSet).sort();
      let jabatanUtama = '—';
      const globalJabatan = jabatanList.find(j => !j.startsWith('Wali Kelas'));
      const waliJabatan = jabatanList.find(j => j.startsWith('Wali Kelas'));
      
      if (globalJabatan) {
        jabatanUtama = globalJabatan;
      } else if (waliJabatan) {
        jabatanUtama = waliJabatan;
      } else if (jabatanList.length > 0) {
        jabatanUtama = jabatanList[0]; 
      }
      
      return {
        ...g,
        mapelList: Array.from(mapelSet).sort(),
        kelasList: Array.from(kelasSet).sort(),
        jabatanList: jabatanList,
        jabatanUtama: jabatanUtama
      }
    })
  }, [guruRaw, jadwalAll, strukturKelasAll, strukturSekolah])

  // MODIFIKASI: Memo untuk daftar jabatan unik (untuk dropdown filter)
  const jabatanList = useMemo(() => {
    const jabatanSet = new Set()
    
    // 1. Ambil dari 'strukturSekolah' (cth: Kepala Sekolah, Kesiswaan)
    // Ini mengambil SEMUA jabatan yang terdaftar, walau kosong
    Object.values(strukturSekolah || {}).forEach(posisi => {
      if (posisi?.jabatan) {
        jabatanSet.add(posisi.jabatan)
      }
    })
    
    // 2. Ambil dari 'kelasStruktur' (cth: Wali Kelas XA)
    // Ini mengambil SEMUA kelas yang punya data struktur, walau walinya kosong
    Object.keys(strukturKelasAll || {}).forEach(kelasId => {
      jabatanSet.add(`Wali Kelas ${kelasId}`)
    })

    // 3. Ambil dari data statis guru (fallback, jika ada jabatan yg di-hardcode)
    guruRaw.forEach(g => {
      if (g.jabatan) {
        jabatanSet.add(String(g.jabatan).trim())
      }
    })
    
    return Array.from(jabatanSet).sort()
  // MODIFIKASI: Dependensi diubah ke data sumber
  }, [strukturSekolah, strukturKelasAll, guruRaw])
  
  const allMapelList = useMemo(() => {
    const mapelSet = new Set()
    // Ambil dari SEMUA mapel yang SUDAH DIPROSES
    // (karena mapel hanya ada di 'jadwal', yang sudah diproses 'guruProcessed')
    guruProcessed.forEach(g => {
      g.mapelList.forEach(mapel => mapelSet.add(mapel))
    })
    return Array.from(mapelSet).sort()
  }, [guruProcessed]) // Dependensi ini sudah benar

  // Update state 'guru' ketika data 'guruProcessed' berubah
  React.useEffect(() => {
    setGuru(guruProcessed)
  }, [guruProcessed])

  /* ===== Filter ===== */
  function applyFilter(){
    setIsSearching(true)
    setTimeout(()=>{
      const nama = qNama.trim().toLowerCase()
      const mapel = qMapel.trim()
      const jab  = qJabatan.trim()

      const res = guruProcessed.filter(g=>{
        const namaOk = nama
          ? (String(g.nama||'').toLowerCase().includes(nama) || String(g.email||'').toLowerCase().includes(nama))
          : true
        const mapelOk = mapel
          ? g.mapelList.some(m => m === mapel) 
          : true
        const jabatanOk = jab
          ? g.jabatanList.some(j => j === jab)
          : true
        return namaOk && mapelOk && jabatanOk
      })

      setGuru(res)
      setIsSearching(false)
    }, 200)
  }
  function resetFilter(){
    setQNama(''); setQMapel(''); setQJabatan('')
    setGuru(guruProcessed)
  }

  /* ===== Status ===== */
  function openNonaktif(u){
    setDisableUID(u.uid)
    setAlasanNonaktif('')
  }
  async function simpanNonaktif(){
    if(!disableUID) return
    await rSet(`users/${disableUID}/status`, 'nonaktif')
    await rSet(`users/${disableUID}/alasanNonaktif`, alasanNonaktif || '-')
    await rSet(`users/${disableUID}/disabledAt`, Date.now())
    setDisableUID(null); setAlasanNonaktif('')
  }
  function batalNonaktif(){
    setDisableUID(null); setAlasanNonaktif('')
  }
  async function aktif(u){
    await rSet(`users/${u.uid}/status`, 'active')
    await rSet(`users/${u.uid}/alasanNonaktif`, null)
    await rSet(`users/${u.uid}/disabledAt`, null)
  }
  
  // Fungsi untuk modal detail
  function openDetailModal(guru) {
    setSelectedGuru(guru)
    setDetailModalOpen(true)
  }
  function closeDetailModal() {
    setSelectedGuru(null)
    setDetailModalOpen(false)
  }
  
  // Helper render untuk list di modal
  const renderList = (data, title, emptyText) => {
    const arr = Array.isArray(data) ? data : []
    return (
      <div className="mb-3">
        <h4 className="font-bold text-md mb-1">{title} ({arr.length})</h4>
        {arr.length > 0 ? (
          <ul className="list-disc list-inside pl-1 space-y-1 text-sm">
            {arr.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        ) : (
          <p className="text-sm muted">{emptyText}</p>
        )}
      </div>
    )
  }

  /* ===== Render ===== */
  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="card">
        <div className="font-bold mb-2">Kelola Akun Guru</div>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-end">
          <div className="flex flex-col md:col-span-3">
            <label className="text-sm mb-1">Nama / Email</label>
            <input className="input" placeholder="Cari nama atau email" value={qNama} onChange={e=>setQNama(e.target.value)} />
          </div>
          
          <div className="flex flex-col md:col-span-2">
            <label className="text-sm mb-1">Mata Pelajaran</label>
            <select className="input" value={qMapel} onChange={e=>setQMapel(e.target.value)}>
              <option value="">— Semua Mapel —</option>
              {allMapelList.map(mapel => (
                <option key={mapel} value={mapel}>{mapel}</option>
              ))}
            </select>
          </div>
          
          {/* MODIFIKASI: Dropdown Jabatan sekarang diisi oleh 'jabatanList' yang baru */}
          <div className="flex flex-col md:col-span-2">
            <label className="text-sm mb-1">Jabatan</label>
            <select className="input" value={qJabatan} onChange={e=>setQJabatan(e.target.value)}>
              <option value="">— Semua Jabatan —</option>
              {jabatanList.map(jab => (
                <option key={jab} value={jab}>{jab}</option>
              ))}
            </select>
          </div>
          
          <button className="btn btn-primary flex items-center justify-center gap-2" onClick={applyFilter}>
            {isSearching ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/><path d="M22 12a10 10 0 0 1-10 10" fill="currentColor"/></svg>
                Mencari...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Search
              </>
            )}
          </button>
          <button className="btn bg-white border" onClick={resetFilter}>Reset</button>
        </div>
      </div>

      {/* Tabel Guru (Tidak ada perubahan UI di sini, hanya datanya) */}
      <div className="card overflow-x-auto">
        <div className="font-bold mb-2">Daftar Guru</div>

        {loadingInit ? (
          <>
            <div className="skeleton h-8 w-full mb-2"></div>
            <div className="skeleton h-8 w-full mb-2"></div>
            <div className="skeleton h-8 w-full"></div>
          </>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="py-2">Foto</th>
                <th>Nama</th>
                <th>Jml. Mapel</th>
                <th>Jml. Kelas</th>
                <th>Jabatan Utama</th> 
                <th>Status</th>
                <th className="w-[200px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {guru.map(g=>{
                const foto = g.photoURL || g.fotoURL || g.foto || ''
                
                return (
                  <tr key={g.uid} className="border-t align-middle">
                    <td className="py-2">
                      {foto ? (
                        <img src={foto} alt={g.nama||'foto'} className="w-8 h-8 rounded-full object-cover border" onError={(e)=>{ e.currentTarget.style.display='none' }} />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 border flex items-center justify-center text-[10px] font-semibold">
                          {initials(g.nama)}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="font-medium">{g.nama || '—'}</div>
                      <div className="muted text-xs">{g.email || '—'}</div>
                    </td>
                    <td className="text-center">
                      <span className="px-2 py-1 rounded-full border text-sm">{g.mapelList.length}</span>
                    </td>
                    <td className="text-center">
                      <span className="px-2 py-1 rounded-full border text-sm">{g.kelasList.length}</span>
                    </td>
                    <td>{g.jabatanUtama}</td>
                    <td>
                      {g.status==='nonaktif'
                        ? <span className="text-red-600">nonaktif{ g.alasanNonaktif ? ` • ${g.alasanNonaktif}` : ''}</span>
                        : <span className="text-green-600">active</span>}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn bg-white border" onClick={() => openDetailModal(g)}>Detail</button>
                        {g.status==='nonaktif' ? (
                          <button className="btn btn-success" onClick={()=>aktif(g)}>Aktifkan</button>
                        ) : (
                          <button className="btn btn-danger" onClick={()=>openNonaktif(g)}>Nonaktifkan</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!guru.length && (
                <tr><td colSpan="7" className="py-3 muted">Tidak ada data guru yang cocok.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal alasan nonaktif (Tidak berubah) */}
      {disableUID && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-4 w-full max-w-md shadow-xl">
            <div className="font-bold text-lg mb-2">Nonaktifkan Guru</div>
            <div className="muted text-sm mb-2">Isi keterangan/alasan penonaktifan. Akun akan diblokir di aplikasi (status = nonaktif).</div>
            <textarea
              className="input min-h-[100px]"
              placeholder="Contoh: Cuti panjang s/d 30 Juni..."
              value={alasanNonaktif}
              onChange={e=>setAlasanNonaktif(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button className="btn bg-white border" onClick={batalNonaktif}>Batal</button>
              <button className="btn btn-danger" onClick={simpanNonaktif}>Simpan & Nonaktifkan</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Detail Guru (Tidak berubah) */}
      {detailModalOpen && selectedGuru && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-4 w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg">Detail Guru</h3>
                <p className="text-sm muted">{selectedGuru.nama} ({selectedGuru.email})</p>
              </div>
              <button className="btn bg-white border" onClick={closeDetailModal}>Tutup</button>
            </div>
            
            <div className="overflow-y-auto space-y-4 pt-2 border-t">
              {renderList(
                selectedGuru.mapelList,
                "Mata Pelajaran Diampu",
                "Tidak ada data mata pelajaran."
              )}
              
              {renderList(
                selectedGuru.kelasList,
                "Kelas Diampu",
                "Tidak ada data kelas."
              )}

              {renderList(
                selectedGuru.jabatanList,
                "Semua Jabatan (Riwayat)",
                "Tidak ada data jabatan."
              )}
            </div>
          </div>
        </div>
      )}
      
    </div>
  )
}