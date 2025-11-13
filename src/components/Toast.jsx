import React from 'react'
import { useUI } from '../store/useUIStore'

export default function Toast(){
  const { toasts, removeToast } = useUI()
  React.useEffect(() => {
    const timers = toasts.map(t => setTimeout(()=>removeToast(t.id), t.timeout ?? 3000))
    return () => timers.forEach(clearTimeout)
  }, [toasts])
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map(t => (
        <div key={t.id} className="card border border-slate-200">
          <div className="font-medium">{t.title}</div>
          {t.desc && <div className="muted mt-1">{t.desc}</div>}
        </div>
      ))}
    </div>
  )
}
