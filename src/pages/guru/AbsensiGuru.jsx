import React, { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { rOn, rSet, rGet } from '../../lib/firebase'

// Helper untuk mendapatkan tanggal hari ini format YYYY-MM-DD
const getToday = () => new Date().toISOString().slice(0, 10)

// Helper untuk menampilkan foto profil atau inisial
function initials(name = '?') {
  const parts = (name || '').trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() || '').join('')
}

const toMinutes = (hhmm) => {
  if(!hhmm) return 0
  const [h,m] = hhmm.split(':').map(Number)
  return (h*60)+(m||0)
}

const getDayName = (tglString) => {
  const date = new Date(tglString + 'T12:00:00Z');
  const dayIndex = date.getUTCDay();
  const HARI_MAP_JS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return HARI_MAP_JS[dayIndex];
}

export default function AbsensiGuru() {
  const { user, profile } = useAuthStore()
  
  const [view, setView] = useState('absen') // 'absen' | 'riwayat'

  // --- Filter Utama ---
  const [kelas, setKelas] = useState('')
  const [tgl, setTgl] = useState(getToday())
  
  // MODIFIKASI: State untuk filter yang berbeda
  // 'selectedScheduleId' untuk tab Absen, 'mapel' untuk tab Riwayat
  const [selectedScheduleId, setSelectedScheduleId] = useState('') 
  const [mapel, setMapel] = useState('') // Untuk filter Riwayat
  
  // State untuk menampung semua jadwal
  const [jadwalAll, setJadwalAll] = useState({})
  
  // Data Absensi
  const [siswa, setSiswa] = useState([])
  const [absensi, setAbsensi] = useState({})
  const [ajuan, setAjuan] = useState([])
  const [absenMode, setAbsenMode] = useState('manual')
  const [isLoading, setIsLoading] = useState(false)
  
  const [currentSchedule, setCurrentSchedule] = useState(null)
  const [todayName, setTodayName] = useState('')

  // Modal Izin
  const [isIzinModalOpen, setIsIzinModalOpen] = useState(false)
  const [izinUid, setIzinUid] = useState(null)
  const [izinReason, setIzinReason] = useState('')

  // Riwayat
  const [riwayatTglStart, setRiwayatTglStart] = useState(getToday())
  const [riwayatTglEnd, setRiwayatTglEnd] = useState(getToday())
  const [riwayatData, setRiwayatData] = useState(null)
  const [isRiwayatLoading, setIsRiwayatLoading] = useState(false)

  // 1. Load semua jadwal untuk membangun filter
  useEffect(() => {
    const unsubJadwal = rOn('jadwal', (val) => {
      setJadwalAll(val || {})
    })
    
    return () => {
      unsubJadwal && unsubJadwal()
    }
  }, [])
  
  // 2. Memo untuk daftar dropdown
  const { myKelasList, myMapelList, schedulesForSelectedClass } = useMemo(() => {
    if (!user?.uid || !jadwalAll) {
      return { myKelasList: [], myMapelList: [], schedulesForSelectedClass: [] }
    }
    
    const kelasSet = new Set()
    const mapelSet = new Set()
    
    // Iterasi semua jadwal untuk menemukan kelas & mapel yang diajar guru
    Object.entries(jadwalAll).forEach(([kelasId, jadwalEntries]) => {
      Object.values(jadwalEntries || {}).forEach(j => {
        if (j.guruId === user.uid) {
          kelasSet.add(kelasId)
          if (j.mapel) mapelSet.add(j.mapel)
        }
      })
    })

    // Buat daftar jadwal spesifik (Mapel + Hari + Jam) untuk KELAS YANG DIPILIH
    const schedulesList = []
    if (kelas && jadwalAll[kelas]) {
      Object.entries(jadwalAll[kelas]).forEach(([id, j]) => {
        if (j.guruId === user.uid) {
          schedulesList.push({
            id: id, // ID unik jadwal (cth: "Senin-Matematika-07:00")
            label: `${j.mapel} (Hari: ${j.hari}, ${j.jamMulai}-${j.jamSelesai})`,
            schedule: j // Simpan objek jadwal lengkap
          })
        }
      })
      schedulesList.sort((a,b) => a.label.localeCompare(b.label));
    }
    
    return {
      myKelasList: Array.from(kelasSet).sort(),
      myMapelList: Array.from(mapelSet).sort(), // Untuk tab Riwayat
      schedulesForSelectedClass: schedulesList // Untuk tab Absen
    }
  }, [jadwalAll, user?.uid, kelas]) // 'kelas' adalah dependensi penting di sini

  // 3. Fungsi untuk mencari/memuat data absensi
  async function loadDataAbsensi() {
    // MODIFIKASI: Cek 'selectedScheduleId'
    if (!kelas || !selectedScheduleId || !tgl) {
      return alert('Silakan pilih Kelas, Jadwal Pelajaran, dan Tanggal terlebih dahulu.')
    }
    
    setIsLoading(true)
    setSiswa([])
    setAbsensi({})
    setAjuan([])
    setCurrentSchedule(null)
    setTodayName('')

    // Tentukan hari dari tanggal
    const dayName = getDayName(tgl)
    setTodayName(dayName)
    
    // Ambil objek jadwal lengkap dari 'selectedScheduleId'
    const selectedScheduleObj = schedulesForSelectedClass.find(s => s.id === selectedScheduleId);

    if (!selectedScheduleObj) {
      alert(`Jadwal tidak valid.`);
      setIsLoading(false);
      return;
    }
    
    const schedule = selectedScheduleObj.schedule;
    const mapelName = schedule.mapel; // Ambil nama mapel dari jadwal
    
    // Validasi hari
    if (schedule.hari !== dayName) {
      alert(`Jadwal "${schedule.mapel}" adalah untuk hari ${schedule.hari}, tapi Anda memilih tanggal di hari ${dayName}.`);
      setIsLoading(false);
      return;
    }
    
    setCurrentSchedule(schedule)

    // Ambil daftar siswa
    const usersVal = await rGet('users')
    const arr = Object.values(usersVal || {}).filter(u => u.role === 'siswa' && u.kelas === kelas)
    arr.sort((a,b) => (a.nama || '').localeCompare(b.nama || ''))
    setSiswa(arr)
    
    // Listener untuk data absensi (cek mapelName)
    rOn(`absensi/${kelas}/${tgl}`, (val) => {
      const mapelAbsen = {}
      Object.entries(val || {}).forEach(([uid, data]) => {
        if (data.mapel === mapelName) {
          mapelAbsen[uid] = data
        }
      })
      setAbsensi(mapelAbsen)
    })

    // Listener untuk ajuan izin
    rOn(`absensi_ajuan/${kelas}/${tgl}`, (val) => {
      const arr = Object.entries(val || {}).map(([uid, v]) => ({ uid, ...v }))
      setAjuan(arr)
    })
    
    // Listener untuk mode absensi (cek mapelName)
    rOn(`absensiSettings/${kelas}/${tgl}/${mapelName}`, (val) => {
      setAbsenMode(val?.mode || 'manual')
    })
    
    setIsLoading(false)
  }
  
  // 4. Memo isAbsenOpen
  const isAbsenOpen = useMemo(() => {
    // ... (Tidak berubah) ...
    if (!currentSchedule || tgl !== getToday()) return false; 
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = toMinutes(currentSchedule.jamMulai);
    const endMinutes = toMinutes(currentSchedule.jamSelesai);
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }, [currentSchedule, tgl])
  
  // 5. Memo listHadir, dll
  const { listHadir, listIzin, listAlpha, listBelumHadir } = useMemo(() => {
    // ... (Tidak berubah) ...
    const listHadir = [], listIzin = [], listAlpha = [], listBelumHadir = []
    for (const s of siswa) {
      const absen = absensi[s.uid]
      if (!absen) {
        listBelumHadir.push(s)
      } else if (absen.status === 'H') {
        listHadir.push({ ...s, ...absen })
      } else if (absen.status === 'I') {
        listIzin.push({ ...s, ...absen })
      } else if (absen.status === 'A') {
        listAlpha.push({ ...s, ...absen })
      } else {
        listBelumHadir.push(s)
      }
    }
    return { listHadir, listIzin, listAlpha, listBelumHadir }
  }, [siswa, absensi])

  // 6. Aksi Guru
  async function setStatus(uid, st, alasan = '') {
    const isToday = (tgl === getToday());
    if (isToday && !isAbsenOpen) {
      return alert('Aksi diblokir. Absensi untuk hari ini hanya bisa dilakukan selama jam pelajaran berlangsung (' + currentSchedule.jamMulai + ' - ' + currentSchedule.jamSelesai + ').');
    }
    
    // MODIFIKASI: Ambil mapel dari currentSchedule
    if (!currentSchedule?.mapel) return alert('Jadwal tidak valid.')
    
    const siswaData = siswa.find(s => s.uid === uid)
    
    await rSet(`absensi/${kelas}/${tgl}/${uid}`, {
      status: st,
      mapel: currentSchedule.mapel, // Ambil dari jadwal
      uid,
      nama: siswaData?.nama || '?',
      waktu: Date.now(),
      oleh: user.uid,
      komentar: alasan || (st === 'H' ? 'Hadir (Manual)' : st === 'A' ? 'Alpha (Manual)' : 'Izin (Manual)')
    })
  }
  
  function openIzinModal(uid) {
    // ... (Logika tidak berubah) ...
    const isToday = (tgl === getToday());
    if (isToday && !isAbsenOpen) {
      return alert('Aksi diblokir. Absensi untuk hari ini hanya bisa dilakukan selama jam pelajaran berlangsung (' + currentSchedule.jamMulai + ' - ' + currentSchedule.jamSelesai + ').');
    }
    setIzinUid(uid)
    setIzinReason('')
    setIsIzinModalOpen(true)
  }

  function handleSimpanIzin() {
    // ... (Logika tidak berubah) ...
    if (!izinUid) return
    setStatus(izinUid, 'I', izinReason || 'Izin (Tanpa Keterangan)')
    setIsIzinModalOpen(false)
    setIzinUid(null)
  }

  async function keputusanAjuan(ajuanData, terima) {
    const isToday = (tgl === getToday());
    if (isToday && !isAbsenOpen) {
      return alert('Aksi diblokir. Absensi untuk hari ini hanya bisa dilakukan selama jam pelajaran berlangsung (' + currentSchedule.jamMulai + ' - ' + currentSchedule.jamSelesai + ').');
    }
    
    // MODIFIKASI: Ambil mapel dari currentSchedule
    if (!currentSchedule?.mapel) return alert('Jadwal tidak valid.')
    
    const { uid, alasan, nama } = ajuanData
    if (terima) {
      await rSet(`absensi/${kelas}/${tgl}/${uid}`, {
        status: 'I', 
        mapel: currentSchedule.mapel, // Ambil dari jadwal
        uid, nama: nama || '?',
        waktu: Date.now(), oleh: 'siswa', dikonfirmasi: user.uid,
        komentar: alasan || 'Izin'
      })
    } else {
      await setStatus(uid, 'A', 'Ajuan izin ditolak')
    }
    await rSet(`absensi_ajuan/${kelas}/${tgl}/${uid}`, null)
  }

  async function toggleAbsenMode(mode) {
    // MODIFIKASI: Ambil mapel dari currentSchedule
    if (!kelas || !currentSchedule?.mapel || !tgl) return alert('Pilih filter terlebih dahulu.')
    const isToday = (tgl === getToday());
    if (isToday && !isAbsenOpen && mode === 'otomatis') {
      return alert('Absen otomatis tidak bisa dibuka di luar jam pelajaran.');
    }
    
    await rSet(`absensiSettings/${kelas}/${tgl}/${currentSchedule.mapel}`, { mode })
    setAbsenMode(mode)
  }
  
  // 7. Logika Riwayat
  async function loadRiwayat() {
    // MODIFIKASI: Cek 'mapel' (dari state) bukan currentSchedule
    if (!kelas || !mapel) return alert('Pilih Kelas dan Mapel untuk melihat riwayat.')
    
    setIsRiwayatLoading(true)
    setRiwayatData(null)
    try {
      const allAbsensi = await rGet(`absensi/${kelas}`) || {}
      const usersVal = await rGet('users') || {}
      const siswaDiKelas = Object.values(usersVal).filter(u => u.role === 'siswa' && u.kelas === kelas)
      const processedData = {}
      siswaDiKelas.forEach(s => {
        processedData[s.uid] = { nama: s.nama, H: 0, I: 0, A: 0, S: 0 }
      })
      Object.entries(allAbsensi).forEach(([tglAbsen, dataTgl]) => {
        if (tglAbsen >= riwayatTglStart && tglAbsen <= riwayatTglEnd) {
          Object.entries(dataTgl).forEach(([uid, absen]) => {
            // MODIFIKASI: Cek 'mapel' (dari state)
            if (absen.mapel === mapel && processedData[uid]) {
              if (absen.status === 'H') processedData[uid].H++
              else if (absen.status === 'I') processedData[uid].I++
              else if (absen.status === 'S') processedData[uid].S++
              else if (absen.status === 'A') processedData[uid].A++
            }
          })
        }
      })
      setRiwayatData(Object.entries(processedData).map(([uid, data]) => ({ uid, ...data })))
    } catch (err) {
      console.error(err)
      alert("Gagal memuat riwayat.")
    }
    setIsRiwayatLoading(false)
  }
  
  function handleExport() {
    alert('Fitur export sedang dalam pengembangan.')
  }
  
  // Render List Siswa
  const renderSiswaList = (list, type) => {
    // ... (Logika render tidak berubah) ...
    const isManualDisabled = absenMode === 'otomatis';
    return (
      <div>
        <h4 className="font-semibold mb-2 capitalize">{type} ({list.length})</h4>
        {list.length === 0 ? (
          <p className="text-sm muted">Tidak ada siswa.</p>
        ) : (
          <div className="space-y-2">
            {list.map(s => (
              <div key={s.uid} className="flex items-center justify-between p-2 border rounded-lg">
                <div className="flex items-center gap-2">
                  {s.photoURL ? (
                    <img src={s.photoURL} alt={s.nama} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold">
                      {initials(s.nama)}
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{s.nama}</div>
                    {s.komentar && <div className="text-xs muted">{s.komentar}</div>}
                  </div>
                </div>
                {type === 'Belum Absen' && (
                  <div className="flex gap-1 md:gap-2 flex-wrap justify-end">
                    <button 
                      className="btn btn-success btn-sm" 
                      onClick={() => setStatus(s.uid, 'H')} 
                      disabled={isManualDisabled}
                      title={isManualDisabled ? "Mode absen otomatis aktif" : "Tandai Hadir"}
                    >H</button>
                    <button 
                      className="btn btn-warning btn-sm" 
                      onClick={() => openIzinModal(s.uid)} 
                      disabled={isManualDisabled}
                      title={isManualDisabled ? "Mode absen otomatis aktif" : "Tandai Izin"}
                    >I</button>
                    <button 
                      className="btn btn-danger btn-sm" 
                      onClick={() => setStatus(s.uid, 'A')} 
                      disabled={isManualDisabled}
                      title={isManualDisabled ? "Mode absen otomatis aktif" : "Tandai Alpha"}
                    >A</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      
      {/* --- Filter Utama --- */}
      <div className="card">
        <div className="grid md:grid-cols-4 gap-2 items-end">
          <div>
            <div className="label">Kelas yang Anda Ajar</div>
            <select className="input" value={kelas} onChange={e => { 
              setKelas(e.target.value); 
              setMapel(''); // Reset mapel riwayat
              setSelectedScheduleId(''); // Reset schedule absen
              setCurrentSchedule(null);
            }}>
              <option value="">— Pilih Kelas —</option>
              {myKelasList.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          
          {/* MODIFIKASI: Tampilkan dropdown yang berbeda berdasarkan 'view' */}
          {view === 'absen' ? (
            <div>
              <div className="label">Jadwal Pelajaran Anda</div>
              <select 
                className="input" 
                value={selectedScheduleId} 
                onChange={e => { 
                  setSelectedScheduleId(e.target.value);
                  setCurrentSchedule(null); // Reset schedule object
                }}
                disabled={!kelas}
              >
                <option value="">— Pilih Jadwal (Mapel, Hari, Jam) —</option>
                {schedulesForSelectedClass.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <div className="label">Mata Pelajaran (untuk Riwayat)</div>
              <select 
                className="input" 
                value={mapel} 
                onChange={e => setMapel(e.target.value)}
                disabled={!kelas}
              >
                <option value="">— Pilih Mapel —</option>
                {/* Riwayat pakai myMapelList (daftar mapel umum) */}
                {myMapelList.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {view === 'absen' && (
            <div>
              <div className="label">Tanggal Absen</div>
              <input className="input" type="date" value={tgl} onChange={e => setTgl(e.target.value)} />
            </div>
          )}
          {view === 'absen' && (
             <button className="btn btn-primary" onClick={loadDataAbsensi} disabled={isLoading}>
              {isLoading ? 'Memuat...' : 'Cari Absensi'}
            </button>
          )}
          
          {/* Sembunyikan filter tanggal & tombol cari jika di tab Riwayat (karena ada filter sendiri) */}
          {view === 'riwayat' && (
            <div className="md:col-span-2"></div>
          )}
        </div>
      </div>
      
      {/* Tampilkan Jadwal jika ditemukan */}
      {view === 'absen' && currentSchedule && (
        <div className={`card ${isAbsenOpen ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
          <div className='flex justify-between items-center'>
            <div>
              <div className='font-bold'>Jadwal Ditemukan (Hari {todayName})</div>
              <div className='text-lg'>Jam: <strong>{currentSchedule.jamMulai} - {currentSchedule.jamSelesai}</strong></div>
            </div>
            {tgl === getToday() && (
              isAbsenOpen ? (
                <div className='text-sm font-semibold p-2 rounded-lg bg-green-200'>SESI DIBUKA</div>
              ) : (
                <div className='text-sm font-semibold p-2 rounded-lg bg-gray-200'>SESI DITUTUP</div>
              )
            )}
          </div>
        </div>
      )}
      
      {/* --- Pilihan Tab --- */}
      <div className="flex gap-2">
        <button className={`btn ${view === 'absen' ? 'btn-primary' : 'bg-white border'}`} onClick={() => setView('absen')}>
          Absen Hari Ini
        </button>
        <button className={`btn ${view === 'riwayat' ? 'btn-primary' : 'bg-white border'}`} onClick={() => setView('riwayat')}>
          Riwayat Kehadiran
        </button>
      </div>

      {/* ======================= */}
      {/* === TAMPILAN ABSEN HARI INI === */}
      {/* ======================= */}
      {view === 'absen' && (
        <div className="space-y-4">
          {/* --- Mode Absensi --- */}
          <div className="card">
            <div className="font-bold mb-2">Mode Absensi</div>
            <div className="flex gap-2">
              <button 
                className={`btn ${absenMode === 'manual' ? 'btn-primary' : 'bg-white border'}`}
                onClick={() => toggleAbsenMode('manual')}
                disabled={!currentSchedule}
              >
                Manual (Input oleh Guru)
              </button>
              <button 
                className={`btn ${absenMode === 'otomatis' ? 'btn-success' : 'bg-white border'}`}
                onClick={() => toggleAbsenMode('otomatis')}
                disabled={!currentSchedule}
              >
                Buka Absen (Otomatis oleh Siswa)
              </button>
            </div>
            {absenMode === 'otomatis' && (
              <div className="text-sm text-green-700 mt-2 p-2 bg-green-50 rounded-lg">
                Siswa di kelas {kelas} sekarang dapat melakukan absensi mandiri di aplikasi mereka untuk mata pelajaran {currentSchedule?.mapel} pada tanggal {tgl}.
                { (tgl === getToday() && !isAbsenOpen) && <span className='font-bold block text-red-600'> (Tapi sesi belum dibuka karena di luar jam pelajaran).</span> }
              </div>
            )}
          </div>
          
          {/* --- Ajuan Izin --- */}
          <div className="card">
            <div className="font-bold mb-2">Ajuan Izin Siswa ({ajuan.length})</div>
            <div className="space-y-2">
              {ajuan.map(a => (
                <div key={a.uid} className="border rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center justify-between">
                  <div>
                    <div className="font-semibold">{a.nama || a.uid}</div>
                    <div className="muted text-sm">{a.alasan || '(tanpa keterangan)'}</div>
                  </div>
                  <div className="flex gap-2 mt-2 md:mt-0">
                    <button className="btn btn-success" onClick={() => keputusanAjuan(a, true)}>Terima</button>
                    <button className="btn btn-danger" onClick={() => keputusanAjuan(a, false)}>Tolak</button>
                  </div>
                </div>
              ))}
              {ajuan.length === 0 && <div className="muted">Tidak ada ajuan.</div>}
            </div>
          </div>

          {/* --- Daftar Siswa Terkategori --- */}
          <div className="card">
            <div className="font-bold mb-2">Daftar Siswa (Total: {siswa.length})</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {renderSiswaList(listHadir, "Hadir")}
              {renderSiswaList(listIzin, "Izin")}
              {renderSiswaList(listAlpha, "Alpha")}
              {renderSiswaList(listBelumHadir, "Belum Absen")}
            </div>
          </div>
        </div>
      )}
      
      {/* ======================= */}
      {/* === TAMPILAN RIWAYAT === */}
      {/* ======================= */}
      {view === 'riwayat' && (
        <div className="space-y-4">
          <div className="card">
            <div className="font-bold mb-2">Cari Riwayat Kehadiran</div>
            {/* MODIFIKASI: Filter Riwayat sekarang punya tombol cari sendiri */}
            <div className="grid md:grid-cols-4 gap-2 items-end">
              <div>
                <div className="label">Tanggal Mulai</div>
                <input className="input" type="date" value={riwayatTglStart} onChange={e => setRiwayatTglStart(e.target.value)} />
              </div>
              <div>
                <div className="label">Tanggal Selesai</div>
                <input className="input" type="date" value={riwayatTglEnd} onChange={e => setRiwayatTglEnd(e.target.value)} />
              </div>
              <button className="btn btn-primary md:col-span-1" onClick={loadRiwayat} disabled={isRiwayatLoading}>
                {isRiwayatLoading ? 'Mencari...' : 'Cari Riwayat'}
              </button>
              <button className="btn bg-green-600 text-white md:col-span-1" onClick={handleExport}>
                Export ke Excel
              </button>
            </div>
          </div>
          
          {isRiwayatLoading && <div className="card muted">Memuat data riwayat...</div>}
          
          {riwayatData && (
             <div className="card overflow-x-auto">
               <div className="font-bold mb-2">Hasil Riwayat ({riwayatTglStart} s/d {riwayatTglEnd})</div>
               <table className="w-full text-sm">
                 <thead className="text-left">
                   <tr>
                     <th className="py-2">Nama Siswa</th>
                     <th className="text-center">Hadir (H)</th>
                     <th className="text-center">Izin (I)</th>
                     <th className="text-center">Alpha (A)</th>
                   </tr>
                 </thead>
                 <tbody>
                   {riwayatData.map(s => (
                     <tr key={s.uid} className="border-t">
                       <td className="py-2">{s.nama}</td>
                       <td className="text-center">{s.H}</td>
                       <td className="text-center">{s.I}</td>
                       <td className="text-center">{s.A}</td>
                     </tr>
                   ))}
                   {riwayatData.length === 0 && (
                     <tr><td colSpan="4" className="py-3 muted text-center">Tidak ada data riwayat pada rentang tanggal ini.</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
          )}
        </div>
      )}
      
      {/* --- Modal Izin (Manual) --- */}
      {isIzinModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-4 w-full max-w-md shadow-xl">
            <div className="font-bold text-lg mb-2">Beri Izin Manual</div>
            <div className="muted text-sm mb-2">Masukkan alasan izin untuk siswa ini.</div>
            <textarea
              className="input min-h-[100px]"
              placeholder="Contoh: Sakit, acara keluarga, dll."
              value={izinReason}
              onChange={e => setIzinReason(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button className="btn bg-white border" onClick={() => setIsIzinModalOpen(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSimpanIzin}>Simpan Izin</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}