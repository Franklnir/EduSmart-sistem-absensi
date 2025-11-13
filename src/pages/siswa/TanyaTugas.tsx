// src/pages/siswa/TanyaTugas.tsx
import React from "react";
import { geminiModel } from "../../lib/ai";

type JenisBantuan = "jelaskan" | "langkah" | "cek";

export default function TanyaTugas() {
  const [isiTugas, setIsiTugas] = React.useState("");
  const [jenisBantuan, setJenisBantuan] =
    React.useState<JenisBantuan>("jelaskan");

  const [jawaban, setJawaban] = React.useState("");
  const [rawJawaban, setRawJawaban] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [isTyping, setIsTyping] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ANIMASI "IRSYAD ANAK UPB SEDANG MENULIS" (typewriter effect)
  React.useEffect(() => {
    if (!isTyping || !rawJawaban) return;

    let index = 0;
    setJawaban("");

    const interval = setInterval(() => {
      index += 1;
      setJawaban(rawJawaban.slice(0, index));

      if (index >= rawJawaban.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 18); // kecepatan ketik (ms per karakter)

    return () => clearInterval(interval);
  }, [isTyping, rawJawaban]);

  async function handleTanya() {
    if (!isiTugas.trim()) return;

    setLoading(true);
    setError(null);
    setJawaban("");
    setRawJawaban("");
    setIsTyping(false);

    try {
      const prompt = `
Kamu adalah asisten belajar untuk siswa sekolah.

Tugas siswa:
${isiTugas}

Jenis bantuan yang diminta: ${jenisBantuan}

Aturan:
- Jelaskan dengan bahasa Indonesia yang sederhana.
- Jika jenis bantuan "langkah", berikan langkah-langkah penyelesaian, bukan jawaban akhir angka.
- Jika jenis bantuan "cek", berikan koreksi dan saran perbaikan, bukan sekadar kunci.
- Jangan dorong siswa untuk menyontek, tapi bantu supaya dia paham konsepnya.
`;

      const result = await geminiModel.generateContent(prompt);
      const text = result.response.text();

      // Simpan text mentah, lalu animasikan lewat useEffect
      setRawJawaban(text);
      setIsTyping(true);
    } catch (e: any) {
      console.error(e);
      setError(
        "Terjadi kesalahan saat menghubungi Irsyad anak UPB, coba lagi beberapa saat lagi."
      );
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || isTyping || !isiTugas.trim();

  return (
    // ❗ SUDAH FULL WIDTH: tidak ada lagi max-w-3xl mx-auto
    <div className="w-full space-y-6">
      {/* HEADER */}
      <div className="rounded-2xl border bg-white/90 shadow-sm px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">
            Tanya Tugas ke <span className="text-blue-600">Irsyad anak UPB</span>
          </h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">
            Tempelkan soal / instruksi tugas. Irsyad anak UPB akan bantu jelaskan konsep dan
            langkah, bukan cuma kasih kunci jawaban.
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end text-xs text-gray-500">
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Mode Belajar
          </span>
        </div>
      </div>

      {/* FORM UTAMA */}
      <div className="rounded-2xl border bg-white/90 shadow-sm p-5 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Isi tugas / soal</label>
          <textarea
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 min-h-[150px]"
            placeholder="Tempelkan soal atau instruksi tugas di sini. Boleh juga sertakan jawabanmu kalau mau dicek..."
            value={isiTugas}
            onChange={(e) => setIsiTugas(e.target.value)}
          />
          <div className="flex justify-between text-[11px] text-gray-500">
            <span>
              Tips: Tambahkan juga <b>jawaban/ide kamu</b> jika memilih &quot;Cek
              jawaban&quot;.
            </span>
            <span>{isiTugas.length}/2000</span>
          </div>
        </div>

        {/* PILIHAN JENIS BANTUAN */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Jenis bantuan</label>
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-full border transition ${
                jenisBantuan === "jelaskan"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setJenisBantuan("jelaskan")}
            >
              Jelaskan materi
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-full border transition ${
                jenisBantuan === "langkah"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setJenisBantuan("langkah")}
            >
              Langkah penyelesaian
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-full border transition ${
                jenisBantuan === "cek"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setJenisBantuan("cek")}
            >
              Cek jawaban / ide
            </button>
          </div>
        </div>

        {/* STATUS LOADING / IRSYAD ANAK UPB MENULIS */}
        {(loading || isTyping) && (
          <div className="flex items-center gap-2 text-xs text-blue-600">
    _         <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </div>
            <span>
              {loading
                ? "Menghubungi Irsyad anak UPB..."
                : "Irsyad anak UPB sedang menulis jawaban..."}
            </span>
          </div>
        )}

        {/* TOMBOL TANYA */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleTanya}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed hover:bg-blue-700 transition" >
            {loading || isTyping ? (
              <>
                <span className="h-4 w-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
Click to copy               Memproses...
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Tanya Irsyad anak UPB</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-2">
            {error}
          </div>
        )}
      </div>

      {/* JAWABAN IRSYAD ANAK UPB */}
      <div className="rounded-2xl border bg-slate-50/80 p-5 min-h-[140px]">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">
          Jawaban Irsyad anak UPB
        </h2>

        {jawaban ? (
          <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
      _       {jawaban}
          </div>
        ) : (
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="text-lg">💬</span>
            <span>
              Belum ada jawaban. Tulis soal dan klik <b>Tanya Irsyad anak UPB</b> untuk
              mulai belajar bareng.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}