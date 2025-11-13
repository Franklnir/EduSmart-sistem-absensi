import React from 'react'
import { rOn, rSet, rGet } from '../../lib/firebase'

/* ===== Utils ===== */
const HARI_OPTS  = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const GRADE_OPTS = ['VII','VIII','IX','X','XI','XII']
const GRADE_ORDER = Object.fromEntries(GRADE_OPTS.map((g,i)=>[g,i]))
const FORBIDDEN = /[.#$/[\]]/
const slug = (s='') => s.toString().trim().toLowerCase()
  .replace(/[^\w\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,80)

const toMinutes = (hhmm) => {
  if(!hhmm) return NaN
  const [h,m] = hhmm.split(':').map(Number)
  return (h*60)+(m||0)
}
const timesOverlap = (aStart,aEnd,bStart,bEnd) => {
  const as=toMinutes(aStart), ae=toMinutes(aEnd)
  const bs=toMinutes(bStart), be=toMinutes(bEnd)
  if([as,ae,bs,be].some(Number.isNaN)) return false
  return as<be && bs<ae
}

const GRADE_REGEX = /^\s*(VII|VIII|IX|X|XI|XII)\b/i
const parseGrade = (name='') => {
  const m = String(name||'').toUpperCase().match(GRADE_REGEX)
  return m ? m[1] : ''
}
const stripGradePrefix = (name='') => {
  const g = parseGrade(name)
  if(!g) return name.trim()
  return name.toUpperCase().startsWith(g) ? name.slice(g.length).trim() : name.trim()
}
const makeClassName = (grade, suffix) => (grade + (suffix ? ' '+suffix.trim() : '')).trim()

/* quick helpers */
const confirmDelete = (msg='Yakin mau dihapus?') => window.confirm(msg)

/* ===== Component ===== */
export default function AKelas(){
  const [tab, setTab] = React.useState('kelas') // 'kelas' | 'struktur' | 'org'

  /* ---------- Data umum: guru & siswa ---------- */
  const [guruList, setGuruList] = React.useState([])   // {id, name}
  const [siswaList, setSiswaList] = React.useState([]) // {uid, nama, kelas}

  React.useEffect(()=>{
    // ... (logika data guru & siswa tidak berubah) ...
    // users → guru & siswa
    rOn('users', (val)=>{
      const entries = Object.entries(val||{})
      const guru = entries
        .filter(([_,u]) => u?.role==='guru' || u?.role==='teacher')
        .map(([uid,u]) => ({
          id: uid,
          name: (u.nama || u.displayName || u.username || u.email || uid) + (u.email?` (${u.email})`:``)
        }))
      const siswa = entries
        .filter(([_,u]) => u?.role==='siswa')
        .map(([uid,u]) => ({
          uid, nama: u.nama || u.displayName || u.username || u.email || uid,
          kelas: u.kelas || ''
        }))
        .sort((a,b)=> (a.kelas||'').localeCompare(b.kelas||'','id') || (a.nama||'').localeCompare(b.nama||'','id'))
      setGuruList(guru.sort((a,b)=>a.name.localeCompare(b.name,'id')))
      setSiswaList(siswa)
    })
    // fallback guru legacy
    rOn('guru', (val)=>{
      const rows = Object.entries(val||{}).map(([id,u])=>({id, name: u.nama||u.name||u.email||id}))
      setGuruList(prev=>{
        const m=new Map(prev.map(g=>[g.id,g])); rows.forEach(g=>{if(!m.has(g.id)) m.set(g.id,g)})
        return Array.from(m.values()).sort((a,b)=>a.name.localeCompare(b.name,'id'))
      })
    })
    rOn('teachers', (val)=>{
      const rows = Object.entries(val||{}).map(([id,u])=>({id, name: u.nama||u.name||u.email||id}))
      setGuruList(prev=>{
        const m=new Map(prev.map(g=>[g.id,g])); rows.forEach(g=>{if(!m.has(g.id)) m.set(g.id,g)})
        return Array.from(m.values()).sort((a,b)=>a.name.localeCompare(b.name,'id'))
      })
    })
  },[])

  /* =========================================================
     TAB 1 — KELAS & JADWAL + STRUKTUR KELAS
   ========================================================= */
  const [kelas, setKelas] = React.useState([]) // {id,nama,grade,suffix,createdAt}
  const [filterGrade, setFilterGrade] = React.useState('') // pilih grade untuk list
  const [kelasSelected, setKelasSelected] = React.useState('')

  const [jadwal, setJadwal] = React.useState([])

  // Form buat/rename kelas
  const [newGrade, setNewGrade] = React.useState('')
  const [newSuffix, setNewSuffix] = React.useState('')
  const selObj = React.useMemo(()=> kelas.find(k=>k.id===kelasSelected)||null,[kelas,kelasSelected])
  const [editSuffix, setEditSuffix] = React.useState('')

  // Struktur kelas (wali & ketua)
  const [waliGuruId, setWaliGuruId]   = React.useState('')
  const [ketuaUid, setKetuaUid]       = React.useState('')
  
  // BARU: State untuk Mata Pelajaran
  const [mapelList, setMapelList] = React.useState([]) // [{id, nama}]
  const [newMapel, setNewMapel]   = React.useState('')

  React.useEffect(()=>{
    if(selObj){ setEditSuffix(selObj.suffix ?? stripGradePrefix(selObj.nama||selObj.id)) }
    else setEditSuffix('')
  },[selObj])

  React.useEffect(()=>{
    rOn('kelas', (val)=>{
      // ... (logika load 'kelas' tidak berubah) ...
      const rows = Object.entries(val||{}).map(([id,v])=>{
        const nama=v?.nama??id
        const grade=v?.grade||parseGrade(id)
        const suffix=v?.suffix??stripGradePrefix(nama)
        return { id, nama, grade, suffix, ...v }
      })
      rows.sort((a,b)=>{
        const ag = GRADE_ORDER[a.grade] ?? 999, bg = GRADE_ORDER[b.grade] ?? 999
        if(ag!==bg) return ag-bg
        return (a.suffix||'').localeCompare(b.suffix||'','id')
      })
      setKelas(rows)
      if(!filterGrade && rows.length) setFilterGrade(rows[0].grade || parseGrade(rows[0].id))
      if(!kelasSelected && rows.length){
        const first = rows.find(r=>!filterGrade || r.grade===filterGrade) || rows[0]
        if(first) setKelasSelected(first.id)
      }
    })
  },[]) // eslint-disable-line

  // subscribe jadwal kelas terpilih
  React.useEffect(()=>{
    // ... (logika load 'jadwal' tidak berubah) ...
    if(!kelasSelected){ setJadwal([]); return }
    return rOn(`jadwal/${kelasSelected}`, (val)=>{
      const rows = Object.entries(val||{}).map(([id,v])=>({id, ...v}))
      rows.sort((a,b)=>{
        const ai=HARI_OPTS.indexOf(a.hari), bi=HARI_OPTS.indexOf(b.hari)
        if(ai!==bi) return ai-bi
        return toMinutes(a.jamMulai)-toMinutes(b.jamMulai)
      })
      setJadwal(rows)
    })
  },[kelasSelected])

  // subscribe struktur kelas terpilih
  React.useEffect(()=>{
    // ... (logika load 'kelasStruktur' tidak berubah) ...
    if(!kelasSelected){ setWaliGuruId(''); setKetuaUid(''); return }
    return rOn(`kelasStruktur/${kelasSelected}`, (val)=>{
      setWaliGuruId(val?.waliGuruId || '')
      setKetuaUid(val?.ketuaUid || '')
    })
  },[kelasSelected])

  // BARU: subscribe mata pelajaran
  React.useEffect(() => {
    return rOn('mataPelajaran', (val) => {
      const rows = Object.entries(val || {}).map(([id, v]) => ({
        id,
        nama: v?.nama || id,
        ...v
      }))
      rows.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
      setMapelList(rows)
    })
  }, [])

  const kelasByGrade = React.useMemo(()=>{
    return filterGrade ? kelas.filter(k=>k.grade===filterGrade) : kelas
  },[kelas, filterGrade])

  const siswaDiKelasTerpilih = React.useMemo(()=>{
    return siswaList.filter(s=>s.kelas===kelasSelected)
  },[siswaList, kelasSelected])

  function guruNameById(id){ return guruList.find(g=>g.id===id)?.name || '' }
  function siswaNameByUid(uid){ return siswaList.find(s=>s.uid===uid)?.nama || '' }
  function buildJadwalKey({hari,mapel,jamMulai}){ return `${hari}-${mapel}-${jamMulai}`.replace(/\s+/g,'_') }

  async function tambahKelas(){
    // ... (logika tambahKelas tidak berubah) ...
    const grade=(newGrade||'').toUpperCase().trim()
    const suffix=(newSuffix||'').trim()
    if(!GRADE_OPTS.includes(grade)) return alert('Pilih grade: VII–XII.')
    if(FORBIDDEN.test(suffix)) return alert('Sufiks tidak boleh mengandung . # $ [ ] /')
    const nama = makeClassName(grade, suffix)
    const exist = await rGet(`kelas/${nama}`)
    if(exist) return alert('Kelas sudah ada.')
    await rSet(`kelas/${nama}`, { nama, grade, suffix, createdAt: Date.now() })
    setNewGrade(''); setNewSuffix('');
    setFilterGrade(grade)
    setKelasSelected(nama)
  }

  async function simpanRenameKelas(){
    // ... (logika simpanRenameKelas tidak berubah) ...
    if(!selObj) return
    const grade = selObj.grade || parseGrade(selObj.id)
    const suffix=(editSuffix||'').trim()
    if(FORBIDDEN.test(suffix)) return alert('Sufiks tidak boleh mengandung . # $ [ ] /')
    const oldId = selObj.id
    const newId = makeClassName(grade, suffix)

    if(newId===oldId){
      await rSet(`kelas/${oldId}`, { ...selObj, nama:newId, grade, suffix, updatedAt:Date.now() })
      return
    }

    const exist=await rGet(`kelas/${newId}`); if(exist) return alert('Nama kelas baru sudah dipakai.')
    await rSet(`kelas/${newId}`, { ...selObj, id:newId, nama:newId, grade, suffix, updatedAt:Date.now(), createdAt:selObj.createdAt||Date.now() })
    const jd = await rGet(`jadwal/${oldId}`); if(jd) await rSet(`jadwal/${newId}`, jd)
    await rSet(`jadwal/${oldId}`, null)
    const strukt = await rGet(`kelasStruktur/${oldId}`); if(strukt) await rSet(`kelasStruktur/${newId}`, strukt)
    await rSet(`kelasStruktur/${oldId}`, null)
    const users = await rGet('users')||{}
    for(const [uid,u] of Object.entries(users)){ // eslint-disable-line
      if(u?.kelas===oldId) await rSet(`users/${uid}/kelas`, newId)
    }
    await rSet(`kelas/${oldId}`, null)
    setFilterGrade(grade)
    setKelasSelected(newId)
  }

  async function hapusKelas(id){
    // ... (logika hapusKelas tidak berubah) ...
    if(!confirmDelete(`Yakin mau dihapus?`)) return
    const users = await rGet('users')||{}
    const used = Object.values(users).some(u=>u?.kelas===id)
    if(used) return alert('Tidak bisa hapus: kelas masih dipakai siswa.')
    await rSet(`jadwal/${id}`, null)
    await rSet(`kelasStruktur/${id}`, null)
    await rSet(`kelas/${id}`, null)
    if(kelasSelected===id) setKelasSelected('')
  }

  /* ------- STRUKTUR KELAS ------- */
  async function simpanStrukturKelas(){
    // ... (logika simpanStrukturKelas tidak berubah) ...
    if(!kelasSelected) return alert('Pilih kelas terlebih dahulu.')
    const payload = {
      waliGuruId: waliGuruId || null,
      waliGuruNama: waliGuruId ? (guruNameById(waliGuruId) || '') : '',
      ketuaUid: ketuaUid || null,
      ketuaNama: ketuaUid ? (siswaNameByUid(ketuaUid) || '') : '',
      updatedAt: Date.now()
    }
    await rSet(`kelasStruktur/${kelasSelected}`, payload)
  }
  async function kosongkanStrukturKelas(){
    // ... (logika kosongkanStrukturKelas tidak berubah) ...
    if(!kelasSelected) return
    if(!confirmDelete('Yakin mau dihapus?')) return
    await rSet(`kelasStruktur/${kelasSelected}`, null)
    setWaliGuruId(''); setKetuaUid('')
  }
  
  // BARU: --- CRUD MATA PELAJARAN ---
  async function tambahMapel() {
    const nama = (newMapel || '').trim()
    if (!nama) return
    if (FORBIDDEN.test(nama)) return alert('Nama mapel tidak boleh mengandung . # $ [ ] /')
    const id = slug(nama)
    const exist = await rGet(`mataPelajaran/${id}`)
    if (exist) return alert('Mata pelajaran sudah ada.')
    await rSet(`mataPelajaran/${id}`, { id, nama, createdAt: Date.now() })
    setNewMapel('')
  }

  async function hapusMapel(mapel) {
    if (!confirmDelete(`Hapus mata pelajaran "${mapel.nama}"?`)) return
    
    // Cek apakah mapel sedang dipakai di jadwal manapun
    const allJadwal = await rGet('jadwal') || {}
    let isUsed = false
    let usedInKelas = ''
    
    for (const [kelasId, jadwalList] of Object.entries(allJadwal)) {
      if (isUsed) break
      for (const j of Object.values(jadwalList || {})) {
        if (j.mapel === mapel.nama) { // Pengecekan berdasarkan nama
          isUsed = true
          usedInKelas = kelasId
          break
        }
      }
    }
    
    if (isUsed) {
      return alert(`Tidak bisa hapus: Mata pelajaran "${mapel.nama}" masih dipakai di jadwal kelas ${usedInKelas}.`)
    }
    
    // Hapus jika tidak dipakai
    await rSet(`mataPelajaran/${mapel.id}`, null)
  }
  // -------------------------------

  /* ------- JADWAL ------- */
  const [form, setForm] = React.useState({ hari:'', mapel:'', guruId:'', jamMulai:'', jamSelesai:'' })
  const [editId, setEditId] = React.useState(null)
  const [editData, setEditData] = React.useState(null)

  async function hasConflict({hari,jamMulai,jamSelesai,guruId}, ignoreId=null){
    // ... (logika hasConflict tidak berubah) ...
    const rows=await rGet(`jadwal/${kelasSelected}`)||{}
    for(const [id,j] of Object.entries(rows)){
      if(ignoreId && id===ignoreId) continue
      if(j.hari!==hari) continue
      if(timesOverlap(jamMulai,jamSelesai,j.jamMulai,j.jamSelesai)) return 'Konflik jam pada kelas ini.'
    }
    if(guruId){
      const all=await rGet('jadwal')||{}
      for(const [kelasId,list] of Object.entries(all)){
        for(const [id,j] of Object.entries(list||{})){
          if(ignoreId && kelasId===kelasSelected && id===ignoreId) continue
          if(j.guruId===guruId && j.hari===hari && timesOverlap(jamMulai,jamSelesai,j.jamMulai,j.jamSelesai))
            return `Guru bentrok di kelas ${kelasId}.`
        }
      }
    }
    return null
  }

  async function tambahJadwal(e){
    // MODIFIKASI: Pengecekan 'mapel'
    e?.preventDefault?.(); if(!kelasSelected) return alert('Pilih kelas.')
    const {hari,mapel,guruId,jamMulai,jamSelesai}=form
    // 'mapel' sekarang adalah nama dari dropdown
    if(!hari||!mapel||!jamMulai||!jamSelesai) return alert('Lengkapi data jadwal (Hari, Mapel, Jam).')
    if(toMinutes(jamMulai)>=toMinutes(jamSelesai)) return alert('Jam mulai harus < jam selesai.')
    
    const msg=await hasConflict({hari,jamMulai,jamSelesai,guruId}); if(msg) return alert(msg)
    
    // buildJadwalKey menggunakan nama mapel (string), ini tidak berubah
    const id=buildJadwalKey({hari,mapel,jamMulai})
    
    await rSet(`jadwal/${kelasSelected}/${id}`,{
      id,hari,
      mapel: mapel, // Simpan nama mapel
      guruId: guruId||null, guruNama: guruNameById(guruId)||'', 
      jamMulai,jamSelesai
    })
    setForm({ hari:'', mapel:'', guruId:'', jamMulai:'', jamSelesai:'' })
  }
  async function hapusJadwal(id){
    // ... (logika hapusJadwal tidak berubah) ...
    if(!confirmDelete()) return
    await rSet(`jadwal/${kelasSelected}/${id}`, null)
    if(editId===id){ setEditId(null); setEditData(null) }
  }
  function startEdit(row){ setEditId(row.id); setEditData({...row}) }
  function cancelEdit(){ setEditId(null); setEditData(null) }
  async function saveEdit(){
    // MODIFIKASI: Pengecekan 'mapel'
    const {hari,mapel,guruId,jamMulai,jamSelesai}=editData||{}
    if(!hari||!mapel||!jamMulai||!jamSelesai) return alert('Lengkapi data.')
    if(toMinutes(jamMulai)>=toMinutes(jamSelesai)) return alert('Jam mulai harus < jam selesai.')
    
    const msg=await hasConflict({hari,jamMulai,jamSelesai,guruId}, editId); if(msg) return alert(msg)
    
    // buildJadwalKey menggunakan nama mapel (string), ini tidak berubah
    const newId=buildJadwalKey({hari,mapel,jamMulai})
    const payload={ 
      id:newId,hari,
      mapel: mapel, // Simpan nama mapel
      guruId: guruId||null,guruNama:guruNameById(guruId)||'', 
      jamMulai,jamSelesai 
    }
    
    if(newId!==editId){
      await rSet(`jadwal/${kelasSelected}/${newId}`, payload)
      await rSet(`jadwal/${kelasSelected}/${editId}`, null)
    } else {
      await rSet(`jadwal/${kelasSelected}/${editId}`, payload)
    }
    setEditId(null); setEditData(null)
  }

  /* ============================ UI ============================ */
  return (
    <div className="space-y-4">
      {/* Tabs */}
      {/* ... (UI Tabs tidak berubah) ... */}
      <div className="flex gap-2">
        {['kelas','struktur','org'].map(key=>{
          const label = key==='kelas' ? 'Kelas & Jadwal' : key==='struktur' ? 'Struktur Sekolah' : 'Organisasi/OSIS'
          const active = tab===key
          return (
            <button key={key} className={'btn '+(active?'btn-primary':'bg-white border')} onClick={()=>setTab(key)}>
              {label}
            </button>
          )
        })}
      </div>

      {/* ===================== TAB: KELAS & JADWAL ===================== */}
      {tab==='kelas' && (
        <>
          {/* --- FILTER GRADE + DAFTAR KELAS (LIST TERPISAH) --- */}
          {/* ... (UI Card ini tidak berubah) ... */}
          <div className="card">
            <div className="flex items-end justify-between gap-2 flex-wrap">
              <div className="font-bold">Daftar Kelas per Grade</div>
              <div className="flex items-center gap-2">
                <label className="text-sm">Pilih Grade</label>
                <select className="input" value={filterGrade} onChange={e=>{
                  setFilterGrade(e.target.value)
                  const first = kelas.find(k=>k.grade===e.target.value)
                  if(first) setKelasSelected(first.id)
                }}>
                  <option value="">— Semua —</option>
                  {GRADE_OPTS.map(g=><option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              {kelasByGrade.map(k=>(
                <div key={k.id} className="flex items-center gap-1">
                  <button
                    className={'btn '+(kelasSelected===k.id?'btn-primary':'bg-white border')}
                    onClick={()=>setKelasSelected(k.id)}
                    title={k.nama||k.id}
                  >
                    {k.nama||k.id}
                  </button>
                  <button className="btn bg-white border text-red-600" onClick={()=>hapusKelas(k.id)} title="Hapus kelas">×</button>
                </div>
              ))}
              {!kelasByGrade.length && <span className="muted">Belum ada kelas untuk grade ini.</span>}
            </div>
          </div>

          {/* --- FORM BUAT KELAS (TERPISAH DARI LIST) --- */}
          {/* ... (UI Card ini tidak berubah) ... */}
          <div className="card">
            <div className="font-bold mb-2">Buat Kelas Baru</div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-sm mb-1">Grade</label>
                <select className="input" value={newGrade} onChange={e=>setNewGrade(e.target.value)}>
                  <option value="">— Pilih grade —</option>
                  {GRADE_OPTS.map(g=><option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex flex-col md:col-span-3">
                <label className="text-sm mb-1">Nama / Sufiks</label>
                <input className="input" placeholder="Contoh: A / A IPA / IPA 1"
                  value={newSuffix} onChange={e=>setNewSuffix(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={tambahKelas}>Tambah</button>
            </div>
          </div>
          
          {/* --- BARU: KELOLA MATA PELAJARAN --- */}
          <div className="card">
            <div className="font-bold mb-2">Kelola Mata Pelajaran</div>
            {/* Form tambah mapel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <div className="flex flex-col md:col-span-3">
                <label className="text-sm mb-1">Nama Mata Pelajaran Baru</label>
                <input 
                  className="input" 
                  placeholder="Contoh: Matematika Wajib"
                  value={newMapel} 
                  onChange={e=>setNewMapel(e.target.value)} 
                />
              </div>
              <button className="btn btn-primary" onClick={tambahMapel}>Tambah Mapel</button>
            </div>
            
            {/* Tabel daftar mapel */}
            <table className="w-full mt-4 text-sm">
              <thead className="text-left">
                <tr>
                  <th>Nama Mata Pelajaran</th>
                  <th className="w-32">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {mapelList.map(m => (
                  <tr key={m.id} className="border-t">
                    <td className="py-2">{m.nama}</td>
                    <td className="py-2">
                      <button className="btn btn-danger" onClick={() => hapusMapel(m)}>Hapus</button>
                    </td>
                  </tr>
                ))}
                {!mapelList.length && (
                  <tr><td colSpan="2" className="py-3 muted">Belum ada data mata pelajaran.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* ---------------------------------- */}


          {/* --- EDIT NAMA KELAS (TERPISAH) --- */}
          {/* ... (UI Card ini tidak berubah) ... */}
          {selObj && (
            <div className="card">
              <div className="font-bold mb-2">Edit Nama Kelas</div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                <div className="flex flex-col">
                  <label className="text-sm mb-1">Grade (Terkunci)</label>
                  <input className="input bg-gray-100" value={selObj.grade || parseGrade(selObj.id)} readOnly />
                </div>
                <div className="flex flex-col md:col-span-3">
                  <label className="text-sm mb-1">Nama / Sufiks</label>
                  <input className="input" value={editSuffix} onChange={e=>setEditSuffix(e.target.value)} placeholder="Contoh: A / A IPA / IPA 1" />
                  <div className="text-xs muted mt-1">Nama penuh: <b>{makeClassName(selObj.grade || parseGrade(selObj.id), editSuffix)}</b></div>
                </div>
                <button className="btn" onClick={simpanRenameKelas}>Simpan Nama</button>
              </div>
            </div>
          )}

          {/* --- STRUKTUR KELAS (WALI/KETUA) --- */}
          {/* ... (UI Card ini tidak berubah) ... */}
          {kelasSelected && (
            <div className="card">
              <div className="font-bold mb-2">Struktur Kelas • {kelasSelected}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <div className="flex flex-col">
                  <label className="text-sm mb-1">Wali Kelas (Guru)</label>
                  <select className="input" value={waliGuruId} onChange={e=>setWaliGuruId(e.target.value)}>
                    <option value="">— Pilih guru —</option>
                    {guruList.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm mb-1">Ketua Kelas (Siswa di {kelasSelected})</label>
                  <select className="input" value={ketuaUid} onChange={e=>setKetuaUid(e.target.value)}>
                    <option value="">— Pilih siswa —</option>
                    {siswaDiKelasTerpilih.map(s=><option key={s.uid} value={s.uid}>{s.nama} ({s.kelas||'—'})</option>)}
                  </select>
                </div>
                <div className="flex gap-2 md:justify-end">
                  <button className="btn" onClick={simpanStrukturKelas}>Simpan</button>
                  <button className="btn btn-danger" onClick={kosongkanStrukturKelas}>Kosongkan</button>
                </div>
              </div>
            </div>
          )}

          {/* --- FORM TAMBAH JADWAL (TERPISAH) --- */}
          {kelasSelected && (
            <div className="card">
              <div className="font-bold">Form Tambah Jadwal • {kelasSelected}</div>
              {/* MODIFIKASI: Input Mapel menjadi Select */}
              <form className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end" onSubmit={tambahJadwal}>
                <div className="flex flex-col">
                  <label className="text-sm mb-1">Hari</label>
                  <select className="input" value={form.hari} onChange={e=>setForm(f=>({...f, hari:e.target.value}))}>
                    <option value="">— Pilih hari —</option>
                    {HARI_OPTS.map(h=><option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm mb-1">Mapel</label>
                  {/* --- MODIFIKASI DISINI --- */}
                  <select className="input" value={form.mapel} onChange={e=>setForm(f=>({...f, mapel:e.target.value}))}>
                    <option value="">— Pilih mapel —</option>
                    {mapelList.map(m => <option key={m.id} value={m.nama}>{m.nama}</option>)}
                  </select>
                  {/* ------------------------- */}
                </div>
                <div className="flex flex-col">
                  <label className="text-sm mb-1">Guru (UID)</label>
                  <select className="input" value={form.guruId} onChange={e=>setForm(f=>({...f, guruId:e.target.value}))}>
                    <option value="">— Tanpa guru —</option>
                    {guruList.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm mb-1">Jam Mulai</label>
                  <input type="time" className="input" value={form.jamMulai} onChange={e=>setForm(f=>({...f, jamMulai:e.target.value}))}/>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm mb-1">Jam Selesai</label>
                  <input type="time" className="input" value={form.jamSelesai} onChange={e=>setForm(f=>({...f, jamSelesai:e.target.value}))}/>
                </div>
                <button className="btn btn-primary md:col-span-1" type="submit">Tambah</button>
              </form>
            </div>
          )}

          {/* --- DAFTAR JADWAL (TERPISAH) --- */}
          {kelasSelected && (
            <div className="card">
              <div className="font-bold">Daftar Jadwal • {kelasSelected}</div>
              {/* MODIFIKASI: Input Edit Mapel menjadi Select */}
              <table className="w-full mt-4">
                <thead>
                  <tr className="text-left text-sm">
                    <th>Hari</th><th>Jam</th><th>Mapel</th><th>Guru</th><th className="w-40">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {jadwal.map(j=>(
                    <tr key={j.id} className="border-t">
                      {editId===j.id ? (
                        <>
                          <td className="py-2">
                            <select className="input" value={editData.hari} onChange={e=>setEditData(d=>({...d, hari:e.target.value}))}>
                              {HARI_OPTS.map(h=><option key={h} value={h}>{h}</option>)}
                            </select>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <input type="time" className="input" value={editData.jamMulai} onChange={e=>setEditData(d=>({...d, jamMulai:e.target.value}))}/>
                              <span>–</span>
                              <input type="time" className="input" value={editData.jamSelesai} onChange={e=>setEditData(d=>({...d, jamSelesai:e.target.value}))}/>
                            </div>
                          </td>
                          <td className="py-2">
                            {/* --- MODIFIKASI DISINI --- */}
                            <select className="input" value={editData.mapel} onChange={e=>setEditData(d=>({...d, mapel:e.target.value}))}>
                              <option value="">— Pilih mapel —</option>
                              {mapelList.map(m => <option key={m.id} value={m.nama}>{m.nama}</option>)}
                            </select>
                            {/* ------------------------- */}
                          </td>
                          <td className="py-2">
                            <select className="input" value={editData.guruId||''} onChange={e=>setEditData(d=>({...d, guruId:e.target.value||null}))}>
                              <option value="">— Tanpa guru —</option>
                              {guruList.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                          </td>
                          <td className="py-2">
                            <div className="flex gap-2">
                              <button className="btn btn-primary" onClick={saveEdit}>Simpan</button>
                              <button className="btn bg-white border" onClick={cancelEdit}>Batal</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2">{j.hari}</td>
                          <td className="py-2">{j.jamMulai}–{j.jamSelesai}</td>
                          <td className="py-2">{j.mapel}</td>
                          <td className="py-2">{j.guruNama || (j.guruId ? j.guruId : '—')}</td>
                          <td className="py-2">
                            <div className="flex gap-2">
                              <button className="btn bg-white border" onClick={()=>startEdit(j)}>Edit</button>
                              <button className="btn btn-danger" onClick={()=>hapusJadwal(j.id)}>Hapus</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {!jadwal.length && <tr><td colSpan="5" className="py-3 muted">Belum ada jadwal.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===================== TAB: STRUKTUR SEKOLAH (GLOBAL) ===================== */}
      {tab==='struktur' && <StrukturSekolah guruList={guruList} />}

      {/* ===================== TAB: ORGANISASI / OSIS ===================== */}
      {tab==='org' && <Organisasi guruList={guruList} siswaList={siswaList} />}
    </div>
  )
}

/* === Sub-sections extracted for clarity (tetap 1 file kalau mau) === */
function StrukturSekolah({guruList}){
  // ... (Komponen StrukturSekolah tidak berubah) ...
  const DEFAULT_POS = ['Kepala Sekolah','Wakil Kepala Sekolah','Kurikulum','Kesiswaan','Sarpras','Humas','Bendahara','Tata Usaha']
  const [struktur, setStruktur] = React.useState([]) // {id,jabatan,guruId,guruNama}
  const [posBaru, setPosBaru]   = React.useState('')
  const [posGuru, setPosGuru]   = React.useState('')

  React.useEffect(()=>{
    rOn('strukturSekolah', (val)=>{
      const rows = Object.entries(val||{}).map(([id,v])=>({id, ...v}))
      rows.sort((a,b)=> (a.jabatan||'').localeCompare(b.jabatan||'','id'))
      setStruktur(rows)
    })
  },[])

  async function addPosisi(){
    const jab=(posBaru||'').trim()
    if(!jab) return; if(FORBIDDEN.test(jab)) return alert('Nama posisi tidak boleh mengandung . # $ [ ] /')
    const id = slug(jab)
    const guruId = posGuru || ''
    const guruNama = guruId ? (guruList.find(g=>g.id===guruId)?.name||'') : ''
    const exist = await rGet(`strukturSekolah/${id}`)
    if(exist) return alert('Posisi sudah ada.')
    await rSet(`strukturSekolah/${id}`, { id, jabatan:jab, guruId: guruId||null, guruNama, createdAt: Date.now() })
    setPosBaru(''); setPosGuru('')
  }
  async function updatePosisi(p, newGuruId){
    await rSet(`strukturSekolah/${p.id}/guruId`, newGuruId || null)
    await rSet(`strukturSekolah/${p.id}/guruNama`, newGuruId ? (guruList.find(g=>g.id===newGuruId)?.name||'') : '')
    await rSet(`strukturSekolah/${p.id}/updatedAt`, Date.now())
  }
  async function hapusPosisi(p){
    if(!confirmDelete()) return
    await rSet(`strukturSekolah/${p.id}`, null)
  }

  return (
    <div className="card">
      <div className="font-bold mb-2">Struktur Sekolah</div>

      {/* Form tambah posisi */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <div className="flex flex-col md:col-span-2">
          <label className="text-sm mb-1">Jabatan</label>
          <input className="input" list="list-posisi" placeholder="cth: Kepala Sekolah"
                 value={posBaru} onChange={e=>setPosBaru(e.target.value)} />
          <datalist id="list-posisi">
            {DEFAULT_POS.map(p=><option key={p} value={p} />)}
          </datalist>
        </div>
        <div className="flex flex-col">
          <label className="text-sm mb-1">Guru (opsional)</label>
          <select className="input" value={posGuru} onChange={e=>setPosGuru(e.target.value)}>
            <option value="">— Pilih guru —</option>
            {guruList.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={addPosisi}>Tambah</button>
      </div>

      {/* Tabel struktur */}
      <table className="w-full mt-4 text-sm">
        <thead className="text-left"><tr><th>Jabatan</th><th>Guru Penanggung Jawab</th><th className="w-40">Aksi</th></tr></thead>
        <tbody>
          {struktur.map(p=>(
            <tr key={p.id} className="border-t">
              <td className="py-2">{p.jabatan}</td>
              <td className="py-2">
                <select className="input" value={p.guruId||''} onChange={e=>updatePosisi(p, e.target.value)}>
                  <option value="">— Kosong —</option>
                  {guruList.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </td>
              <td className="py-2"><button className="btn btn-danger" onClick={()=>hapusPosisi(p)}>Hapus</button></td>
            </tr>
          ))}
          {!struktur.length && <tr><td colSpan="3" className="py-3 muted">Belum ada data struktur.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function Organisasi({guruList, siswaList}){
  // ... (Komponen Organisasi tidak berubah) ...
  const [orgList, setOrgList] = React.useState([])
  const [orgSel, setOrgSel]   = React.useState('')
  const [orgForm, setOrgForm] = React.useState({ nama:'', visi:'', misi:'', pembinaGuruId:'' })
  const [orgAnggota, setOrgAnggota] = React.useState([])
  const [addMemberUid, setAddMemberUid] = React.useState('')

  React.useEffect(()=>{
    rOn('organisasi', (val)=>{
      const rows = Object.entries(val||{}).map(([id,v])=>({ id, ...v }))
      rows.sort((a,b)=> (a.nama||'').localeCompare(b.nama||'','id'))
      setOrgList(rows)
    })
  },[])
  React.useEffect(()=>{
    if(!orgSel){
      setOrgForm({nama:'',visi:'',misi:'',pembinaGuruId:''}); setOrgAnggota([]); return
    }
    rOn(`organisasi/${orgSel}`, (o)=>{
      o=o||{}
      setOrgForm({
        nama: o.nama || '',
        visi: o.visi || '',
        misi: o.misi || '',
        pembinaGuruId: o.pembinaGuruId || ''
      })
    })
    rOn(`organisasi/${orgSel}/anggota`, (val)=>{
      const rows = Object.entries(val||{}).map(([uid,v])=>({ uid, ...(v||{}) }))
      rows.sort((a,b)=> (a.kelas||'').localeCompare(b.kelas||'','id') || (a.nama||'').localeCompare(b.nama||'','id'))
      setOrgAnggota(rows)
    })
  },[orgSel])

  async function tambahOrganisasi(){
    const nama=(orgForm.nama||'').trim()
    if(!nama) return
    if(FORBIDDEN.test(nama)) return alert('Nama organisasi tidak boleh mengandung . # $ [ ] /')
    const id = slug(nama)
    const exist = await rGet(`organisasi/${id}`); if(exist) return alert('Nama organisasi sudah ada.')
    const pembinaId = orgForm.pembinaGuruId || ''
    const pembinaNama = pembinaId ? (guruList.find(g=>g.id===pembinaId)?.name||'') : ''
    await rSet(`organisasi/${id}`, {
      id, nama, visi: orgForm.visi||'', misi: orgForm.misi||'',
      pembinaGuruId: pembinaId || null, pembinaGuruNama: pembinaNama,
      createdAt: Date.now()
    })
    setOrgSel(id)
  }
  async function simpanOrganisasi(){
    if(!orgSel) return
    const pembinaId = orgForm.pembinaGuruId || ''
    const pembinaNama = pembinaId ? (guruList.find(g=>g.id===pembinaId)?.name||'') : ''
    await rSet(`organisasi/${orgSel}`, {
      id: orgSel,
      nama: orgForm.nama||'',
      visi: orgForm.visi||'',
      misi: orgForm.misi||'',
      pembinaGuruId: pembinaId || null,
      pembinaGuruNama: pembinaNama,
      updatedAt: Date.now()
    })
  }
  async function hapusOrganisasi(){
    if(!orgSel) return
    if(!confirmDelete()) return
    await rSet(`organisasi/${orgSel}`, null)
    setOrgSel(''); setOrgForm({nama:'',visi:'',misi:'',pembinaGuruId:''}); setOrgAnggota([]); setAddMemberUid('')
  }
  async function tambahAnggota(){
    if(!orgSel || !addMemberUid) return
    const s = siswaList.find(x=>x.uid===addMemberUid); if(!s) return
    await rSet(`organisasi/${orgSel}/anggota/${s.uid}`, { uid:s.uid, nama:s.nama, kelas:s.kelas||'' })
    setAddMemberUid('')
  }
  async function hapusAnggota(uid){
    if(!orgSel) return
    if(!confirmDelete()) return
    await rSet(`organisasi/${orgSel}/anggota/${uid}`, null)
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="font-bold mb-2">Organisasi / OSIS</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <div className="flex flex-col md:col-span-2">
            <label className="text-sm mb-1">Pilih Organisasi</label>
            <select className="input" value={orgSel} onChange={e=>setOrgSel(e.target.value)}>
              <option value="">— Baru —</option>
              {orgList.map(o=><option key={o.id} value={o.id}>{o.nama}</option>)}
            </select>
          </div>
          <div className="flex md:justify-end gap-2 md:col-span-3">
            <button className="btn btn-primary" onClick={tambahOrganisasi}>Tambah Baru</button>
            {orgSel && <button className="btn btn-danger" onClick={hapusOrganisasi}>Hapus</button>}
          </div>
        </div>

        {/* FORM DETAIL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div className="flex flex-col">
            <label className="text-sm mb-1">Nama Organisasi</label>
            <input className="input" placeholder="cth: OSIS, Pramuka, Paskibra"
                   value={orgForm.nama} onChange={e=>setOrgForm(f=>({...f, nama:e.target.value}))}/>
          </div>
          <div className="flex flex-col">
            <label className="text-sm mb-1">Pembina (Guru)</label>
            <select className="input" value={orgForm.pembinaGuruId} onChange={e=>setOrgForm(f=>({...f, pembinaGuruId:e.target.value}))}>
              <option value="">— Pilih guru —</option>
              {guruList.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-sm mb-1">Visi</label>
            <textarea className="input min-h-[90px]" value={orgForm.visi} onChange={e=>setOrgForm(f=>({...f, visi:e.target.value}))}/>
          </div>
          <div className="flex flex-col">
            <label className="text-sm mb-1">Misi</label>
            <textarea className="input min-h-[90px]" value={orgForm.misi} onChange={e=>setOrgForm(f=>({...f, misi:e.target.value}))}/>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button className="btn" onClick={simpanOrganisasi} disabled={!orgSel && !orgForm.nama}>Simpan</button>
        </div>
      </div>

      {orgSel && (
        <div className="card">
          <div className="font-bold mb-2">Anggota • {orgForm.nama || orgSel}</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <div className="flex flex-col md:col-span-2">
              <label className="text-sm mb-1">Tambah Anggota (Siswa + Kelas)</label>
              <select className="input" value={addMemberUid} onChange={e=>setAddMemberUid(e.target.value)}>
                <option value="">— Pilih siswa —</option>
                {siswaList.map(s=><option key={s.uid} value={s.uid}>{s.nama} ({s.kelas||'—'})</option>)}
              </select>
            </div>
            <button className="btn bg-white border" onClick={tambahAnggota} disabled={!addMemberUid}>Tambah</button>
          </div>

          <table className="w-full mt-3 text-sm">
            <thead className="text-left"><tr><th>Nama</th><th>Kelas</th><th className="w-32">Aksi</th></tr></thead>
            <tbody>
              {orgAnggota.map(a=>(
                <tr key={a.uid} className="border-t">
                  <td className="py-2">{a.nama}</td>
                  <td className="py-2">{a.kelas || '—'}</td>
                  <td className="py-2"><button className="btn btn-danger" onClick={()=>hapusAnggota(a.uid)}>Hapus</button></td>
                </tr>
              ))}
              {!orgAnggota.length && <tr><td colSpan="3" className="py-3 muted">Belum ada anggota.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}