// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const SUPABASE_BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'project111'

export async function uploadFile(bucket, path, file){
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,      // tetap timpa file lama
    cacheControl: '0', // jangan cache lama-lama
  })
  if (error) throw error

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)

  // 🔥 file di storage tetap 1 (bucket/path yang sama),
  //    query ?v=... cuma untuk paksa browser ambil versi terbaru
  return `${pub.publicUrl}?v=${Date.now()}`
}
