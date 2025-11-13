// src/pages/guru/TugasGuru.jsx
import React, { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { rOn, rSet, rGet } from '../../lib/firebase'
import { v4 as uuidv4 } from 'uuid'
import { uploadFile, SUPABASE_BUCKET } from '../../lib/supabase'
import FileDropzone from '../../components/FileDropzone'
import { useUI } from '../../store/useUIStore'

/* ================ Helpers ================ */
const getNowDateTimeLocal = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

const renderLink = (url, text) => {
  if (!url) return null
  try {
    if (/\.(jpeg|jpg|gif|png|webp)$/i.test(url)) {
      return (
        <img
          src={url}
          alt="lampiran"
          className="max-w-xs max-h-40 rounded-lg mt-2 border"
        />
      )
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-sm bg-blue-100 text-blue-700 mt-2"
      >
        {text}
      </a>
    )
  } catch {
    return null
  }
}

/* ================ Component ================ */
export default function TugasGuru() {
  const { user, profile } = useAuthStore()
  const { pushToast } = useUI()

  /* ---------- master data ---------- */
  const [jadwalAll, setJadwalAll] = useState({})

  /* ---------- form tambah ---------- */
  const [kelas, setKelas] = useState('')
  const [mapel, setMapel] = useState('')
  const [form, setForm] = useState({
    judul: '',
    keterangan: '',
    deadline: getNowDateTimeLocal(),
    format: 'pdf',
    link: '',
    fileURL: '',
  })
  const [isExpanded, setIsExpanded] = useState(false)
  const [isUploadingFoto, setIsUploadingFoto] = useState(false)

  /* ---------- riwayat ---------- */
  const [listRaw, setListRaw] = useState([])
  const [listTugas, setListTugas] = useState([])
  const [historyMode, setHistoryMode] = useState('perKelas') // 'perKelas' | 'semuaSaya'

  // filter waktu
  const [timeFilterType, setTimeFilterType] = useState('today') // 'today' | 'all' | 'range' | 'month'
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [monthVal, setMonthVal] = useState('')

  /* ---------- detail & penilaian ---------- */
  const [selectedTugas, setSelectedTugas] = useState(null)
  const [siswaDiKelas, setSiswaDiKelas] = useState([])
  const [jawabanTugas, setJawabanTugas] = useState({})
  const [nilaiInput, setNilaiInput] = useState({})
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  const [isEditingTugas, setIsEditingTugas] = useState(false)
  const [editForm, setEditForm] = useState(null)

  /* ========== 1. Listener Jadwal ========== */
  useEffect(() => {
    const unsub = rOn('jadwal', (val) => setJadwalAll(val || {}))
    return () => unsub && unsub()
  }, [])

  /* ========== 2. Kelas & Mapel yang diampu guru ini ========== */
  const { myKelasList, myMapelList } = useMemo(() => {
    if (!user?.uid || !jadwalAll) return { myKelasList: [], myMapelList: [] }
    const kelasSet = new Set()
    const mapelSet = new Set()
    Object.entries(jadwalAll).forEach(([kelasId, jadwals]) => {
      Object.values(jadwals || {}).forEach((j) => {
        if (j.guruId === user.uid) {
          kelasSet.add(kelasId)
          if (j.mapel) mapelSet.add(j.mapel)
        }
      })
    })
    return { myKelasList: [...kelasSet].sort(), myMapelList: [...mapelSet].sort() }
  }, [jadwalAll, user?.uid])

  // auto pilih kelas pertama bila kosong
  useEffect(() => {
    if (!kelas && myKelasList.length) setKelas(myKelasList[0])
  }, [myKelasList, kelas])

  /* ========== 3. Loader Riwayat ========== */
  // mode perKelas → listener realtime
  useEffect(() => {
    if (historyMode !== 'perKelas') return
    let unsub = () => {}
    if (kelas) {
      unsub = rOn(`tugas/${kelas}`, (val) => {
        const arr = Object.entries(val || {}).map(([id, v]) => ({ id, ...v }))
        setListRaw(arr)
      })
    } else setListRaw([])
    return () => unsub()
  }, [historyMode, kelas])

  // mode semuaSaya → snapshot semua kelas yang diampu
  useEffect(() => {
    if (historyMode !== 'semuaSaya') return
    let alive = true
    async function loadAll() {
      const all = []
      for (const k of myKelasList) {
        const snap = (await rGet(`tugas/${k}`)) || {}
        Object.entries(snap).forEach(([id, v]) => all.push({ id, ...v }))
      }
      if (alive) setListRaw(all)
    }
    loadAll()
    return () => {
      alive = false
    }
  }, [historyMode, myKelasList])

  /* ========== 4. Filter owner + waktu + mapel (memo) ========== */
  const ownerMatch = (t) => {
    if (t.createdByUid && user?.uid) return t.createdByUid === user.uid
    if (t.createdBy && profile?.nama)
      return String(t.createdBy).trim() === String(profile?.nama).trim()
    return true
  }

  const timeMatch = (ts) => {
    if (!ts) return true
    const d = new Date(ts)
    const dMs = d.getTime()
    if (Number.isNaN(dMs)) return false

    if (timeFilterType === 'all') return true

    if (timeFilterType === 'today') {
      const now = new Date()
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      )
    }

    if (timeFilterType === 'range') {
      const s = dateStart ? new Date(`${dateStart}T00:00:00`).getTime() : -Infinity
      const e = dateEnd ? new Date(`${dateEnd}T23:59:59`).getTime() : Infinity
      return dMs >= s && dMs <= e
    }

    if (timeFilterType === 'month' && monthVal) {
      const [y, m] = monthVal.split('-').map(Number)
      if (!y || !m) return true
      const start = new Date(y, m - 1, 1).getTime()
      const end = new Date(y, m, 0, 23, 59, 59, 999).getTime()
      return dMs >= start && dMs <= end
    }

    return true
  }

  const groupedList = useMemo(() => {
    let arr = listRaw.filter((t) => {
      const timeKey = t.deadline || t.createdAt
      return ownerMatch(t) && timeMatch(timeKey)
    })

    if (historyMode === 'perKelas') {
      if (mapel) arr = arr.filter((t) => t.mapel === mapel)
      if (kelas) arr = arr.filter((t) => t.kelas === kelas)
    } else {
      if (mapel) arr = arr.filter((t) => t.mapel === mapel)
      if (kelas) arr = arr.filter((t) => t.kelas === kelas)
    }

    arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    const groups = {}
    for (const t of arr) {
      const key = `${t.kelas || '-'} • ${t.mapel || '-'}`
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    }
    return Object.entries(groups).map(([key, items]) => ({ key, items }))
  }, [
    listRaw,
    mapel,
    kelas,
    historyMode,
    timeFilterType,
    dateStart,
    dateEnd,
    monthVal,
    profile?.nama,
    user?.uid,
  ])

  useEffect(() => {
    setListTugas(groupedList.flatMap((g) => g.items))
  }, [groupedList])

  /* ========== 5. Detail Tugas: siswa & jawaban ========== */
  useEffect(() => {
    let unsub = () => {}
    if (selectedTugas) {
      if (isEditingTugas) return
      setIsLoadingDetail(true)
      setSiswaDiKelas([])
      setJawabanTugas({})

      rGet('users').then((val) => {
        const arr = Object.values(val || {}).filter(
          (u) => u.role === 'siswa' && u.kelas === selectedTugas.kelas,
        )
        arr.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
        setSiswaDiKelas(arr)
      })

      unsub = rOn(`tugas_jawaban/${selectedTugas.id}`, (val) => {
        setJawabanTugas(val || {})
        const nilaiAwal = {}
        Object.entries(val || {}).forEach(([uid, data]) => {
          if (data.nilai != null) nilaiAwal[uid] = data.nilai
        })
        setNilaiInput(nilaiAwal)
      })

      setIsLoadingDetail(false)
    }
    return () => unsub()
  }, [selectedTugas, isEditingTugas])

  /* ========== 6. Derivasi status siswa (biru/hijau/merah) ========== */
  const siswaDinilai = useMemo(
    () =>
      siswaDiKelas
        .filter((s) => jawabanTugas[s.uid]?.nilai != null)
        .map((s) => ({ ...s, jawaban: jawabanTugas[s.uid] })),
    [siswaDiKelas, jawabanTugas],
  )

  const siswaDikerjakan = useMemo(
    () =>
      siswaDiKelas
        .filter((s) => jawabanTugas[s.uid] && jawabanTugas[s.uid].nilai == null)
        .map((s) => ({ ...s, jawaban: jawabanTugas[s.uid] })),
    [siswaDiKelas, jawabanTugas],
  )

  const siswaBelum = useMemo(
    () => siswaDiKelas.filter((s) => !jawabanTugas[s.uid]),
    [siswaDiKelas, jawabanTugas],
  )

  /* ========== Aksi: tambah tugas ========== */
  async function tambah() {
    if (!kelas || !mapel || !form.judul || !form.deadline)
      return alert('Lengkapi data (Kelas, Mapel, Judul, Deadline)')

    const id = uuidv4()
    const payload = {
      id,
      kelas,
      mapel,
      ...form,
      createdBy: profile?.nama || '-',
      createdByUid: user?.uid || null,
      createdAt: Date.now(),
    }
    if (!isExpanded) {
      delete payload.link
      delete payload.fileURL
    }

    await rSet(`tugas/${kelas}/${id}`, payload)
    alert('Tugas ditambahkan')
    setForm({
      judul: '',
      keterangan: '',
      deadline: getNowDateTimeLocal(),
      format: 'pdf',
      link: '',
      fileURL: '',
    })
    setIsExpanded(false)
  }

  /* ========== Aksi: simpan nilai ========== */
  async function simpanNilai(uidSiswa) {
    if (!selectedTugas) return
    const nilai = nilaiInput[uidSiswa] ?? ''
    const path = `tugas_jawaban/${selectedTugas.id}/${uidSiswa}`
    try {
      await rSet(`${path}/nilai`, parseInt(nilai))
      await rSet(`${path}/dinilaiAt`, Date.now())
      alert('Nilai disimpan')
    } catch (err) {
      alert('Gagal menyimpan nilai: ' + err.message)
    }
  }

  /* ========== Edit tugas ========== */
  function openEditTugas() {
    if (!selectedTugas) return
    setEditForm({
      id: selectedTugas.id,
      kelas: selectedTugas.kelas,
      mapel: selectedTugas.mapel,
      judul: selectedTugas.judul,
      keterangan: selectedTugas.keterangan || '',
      deadline: selectedTugas.deadline,
      link: selectedTugas.link || '',
      fileURL: selectedTugas.fileURL || '',
    })
    setIsEditingTugas(true)
  }
  function cancelEditTugas() {
    setIsEditingTugas(false)
    setEditForm(null)
  }
  function handleEditFormChange(e) {
    const { name, value } = e.target
    setEditForm((p) => ({ ...p, [name]: value }))
  }
  async function simpanEditTugas() {
    if (!editForm) return
    const { id, kelas, ...payload } = editForm
    if (!id || !kelas || !payload.judul || !payload.deadline)
      return alert('Judul dan Deadline wajib diisi.')
    const existing = await rGet(`tugas/${kelas}/${id}`)
    await rSet(`tugas/${kelas}/${id}`, { ...existing, ...payload, updatedAt: Date.now() })
    alert('Tugas diperbarui')
    setSelectedTugas((p) => ({ ...p, ...payload }))
    cancelEditTugas()
  }

  /* ========== Upload lampiran tugas guru ========== */
  async function handleFotoUpload(files) {
    if (!files?.length) return
    const f = files[0]
    setIsUploadingFoto(true)
    try {
      const safe = f.name.replace(/[^\w.-]+/g, '_')
      const path = `tugas_lampiran/${user.uid}/${Date.now()}_${safe}`
      const url = await uploadFile(SUPABASE_BUCKET, path, f)
      setForm((prev) => ({ ...prev, fileURL: url }))
      pushToast({ title: 'Foto/file lampiran berhasil di-upload!', status: 'success' })
    } catch (err) {
      console.error(err)
      pushToast({ title: 'Gagal mengupload foto', text: err.message, status: 'error' })
    } finally {
      setIsUploadingFoto(false)
    }
  }

  /* =================== RENDER =================== */
  return (
    <div className="space-y-4">
      {/* ============ Tambah Tugas ============ */}
      <div className="card">
        <div className="font-bold mb-2">Tambah Tugas</div>
        <div className="grid md:grid-cols-4 gap-2">
          <div>
            <div className="label">Kelas</div>
            <select className="input" value={kelas} onChange={(e) => setKelas(e.target.value)}>
              <option value="">— Pilih Kelas —</option>
              {myKelasList.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="label">Mapel</div>
            <select
              className="input"
              value={mapel}
              onChange={(e) => setMapel(e.target.value)}
              disabled={!kelas && historyMode === 'perKelas'}
            >
              <option value="">— Pilih Mapel —</option>
              {myMapelList.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="label">Judul</div>
            <input className="input" value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} />
          </div>

          <div>
            <div className="label">Deadline</div>
            <input className="input" type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>

          <div className="md:col-span-4">
            <div className="label">Keterangan</div>
            <textarea className="input" rows="3" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <input type="checkbox" id="isExpanded" className="checkbox" checked={isExpanded} onChange={(e) => setIsExpanded(e.target.checked)} />
            <label htmlFor="isExpanded" className="text-sm cursor-pointer">Perpanjang Form (untuk Lampiran Link/Foto)</label>
          </div>

          {isExpanded && (
            <>
              <div className="md:col-span-4">
                <div className="label">Link Eksternal (YouTube, GDrive, dll)</div>
                <input className="input" placeholder="https://youtube.com/..." value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
              </div>

              <div className="md:col-span-4">
                <div className="label">Upload Foto / File Lampiran (Opsional)</div>
                {isUploadingFoto ? (
                  <div className="card muted">Mengupload foto...</div>
                ) : form.fileURL ? (
                  <div>
                    {renderLink(form.fileURL, 'Lihat File/Foto')}
                    <button className="btn btn-danger btn-sm ml-2" onClick={() => setForm((p) => ({ ...p, fileURL: '' }))}>Hapus</button>
                  </div>
                ) : (
                  <FileDropzone onFiles={handleFotoUpload} accept="image/png, image/jpeg, application/pdf" />
                )}
                <p className="text-xs muted mt-1">Anda bisa menambahkan link eksternal dan mengupload file lampiran sekaligus.</p>
              </div>
            </>
          )}

          <div className="md:col-span-4">
            <button className="btn btn-primary" onClick={tambah}>Simpan</button>
          </div>
        </div>
      </div>

      {/* ============ Riwayat ============ */}
      <div className="card">
        <div className="font-bold mb-2">Riwayat Tugas</div>

        {/* Filter bar */}
        <div className="grid md:grid-cols-6 gap-2 mb-3">
          <div className="md:col-span-2">
            <div className="label">Mode</div>
            <select className="input" value={historyMode} onChange={(e) => setHistoryMode(e.target.value)}>
              <option value="perKelas">Per Kelas & Mapel</option>
              <option value="semuaSaya">Semua tugas saya</option>
            </select>
          </div>

          <div>
            <div className="label">Kelas</div>
            <select className="input" value={kelas} onChange={(e) => setKelas(e.target.value)} disabled={historyMode === 'semuaSaya' && !myKelasList.length}>
              <option value="">(Semua)</option>
              {myKelasList.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="label">Mapel</div>
            <select className="input" value={mapel} onChange={(e) => setMapel(e.target.value)}>
              <option value="">(Semua)</option>
              {myMapelList.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="label">Filter Waktu</div>
            <select className="input" value={timeFilterType} onChange={(e) => setTimeFilterType(e.target.value)}>
              <option value="today">Hari ini</option>
              <option value="all">Semua</option>
              <option value="month">Bulan</option>
              <option value="range">Rentang Tanggal</option>
            </select>
          </div>

          {timeFilterType === 'month' && (
            <div>
              <div className="label">Bulan</div>
              <input type="month" className="input" value={monthVal} onChange={(e) => setMonthVal(e.target.value)} />
            </div>
          )}

          {timeFilterType === 'range' && (
            <>
              <div>
                <div className="label">Dari</div>
                <input type="date" className="input" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
              </div>
              <div>
                <div className="label">Sampai</div>
                <input type="date" className="input" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
              </div>
            </>
          )}
        </div>

        {/* List grouped by Kelas • Mapel */}
        {groupedList.length ? (
          <div className="space-y-4">
            {groupedList.map((group) => (
              <div key={group.key} className="border rounded-xl p-3">
                <div className="font-semibold mb-2">{group.key}</div>
                <div className="grid md:grid-cols-2 gap-2">
                  {group.items.map((t) => (
                    <div
                      key={t.id}
                      className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedTugas(t)}
                    >
                      <div className="font-medium">{t.judul}</div>
                      <div className="muted text-xs">
                        Dibuat: {new Date(t.createdAt || Date.now()).toLocaleString('id-ID')}
                        {t.deadline && <> • Deadline: {new Date(t.deadline).toLocaleString('id-ID')}</>}
                      </div>
                      {t.keterangan && (
                        <p className="text-sm mt-1 line-clamp-2 whitespace-pre-wrap">{t.keterangan}</p>
                      )}
                      {(t.fileURL || t.link) && (
                        <div className="flex gap-2 mt-2">
                          {renderLink(t.fileURL, 'Lampiran')}
                          {renderLink(t.link, 'Link Eksternal')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">Belum ada data tugas untuk filter ini.</div>
        )}
      </div>

      {/* ============ Detail & Penilaian ============ */}
      {selectedTugas && (
        <div className="card">
          {isEditingTugas ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">Edit Tugas</h3>
              </div>
              <div>
                <label className="label">Judul</label>
                <input className="input" name="judul" value={editForm.judul} onChange={handleEditFormChange} />
              </div>
              <div>
                <label className="label">Deadline</label>
                <input className="input" type="datetime-local" name="deadline" value={editForm.deadline} onChange={handleEditFormChange} />
              </div>
              <div>
                <label className="label">Keterangan</label>
                <textarea className="input" rows="3" name="keterangan" value={editForm.keterangan} onChange={handleEditFormChange} />
              </div>
              <div>
                <label className="label">Link Eksternal</label>
                <input className="input" name="link" value={editForm.link} onChange={handleEditFormChange} />
              </div>
              <div>
                <label className="label">Link Foto/File</label>
                <input className="input" name="fileURL" value={editForm.fileURL} onChange={handleEditFormChange} />
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn bg-white border" onClick={cancelEditTugas}>Batal</button>
                <button className="btn btn-primary" onClick={simpanEditTugas}>Simpan Perubahan</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-bold text-lg leading-tight">{selectedTugas.judul}</div>
                  <div className="muted text-sm">
                    {selectedTugas.kelas} • {selectedTugas.mapel} • deadline {new Date(selectedTugas.deadline).toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn bg-white border" onClick={openEditTugas}>Edit</button>
                  <button className="btn bg-white border" onClick={() => setSelectedTugas(null)}>Tutup</button>
                </div>
              </div>

              <p className="text-sm my-2 whitespace-pre-wrap">{selectedTugas.keterangan}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {renderLink(selectedTugas.fileURL, 'Lihat File/Foto Tugas')}
                {renderLink(selectedTugas.link, 'Buka Link Eksternal Tugas')}
              </div>

              <hr className="my-3" />

              {isLoadingDetail ? (
                <div className="muted">Memuat data pengumpulan...</div>
              ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Sudah dinilai (Biru) */}
                  <div className="border rounded-lg p-3 bg-blue-50 border-blue-200">
                    <h4 className="font-semibold text-blue-700 mb-2">
                      Sudah dinilai ({siswaDinilai.length})
                    </h4>
                    {siswaDinilai.length === 0 && <div className="muted text-sm">Tidak ada.</div>}
                    {siswaDinilai.map((s) => (
                      <div key={s.uid} className="bg-white rounded-md border mb-2 p-2">
                        <div className="font-medium">{s.nama}</div>
                        <div className="text-xs muted">Nilai: {s.jawaban.nilai}</div>
                        <a
                          href={s.jawaban.fileURL || s.jawaban.linkURL}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-xs bg-blue-100 text-blue-700 mt-1"
                        >
                          Buka Jawaban
                        </a>
                      </div>
                    ))}
                  </div>

                  {/* Sudah mengerjakan (Hijau) – tambahkan tombol Buka Jawaban */}
                  <div className="border rounded-lg p-3 bg-green-50 border-green-200">
                    <h4 className="font-semibold text-green-700 mb-2">
                      Sudah mengerjakan (belum dinilai) ({siswaDikerjakan.length})
                    </h4>
                    {siswaDikerjakan.length === 0 && <div className="muted text-sm">Tidak ada.</div>}
                    {siswaDikerjakan.map((s) => {
                      const url = s.jawaban.fileURL || s.jawaban.linkURL
                      return (
                        <div key={s.uid} className="bg-white rounded-md border mb-2 p-2">
                          <div className="font-medium">{s.nama}</div>
                          <div className="text-xs muted">
                            Submit: {new Date(s.jawaban.waktuSubmit).toLocaleString('id-ID')}
                          </div>

                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-xs bg-blue-100 text-blue-700 mt-2"
                            >
                              Buka Jawaban
                            </a>
                          )}

                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="number"
                              className="input w-24"
                              placeholder="0-100"
                              value={nilaiInput[s.uid] || ''}
                              onChange={(e) =>
                                setNilaiInput((p) => ({ ...p, [s.uid]: e.target.value }))
                              }
                            />
                            <button className="btn btn-primary btn-sm" onClick={() => simpanNilai(s.uid)}>
                              Simpan Nilai
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Belum mengerjakan (Merah) */}
                  <div className="border rounded-lg p-3 bg-red-50 border-red-200">
                    <h4 className="font-semibold text-red-700 mb-2">
                      Belum mengerjakan ({siswaBelum.length})
                    </h4>
                    {siswaBelum.length === 0 && (
                      <div className="muted text-sm">Semua siswa sudah mengumpulkan.</div>
                    )}
                    {siswaBelum.map((s) => (
                      <div key={s.uid} className="bg-white rounded-md border mb-2 p-2">
                        <div className="font-medium">{s.nama}</div>
                        <div className="text-xs muted">(Belum ada data pengumpulan)</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
