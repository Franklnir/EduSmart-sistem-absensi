import React from 'react'

export default function FileDropzone({ onFiles, disabled=false, accept='' }){ // MODIFIKASI: Tambahkan prop 'accept'
  const divRef = React.useRef(null)
  const inputRef = React.useRef(null) // BARU: Ref untuk input file
  const [over, setOver] = React.useState(false)

  function onDrop(e){
    e.preventDefault()
    setOver(false)
    if(disabled) return
    const files = Array.from(e.dataTransfer.files || [])
    if(files.length) onFiles(files)
  }
  
  // BARU: Fungsi untuk menangani klik pada div
  function handleClick() {
    if (disabled) return
    // Klik input file yang tersembunyi secara programatis
    inputRef.current?.click() 
  }

  return (
    <div
      ref={divRef}
      onDragOver={(e)=>{ e.preventDefault(); setOver(true) }}
      onDragLeave={()=>setOver(false)}
      onDrop={onDrop}
      onClick={handleClick} // MODIFIKASI: Tambahkan onClick handler
      // MODIFIKASI: Tambahkan cursor-pointer dan style disabled
      className={
        "border-2 border-dashed rounded-2xl p-6 text-center " + 
        (over ? "border-primary bg-primary/5" : "border-slate-300") +
        (disabled ? " bg-gray-100 opacity-70 cursor-not-allowed" : " cursor-pointer hover:border-gray-400")
      }
    >
      <div className="font-medium">Tarik & letakkan file di sini</div>
      <div className="muted">atau klik untuk memilih</div>
      <input 
        ref={inputRef} // MODIFIKASI: Hubungkan ref ke input
        type="file" 
        className="hidden" 
        onChange={(e)=> onFiles(Array.from(e.target.files || []))} 
        disabled={disabled}
        accept={accept} // MODIFIKASI: Tambahkan accept di sini
      />
    </div>
  )
}