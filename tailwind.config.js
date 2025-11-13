/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2563EB",
        hadir: "#16A34A",
        izin: "#F59E0B",
        alpha: "#DC2626"
      },
      boxShadow: {
        soft: "0 8px 20px rgba(0,0,0,0.07)"
      }
    },
  },
  plugins: [
    function({ addComponents }) {
      addComponents({
        ".card": {
          "@apply bg-white rounded-2xl shadow-soft p-4": {}
        },
        ".btn": {
          "@apply inline-flex items-center gap-2 rounded-xl px-4 py-2 font-medium": {}
        },
        ".btn-primary": { "@apply btn bg-primary text-white hover:opacity-90": {} },
        ".btn-danger": { "@apply btn bg-alpha text-white hover:opacity-90": {} },
        ".btn-success": { "@apply btn bg-hadir text-white hover:opacity-90": {} },
        ".btn-warning": { "@apply btn bg-izin text-white hover:opacity-90": {} },
        ".badge": { "@apply text-xs px-2 py-1 rounded-full": {} },
        ".badge-live": { "@apply badge bg-green-100 text-green-700 border border-green-200": {} },
        ".input": { "@apply w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-primary": {} },
        ".label": { "@apply text-sm font-medium text-slate-700": {} },
        ".muted": { "@apply text-slate-500 text-sm": {} }
      })
    }
  ],
}
