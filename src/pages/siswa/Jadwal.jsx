import React from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { rOn } from '../../lib/firebase'
import Badge from '../../components/Badge'

// Helper inisial untuk avatar teks
function initials(name = '?') {
  const parts = (name || '').trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() || '').join('')
}

export default function SJadwal(){
  const { profile } = useAuthStore()
  const [jadwal, setJadwal] = React.useState([])
  const [kosongList, setKosongList] = React.useState([])   // untuk kartu jam kosong
  const [kosongMap, setKosongMap] = React.useState({})     // untuk status di tabel

  // 🆕 Map data guru (untuk profil di kolom Guru)
  const [guruMap, setGuruMap] = React.useState({})

  React.useEffect(() => {
    if(!profile?.kelas) return

    // listener jadwal kelas
    const unsubJadwal = rOn(`jadwal/${profile.kelas}`, (val) => {
      const arr = Object.values(val || {})
      // urutkan per hari & jam mulai
      const orderHari = {
        Senin:1, Selasa:2, Rabu:3, Kamis:4, Jumat:5, Sabtu:6, Minggu:7
      }
      arr.sort((a,b) => {
        const ah = orderHari[a.hari] || 99
        const bh = orderHari[b.hari] || 99
        if (ah !== bh) return ah - bh
        return (a.jamMulai || '').localeCompare(b.jamMulai || '')
      })
      setJadwal(arr)
    })

    // listener jam kosong (hari ini & besok)
    const unsubKosong = rOn(`jam_kosong`, (val) => {
      const data = val || {}
      const now = new Date()
      const today = now.toISOString().slice(0,10)
      const tomorrow = new Date(now.getTime()+86400000).toISOString().slice(0,10)

      const list = []
      const mapToday = {}

      ;[today, tomorrow].forEach(d => {
        const perDate = data[d] || {}
        Object.values(perDate).forEach(row => {
          if (row.kelas === profile.kelas) {
            // untuk kartu (hari ini & besok)
            list.push({ tgl:d, ...row })

            // untuk status tabel: HANYA jam kosong hari ini
            if (d === today) {
              const key = `${row.kelas}|${row.mapel}|${row.jamMulai}|${row.jamSelesai}`
              mapToday[key] = row
            }
          }
        })
      })

      setKosongList(list)
      setKosongMap(mapToday)
    })

    // 🆕 listener data guru untuk profil (tanpa email)
    const unsubGuru = rOn('users', (val) => {
      const map = {}
      Object.entries(val || {}).forEach(([uid, u]) => {
        if (u.role === 'guru') {
          map[uid] = {
            nama: u.nama || u.displayName || u.username || 'Guru',
            photoURL: u.photoURL || u.avatar || u.foto || ''
          }
        }
      })
      setGuruMap(map)
    })

    return () => {
      unsubJadwal && unsubJadwal()
      unsubKosong && unsubKosong()
      unsubGuru && unsubGuru()
    }
  }, [profile?.kelas])

  const days = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']

  // Helper: hari & tanggal hari ini/besok
  const now = new Date()
  const todayStr = now.toISOString().slice(0,10)
  const tomorrowStr = new Date(now.getTime()+86400000).toISOString().slice(0,10)
  const namaHari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
  const todayName = namaHari[now.getDay()] // contoh: "Senin"

  return (
    <div className="space-y-4">
      {/* --- Card Jam Kosong --- */}
      <div className="card">
        <div className="font-bold mb-2">
          Jam Kosong (Hari Ini / Besok) <Badge variant="live">Live</Badge>
        </div>
        <div className="space-y-2">
          {kosongList.map((k,i)=>(
            <div
              key={i}
              className="border rounded-xl p-3 bg-red-50 border-red-200"
            >
              <div className="font-medium">
                {k.mapel} ({k.kelas})
              </div>
              <div className="muted text-sm">
                {k.tgl === todayStr
                  ? 'Hari ini'
                  : k.tgl === tomorrowStr
                  ? 'Besok'
                  : k.tgl}{' '}
                • {k.jamMulai}-{k.jamSelesai} • {k.alasan}
              </div>
              {k.guruPengganti && (
                <div className="text-sm">
                  Guru Pengganti:{' '}
                  {k.guruPengganti_nama || k.guruPengganti}
                </div>
              )}
            </div>
          ))}
          {!kosongList.length && (
            <div className="muted">Tidak ada jam kosong.</div>
          )}
        </div>
      </div>

      {/* --- Card Jadwal Kelas --- */}
      <div className="card">
        <div className="font-bold mb-2">Jadwal Kelas</div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-slate-500">
              <th>Hari</th>
              <th>Jam</th>
              <th>Mapel</th>
              <th>Guru</th>
              <th>Status (Hari Ini)</th>
            </tr>
          </thead>
          <tbody>
            {jadwal
              .filter(j=>days.includes(j.hari))
              .map((j,i)=>{
                const isToday = j.hari === todayName

                // 🆕 Ambil profil guru (tanpa email)
                const guruProfile = j.guruId ? guruMap[j.guruId] : null
                const guruName = guruProfile?.nama || j.guruNama || 'Guru'
                const guruPhoto = guruProfile?.photoURL || ''

                let statusMain = '-'
                let statusSub = ''
                let statusClass = ''

                if (isToday) {
                  const key = `${profile.kelas}|${j.mapel}|${j.jamMulai}|${j.jamSelesai}`
                  const k = kosongMap[key]

                  if (k) {
                    const adaPengganti = !!k.guruPengganti
                    // Teks utama
                    statusMain = adaPengganti ? 'Jam kosong (Diganti)' : 'Jam kosong'
                    statusClass = adaPengganti
                      ? 'text-amber-700 font-semibold'
                      : 'text-red-600 font-semibold'

                    // Teks detail di bawah: jam • guru + alasan • pengganti
                    const subParts = []
                    subParts.push(`${k.jamMulai}-${k.jamSelesai}`)

                    // nama guru + alasan (tanpa email)
                    if (k.alasan) {
                      subParts.push(`${guruName}: ${k.alasan}`)
                    } else {
                      subParts.push(`${guruName}: Berhalangan`)
                    }

                    if (adaPengganti) {
                      subParts.push(
                        `Pengganti: ${k.guruPengganti_nama || k.guruPengganti}`
                      )
                    }

                    statusSub = subParts.join(' • ')
                  } else {
                    statusMain = 'Masuk'
                    statusClass = 'text-emerald-600 font-semibold'
                  }
                }

                return (
                  <tr key={i} className="border-t">
                    <td className="py-2">{j.hari}</td>
                    <td>{j.jamMulai} - {j.jamSelesai}</td>
                    <td>{j.mapel}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {guruPhoto ? (
                          <img
                            src={guruPhoto}
                            alt={guruName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
                            {initials(guruName)}
                          </div>
                        )}
                        <span className="text-sm font-medium">
                          {guruName}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className={statusClass}>{statusMain}</div>
                      {statusSub && (
                        <div className="text-xs text-slate-500">
                          {statusSub}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            {!jadwal.length && (
              <tr>
                <td colSpan="5" className="py-3 muted">
                  Belum ada jadwal.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
