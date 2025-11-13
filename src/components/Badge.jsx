import React from 'react'
import clsx from 'clsx'

export default function Badge({ children, variant='default' }){
  const styles = {
    default: 'bg-slate-100 text-slate-700',
    live: 'bg-green-100 text-green-700 border border-green-200',
    hadir: 'bg-hadir/10 text-hadir',
    izin: 'bg-izin/10 text-izin',
    alpha: 'bg-alpha/10 text-alpha'
  }
  return <span className={clsx('badge', styles[variant] || styles.default)}>{children}</span>
}
