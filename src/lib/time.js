export const ID_TIMEZONE = 'Asia/Jakarta'

export function fmt(date, withTime=true){
  try{
    const d = typeof date === 'number' ? new Date(date) : new Date(date)
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: ID_TIMEZONE,
      day: '2-digit', month: '2-digit', year: 'numeric',
      ...(withTime ? { hour:'2-digit', minute:'2-digit' } : {})
    }).format(d)
  }catch(e){
    return String(date)
  }
}

export function todayKey(){
  const d = new Date()
  const tz = new Intl.DateTimeFormat('en-US', { timeZone: ID_TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d)
  const Y = tz.find(p=>p.type==='year').value
  const M = tz.find(p=>p.type==='month').value
  const D = tz.find(p=>p.type==='day').value
  return `${Y}-${M}-${D}`
}

export function isPast(endHHmm){
  // endHHmm: "13:30"
  const [hh, mm] = endHHmm.split(':').map(Number)
  const now = new Date()
  const nowParts = new Intl.DateTimeFormat('en-US', { timeZone: ID_TIMEZONE, hour:'2-digit', minute:'2-digit', hour12:false }).format(now).split(':').map(Number)
  const nHH = nowParts[0], nMM = nowParts[1]
  return (nHH*60 + nMM) > (hh*60 + mm)
}

export function dayNameId(date = new Date()){
  return new Intl.DateTimeFormat('id-ID', { weekday:'long', timeZone: ID_TIMEZONE }).format(date)
}
