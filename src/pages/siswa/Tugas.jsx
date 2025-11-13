// src/pages/siswa/STugas.jsx
import React, { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { rOn, rSet } from '../../lib/firebase'
import { uploadFile, SUPABASE_BUCKET } from '../../lib/supabase'
import FileDropzone from '../../components/FileDropzone'
import { useUI } from '../../store/useUIStore'

// Helper: nama hari dari tanggal
const getDayName = (tglString) => {
  const date = new Date(tglString)
  if (Number.isNaN(date.getTime())) return ''
  const HARI_MAP_JS = [
    'Minggu',
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
  ]
  return HARI_MAP_JS[date.getDay()]
}

// Helper: format deadline lengkap
const formatDeadline = (isoString) => {
  if (!isoString) return '-'
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '-'
  const hari = getDayName(isoString)
  const tanggal = d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const jam = d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${hari}, ${tanggal} ${jam} WIB`
}

// Helper: render link / gambar
const renderLink = (url, text) => {
  if (!url) return null
  try {
    if (/\.(jpeg|jpg|gif|png|webp)$/i.test(url)) {
      return (
        <img
          src={url}
          alt="lampiran"
          className="max-w-xs max-h-40 rounded-lg mt-2"
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

export default function STugas() {
  const { profile, user } = useAuthStore()
  const { pushToast } = useUI()

  // Filter list tugas utama (by hari & mapel)
  const [qHari, setQHari] = useState('')
  const [qMapel, setQMapel] = useState('')

  const [tugas, setTugas] = useState([])
  const [allMapelList, setAllMapelList] = useState([])
  const [now, setNow] = useState(Date.now())

  const [jawabanList, setJawabanList] = useState({})
  const [uploadMode, setUploadMode] = useState({}) // { [tugasId]: 'file' | 'link' }
  const [linkInput, setLinkInput] = useState({})
  const [isUploading, setIsUploading] = useState(null) // tugas.id yg sedang upload

  // ==== State untuk RIWAYAT ====
  const [historyMapel, setHistoryMapel] = useState('')
  const [historyStatus, setHistoryStatus] = useState('all') // all | submitted | not_submitted | graded
  const [historyTimeType, setHistoryTimeType] = useState('all') // all | month | range
  const [historyDateStart, setHistoryDateStart] = useState('')
  const [historyDateEnd, setHistoryDateEnd] = useState('')
  const [historyMonth, setHistoryMonth] = useState('')

  useEffect(() => {
    if (!profile?.kelas) return

    // 1. Tugas per kelas
    const unsubTugas = rOn(`tugas/${profile.kelas}`, (val) => {
      const arr = Object.entries(val || {}).map(([id, v]) => ({ id, ...v }))
      setTugas(arr)

      const mapelSet = new Set(arr.map((t) => t.mapel))
      setAllMapelList(Array.from(mapelSet).sort())
    })

    // 2. Semua jawaban (nanti difilter per user)
    const unsubJawaban = rOn('tugas_jawaban', (val) => {
      setJawabanList(val || {})
    })

    const iv = setInterval(() => setNow(Date.now()), 60000)

    return () => {
      typeof unsubTugas === 'function' && unsubTugas()
      typeof unsubJawaban === 'function' && unsubJawaban()
      clearInterval(iv)
    }
  }, [profile?.kelas])

  // ===== Upload file jawaban ke Supabase =====
  async function onUpload(task, files) {
    if (!files || files.length === 0) return
    const f = files[0]

    const allowedExt = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png']
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    if (!allowedExt.includes(ext)) {
      return pushToast({
        title: 'Format file tidak diizinkan',
        text: 'Gunakan pdf/doc/docx/ppt/pptx/jpg/jpeg/png',
        status: 'error',
      })
    }

    setIsUploading(task.id)

    try {
      // path di bucket: tugas_jawaban/<idTugas>/<uid>.<ext>
      const path = `tugas_jawaban/${task.id}/${user.uid}.${ext}`

      // uploadFile sudah upsert: true, jadi file lama ketimpa
      const url = await uploadFile(SUPABASE_BUCKET, path, f)

      await rSet(`tugas_jawaban/${task.id}/${user.uid}`, {
        fileURL: url,
        linkURL: null,
        fileName: f.name,
        waktuSubmit: Date.now(),
        status: 'dikumpulkan',
        nilai: null, // reset nilai jika submit ulang
      })

      pushToast({ title: 'Tugas berhasil dikumpulkan!', status: 'success' })
    } catch (err) {
      console.error(err)
      pushToast({
        title: 'Gagal mengupload',
        text: err.message,
        status: 'error',
      })
    } finally {
      setIsUploading(null)
    }
  }

  // ===== Kirim link jawaban =====
  async function onSendLink(task) {
    const link = (linkInput[task.id] || '').trim()
    if (!link || !/^https?:\/\//i.test(link)) {
      return pushToast({
        title: 'Link tidak valid',
        text: 'Pastikan link diawali dengan http:// atau https://',
        status: 'error',
      })
    }

    setIsUploading(task.id)

    try {
      await rSet(`tugas_jawaban/${task.id}/${user.uid}`, {
        fileURL: null,
        linkURL: link,
        fileName: 'Link Eksternal',
        waktuSubmit: Date.now(),
        status: 'dikumpulkan',
        nilai: null,
      })

      pushToast({
        title: 'Tugas (link) berhasil dikumpulkan!',
        status: 'success',
      })
      setLinkInput((prev) => ({ ...prev, [task.id]: '' }))
    } catch (err) {
      console.error(err)
      pushToast({
        title: 'Gagal mengirim link',
        text: err.message,
        status: 'error',
      })
    } finally {
      setIsUploading(null)
    }
  }

  // ===== Filter tugas utama berdasar hari & mapel =====
  const filteredTugas = useMemo(() => {
    return tugas
      .filter((t) => {
        const hariTugas = getDayName(t.deadline)
        const okHari = qHari ? hariTugas === qHari : true
        const okMapel = qMapel ? t.mapel === qMapel : true
        return okHari && okMapel
      })
      .sort(
        (a, b) =>
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
      )
  }, [tugas, qHari, qMapel])

  const HARI_FILTER = [
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
    'Minggu',
  ]

  // ===== RIWAYAT: hitung list + filter waktu/status/mapel =====
  const historyList = useMemo(() => {
    const myUid = user?.uid
    if (!myUid) return []

    const matchTime = (deadline) => {
      if (historyTimeType === 'all') return true
      const d = new Date(deadline)
      const ts = d.getTime()
      if (Number.isNaN(ts)) return false

      if (historyTimeType === 'range') {
        const s = historyDateStart
          ? new Date(`${historyDateStart}T00:00:00`).getTime()
          : -Infinity
        const e = historyDateEnd
          ? new Date(`${historyDateEnd}T23:59:59`).getTime()
          : Infinity
        return ts >= s && ts <= e
      }

      if (historyTimeType === 'month' && historyMonth) {
        const [y, m] = historyMonth.split('-').map(Number)
        if (!y || !m) return true
        const start = new Date(y, m - 1, 1).getTime()
        const end = new Date(y, m, 0, 23, 59, 59, 999).getTime()
        return ts >= start && ts <= end
      }

      return true
    }

    return tugas
      .filter((t) => {
        if (historyMapel && t.mapel !== historyMapel) return false
        if (!matchTime(t.deadline)) return false

        const jawaban = jawabanList[t.id]?.[myUid]
        const status = jawaban
          ? jawaban.nilai != null
            ? 'graded'
            : 'submitted'
          : 'not_submitted'

        if (historyStatus === 'submitted' && status !== 'submitted')
          return false
        if (historyStatus === 'not_submitted' && status !== 'not_submitted')
          return false
        if (historyStatus === 'graded' && status !== 'graded') return false

        return true
      })
      .map((t) => {
        const jawaban = jawabanList[t.id]?.[myUid]
        const status = jawaban
          ? jawaban.nilai != null
            ? 'graded'
            : 'submitted'
          : 'not_submitted'
        return { ...t, status, jawaban }
      })
      .sort(
        (a, b) =>
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
      )
  }, [
    tugas,
    jawabanList,
    user?.uid,
    historyMapel,
    historyStatus,
    historyTimeType,
    historyDateStart,
    historyDateEnd,
    historyMonth,
  ])

  const statusBadgeClass = (status) => {
    if (status === 'graded') return 'bg-blue-600 text-white'
    if (status === 'submitted') return 'bg-green-600 text-white'
    return 'bg-red-600 text-white'
  }
  const statusCardClass = (status) => {
    if (status === 'graded') return 'bg-blue-50 border-blue-200'
    if (status === 'submitted') return 'bg-green-50 border-green-200'
    return 'bg-red-50 border-red-200'
  }
  const statusLabel = {
    graded: 'Sudah Dinilai',
    submitted: 'Sudah Dikumpulkan',
    not_submitted: 'Belum Dikumpulkan',
  }

  return (
    <div className="space-y-4">
      {/* ========== Daftar Tugas Aktif ========== */}
      {/* Filter hari & mapel */}
      <div className="card">
        <div className="font-bold mb-2">Daftar Tugas</div>
        <div className="flex flex-wrap gap-2">
          <select
            className="input max-w-xs"
            value={qHari}
            onChange={(e) => setQHari(e.target.value)}
          >
            <option value="">Semua Hari</option>
            {HARI_FILTER.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <select
            className="input max-w-xs"
            value={qMapel}
            onChange={(e) => setQMapel(e.target.value)}
          >
            <option value="">Semua Mapel</option>
            {allMapelList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs muted mt-1">
          Filter di atas menyaring tugas berdasarkan hari deadline dan mata
          pelajaran.
        </p>
      </div>

      {/* List tugas utama + form pengumpulan */}
      <div className="grid md:grid-cols-2 gap-3">
        {filteredTugas.map((t) => {
          const isClosed = new Date(t.deadline).getTime() < now
          const myJawaban = jawabanList[t.id]?.[user.uid]
          const mode = uploadMode[t.id] || 'file'

          const sudahDinilai =
            myJawaban && myJawaban.nilai !== null && myJawaban.nilai !== undefined

          return (
            <div
              key={t.id}
              className={`card ${
                isClosed && !myJawaban ? 'bg-gray-50 opacity-70' : ''
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-semibold">{t.judul}</div>
                  <div className="muted text-xs">
                    {t.mapel} • Deadline {formatDeadline(t.deadline)}
                  </div>
                </div>
                {myJawaban && (
                  <span
                    className={
                      'text-[11px] px-2 py-1 rounded-full ' +
                      (sudahDinilai
                        ? 'bg-blue-600 text-white'
                        : 'bg-green-600 text-white')
                    }
                  >
                    {sudahDinilai ? 'Sudah Dinilai' : 'Sudah Dikumpulkan'}
                  </span>
                )}
              </div>

              <p className="text-sm my-2 whitespace-pre-wrap">
                {t.keterangan}
              </p>

              {/* Lampiran dari guru */}
              <div className="flex flex-wrap gap-2 mb-2">
                {renderLink(t.fileURL, 'Lihat File/Foto Tugas')}
                {renderLink(t.link, 'Buka Link Eksternal Tugas')}
              </div>

              <hr className="my-3" />

              {/* Loading upload */}
              {isUploading === t.id && (
                <div className="card bg-blue-50 text-blue-700">
                  Mengirim tugas, mohon tunggu...
                </div>
              )}

              {/* Info jika sudah mengumpulkan */}
              {myJawaban && (
                <div className="space-y-2">
                  <div className="font-semibold text-green-600">
                    Tugas Terkumpul
                  </div>
                  <a
                    href={myJawaban.fileURL || myJawaban.linkURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm bg-gray-100"
                  >
                    Lihat Jawaban Anda: {myJawaban.fileName}
                  </a>
                  <div className="border-t pt-2">
                    <div className="label">Nilai Anda:</div>
                    <div className="text-2xl font-bold">
                      {sudahDinilai ? myJawaban.nilai : 'Belum Dinilai'}
                    </div>
                  </div>
                  {!isClosed && (
                    <div className="text-xs muted">
                      Anda bisa mengumpulkan ulang di bawah jika perlu (file
                      lama akan tertimpa).
                    </div>
                  )}
                </div>
              )}

              {/* Form kumpul (boleh submit ulang selama belum lewat deadline) */}
              {!isClosed && isUploading !== t.id && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <button
                      className={`btn btn-sm ${
                        mode === 'file' ? 'btn-primary' : 'bg-white border'
                      }`}
                      onClick={() =>
                        setUploadMode((p) => ({ ...p, [t.id]: 'file' }))
                      }
                    >
                      Upload File
                    </button>
                    <button
                      className={`btn btn-sm ${
                        mode === 'link' ? 'btn-primary' : 'bg-white border'
                      }`}
                      onClick={() =>
                        setUploadMode((p) => ({ ...p, [t.id]: 'link' }))
                      }
                    >
                      Kirim Link
                    </button>
                  </div>

                  {mode === 'file' ? (
                    <FileDropzone
                      onFiles={(fs) => onUpload(t, fs)}
                      disabled={isClosed}
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                    />
                  ) : (
                    <div className="flex gap-2">
                      <input
                        className="input"
                        placeholder="https://drive.google.com/..."
                        value={linkInput[t.id] || ''}
                        onChange={(e) =>
                          setLinkInput((p) => ({
                            ...p,
                            [t.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        className="btn btn-primary"
                        onClick={() => onSendLink(t)}
                      >
                        Kirim
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Sudah tutup dan belum kumpul */}
              {isClosed && !myJawaban && (
                <div className="text-sm text-red-600 mt-1 p-2 bg-red-50 rounded-lg">
                  Upload ditutup setelah deadline. Anda belum mengumpulkan
                  tugas ini.
                </div>
              )}
            </div>
          )
        })}

        {filteredTugas.length === 0 && (
          <div className="muted">Tidak ada tugas untuk filter ini.</div>
        )}
      </div>

      {/* ========== RIWAYAT TUGAS SAYA ========== */}
      <div className="card">
        <div className="font-bold mb-2">Riwayat Tugas Saya</div>

        {/* Filter riwayat */}
        <div className="grid md:grid-cols-6 gap-2 mb-3">
          <div>
            <div className="label">Mapel</div>
            <select
              className="input"
              value={historyMapel}
              onChange={(e) => setHistoryMapel(e.target.value)}
            >
              <option value="">(Semua)</option>
              {allMapelList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="label">Status</div>
            <select
              className="input"
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
            >
              <option value="all">Semua</option>
              <option value="submitted">Sudah dikumpulkan</option>
              <option value="not_submitted">Belum dikumpulkan</option>
              <option value="graded">Sudah dinilai</option>
            </select>
          </div>

          <div>
            <div className="label">Filter Waktu</div>
            <select
              className="input"
              value={historyTimeType}
              onChange={(e) => setHistoryTimeType(e.target.value)}
            >
              <option value="all">Semua</option>
              <option value="month">Bulan</option>
              <option value="range">Rentang Tanggal</option>
            </select>
          </div>

          {historyTimeType === 'month' && (
            <div>
              <div className="label">Bulan</div>
              <input
                type="month"
                className="input"
                value={historyMonth}
                onChange={(e) => setHistoryMonth(e.target.value)}
              />
            </div>
          )}

          {historyTimeType === 'range' && (
            <>
              <div>
                <div className="label">Dari</div>
                <input
                  type="date"
                  className="input"
                  value={historyDateStart}
                  onChange={(e) => setHistoryDateStart(e.target.value)}
                />
              </div>
              <div>
                <div className="label">Sampai</div>
                <input
                  type="date"
                  className="input"
                  value={historyDateEnd}
                  onChange={(e) => setHistoryDateEnd(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* List riwayat: warna merah/hijau/biru */}
        {historyList.length ? (
          <div className="space-y-2">
            {historyList.map((t) => (
              <div
                key={t.id}
                className={
                  'border rounded-lg p-3 ' + statusCardClass(t.status)
                }
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-semibold">{t.judul}</div>
                    <div className="muted text-xs">
                      {t.mapel} • Deadline {formatDeadline(t.deadline)}
                    </div>
                  </div>
                  <span
                    className={
                      'text-[11px] px-2 py-1 rounded-full ' +
                      statusBadgeClass(t.status)
                    }
                  >
                    {statusLabel[t.status]}
                  </span>
                </div>

                <p className="text-sm mt-1 whitespace-pre-wrap">
                  {t.keterangan}
                </p>

                {t.jawaban && (
                  <div className="mt-2 flex flex-wrap gap-2 items-center">
                    <a
                      href={t.jawaban.fileURL || t.jawaban.linkURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-xs bg-gray-100"
                    >
                      Lihat Jawaban
                    </a>
                    <span className="text-xs muted">
                      Disubmit:{' '}
                      {new Date(
                        t.jawaban.waktuSubmit,
                      ).toLocaleString('id-ID')}
                    </span>
                    {t.jawaban.nilai != null && (
                      <span className="text-xs font-semibold">
                        Nilai: {t.jawaban.nilai}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">
            Belum ada riwayat tugas untuk filter ini.
          </div>
        )}
      </div>
    </div>
  )
}
