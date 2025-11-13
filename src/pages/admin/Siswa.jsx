import React from 'react'
import { rOn, rSet, rGet } from '../../lib/firebase'

/* ===== Utils ===== */
function initials(name='?'){
  const parts = (name||'').trim().split(/\s+/).slice(0,2)
  return parts.map(p=>p[0]?.toUpperCase()||'').join('')
}
const JK_LABEL = (jk) => {
  if(!jk) return '—'
  const s = String(jk).toLowerCase()
  if(['l','laki','laki-laki','male'].includes(s)) return 'Laki-laki'
  if(['p','perempuan','female'].includes(s)) return 'Perempuan'
  return jk
}
const GRADE_REGEX = /^\s*(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I|\d+)/i
function getGradeRaw(kelasId=''){
  const m = String(kelasId||'').toUpperCase().match(GRADE_REGEX)
  return m ? m[1] : ''
}
// angka → roman (minimal 1..12)
const NUM2ROMAN = { '1':'I','2':'II','3':'III','4':'IV','5':'V','6':'VI','7':'VII','8':'VIII','9':'IX','10':'X','11':'XI','12':'XII' }
function canonGrade(x){
  if(!x) return ''
  const s = String(x).toUpperCase().trim()
  if(/^\d+$/.test(s)) return NUM2ROMAN[s] || s
  return s
}
function getGradeLabel(kelasId=''){ // kanonik
  return canonGrade(getGradeRaw(kelasId))
}
function sameGrade(a, b){
  const ga = getGradeLabel(a)
  const gb = getGradeLabel(b)
  return ga && gb && ga === gb
}
const ANGGOTA_STATUS = ['aktif','nonaktif','alumni']

export default function ASiswa(){
  const [loadingInit, setLoadingInit] = React.useState(true)

  // users
  const [siswaRaw, setSiswaRaw] = React.useState([])
  const [siswa, setSiswa] = React.useState([])

  // kelas
  const [kelasList, setKelasList] = React.useState([])

  // search fields
  const [qNama, setQNama] = React.useState('')
  const [qNIK, setQNIK] = React.useState('')
  const [qKelas, setQKelas] = React.useState('')
  const [isSearching, setIsSearching] = React.useState(false)

  // ===== Detail modal state =====
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailUID, setDetailUID] = React.useState(null)
  const [detailUser, setDetailUser] = React.useState(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  // organisasi & osis
  const [orgAll, setOrgAll] = React.useState([])      // [{id,nama}]
  const [orgMember, setOrgMember] = React.useState([])// [{orgId, orgNama, status, bagian}]
  const [orgEdits, setOrgEdits] = React.useState({})  // {orgId:{status, bagian}}
  const [orgAddSel, setOrgAddSel] = React.useState('')

  const [osisRow, setOsisRow] = React.useState(null)  // {status, bagian} | null
  const [osisEdit, setOsisEdit] = React.useState({ status:'aktif', bagian:'' })

  // pindah kelas (di detail)
  const [moveKelas, setMoveKelas] = React.useState('')
  const [moveGrade, setMoveGrade] = React.useState('') // grade pilihan ketika belum punya kelas

  React.useEffect(()=>{
    const unsubUsers = rOn('users', (val)=>{
      const arr = Object.entries(val || {})
        .map(([uid,u])=>({ uid, ...u }))
        .filter(u=>u.role==='siswa')
        .sort((a,b)=>{
          const ak = (a.kelas||'').localeCompare(b.kelas||'', 'id', {numeric:true})
          if(ak!==0) return ak
          return (a.nama||'').localeCompare(b.nama||'', 'id', {numeric:true})
        })
      setSiswaRaw(arr)
      setSiswa(arr)
      setLoadingInit(false)
    })
    const unsubKelas = rOn('kelas', (val)=>{
      const arr = Object.entries(val||{}).map(([id,v])=>({id, ...(v||{})}))
      arr.sort((a,b)=>a.id.localeCompare(b.id,'id', {numeric:true}))
      setKelasList(arr)
    })
    return ()=>{ unsubUsers && unsubUsers(); unsubKelas && unsubKelas() }
  },[])

  /* ===== Filter ===== */
  function applyFilter(){
    setIsSearching(true)
    setTimeout(()=>{
      const namaNeedle = qNama.trim().toLowerCase()
      const nikNeedle  = qNIK.trim().toLowerCase()
      const kelasNeedle= qKelas.trim().toLowerCase()
      const res = siswaRaw.filter(s=>{
        const okNama = namaNeedle
          ? (String(s.nama||'').toLowerCase().includes(namaNeedle) ||
             String(s.email||'').toLowerCase().includes(namaNeedle))
          : true
        const okNik  = nikNeedle  ? (String(s.nik||'').toLowerCase().includes(nikNeedle))   : true
        const okKls  = kelasNeedle? (String(s.kelas||'').toLowerCase()===kelasNeedle)       : true
        return okNama && okNik && okKls
      })
      setSiswa(res); setIsSearching(false)
    }, 250)
  }
  function resetFilter(){
    setQNama(''); setQNIK(''); setQKelas('')
    setSiswa(siswaRaw)
  }

  /* ===== Grade helpers ===== */
  const DEFAULT_GRADES = ['VII','VIII','IX','X','XI','XII'] // tampilkan semua ini meski belum ada kelas-nya
  const gradeLabels = React.useMemo(()=>{
    const s = new Set(DEFAULT_GRADES)
    for(const k of kelasList){
      const g = getGradeLabel(k.id)
      if(g) s.add(g)
    }
    // urut natural (VII..XII)
    const order = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
    return [...s].sort((a,b)=> order.indexOf(a) - order.indexOf(b))
  }, [kelasList])

  function kelasByGrade(g){
    const G = canonGrade(g)
    if(!G) return []
    return kelasList.filter(k=> getGradeLabel(k.id) === G)
  }

  /* ===== Detail modal ===== */
  async function openDetail(u){
    setDetailUID(u.uid)
    setDetailUser(u)
    setMoveKelas(u.kelas || '')
    setMoveGrade(getGradeLabel(u.kelas || '') || '')
    setDetailLoading(true)
    setDetailOpen(true)

    // organisasi
    const orgSnap = await rGet('organisasi') || {}
    const all = Object.entries(orgSnap).map(([id,o])=>({ id, nama: o?.nama || id, anggota: o?.anggota || {} }))
    const mine = []
    for(const o of all){
      if(o.anggota && o.anggota[u.uid]){
        const a = o.anggota[u.uid]
        mine.push({ orgId:o.id, orgNama:o.nama, status:a.status||'aktif', bagian:a.bagian||'' })
      }
    }
    setOrgAll(all.map(({id,nama})=>({id,nama})))
    setOrgMember(mine)
    setOrgEdits({})
    setOrgAddSel('')

    // osis
    const osisAll = await rGet('osis/anggota') || {}
    const row = osisAll[u.uid] || null
    setOsisRow(row ? { status: row.status || 'aktif', bagian: row.bagian || '' } : null)
    setOsisEdit({ status: row?.status || 'aktif', bagian: row?.bagian || '' })

    setDetailLoading(false)
  }

  // Auto pilih kelas pertama ketika user pilih grade & belum ada kelas
  React.useEffect(()=>{
    if(!detailOpen) return
    const currentGrade = getGradeLabel(detailUser?.kelas||'')
    // hanya auto-pick kalau BELUM punya kelas
    if(currentGrade) return
    if(!moveGrade) return
    const opts = kelasByGrade(moveGrade)
    if(!opts.length) return
    // jangan timpa jika user sudah pilih
    if(!moveKelas) setMoveKelas(opts[0].id)
  }, [detailOpen, moveGrade, kelasList, detailUser, moveKelas])

  /* ===== Detail: actions ===== */
  async function simpanPindahKelas(){
    const user = detailUser
    const target = moveKelas || ''
    if(!user || !target) return

    const currentGrade = getGradeLabel(user.kelas || '') // kanonik
    const targetGrade  = getGradeLabel(target || '')
    const chosenGrade  = moveGrade || currentGrade

    if(currentGrade ? (targetGrade !== currentGrade) : (chosenGrade && targetGrade !== chosenGrade)){
      alert('Hanya boleh pindah ke kelas dalam tingkatan (grade) yang sama.')
      return
    }
    await rSet(`users/${user.uid}/kelas`, target)
    setDetailUser(prev=> prev ? ({ ...prev, kelas: target }) : prev)
  }
  async function kosongkanKelas(){
    const user = detailUser
    if(!user) return
    if(!window.confirm(`Yakin mau dikosongkan kelas untuk ${user.nama || user.email || user.uid}?`)) return
    await rSet(`users/${user.uid}/kelas`, '')
    setMoveKelas('')
    setDetailUser(prev=> prev ? ({ ...prev, kelas: '' }) : prev)
  }
  async function setStatusAkun(newStatus){
    const user = detailUser; if(!user) return
    if(newStatus === 'nonaktif'){
      const alasan = window.prompt('Alasan menonaktifkan? (opsional)','')
      await rSet(`users/${user.uid}/status`, 'nonaktif')
      await rSet(`users/${user.uid}/alasanNonaktif`, alasan || '-')
      await rSet(`users/${user.uid}/disabledAt`, Date.now())
      setDetailUser(prev=> prev ? ({ ...prev, status:'nonaktif', alasanNonaktif: alasan||'-' }) : prev)
    } else {
      await rSet(`users/${user.uid}/status`, 'active')
      await rSet(`users/${user.uid}/alasanNonaktif`, null)
      await rSet(`users/${user.uid}/disabledAt`, null)
      setDetailUser(prev=> prev ? ({ ...prev, status:'active', alasanNonaktif: null }) : prev)
    }
  }

  // Organisasi
  function setOrgEdit(orgId, key, val){
    setOrgEdits(prev=>({ ...prev, [orgId]: { ...(prev[orgId]||{}), [key]: val } }))
  }
  async function simpanOrg(orgId){
    const u = detailUser; if(!u) return
    const curr = orgMember.find(x=>x.orgId===orgId) || { status:'aktif', bagian:'' }
    const patch = orgEdits[orgId] || {}
    const payload = {
      uid: u.uid,
      nama: u.nama || u.displayName || u.email || u.uid,
      kelas: (u.kelas || ''),
      status: patch.status ?? curr.status ?? 'aktif',
      bagian: patch.bagian ?? curr.bagian ?? ''
    }
    await rSet(`organisasi/${orgId}/anggota/${u.uid}`, payload)
    setOrgMember(prev=>{
      const idx = prev.findIndex(x=>x.orgId===orgId)
      const row = { orgId, orgNama: (orgAll.find(o=>o.id===orgId)?.nama || orgId), status: payload.status, bagian: payload.bagian }
      if(idx>=0){ const cp=[...prev]; cp[idx]=row; return cp }
      return [...prev, row]
    })
    setOrgEdits(prev=>{ const cp={...prev}; delete cp[orgId]; return cp })
  }
  async function hapusOrg(orgId){
    const u = detailUser; if(!u) return
    if(!window.confirm('Yakin mau dihapus dari organisasi ini?')) return
    await rSet(`organisasi/${orgId}/anggota/${u.uid}`, null)
    setOrgMember(prev=> prev.filter(x=>x.orgId!==orgId))
    setOrgEdits(prev=>{ const cp={...prev}; delete cp[orgId]; return cp })
  }
  async function tambahKeOrg(){
    const u = detailUser; if(!u || !orgAddSel) return
    await rSet(`organisasi/${orgAddSel}/anggota/${u.uid}`, {
      uid: u.uid, nama: u.nama || u.email || u.uid, kelas: u.kelas || '', status:'aktif', bagian:''
    })
    setOrgMember(prev=>[...prev, {
      orgId: orgAddSel, orgNama: (orgAll.find(o=>o.id===orgAddSel)?.nama || orgAddSel), status:'aktif', bagian:''
    }])
    setOrgAddSel('')
  }

  // OSIS
  async function simpanOsis(){
    const u = detailUser; if(!u) return
    const payload = {
      uid: u.uid, nama: u.nama || u.email || u.uid, kelas: u.kelas || '',
      status: osisEdit.status || 'aktif', bagian: osisEdit.bagian || ''
    }
    await rSet(`osis/anggota/${u.uid}`, payload)
    setOsisRow({ status: payload.status, bagian: payload.bagian })
  }
  async function hapusOsis(){
    const u = detailUser; if(!u) return
    if(!window.confirm('Yakin mau dihapus dari OSIS?')) return
    await rSet(`osis/anggota/${u.uid}`, null)
    setOsisRow(null)
    setOsisEdit({ status:'aktif', bagian:'' })
  }

  /* ===== Render ===== */
  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="card">
        {/* ... (Filter UI tidak berubah) ... */}
        <div className="font-bold mb-2">Kelola Akun Siswa</div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <div className="flex flex-col">
            <label className="text-sm mb-1">Nama / Email</label>
            <input className="input" placeholder="Cari nama atau email" value={qNama} onChange={e=>setQNama(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-sm mb-1">NIK</label>
            <input className="input" placeholder="Cari NIK" value={qNIK} onChange={e=>setQNIK(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-sm mb-1">Kelas</label>
            <select className="input" value={qKelas} onChange={e=>setQKelas(e.target.value)}>
              <option value="">— Semua —</option>
              {kelasList.map(k=><option key={k.id} value={k.id}>{k.id}</option>)}
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

      {/* Tabel Siswa */}
      <div className="card overflow-x-auto">
        {/* ... (Tabel Siswa UI tidak berubah) ... */}
        <div className="font-bold mb-2">Daftar Siswa</div>
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
                <th>Email</th>
                <th>NIK</th>
                <th>Kelas</th>
                <th>JK</th>
                <th>Usia</th>
                <th>Status</th>
                <th className="w-[120px]">Detail</th>
              </tr>
            </thead>
            <tbody>
              {siswa.map(s=>{
                const foto = s.photoURL || s.fotoURL || s.foto || ''
                return (
                  <tr key={s.uid} className="border-t align-middle">
                    <td className="py-2">
                      {foto ? (
                        <img src={foto} alt={s.nama||'foto'} className="w-8 h-8 rounded-full object-cover border" onError={(e)=>{ e.currentTarget.style.display='none' }} />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 border flex items-center justify-center text-[10px] font-semibold">
                          {initials(s.nama)}
                        </div>
                      )}
                    </td>
                    <td>{s.nama || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td>{s.nik || '—'}</td>
                    <td>{s.kelas || '—'}</td>
                    <td>{JK_LABEL(s.jk)}</td>
                    <td>{s.usia || '—'}</td>
                    <td>
                      {s.status==='nonaktif'
                        ? <span className="text-red-600">nonaktif{ s.alasanNonaktif ? ` • ${s.alasanNonaktif}` : ''}</span>
                        : <span className="text-green-600">active</span>}
                    </td>
                    <td>
                      <button className="btn bg-white border" onClick={()=>openDetail(s)}>Detail</button>
                    </td>
                  </tr>
                )
              })}
              {!siswa.length && (
                <tr><td colSpan="9" className="py-3 muted">Tidak ada data siswa yang cocok.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== Modal DETAIL SISWA (scrollable) ===== */}
      {detailOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Sticky Header */}
            <div className="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-lg leading-tight">{detailUser?.nama || detailUser?.email || detailUID}</div>
                <div className="muted text-sm">{detailUser?.email || '—'} • NIK: {detailUser?.nik || '—'}</div>
              </div>
              <button className="btn bg-white border" onClick={()=>setDetailOpen(false)}>Tutup</button>
            </div>

            {/* Scrollable body */}
            <div className="p-4 space-y-4 overflow-y-auto">
              {detailLoading ? (
                <>
                  <div className="skeleton h-10 w-full"></div>
                  <div className="skeleton h-10 w-full"></div>
                  <div className="skeleton h-10 w-full"></div>
                </>
              ) : (
                <>
                  {/* MODIFIKASI: Layout "Kelas & Status Akun" dirombak */}
                  <div className="card">
                    <div className="font-bold mb-2">Kelas & Status Akun</div>

                    {/* BARU: Grid hanya untuk input (Tingkatan & Kelas) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      {/* Tingkatan (dibuat col-span-1) */}
                      <div className="flex flex-col">
                        <label className="text-sm mb-1">Tingkatan</label>
                        {getGradeLabel(detailUser?.kelas||'') ? (
                          <input className="input" value={getGradeLabel(detailUser?.kelas||'')} disabled />
                        ) : (
                          <select
                            className="input"
                            value={moveGrade}
                            onChange={e=>{ setMoveGrade(e.target.value); setMoveKelas('') }}
                          >
                            <option value="">— Pilih tingkatan —</option>
                            {gradeLabels.map(g=> <option key={g} value={g}>{g}</option>)}
                          </select>
                        )}
                      </div>

                      {/* Kelas (dibuat col-span-2 agar lebih lebar) */}
                      <div className="flex flex-col md:col-span-2">
                        <label className="text-sm mb-1">Kelas (se-tingkatan)</label>
                        {(() => {
                          const baseGrade = getGradeLabel(detailUser?.kelas||'') || moveGrade
                          const options = kelasByGrade(baseGrade)
                          const disabled = !baseGrade || options.length===0
                          return (
                            <select
                              className="input"
                              value={moveKelas}
                              onChange={e=>setMoveKelas(e.target.value)}
                              disabled={disabled}
                              title={disabled ? 'Pilih tingkatan dulu atau belum ada kelas pada tingkatan ini' : 'Pilih kelas tujuan dalam tingkatan yang sama'}
                            >
                              {!baseGrade
                                ? <option value="">— Pilih tingkatan dulu —</option>
                                : options.length===0
                                  ? <option value="">— Tidak ada kelas pada tingkatan ini —</option>
                                  : <>
                                      <option value="">— Pilih kelas —</option>
                                      {options.map(k=><option key={k.id} value={k.id}>{k.id}</option>)}
                                    </>
                              }
                            </select>
                          )
                        })()}
                      </div>
                    </div>

                    {/* BARU: Area Aksi (tombol) dipisah di bawah, dengan flex yang responsif */}
                    <div className="mt-4 pt-4 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      {/* Sisi Kiri: Status Akun */}
                      <div className="flex items-center gap-2">
                        {detailUser?.status==='nonaktif'
                          ? <button className="btn btn-success" onClick={()=>setStatusAkun('active')}>Aktifkan</button>
                          : <button className="btn btn-danger" onClick={()=>setStatusAkun('nonaktif')}>Nonaktifkan</button>}
                        <span className="muted text-sm">Status: {detailUser?.status==='nonaktif' ? `nonaktif${detailUser?.alasanNonaktif?` • ${detailUser.alasanNonaktif}`:''}` : 'active'}</span>
                      </div>

                      {/* Sisi Kanan: Aksi Kelas */}
                      <div className="flex md:justify-end gap-2">
                        <button className="btn btn-primary" onClick={simpanPindahKelas} disabled={!moveKelas || moveKelas===detailUser?.kelas}>Simpan Kelas</button>
                        <button className="btn bg-white border" onClick={kosongkanKelas}>Kosongkan</button>
                      </div>
                    </div>
                  </div>
                  {/* AKHIR MODIFIKASI */}


                  {/* Organisasi (Tidak berubah) */}
                  <div className="card">
                    {/* ... (UI Organisasi tidak berubah) ... */}
                    <div className="font-bold mb-2">Organisasi</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                      <div className="flex flex-col md:col-span-2">
                        <label className="text-sm mb-1">Tambah ke Organisasi</label>
                        <select className="input" value={orgAddSel} onChange={e=>setOrgAddSel(e.target.value)}>
                          <option value="">— Pilih organisasi —</option>
                          {orgAll
                            .filter(o=> !orgMember.some(m=>m.orgId===o.id))
                            .map(o=> <option key={o.id} value={o.id}>{o.nama}</option>)}
                        </select>
                      </div>
                      <button className="btn btn-primary" onClick={tambahKeOrg} disabled={!orgAddSel}>Tambah</button>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left">
                          <tr>
                            <th className="py-2">Organisasi</th>
                            <th>Status</th>
                            <th>Bagian/Jabatan</th>
                            <th className="w-40">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orgMember.map(row=>{
                            const ed = orgEdits[row.orgId] || {}
                            return (
                              <tr key={row.orgId} className="border-t">
                                <td className="py-2">{row.orgNama}</td>
                                <td className="py-2">
                                  <select
                                    className="input"
                                    value={ed.status ?? row.status ?? 'aktif'}
                                    onChange={e=>setOrgEdit(row.orgId, 'status', e.target.value)}
                                  >
                                    {ANGGOTA_STATUS.map(s=><option key={s} value={s}>{s}</option>)}
                                  </select>
                                </td>
                                <td className="py-2">
                                  <input
                                    className="input"
                                    placeholder="cth: Anggota / Sekbid Humas"
                                    value={ed.bagian ?? row.bagian ?? ''}
                                    onChange={e=>setOrgEdit(row.orgId, 'bagian', e.target.value)}
                                  />
                                </td>
                                <td className="py-2">
                                  <div className="flex gap-2">
                                    <button className="btn btn-primary" onClick={()=>simpanOrg(row.orgId)}>Simpan</button>
                                    <button className="btn btn-danger" onClick={()=>hapusOrg(row.orgId)}>Hapus</button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                          {!orgMember.length && <tr><td colSpan="4" className="py-3 muted">Belum terdaftar di organisasi.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* OSIS (Tidak berubah) */}
                  <div className="card">
                    {/* ... (UI OSIS tidak berubah) ... */}
                    <div className="font-bold mb-2">OSIS</div>
                    {osisRow ? (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                        <div className="flex flex-col">
                          <label className="text-sm mb-1">Status</label>
                          <select
                            className="input"
                            value={osisEdit.status}
                            onChange={e=>setOsisEdit(ed=>({...ed, status:e.target.value}))}
                          >
                            {ANGGOTA_STATUS.map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col md:col-span-2">
                          <label className="text-sm mb-1">Bagian/Jabatan</label>
                          <input
                            className="input"
                            placeholder="cth: Ketua / Sekretaris / Sekbid"
                            value={osisEdit.bagian}
                            onChange={e=>setOsisEdit(ed=>({...ed, bagian:e.target.value}))}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button className="btn btn-primary" onClick={simpanOsis}>Simpan</button>
                          <button className="btn btn-danger" onClick={hapusOsis}>Hapus</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="muted text-sm">Siswa belum terdaftar di OSIS.</div>
                        <button className="btn btn-primary" onClick={simpanOsis}>Tambah ke OSIS</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}