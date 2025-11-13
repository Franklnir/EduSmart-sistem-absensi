import React from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { rOn, rSet, rGet } from '../../lib/firebase'
import { isPast, todayKey } from '../../lib/time'
import Badge from '../../components/Badge'

export default function SAbsensi(){
  const { profile, user } = useAuthStore()
  const [tab, setTab] = React.useState('manual')
  const [mapel, setMapel] = React.useState('')
  const [tgl, setTgl] = React.useState(todayKey())
  const [status, setStatus] = React.useState(null)
  const [ringkas, setRingkas] = React.useState({H:0,I:0,A:0})
  const [riwayat, setRiwayat] = React.useState([])

  React.useEffect(()=>{
    if(!profile?.kelas) return
    rOn(`absensi/${profile.kelas}/${tgl}`, (val)=>{
      const agg = {H:0,I:0,A:0}
      if(val){
        Object.values(val).forEach(v => {
          if(v.status==='H') agg.H++
          if(v.status==='I') agg.I++
          if(v.status==='A') agg.A++
        })
      }
      setRingkas(agg)
      setStatus(val?.[user.uid]?.status ?? null)
    })
    rOn(`users/${user.uid}/riwayat_absensi`, (val) => {
      const arr = Object.values(val || {}).sort((a,b)=> (b.tanggal||'').localeCompare(a.tanggal||''))
      setRiwayat(arr)
    })
  }, [profile?.kelas, tgl])

  async function submit(status){
    if(!mapel) return alert('Pilih mapel')
    // fetch jadwal to ensure time validity
    const jad = await rGet(`jadwal/${profile.kelas}`) || {}
    const entries = Object.values(jad)
    const found = entries.find(j => j.mapel === mapel)
    if(found){
      if(isPast(found.jamSelesai)) return alert('Sudah melewati jam selesai. Auto-Alpha.')
    }
    await rSet(`absensi/${profile.kelas}/${tgl}/${user.uid}`, {
      status,
      mapel,
      uid: user.uid,
      nama: profile.nama,
      waktu: Date.now()
    })
    await rSet(`users/${user.uid}/riwayat_absensi/${tgl}-${mapel}`, {
      status, mapel, tanggal: tgl, waktu: Date.now()
    })
  }

  React.useEffect(()=>{
    // Auto mark alpha jika lewat jam selesai dan belum absen
    const iv = setInterval(async ()=>{
      if(status) return
      if(!mapel) return
      const jad = await rGet(`jadwal/${profile.kelas}`) || {}
      const found = Object.values(jad).find(j=>j.mapel===mapel)
      if(found && isPast(found.jamSelesai)){
        await submit('A')
      }
    }, 15000)
    return ()=>clearInterval(iv)
  }, [status, mapel])

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button className={"btn " + (tab==='manual'?'btn-primary':'bg-white border')} onClick={()=>setTab('manual')}>Absen Manual</button>
        <button className={"btn " + (tab==='riwayat'?'btn-primary':'bg-white border')} onClick={()=>setTab('riwayat')}>Riwayat</button>
      </div>

      {tab==='manual' && (
        <div className="card space-y-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="label">Tanggal</div>
              <input className="input" type="date" value={tgl} onChange={e=>setTgl(e.target.value)} />
            </div>
            <div>
              <div className="label">Mapel</div>
              <select className="input" value={mapel} onChange={e=>setMapel(e.target.value)}>
                <option value="">Pilih</option>
                {(profile?.kelas) && <MapelOptions kelas={profile.kelas} />}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-success" disabled={!mapel || status} onClick={()=>submit('H')}>Hadir</button>
            <button className="btn btn-warning" disabled={!mapel || status} onClick={()=>submit('I')}>Izin</button>
            <button className="btn bg-slate-200" disabled>Tombol akan disable setelah jam selesai</button>
          </div>
          <div className="mt-2">
            <div className="font-semibold">Ringkasan Kehadiran Kelas <Badge variant="live">Live</Badge></div>
            <div className="flex gap-3 mt-2">
              <Badge variant="hadir">Hadir {ringkas.H}</Badge>
              <Badge variant="izin">Izin {ringkas.I}</Badge>
              <Badge variant="alpha">Alpha {ringkas.A}</Badge>
            </div>
          </div>
        </div>
      )}

      {tab==='riwayat' && (
        <div className="card">
          <div className="font-bold mb-2">Riwayat</div>
          <div className="space-y-2">
            {riwayat.map((r,i) => (
              <div key={i} className="border rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.mapel} • {r.tanggal}</div>
                  <div className="muted text-xs">{new Date(r.waktu).toLocaleString('id-ID')}</div>
                </div>
                <Badge variant={r.status==='H'?'hadir': r.status==='I'?'izin':'alpha'}>{r.status}</Badge>
              </div>
            ))}
            {!riwayat.length && <div className="muted">Belum ada data.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

function MapelOptions({ kelas }){
  const [list, setList] = React.useState([])
  React.useEffect(()=>{
    const unsub = rOn(`jadwal/${kelas}`, (val)=>{
      const arr = Array.from(new Set(Object.values(val || {}).map(v=>v.mapel)))
      setList(arr)
    })
    return ()=>typeof unsub==='function' && unsub()
  }, [kelas])
  return (<>
    {list.map(m => <option key={m} value={m}>{m}</option>)}
  </>)
}
