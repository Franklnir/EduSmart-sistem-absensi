// src/pages/guru/JadwalGuru.jsx
import React from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { rOn, rSet } from '../../lib/firebase'

const HARI_JS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export default function JadwalGuru() {
  const { profile, user } = useAuthStore()

  const [jadwal, setJadwal] = React.useState([])
  const [guruList, setGuruList] = React.useState([])
  const [form, setForm] = React.useState({
    jadwalId: '',
    alasan: '',
    pengganti: ''
  })

  // jadwal ekskul yang diampu
  const [eskulDiampu, setEskulDiampu] = React.useState([])

  // riwayat jam kosong guru (hari ini & besok)
  const [riwayatKosong, setRiwayatKosong] = React.useState([])

  // helper: info hari & tanggal (dihitung sekali)
  const { todayStr, tomorrowStr, todayName } = React.useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const tomorrow = new Date(now.getTime() + 86400000)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)

    const todayName = HARI_JS[now.getDay()]

    return { todayStr, tomorrowStr, todayName }
  }, [])

  React.useEffect(() => {
    if (!user?.uid) return

    // 1. ambil jadwal pelajaran yang diampu guru ini
    const unsubJadwal = rOn('jadwal', (val) => {
      const arr = []
      Object.entries(val || {}).forEach(([kelas, rows]) => {
        Object.entries(rows || {}).forEach(([id, j]) => {
          if (j.guruId === user.uid || j.guruNama === profile?.nama) {
            arr.push({ id, kelas, ...j })
          }
        })
      })
      setJadwal(arr)
    })

    // 2. list guru utk pengganti
    const unsubGuru = rOn('users', (val) => {
      const arr = Object.values(val || {}).filter((u) => u.role === 'guru')
      setGuruList(arr)
    })

    // 3. ambil ekskul yang dibina guru ini
    const unsubEkskul = rOn('ekskul', (val) => {
      const rows = Object.entries(val || {}).map(([id, v]) => ({ id, ...v }))
      const filtered = rows.filter(
        (x) =>
          x.pembinaGuruId === user.uid ||
          (!x.pembinaGuruId && x.pembinaGuruNama && x.pembinaGuruNama === profile?.nama)
      )
      setEskulDiampu(filtered)
    })

    // 4. riwayat jam kosong guru ini (hari ini & besok)
    const unsubKosong = rOn('jam_kosong', (val) => {
      const data = val || {}
      const list = []

      ;[todayStr, tomorrowStr].forEach((tgl) => {
        const perDate = data[tgl] || {}
        Object.entries(perDate).forEach(([key, row]) => {
          if (
            row &&
            (row.guru === user.uid ||
              (!row.guru && row.guruNama && row.guruNama === profile?.nama))
          ) {
            list.push({ tgl, key, ...row })
          }
        })
      })

      // urutkan per tanggal lalu jam mulai
      list.sort((a, b) => {
        if (a.tgl !== b.tgl) return a.tgl.localeCompare(b.tgl)
        return (a.jamMulai || '').localeCompare(b.jamMulai || '')
      })

      setRiwayatKosong(list)
    })

    return () => {
      unsubJadwal && unsubJadwal()
      unsubGuru && unsubGuru()
      unsubEkskul && unsubEkskul()
      unsubKosong && unsubKosong()
    }
  }, [user?.uid, profile?.nama, todayStr, tomorrowStr])

  // jadwal yang bisa di-input jam kosong: HANYA jadwal hari ini
  const jadwalToday = React.useMemo(
    () => jadwal.filter((j) => j.hari === todayName),
    [jadwal, todayName]
  )

  async function kirimJamKosong() {
    const j = jadwalToday.find((x) => x.id === form.jadwalId)
    if (!j) return alert('Pilih jadwal mata pelajaran *hari ini* yang akan dibuat jam kosong.')

    const penggantiData = guruList.find((g) => g.uid === form.pengganti)

    const data = {
      // dipakai SJadwal
      kelas: j.kelas,
      mapel: j.mapel,
      jamMulai: j.jamMulai,
      jamSelesai: j.jamSelesai,

      // info guru
      guru: user.uid,
      guruNama: profile?.nama || j.guruNama || '',

      // info hari & tanggal
      tgl: todayStr,
      hari: j.hari,

      // alasan & pengganti
      alasan: form.alasan,
      guruPengganti: form.pengganti || null,
      guruPengganti_nama: penggantiData?.nama || null,

      dibuatPada: Date.now()
    }

    // ⚠️ STRUKTUR MATCH DENGAN SJadwal:
    // jam_kosong/{tgl}/{someKey} = data
    // pakai kelas + id_jadwal supaya unik
    const jamKey = `${j.kelas}_${j.id}`
    await rSet(`jam_kosong/${todayStr}/${jamKey}`, data)

    alert('Jam kosong berhasil disimpan dan akan tampil di jadwal siswa (status & kartu).')

    setForm({ jadwalId: '', alasan: '', pengganti: '' })
  }

  return (
    <div className="space-y-4">
      {/* --- Card Jadwal Diampu (Pelajaran) --- */}
      <div className="card">
        <div className="font-bold mb-2">Jadwal Diampu</div>
        <div className="grid md:grid-cols-2 gap-2">
          {jadwal.map((j) => (
            <div key={`${j.kelas}-${j.id}`} className="border rounded-xl p-3">
              <div className="font-medium">
                {j.kelas} • {j.mapel}
              </div>
              <div className="muted">
                {j.hari} • {j.jamMulai}-{j.jamSelesai}
              </div>
            </div>
          ))}
          {!jadwal.length && <div className="muted">Belum ada data.</div>}
        </div>
      </div>

      {/* --- Card Jadwal Ekskul Diampu --- */}
      <div className="card">
        <div className="font-bold mb-2">Jadwal Ekstrakurikuler Diampu</div>
        <div className="grid md:grid-cols-2 gap-2">
          {eskulDiampu.map((x) => (
            <div key={x.id} className="border rounded-xl p-3">
              <div className="font-medium">{x.nama}</div>
              <div className="muted text-sm">
                {x.hari || 'Hari belum diatur'} • {x.jamMulai || '??'} -{' '}
                {x.jamSelesai || '??'}
              </div>
            </div>
          ))}
          {!eskulDiampu.length && (
            <div className="muted">Anda belum menjadi pembina ekskul.</div>
          )}
        </div>
      </div>

      {/* --- Card Input Jam Kosong (HARI INI SAJA) --- */}
      <div className="card">
        <div className="font-bold mb-2">
          Input Jam Kosong (Hari Ini – {todayName}, {todayStr})
        </div>

        <div className="grid md:grid-cols-3 gap-2">
          <div>
            <div className="label">Jadwal Hari Ini</div>
            <select
              className="input"
              value={form.jadwalId}
              onChange={(e) => setForm({ ...form, jadwalId: e.target.value })}
            >
              <option value="">
                {jadwalToday.length
                  ? 'Pilih jadwal pelajaran hari ini'
                  : 'Anda tidak punya jadwal hari ini'}
              </option>
              {jadwalToday.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.kelas} - {j.mapel} ({j.jamMulai}-{j.jamSelesai})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="label">Alasan</div>
            <input
              className="input"
              value={form.alasan}
              onChange={(e) => setForm({ ...form, alasan: e.target.value })}
              placeholder="contoh: dinas luar, sakit, dsb."
            />
          </div>

          <div>
            <div className="label">Guru Pengganti</div>
            <select
              className="input"
              value={form.pengganti}
              onChange={(e) => setForm({ ...form, pengganti: e.target.value })}
            >
              <option value="">(opsional)</option>
              {guruList.map((g) => (
                <option key={g.uid} value={g.uid}>
                  {g.nama}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="btn btn-primary mt-3"
          onClick={kirimJamKosong}
          disabled={!form.jadwalId}
        >
          Simpan Jam Kosong Hari Ini
        </button>
      </div>

      {/* --- Card Riwayat Jam Kosong (Hari Ini & Besok) --- */}
      <div className="card">
        <div className="font-bold mb-2">Riwayat Jam Kosong (Hari Ini & Besok)</div>
        <div className="space-y-2">
          {riwayatKosong.map((r, i) => (
            <div
              key={`${r.tgl}-${r.kelas}-${r.mapel}-${r.jamMulai}-${i}`}
              className="border rounded-xl p-3 bg-slate-50"
            >
              <div className="font-medium">
                {r.mapel} ({r.kelas}) • {r.jamMulai}-{r.jamSelesai}
              </div>
              <div className="text-sm text-slate-600">
                {r.tgl === todayStr ? 'Hari ini' : r.tgl === tomorrowStr ? 'Besok' : r.tgl}
                {' • '}
                {r.alasan || 'Tanpa keterangan'}
              </div>
              {r.guruPengganti && (
                <div className="text-xs text-slate-500">
                  Guru pengganti: {r.guruPengganti_nama || r.guruPengganti}
                </div>
              )}
            </div>
          ))}

          {!riwayatKosong.length && (
            <div className="muted text-sm">
              Belum ada jam kosong yang tercatat untuk hari ini atau besok.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
