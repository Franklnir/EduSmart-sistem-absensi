// src/pages/admin/APengaturan.jsx
import React from 'react'
// Impor dari Firebase RTDB
import { rSet, rGet } from '../../lib/firebase'
// Impor fungsi dari Supabase
import { uploadFile, SUPABASE_BUCKET } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'

// --- KONFIGURASI ---
const SETTINGS_PATH = 'pengaturan'
const LOGO_FILE_PATH = 'public/logo_sekolah.png' // Nama file permanen di bucket
// -------------------

/* Helper: parse string tahunAjaran dari DB ke {day, month, year}
   Mendukung:
   - "2024-07-01"
   - "2024/2025" (akan dianggap mulai 01-07-2024)
*/
function parseTahunAjaran(str) {
  if (!str) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-')
    return { year: y, month: m, day: d }
  }
  if (/^\d{4}\/\d{4}$/.test(str)) {
    const y = str.slice(0, 4)
    return { year: y, month: '07', day: '01' }
  }
  return null
}

// Helper: naikkan kelas "X A IPA" -> "XI A IPA" dst.
function naikKelasString(kelas) {
  if (!kelas || typeof kelas !== 'string') return kelas
  const m = kelas.match(/^(XII|XI|X)\s*(.*)$/i)
  if (!m) return kelas
  const grade = m[1].toUpperCase()
  const rest = m[2] ? m[2].trim() : ''
  let next = grade
  if (grade === 'X') next = 'XI'
  else if (grade === 'XI') next = 'XII'
  else if (grade === 'XII') return kelas // sudah paling atas

  return rest ? `${next} ${rest}` : next
}

/* Helper: kompres gambar ke <= 1MB (dipakai untuk logo & foto profil) */
async function compressImageTo1MB(file, maxBytes = 1024 * 1024) {
  if (!file || file.size <= maxBytes) return file

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const img = await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const maxDim = 1024
  let { width, height } = img
  const ratio = Math.min(1, maxDim / width, maxDim / height)
  width *= ratio
  height *= ratio
  canvas.width = width
  canvas.height = height
  ctx.drawImage(img, 0, 0, width, height)

  let quality = 0.9
  let blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )

  while (blob && blob.size > maxBytes && quality > 0.3) {
    quality -= 0.1
    blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
  }

  if (!blob) return file
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', {
    type: 'image/jpeg',
  })
}

export default function APengaturan() {
  const { user, profile, logout } = useAuthStore()

  // Form state
  const [form, setForm] = React.useState({
    namaSekolah: '',
    tahunAjaran: '',
    semesterAktif: '',
    email: '',
    telepon: '',
    alamat: '',
    geminiApiKey: '', // sudah tidak dipakai di UI, tapi aman kalau masih ada
    logoUrl: '',
    registrasiSiswaAktif: true,
    registrasiGuruAktif: true,
    registrasiAdminAktif: false,
  })

  // State untuk dropdown Tahun Ajaran
  const now = new Date()
  const [taParts, setTaParts] = React.useState({
    day: '01',
    month: '07',
    year: String(now.getFullYear()),
  })
  const [initialTahunAjaran, setInitialTahunAjaran] = React.useState('')

  // UI state
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [uploadingLogo, setUploadingLogo] = React.useState(false)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  const [notif, setNotif] = React.useState(null)
  const [selectedFile, setSelectedFile] = React.useState(null)

  // 1. Load data saat halaman dibuka
  React.useEffect(() => {
    async function loadSettings() {
      setLoading(true)
      try {
        const data = await rGet(SETTINGS_PATH)
        if (data) {
          setForm((prev) => ({ ...prev, ...data }))
          if (data.tahunAjaran) {
            setInitialTahunAjaran(data.tahunAjaran)
            const parsed = parseTahunAjaran(data.tahunAjaran)
            if (parsed) {
              setTaParts({
                day: parsed.day,
                month: parsed.month,
                year: parsed.year,
              })
            }
          }
        }
      } catch (err) {
        setNotif({ type: 'error', message: 'Gagal memuat pengaturan.' })
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  // 2. Handle perubahan input standar (butuh klik "Simpan")
  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // 2b. Handle perubahan dropdown Tahun Ajaran (day/month/year)
  function handleTahunAjaranPart(part, value) {
    setTaParts((prev) => {
      const next = { ...prev, [part]: value }
      const { day, month, year } = next
      if (year && month && day) {
        const str = `${year}-${month}-${day}`
        setForm((f) => ({ ...f, tahunAjaran: str }))
      }
      return next
    })
  }

  // 3. Handle perubahan checkbox (AUTO-SAVE)
  async function handleCheckboxChange(e) {
    const { name, checked } = e.target

    setForm((prev) => ({ ...prev, [name]: checked }))
    setNotif(null)

    try {
      await rSet(`${SETTINGS_PATH}/${name}`, checked)
      setNotif({
        type: 'success',
        message: 'Pengaturan registrasi berhasil diperbarui.',
      })
    } catch (err) {
      setNotif({
        type: 'error',
        message: 'Gagal menyimpan pengaturan: ' + err.message,
      })
    }
  }

  // 4. Handle pemilihan file logo (file mentah, nanti dikompres saat upload)
  function handleFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
    }
  }

  // Helper: naikkan kelas semua siswa
  async function naikkanKelasSemuaSiswa() {
    const users = await rGet('users')
    if (!users) return

    const tasks = []
    Object.entries(users).forEach(([uid, u]) => {
      if (u.role === 'siswa' && u.kelas) {
        const kelasBaru = naikKelasString(u.kelas)
        if (kelasBaru !== u.kelas) {
          tasks.push(rSet(`users/${uid}/kelas`, kelasBaru))
        }
      }
    })

    if (tasks.length) {
      await Promise.all(tasks)
    }
  }

  // Helper: proses perubahan tahun ajaran (+ konfirmasi & naik kelas)
  async function applyTahunAjaranChange() {
    const tahunBerubah =
      initialTahunAjaran &&
      form.tahunAjaran &&
      form.tahunAjaran !== initialTahunAjaran

    if (!tahunBerubah) return true

    const ok = window.confirm(
      'Tahun ajaran akan diubah dan semua siswa akan dinaikkan kelas (X → XI, XI → XII). Yakin?',
    )
    if (!ok) return false

    await naikkanKelasSemuaSiswa()
    setInitialTahunAjaran(form.tahunAjaran)
    return true
  }

  // 5a. UPLOAD LOGO (kompres jadi <= 1MB & menimpa file lama)
  async function handleLogoUpload() {
    if (!selectedFile) return
    setUploadingLogo(true)
    setNotif(null)
    try {
      const compressed = await compressImageTo1MB(selectedFile)
      const newLogoUrl = await uploadFile(
        SUPABASE_BUCKET,
        LOGO_FILE_PATH,
        compressed,
      )

      setForm((prev) => ({ ...prev, logoUrl: newLogoUrl }))
      await rSet(`${SETTINGS_PATH}/logoUrl`, newLogoUrl)
      setNotif({ type: 'success', message: 'Logo berhasil di-upload!' })
      setSelectedFile(null)
    } catch (err) {
      setNotif({ type: 'error', message: 'Gagal upload logo: ' + err.message })
    } finally {
      setUploadingLogo(false)
    }
  }

  // 5b. UPLOAD FOTO PROFIL ADMIN (kompres 1MB)
  async function handleAdminPhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user?.uid) return

    setUploadingAvatar(true)
    setNotif(null)
    try {
      const compressed = await compressImageTo1MB(file)
      // path tetap => file lama tertimpa
      const path = `profile/${user.uid}.jpg`
      const url = await uploadFile(SUPABASE_BUCKET, path, compressed)

      // simpan hanya field photoURL supaya tidak menimpa data lain
      await rSet(`users/${user.uid}/photoURL`, url)
      await rSet(`users/${user.uid}/avatar`, null)
      await rSet(`users/${user.uid}/foto`, null)

      setNotif({
        type: 'success',
        message: 'Foto profil admin berhasil diperbarui.',
      })
    } catch (err) {
      setNotif({
        type: 'error',
        message: 'Gagal upload foto profil: ' + err.message,
      })
    } finally {
      setUploadingAvatar(false)
      // reset value input supaya bisa pilih file yang sama lagi jika mau
      e.target.value = ''
    }
  }

  // 6a. Tombol SIMPAN KHUSUS TAHUN AJARAN
  async function handleSaveTahunAjaran() {
    if (!form.tahunAjaran) {
      setNotif({
        type: 'error',
        message: 'Tahun ajaran belum dipilih.',
      })
      return
    }

    setSaving(true)
    setNotif(null)
    try {
      const ok = await applyTahunAjaranChange()
      if (!ok) {
        setSaving(false)
        return
      }
      const existing = (await rGet(SETTINGS_PATH)) || {}
      await rSet(SETTINGS_PATH, {
        ...existing,
        tahunAjaran: form.tahunAjaran,
      })
      setNotif({
        type: 'success',
        message: 'Tahun ajaran berhasil disimpan.',
      })
    } catch (err) {
      setNotif({
        type: 'error',
        message: 'Gagal menyimpan tahun ajaran: ' + err.message,
      })
    } finally {
      setSaving(false)
    }
  }

  // 6b. Handle SIMPAN SEMUA PENGATURAN (untuk field teks)
  async function onSave() {
    setNotif(null)
    setSaving(true)
    try {
      const ok = await applyTahunAjaranChange()
      if (!ok) {
        setSaving(false)
        return
      }

      const dataToSave = { ...form }
      await rSet(SETTINGS_PATH, dataToSave)
      setNotif({ type: 'success', message: 'Pengaturan berhasil disimpan.' })
    } catch (err) {
      setNotif({
        type: 'error',
        message: 'Gagal menyimpan: ' + err.message,
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8">Memuat pengaturan...</div>
  }

  // Data untuk dropdown hari / bulan / tahun
  const days = Array.from({ length: 31 }, (_, i) =>
    String(i + 1).padStart(2, '0'),
  )
  const months = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
  ]
  const currentYear = now.getFullYear()
  const years = Array.from({ length: 7 }, (_, i) =>
    String(currentYear - 1 + i),
  )

  // data profil admin
  const avatarUrl =
    profile?.photoURL || profile?.avatar || profile?.foto || ''
  const displayName =
    profile?.nama || profile?.username || user?.email || 'Admin'
  const roleLabel = (profile?.role || 'admin').toUpperCase()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Kolom Kiri: Form Pengaturan */}
      <div className="md:col-span-2 space-y-6">
        {/* Kartu Identitas Sekolah */}
        <div className="card">
          <h2 className="font-bold text-xl mb-4">Identitas Sekolah</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Nama Sekolah</label>
              <input
                type="text"
                name="namaSekolah"
                className="input"
                value={form.namaSekolah}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="label">Email Sekolah</label>
              <input
                type="email"
                name="email"
                className="input"
                value={form.email}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="label">Nomor Telepon</label>
              <input
                type="tel"
                name="telepon"
                className="input"
                value={form.telepon}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="label">Alamat Sekolah</label>
              <textarea
                name="alamat"
                className="input"
                rows="3"
                value={form.alamat}
                onChange={handleChange}
              ></textarea>
            </div>
          </div>
        </div>

        {/* Kartu Akademik & Registrasi */}
        <div className="card">
          <h2 className="font-bold text-xl mb-4">Akademik & Registrasi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tahun Ajaran Aktif dengan dropdown tgl/bulan/tahun */}
            <div>
              <label className="label">
                Tahun Ajaran Aktif (Tanggal Mulai)
              </label>
              <div className="flex gap-2">
                <select
                  className="input"
                  value={taParts.day}
                  onChange={(e) =>
                    handleTahunAjaranPart('day', e.target.value)
                  }
                >
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={taParts.month}
                  onChange={(e) =>
                    handleTahunAjaranPart('month', e.target.value)
                  }
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={taParts.year}
                  onChange={(e) =>
                    handleTahunAjaranPart('year', e.target.value)
                  }
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Disimpan sebagai:{' '}
                <strong>{form.tahunAjaran || '-'}</strong>
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm mt-2"
                onClick={handleSaveTahunAjaran}
                disabled={saving}
              >
                {saving ? 'Menyimpan...' : 'Simpan Tahun Ajaran'}
              </button>
            </div>

            {/* Semester Aktif: Ganjil / Genap */}
            <div>
              <label className="label">Semester Aktif</label>
              <select
                name="semesterAktif"
                className="input"
                value={form.semesterAktif}
                onChange={handleChange}
              >
                <option value="">Pilih</option>
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
          </div>

          <div className="mt-6 border-t pt-4">
            <label className="label font-semibold">
              Halaman Registrasi Publik
            </label>
            <p className="text-sm text-gray-500 mb-2">
              Atur siapa saja yang bisa mendaftar akun baru.
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="registrasiSiswaAktif"
                  checked={form.registrasiSiswaAktif}
                  onChange={handleCheckboxChange}
                />
                <span>Buka pendaftaran untuk Siswa</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="registrasiGuruAktif"
                  checked={form.registrasiGuruAktif}
                  onChange={handleCheckboxChange}
                />
                <span>Buka pendaftaran untuk Guru</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="registrasiAdminAktif"
                  checked={form.registrasiAdminAktif}
                  onChange={handleCheckboxChange}
                />
                <span>Buka pendaftaran untuk Admin</span>
              </label>
              {form.registrasiAdminAktif && (
                <p className="text-xs text-red-500 pl-6">
                  PERINGATAN: Membuka pendaftaran admin untuk publik sangat
                  berisiko.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Kolom Kanan: Profil Admin + Logo + Tombol Simpan */}
      <div className="space-y-6">
        {/* Profil Admin */}
        <div className="card flex flex-col items-center text-center">
          <h2 className="font-bold text-xl mb-4">Profil Admin</h2>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Foto Profil"
              className="w-20 h-20 rounded-full object-cover border mb-2"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-200 border flex items-center justify-center text-lg font-semibold text-gray-600 mb-2">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="font-semibold">{displayName}</div>
          <div className="text-xs text-gray-500">{roleLabel}</div>
          <div className="text-xs text-gray-500 mb-3">{user?.email}</div>

          <div className="w-full space-y-2 mt-1">
            {/* tombol ubah foto profil (pakai label sebagai tombol) */}
            <label
              htmlFor="admin-avatar-input"
              className={
                'btn btn-secondary w-full cursor-pointer text-center ' +
                (uploadingAvatar ? 'opacity-75 pointer-events-none' : '')
              }
            >
              {uploadingAvatar ? 'Mengupload...' : 'Ubah Foto Profil'}
            </label>
            <input
              id="admin-avatar-input"
              type="file"
              accept="image/png, image/jpeg"
              className="hidden"
              onChange={handleAdminPhotoChange}
            />

            <button
              type="button"
              className="btn btn-danger w-full"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Logo Sekolah */}
        <div className="card">
          <h2 className="font-bold text-xl mb-4">Logo Sekolah</h2>
          {form.logoUrl ? (
            <img
              src={form.logoUrl}
              alt="Logo Sekolah"
              className="w-32 h-32 object-contain mb-4 bg-gray-100 rounded-lg p-2"
            />
          ) : (
            <div className="w-32 h-32 flex items-center justify-center bg-gray-100 rounded-lg mb-4 text-sm text-gray-500">
              Belum ada logo
            </div>
          )}

          <input
            type="file"
            accept="image/png, image/jpeg"
            className="input"
            onChange={handleFileChange}
          />

          <button
            className="btn btn-secondary w-full mt-2"
            onClick={handleLogoUpload}
            disabled={!selectedFile || uploadingLogo}
          >
            {uploadingLogo ? 'Mengupload...' : 'Upload Logo Baru (max ~1MB)'}
          </button>
        </div>

        {/* Tombol Simpan Semua */}
        <div className="card sticky top-20">
          <button
            className="btn btn-primary w-full"
            onClick={onSave}
            disabled={saving || uploadingLogo || uploadingAvatar}
          >
            {saving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}
          </button>

          {notif && (
            <div
              className={
                'mt-3 text-sm rounded-lg px-3 py-2 border ' +
                (notif.type === 'success'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200')
              }
            >
              {notif.message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
