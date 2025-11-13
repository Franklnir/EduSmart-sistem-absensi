import React, { useState, useEffect, useMemo } from 'react'
import { rOn, rSet, rGet } from '../../lib/firebase'

/* ===== Utils ===== */
const FORBIDDEN = /[.#$/[\]]/
const slug = (s = '') =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)

const confirmDelete = (msg = 'Yakin mau dihapus?') => window.confirm(msg)
const HARI_OPTS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

// ===================================================================
//    Halaman Home Admin (Pengumuman & Ekstrakurikuler)
// ===================================================================
export default function Home() {
  /* --- Data Umum (Guru & Siswa) --- */
  const [guruList, setGuruList] = useState([]) // {id, name}
  const [siswaList, setSiswaList] = useState([]) // {uid, nama, kelas}

  useEffect(() => {
    // users → guru & siswa
    rOn('users', (val) => {
      const entries = Object.entries(val || {})

      const guru = entries
        .filter(([_, u]) => u?.role === 'guru' || u?.role === 'teacher')
        .map(([uid, u]) => ({
          id: uid,
          name:
            (u.nama ||
              u.displayName ||
              u.username ||
              u.email ||
              uid) + (u.email ? ` (${u.email})` : ''),
        }))

      const siswa = entries
        .filter(([_, u]) => u?.role === 'siswa')
        .map(([uid, u]) => ({
          uid,
          nama: u.nama || u.displayName || u.username || u.email || uid,
          kelas: u.kelas || '',
        }))
        .sort(
          (a, b) =>
            (a.kelas || '').localeCompare(b.kelas || '', 'id') ||
            (a.nama || '').localeCompare(b.nama || '', 'id'),
        )

      setGuruList(guru.sort((a, b) => a.name.localeCompare(b.name, 'id')))
      setSiswaList(siswa)
    })

    // fallback guru legacy
    rOn('guru', (val) => {
      const rows = Object.entries(val || {}).map(([id, u]) => ({
        id,
        name: u.nama || u.name || u.email || id,
      }))
      setGuruList((prev) => {
        const m = new Map(prev.map((g) => [g.id, g]))
        rows.forEach((g) => {
          if (!m.has(g.id)) m.set(g.id, g)
        })
        return Array.from(m.values()).sort((a, b) =>
          a.name.localeCompare(b.name, 'id'),
        )
      })
    })

    rOn('teachers', (val) => {
      const rows = Object.entries(val || {}).map(([id, u]) => ({
        id,
        name: u.nama || u.name || u.email || id,
      }))
      setGuruList((prev) => {
        const m = new Map(prev.map((g) => [g.id, g]))
        rows.forEach((g) => {
          if (!m.has(g.id)) m.set(g.id, g)
        })
        return Array.from(m.values()).sort((a, b) =>
          a.name.localeCompare(b.name, 'id'),
        )
      })
    })
  }, [])

  // Map cepat: uid → {nama, kelas}
  const siswaMap = useMemo(() => {
    const m = {}
    siswaList.forEach((s) => {
      m[s.uid] = s
    })
    return m
  }, [siswaList])

  /* --- Section 1: Pengumuman --- */
  const [pengumumanList, setPengumumanList] = useState([])
  const [pForm, setPForm] = useState({
    judul: '',
    keterangan: '',
    target: 'semua',
  })
  const [pEditId, setPEditId] = useState(null)

  useEffect(() => {
    return rOn('pengumuman', (val) => {
      const rows = Object.entries(val || {}).map(([id, v]) => ({ id, ...v }))
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      setPengumumanList(rows)
    })
  }, [])

  async function simpanPengumuman(e) {
    e.preventDefault()
    const { judul, keterangan, target } = pForm
    if (!judul || !keterangan)
      return alert('Judul dan Keterangan wajib diisi.')

    const payload = {
      ...pForm,
      judul: judul.trim(),
      keterangan: keterangan.trim(),
      target: target || 'semua',
    }

    try {
      if (pEditId) {
        await rSet(`pengumuman/${pEditId}`, {
          ...payload,
          updatedAt: Date.now(),
        })
        alert('Pengumuman diperbarui!')
      } else {
        const id = slug(payload.judul) || Date.now().toString()
        const exist = await rGet(`pengumuman/${id}`)
        if (exist) return alert('Pengumuman dengan judul/ID ini sudah ada.')

        await rSet(`pengumuman/${id}`, {
          ...payload,
          id,
          createdAt: Date.now(),
        })
        alert('Pengumuman disimpan!')
      }
      cancelEditPengumuman()
    } catch (err) {
      console.error(err)
      alert('Gagal menyimpan: ' + err.message)
    }
  }

  async function hapusPengumuman(id) {
    if (!confirmDelete('Hapus pengumuman ini?')) return
    await rSet(`pengumuman/${id}`, null)
  }

  function startEditPengumuman(p) {
    setPEditId(p.id)
    setPForm({
      judul: p.judul,
      keterangan: p.keterangan,
      target: p.target || 'semua',
    })
  }

  function cancelEditPengumuman() {
    setPEditId(null)
    setPForm({ judul: '', keterangan: '', target: 'semua' })
  }

  /* --- Section 2: Ekstrakurikuler --- */
  const [eskulList, setEskulList] = useState([])
  const [eskulSel, setEskulSel] = useState('')
  const [eskulForm, setEskulForm] = useState({
    nama: '',
    keterangan: '',
    hari: '',
    jamMulai: '',
    jamSelesai: '',
    pembinaGuruId: '',
  })
  const [eskulAnggota, setEskulAnggota] = useState([]) // raw {uid, ...}
  const [addMemberUid, setAddMemberUid] = useState('')

  useEffect(() => {
    rOn('ekskul', (val) => {
      const rows = Object.entries(val || {}).map(([id, v]) => ({ id, ...v }))
      rows.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'))
      setEskulList(rows)
    })
  }, [])

  useEffect(() => {
    if (!eskulSel) {
      setEskulForm({
        nama: '',
        keterangan: '',
        hari: '',
        jamMulai: '',
        jamSelesai: '',
        pembinaGuruId: '',
      })
      setEskulAnggota([])
      return
    }

    const unsubDetail = rOn(`ekskul/${eskulSel}`, (o) => {
      o = o || {}
      setEskulForm({
        nama: o.nama || '',
        keterangan: o.keterangan || '',
        hari: o.hari || '',
        jamMulai: o.jamMulai || '',
        jamSelesai: o.jamSelesai || '',
        pembinaGuruId: o.pembinaGuruId || '',
      })
    })

    const unsubAnggota = rOn(`ekskul/${eskulSel}/anggota`, (val) => {
      const rows = Object.entries(val || {}).map(([uid, v]) => ({
        uid,
        ...(v || {}),
      }))
      setEskulAnggota(rows)
    })

    return () => {
      unsubDetail && unsubDetail()
      unsubAnggota && unsubAnggota()
    }
  }, [eskulSel])

  // Gabungkan data anggota dengan data siswa (nama + kelas)
  const anggotaDisplay = useMemo(() => {
    const rows = eskulAnggota.map((a) => {
      const s = siswaMap[a.uid] || {}
      return {
        uid: a.uid,
        nama: a.nama || s.nama || a.uid,
        kelas: a.kelas || s.kelas || '—',
      }
    })
    return rows.sort(
      (a, b) =>
        (a.kelas || '').localeCompare(b.kelas || '', 'id') ||
        (a.nama || '').localeCompare(b.nama || '', 'id'),
    )
  }, [eskulAnggota, siswaMap])

  async function simpanEskul() {
    const nama = (eskulForm.nama || '').trim()
    if (!nama) return alert('Nama eskul wajib diisi.')

    const pembinaId = eskulForm.pembinaGuruId || ''
    const pembinaNama = pembinaId
      ? guruList.find((g) => g.id === pembinaId)?.name || ''
      : ''

    const payload = {
      nama,
      keterangan: eskulForm.keterangan || '',
      hari: eskulForm.hari || '',
      jamMulai: eskulForm.jamMulai || '',
      jamSelesai: eskulForm.jamSelesai || '',
      pembinaGuruId: pembinaId || null,
      pembinaGuruNama: pembinaNama,
    }

    try {
      if (eskulSel) {
        await rSet(`ekskul/${eskulSel}`, {
          ...payload,
          id: eskulSel,
          updatedAt: Date.now(),
        })
        alert('Eskul diperbarui!')
      } else {
        const id = slug(nama)
        const exist = await rGet(`ekskul/${id}`)
        if (exist) return alert('Eskul dengan nama ini sudah ada.')

        await rSet(`ekskul/${id}`, {
          ...payload,
          id,
          createdAt: Date.now(),
        })
        alert('Eskul disimpan!')
        setEskulSel(id)
      }
    } catch (err) {
      console.error(err)
      alert('Gagal menyimpan: ' + err.message)
    }
  }

  async function hapusEskul() {
    if (!eskulSel) return
    if (!confirmDelete(`Hapus eskul "${eskulForm.nama || eskulSel}" beserta anggotanya?`))
      return

    // Hapus node ekskul
    await rSet(`ekskul/${eskulSel}`, null)

    // Optional: bersihkan referensi di users/*/ekskul
    const users = await rGet('users')
    if (users) {
      const tasks = []
      Object.keys(users).forEach((uid) => {
        if (users[uid]?.ekskul && users[uid].ekskul[eskulSel]) {
          tasks.push(rSet(`users/${uid}/ekskul/${eskulSel}`, null))
        }
      })
      if (tasks.length) await Promise.all(tasks)
    }

    setEskulSel('')
  }

  async function tambahAnggotaEskul() {
    if (!eskulSel || !addMemberUid) return
    const s = siswaList.find((x) => x.uid === addMemberUid)
    if (!s) return

    // Simpan sebagai boolean di node ekskul...
    await rSet(`ekskul/${eskulSel}/anggota/${s.uid}`, true)
    // ... dan juga tandai di user
    await rSet(`users/${s.uid}/ekskul/${eskulSel}`, true)

    setAddMemberUid('')
  }

  async function hapusAnggotaEskul(uid) {
    if (!eskulSel) return
    if (!confirmDelete('Hapus anggota ini dari eskul?')) return

    await rSet(`ekskul/${eskulSel}/anggota/${uid}`, null)
    await rSet(`users/${uid}/ekskul/${eskulSel}`, null)
  }

  return (
    <div className="space-y-4">
      {/* --- CARD PENGUMUMAN --- */}
      <div className="card">
        <div className="font-bold mb-2">Kelola Pengumuman</div>

        <form className="space-y-3" onSubmit={simpanPengumuman}>
          <div className="flex flex-col">
            <label className="text-sm mb-1">Judul Pengumuman</label>
            <input
              className="input"
              placeholder="Cth: Libur Nasional, Rapat Guru"
              value={pForm.judul}
              onChange={(e) =>
                setPForm((f) => ({ ...f, judul: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm mb-1">Keterangan / Isi</label>
            <textarea
              className="input min-h-[100px]"
              placeholder="Isi pengumuman..."
              value={pForm.keterangan}
              onChange={(e) =>
                setPForm((f) => ({ ...f, keterangan: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm mb-1">Tampilkan ke</label>
            <select
              className="input"
              value={pForm.target}
              onChange={(e) =>
                setPForm((f) => ({ ...f, target: e.target.value }))
              }
            >
              <option value="semua">Semua (Guru & Siswa)</option>
              <option value="siswa">Siswa Saja</option>
              <option value="guru">Guru Saja</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            {pEditId && (
              <button
                type="button"
                className="btn bg-white border"
                onClick={cancelEditPengumuman}
              >
                Batal Edit
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              {pEditId ? 'Simpan Perubahan' : 'Tambah Pengumuman'}
            </button>
          </div>
        </form>

        <table className="w-full mt-4 text-sm">
          <thead className="text-left">
            <tr>
              <th>Judul</th>
              <th>Target</th>
              <th className="w-32">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pengumumanList.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-2">
                  <div className="font-medium">{p.judul}</div>
                  <div className="muted text-xs truncate max-w-md">
                    {p.keterangan}
                  </div>
                </td>
                <td className="py-2 capitalize">{p.target || 'semua'}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button
                      className="btn bg-white border"
                      onClick={() => startEditPengumuman(p)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => hapusPengumuman(p.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!pengumumanList.length && (
              <tr>
                <td colSpan="3" className="py-3 muted">
                  Belum ada pengumuman.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- CARD EKSTRAKURIKULER --- */}
      <div className="space-y-4">
        {/* Form utama eskul */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-bold">Kelola Ekstrakurikuler</div>
              <div className="text-xs muted">
                Atur data ekskul, jadwal, dan pembina.
              </div>
            </div>
            <div className="flex gap-2">
              {eskulSel && (
                <button className="btn btn-danger" onClick={hapusEskul}>
                  Hapus Eskul
                </button>
              )}
              <button className="btn btn-primary" onClick={simpanEskul}>
                {eskulSel ? 'Simpan Perubahan' : 'Tambah Eskul Baru'}
              </button>
            </div>
          </div>

          {/* Pilih eskul */}
          <div className="mb-3">
            <label className="text-sm mb-1 block">Pilih Eskul</label>
            <select
              className="input max-w-xs"
              value={eskulSel}
              onChange={(e) => setEskulSel(e.target.value)}
            >
              <option value="">— Buat Baru —</option>
              {eskulList.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Form detail eskul */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <div className="flex flex-col">
              <label className="text-sm mb-1">Nama Eskul</label>
              <input
                className="input"
                placeholder="cth: Pramuka, Paskibra"
                value={eskulForm.nama}
                onChange={(e) =>
                  setEskulForm((f) => ({ ...f, nama: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1">Pembina (Guru)</label>
              <select
                className="input"
                value={eskulForm.pembinaGuruId}
                onChange={(e) =>
                  setEskulForm((f) => ({
                    ...f,
                    pembinaGuruId: e.target.value,
                  }))
                }
              >
                <option value="">— Pilih guru —</option>
                {guruList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1">Hari</label>
              <select
                className="input"
                value={eskulForm.hari}
                onChange={(e) =>
                  setEskulForm((f) => ({ ...f, hari: e.target.value }))
                }
              >
                <option value="">— Pilih hari —</option>
                {HARI_OPTS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1">Jadwal (Mulai)</label>
              <input
                type="time"
                className="input"
                value={eskulForm.jamMulai}
                onChange={(e) =>
                  setEskulForm((f) => ({ ...f, jamMulai: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1">Jadwal (Selesai)</label>
              <input
                type="time"
                className="input"
                value={eskulForm.jamSelesai}
                onChange={(e) =>
                  setEskulForm((f) => ({ ...f, jamSelesai: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col md:col-span-3">
              <label className="text-sm mb-1">Keterangan</label>
              <textarea
                className="input min-h-[90px]"
                value={eskulForm.keterangan}
                onChange={(e) =>
                  setEskulForm((f) => ({
                    ...f,
                    keterangan: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>

        {/* Anggota eskul */}
        {eskulSel && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-bold">
                  Anggota • {eskulForm.nama || eskulSel}
                </div>
                <div className="text-xs muted">
                  {anggotaDisplay.length} siswa mengikuti
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end mb-3">
              <div className="flex flex-col md:col-span-2">
                <label className="text-sm mb-1">
                  Tambah Anggota (Siswa)
                </label>
                <select
                  className="input"
                  value={addMemberUid}
                  onChange={(e) => setAddMemberUid(e.target.value)}
                >
                  <option value="">— Pilih siswa —</option>
                  {siswaList.map((s) => (
                    <option key={s.uid} value={s.uid}>
                      {s.nama} ({s.kelas || '—'})
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn bg-white border"
                onClick={tambahAnggotaEskul}
                disabled={!addMemberUid}
              >
                Tambah
              </button>
            </div>

            <table className="w-full mt-1 text-sm">
              <thead className="text-left">
                <tr>
                  <th>Nama</th>
                  <th>Kelas</th>
                  <th className="w-32">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {anggotaDisplay.map((a) => (
                  <tr key={a.uid} className="border-t">
                    <td className="py-2">{a.nama}</td>
                    <td className="py-2">{a.kelas}</td>
                    <td className="py-2">
                      <button
                        className="btn btn-danger"
                        onClick={() => hapusAnggotaEskul(a.uid)}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
                {!anggotaDisplay.length && (
                  <tr>
                    <td colSpan="3" className="py-3 muted">
                      Belum ada anggota.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
