// src/pages/guru/profile.jsx
import React from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { rSet } from '../../lib/firebase'
import { uploadFile, SUPABASE_BUCKET } from '../../lib/supabase'
import { sendEmailVerification } from 'firebase/auth'

/* ========= Helper: kompres gambar ke <= 1MB ========= */
async function compressImageTo1MB(file, maxBytes = 1024 * 1024) {
  if (!file || file.size <= maxBytes) return file

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
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
  let blob = await new Promise(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )

  while (blob && blob.size > maxBytes && quality > 0.3) {
    quality -= 0.1
    blob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
  }

  if (!blob) return file
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', {
    type: 'image/jpeg',
  })
}

/* ==================== COMPONENT ==================== */
export default function GProfile() {
  const { user, profile, logout } = useAuthStore()

  const [form, setForm] = React.useState({
    nama: profile?.nama || '',
    jk: profile?.jk || '',
    agama: profile?.agama || '',
    jabatan: profile?.jabatan || '',
    telp: profile?.telp || '',
    alamat: profile?.alamat || '',
    tanggalLahir: profile?.tanggalLahir || '',
  })

  const [photoURL, setPhotoURL] = React.useState(
    profile?.photoURL || profile?.avatar || profile?.foto || '',
  )
  const [preview, setPreview] = React.useState(photoURL)

  const [saving, setSaving] = React.useState(false)
  const [notif, setNotif] = React.useState(null)
  const [sendingVerify, setSendingVerify] = React.useState(false)

  // sync ketika profile berubah (misal baru selesai fetch)
  React.useEffect(() => {
    if (!profile) return
    setForm({
      nama: profile.nama || '',
      jk: profile.jk || '',
      agama: profile.agama || '',
      jabatan: profile.jabatan || '',
      telp: profile.telp || '',
      alamat: profile.alamat || '',
      tanggalLahir: profile.tanggalLahir || '',
    })
    const pUrl = profile.photoURL || profile.avatar || profile.foto || ''
    setPhotoURL(pUrl)
    setPreview(pUrl)
  }, [profile])

  function handleFieldChange(key, value) {
    setForm(s => ({ ...s, [key]: value }))
  }

  // ==== Ganti foto → kompres → upload → simpan otomatis ====
  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user?.uid) return

    setSaving(true)
    setNotif(null)

    try {
      const compressed = await compressImageTo1MB(file)
      const localPreview = URL.createObjectURL(compressed)
      setPreview(localPreview)

      const url = await uploadFile(
        SUPABASE_BUCKET,
        `${user.uid}.jpg`, // nama file tetap → timpa file lama
        compressed,
      )

      setPhotoURL(url)

      // update hanya field foto
      await rSet(`users/${user.uid}/photoURL`, url)
      await rSet(`users/${user.uid}/avatar`, null)
      await rSet(`users/${user.uid}/foto`, null)

      setNotif({
        type: 'success',
        message: 'Foto profil berhasil diperbarui.',
      })
    } catch (err) {
      console.error('Error ganti foto:', err)
      setNotif({
        type: 'error',
        message:
          'Gagal mengganti foto: ' +
          (err.message || 'Periksa koneksi / konfigurasi Supabase.'),
      })
    } finally {
      setSaving(false)
    }
  }

  // ==== Simpan data teks ====
  async function onSave() {
    if (!user) return
    setNotif(null)
    setSaving(true)

    try {
      const baseProfile = profile || {}

      await rSet(`users/${user.uid}`, {
        ...baseProfile,
        ...form,
        uid: user.uid,
        email: user.email ?? baseProfile.email,
        role: baseProfile.role ?? 'guru',
        photoURL: photoURL || baseProfile.photoURL || '',
        avatar: null,
        foto: null,
      })

      setNotif({
        type: 'success',
        message: 'Data profil Anda berhasil disimpan.',
      })
    } catch (err) {
      console.error('Error rSet profil:', err)
      setNotif({
        type: 'error',
        message:
          'Gagal menyimpan profil: ' +
          (err.message || 'Terjadi kesalahan. Coba lagi nanti.'),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleSendVerification() {
    if (!user?.email) {
      setNotif({
        type: 'error',
        message: 'Email tidak tersedia.',
      })
      return
    }
    setSendingVerify(true)
    setNotif(null)
    try {
      await sendEmailVerification(user)
      setNotif({
        type: 'success',
        message:
          'Email verifikasi sudah dikirim. Silakan cek inbox / folder spam.',
      })
    } catch (err) {
      console.error(err)
      setNotif({
        type: 'error',
        message:
          'Gagal mengirim email verifikasi: ' +
          (err.message || 'Coba lagi nanti.'),
      })
    } finally {
      setSendingVerify(false)
    }
  }

  const email = user?.email || profile?.email || ''
  const emailVerified = !!user?.emailVerified

  return (
    <div className="w-full px-6 py-6">
      <div className="card w-full">
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-bold text-xl">Profil Guru</h1>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* ========== KOLOM KIRI: FOTO + INFO RINGKAS + LOGOUT ========== */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="relative w-24 h-24">
              {preview ? (
                <img
                  src={preview}
                  alt="Foto Profil"
                  className="w-24 h-24 rounded-full object-cover border"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 border flex items-center justify-center text-3xl text-gray-500">
                  📷
                </div>
              )}

              {saving && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                  <svg
                    className="animate-spin h-6 w-6 text-white"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                </div>
              )}

              <label
                htmlFor="photo-input"
                className="absolute bottom-0 right-0 bg-primary text-white text-xs px-2 py-1 rounded-full cursor-pointer shadow"
              >
                Ubah
              </label>
              <input
                id="photo-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="text-center md:text-left">
              <div className="font-semibold text-lg">
                {form.nama || profile?.nama || '-'}
              </div>
              <div className="text-xs text-gray-500">
                {form.jabatan || profile?.jabatan || 'Guru'}
              </div>
              <div className="text-xs text-gray-500">{email || '-'}</div>
            </div>

            <button
              type="button"
              className="btn btn-danger btn-sm mt-2 w-full md:w-auto"
              onClick={logout}
            >
              Logout
            </button>
          </div>

          {/* ========== KOLOM KANAN: FORM DETAIL ========== */}
          <div className="md:col-span-2 space-y-3">
            {/* Nama */}
            <div>
              <label className="label">Nama Lengkap</label>
              <input
                className="input"
                value={form.nama}
                onChange={e => handleFieldChange('nama', e.target.value)}
              />
            </div>

            {/* Jenis Kelamin */}
            <div>
              <label className="label">Jenis Kelamin</label>
              <select
                className="input"
                value={form.jk}
                onChange={e => handleFieldChange('jk', e.target.value)}
              >
                <option value="">Pilih</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>

            {/* Agama */}
            <div>
              <label className="label">Agama</label>
              <input
                className="input"
                value={form.agama}
                onChange={e => handleFieldChange('agama', e.target.value)}
              />
            </div>

            {/* Jabatan (read-only) */}
            <div>
              <label className="label">Jabatan</label>
              <input
                className="input bg-gray-50"
                value={form.jabatan}
                readOnly
              />
              <p className="text-xs text-gray-500 mt-1">
                Jabatan diatur oleh admin. Hubungi admin jika ada perubahan.
              </p>
            </div>

            {/* Nomor HP */}
            <div>
              <label className="label">Nomor HP</label>
              <input
                className="input"
                type="tel"
                placeholder="08xxxxxxxxxx"
                value={form.telp}
                onChange={e => handleFieldChange('telp', e.target.value)}
              />
            </div>

            {/* Alamat */}
            <div>
              <label className="label">Alamat</label>
              <textarea
                className="input"
                rows={2}
                value={form.alamat}
                onChange={e => handleFieldChange('alamat', e.target.value)}
              />
            </div>

            {/* Tanggal Lahir */}
            <div>
              <label className="label">Tanggal Lahir</label>
              <input
                className="input"
                type="date"
                value={form.tanggalLahir}
                onChange={e =>
                  handleFieldChange('tanggalLahir', e.target.value)
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Pilih tanggal lahir Anda (hari / bulan / tahun).
              </p>
            </div>

            {/* Email + status verifikasi */}
            <div>
              <label className="label">Email</label>
              <input className="input bg-gray-50" value={email} readOnly />

              <div className="flex items-center gap-2 mt-1">
                <span
                  className={
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ' +
                    (emailVerified
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700')
                  }
                >
                  {emailVerified ? 'Terverifikasi' : 'Belum verifikasi'}
                </span>

                {!emailVerified && (
                  <button
                    type="button"
                    className="btn btn-xs btn-primary"
                    onClick={handleSendVerification}
                    disabled={sendingVerify}
                  >
                    {sendingVerify ? 'Mengirim...' : 'Kirim Email Verifikasi'}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Kami akan mengirimkan link verifikasi ke email Anda.
              </p>
            </div>

            <button
              className="btn btn-primary w-full mt-2"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>

        {notif && (
          <div
            className={
              'mt-4 text-sm rounded-lg px-3 py-2 border ' +
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
  )
}
