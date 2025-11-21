# EduSmart (React + Firebase RTDB + Supabase Storage)

SaaS sekolah sederhana: autentikasi (role siswa/guru/admin), jadwal, absensi realtime, tugas & materi, kelola akun, dan upload via Supabase Storage.

## Stack
- React + Vite + React Router
- Zustand (state global) — Loading, Error, Success (toast)
- Tailwind CSS (Mobile-first, modern UI)
- Firebase Auth + Realtime Database (Asia Southeast rekomendasi)
- Supabase Storage (profiles, tugas)

Warna:
- Primary: `#2563EB`
- Hadir: `#16A34A` • Izin: `#F59E0B` • Alpha: `#DC2626`

## Jalankan Lokal
1. **Clone & install**
   ```bash
   npm i
   cp .env.example .env
   ```
2. **Isi `.env`** dengan kredensial Firebase & Supabase Anda.
3. **Tailwind & Dev server**
   ```bash
   npm run dev
   ```

## Konfigurasi Firebase
- Buat project → aktifkan Authentication (Email/Password) & Realtime Database.
- Atur **Database location**: `asia-southeast1` disarankan.
- Salin kredensial ke `.env`.
- Terapkan aturan `firebase.rules.json` (opsional: sesuaikan untuk produksi).

## Supabase Storage
- Buat bucket: `profiles` (public) dan `tugas` (public).
- Aktifkan **Public** untuk memudahkan akses file (atau implementasikan signed URL).
- Masukkan `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` ke `.env`.

## Struktur Data RTDB (ringkas)
```
users/{uid} => { role: 'siswa'|'guru'|'admin', nama, kelas, ... }
kelas/{nama} => { nama }
jadwal/{kelas}/{id} => { hari, mapel, guruId, guruNama, jamMulai, jamSelesai }
absensi/{kelas}/{YYYY-MM-DD}/{uid} => { status:'H'|'I'|'A', mapel, waktu }
absensi_ajuan/{kelas}/{YYYY-MM-DD}/{uid} => { alasan, nama }
tugas/{kelas}/{id} => { mapel, judul, keterangan, deadline, format }
kumpulan_tugas/{uid}/{idTugas} => { url, filename, uploadedAt }
ekskul/{id} => { nama, pembina, hari, jam }
jam_kosong/{YYYY-MM-DD}/{kelas}/{idJadwal} => { alasan, guruPengganti }
```

## Catatan Keamanan
- Aturan RTDB di sini **baseline**; sesuaikan untuk produksi.
- Batasi pendaftaran admin (`ALLOW_ADMIN_SELF_REGISTER=false` di `useAuthStore.js`).

## Rute
- `/login`, `/register`
- Siswa: `/home`, `/jadwal`, `/absensi`, `/tugas`, `/edit-profile`
- Guru: `/guru/jadwal`, `/guru/absensi`, `/guru/tugas`
- Admin: `/admin/kelas`, `/admin/siswa`, `/admin/guru`

## Fitur Penting
- **Realtime** badge "Live" pada ringkasan kelas, jam kosong, dll.
- **Disabled states** setelah deadline (tugas) / jam selesai (absensi).
- **Skeleton Loading** dan toast notifikasi sederhana.
- **Privasi** ringkasan absensi kelas menampilkan **agregat** tanpa nama siswa lain.

Selamat mencoba! 🚀














                                             #include <WiFi.h>
                                             #include <WiFiClientSecure.h>
                                             #include <HTTPClient.h>
                                             #include <SPI.h>
                                             #include <Adafruit_PN532.h>
                                             
                                             /* ====== Konfigurasi WiFi ====== */
                                             const char* WIFI_SSID = "GEORGIA";
                                             const char* WIFI_PASS = "Georgia12345";
                                             
                                             /* ====== Konfigurasi Supabase ====== */
                                             const char* SUPABASE_URL = "https://znxmkastzbpzfurztvwt.supabase.co/rest/v1/rfid_scans";
                                             const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpueG1rYXN0emJwemZ1cnp0dnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwODYwNTUsImV4cCI6MjA3NzY2MjA1NX0.-1OhFVh6XIkQm2tabzzF_xEOLgaOXhdTrYuKP7rQssQ";
                                             
                                             /* ====== Konfigurasi pin SPI ESP32-C3 ====== */
                                             #define PN532_SCK   4
                                             #define PN532_MISO  5
                                             #define PN532_MOSI  6
                                             #define PN532_SS    7
                                             
                                             // LED & Buzzer
                                             #define LED_PIN      2
                                             #define BUZZER_PIN   3
                                             
                                             // Objek PN532 pakai Software SPI
                                             Adafruit_PN532 nfc(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_SS);
                                             
                                             /* ====== Variabel untuk deteksi UID unik ====== */
                                             uint8_t lastUid[7];
                                             uint8_t lastUidLength = 0;
                                             bool hasLastUid = false;
                                             unsigned long lastScanTime = 0;
                                             const unsigned long SCAN_COOLDOWN = 3000; // 3 detik cooldown antara scan
                                             
                                             // Status sistem
                                             bool wifiConnected = false;
                                             unsigned long lastWifiCheck = 0;
                                             const unsigned long WIFI_CHECK_INTERVAL = 10000; // Cek WiFi setiap 10 detik
                                             
                                             /* ====== Deklarasi Fungsi ====== */
                                             bool connectWiFi();
                                             void checkWiFiConnection();
                                             bool isSameUid(uint8_t *uid, uint8_t uidLength);
                                             void copyUid(uint8_t *src, uint8_t len);
                                             String uidToHexString(uint8_t *uid, uint8_t len);
                                             void beepAndBlink(int count);
                                             void sendScanToSupabase(const String &uidHex);
                                             void blinkLED(int count, int delayTime);
                                             
                                             /* ====== Koneksi WiFi dengan Retry ====== */
                                             bool connectWiFi() {
                                               Serial.print("Menghubungkan ke WiFi: ");
                                               Serial.println(WIFI_SSID);
                                               
                                               WiFi.disconnect();
                                               delay(1000);
                                               WiFi.begin(WIFI_SSID, WIFI_PASS);
                                               
                                               int retries = 0;
                                               while (WiFi.status() != WL_CONNECTED && retries < 30) {
                                                 delay(500);
                                                 Serial.print(".");
                                                 retries++;
                                                 blinkLED(1, 200); // Blink pendek saat connecting
                                               }
                                               
                                               if (WiFi.status() == WL_CONNECTED) {
                                                 Serial.println("\nWiFi TERHUBUNG!");
                                                 Serial.print("IP Address: ");
                                                 Serial.println(WiFi.localIP());
                                                 return true;
                                               } else {
                                                 Serial.println("\nGAGAL terhubung ke WiFi!");
                                                 return false;
                                               }
                                             }
                                             
                                             /* ====== Cek Koneksi WiFi Periodik ====== */
                                             void checkWiFiConnection() {
                                               if (millis() - lastWifiCheck > WIFI_CHECK_INTERVAL) {
                                                 lastWifiCheck = millis();
                                                 
                                                 if (WiFi.status() != WL_CONNECTED) {
                                                   Serial.println("[WiFi] Koneksi terputus, mencoba reconnect...");
                                                   wifiConnected = connectWiFi();
                                                 } else if (!wifiConnected) {
                                                   wifiConnected = true;
                                                   Serial.println("[WiFi] Koneksi kembali normal");
                                                 }
                                               }
                                             }
                                             
                                             /* ====== Perbandingan UID ====== */
                                             bool isSameUid(uint8_t *uid, uint8_t uidLength) {
                                               if (!hasLastUid) return false;
                                               if (uidLength != lastUidLength) return false;
                                               for (uint8_t i = 0; i < uidLength; i++) {
                                                 if (uid[i] != lastUid[i]) return false;
                                               }
                                               return true;
                                             }
                                             
                                             void copyUid(uint8_t *src, uint8_t len) {
                                               lastUidLength = len;
                                               for (uint8_t i = 0; i < len; i++) {
                                                 lastUid[i] = src[i];
                                               }
                                               hasLastUid = true;
                                               lastScanTime = millis();
                                             }
                                             
                                             /* ====== Konversi UID ke HEX ====== */
                                             String uidToHexString(uint8_t *uid, uint8_t len) {
                                               String s;
                                               for (uint8_t i = 0; i < len; i++) {
                                                 if (uid[i] < 0x10) s += "0";
                                                 s += String(uid[i], HEX);
                                               }
                                               s.toUpperCase();
                                               return s;
                                             }
                                             
                                             /* ====== Indikator LED ====== */
                                             void blinkLED(int count, int delayTime) {
                                               for (int i = 0; i < count; i++) {
                                                 digitalWrite(LED_PIN, HIGH);
                                                 delay(delayTime);
                                                 digitalWrite(LED_PIN, LOW);
                                                 if (i < count - 1) delay(delayTime);
                                               }
                                             }
                                             
                                             /* ====== Buzzer dan LED untuk kartu terdeteksi ====== */
                                             void beepAndBlink(int count) {
                                               for (int i = 0; i < count; i++) {
                                                 digitalWrite(LED_PIN, HIGH);
                                                 digitalWrite(BUZZER_PIN, HIGH);
                                                 delay(100);
                                                 digitalWrite(LED_PIN, LOW);
                                                 digitalWrite(BUZZER_PIN, LOW);
                                                 if (i < count - 1) delay(100);
                                               }
                                             }
                                             
                                             /* ====== Kirim Data ke Supabase (DIPERBAIKI) ====== */
                                             void sendScanToSupabase(const String &uidHex) {
                                               if (!wifiConnected) {
                                                 Serial.println("[Supabase] WiFi tidak terhubung, skip pengiriman");
                                                 blinkLED(3, 300); // Blink 3x cepat sebagai error WiFi
                                                 return;
                                               }
                                               
                                               WiFiClientSecure client;
                                               client.setInsecure();  // Non-verifikasi SSL untuk testing
                                               
                                               HTTPClient http;
                                               
                                               Serial.println("[Supabase] Memulai HTTP POST...");
                                               Serial.print("URL: ");
                                               Serial.println(SUPABASE_URL);
                                               
                                               if (!http.begin(client, SUPABASE_URL)) {
                                                 Serial.println("[Supabase] Gagal memulai koneksi HTTP");
                                                 return;
                                               }
                                               
                                               // Header Supabase
                                               http.addHeader("Content-Type", "application/json");
                                               http.addHeader("apikey", SUPABASE_KEY);
                                               http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
                                               http.addHeader("Prefer", "return=minimal");
                                               
                                               // Data yang dikirim (sesuai schema database)
                                               String jsonData = "{";
                                               jsonData += "\"card_uid\":\"" + uidHex + "\",";
                                               jsonData += "\"device_id\":\"ESP32C3_GERBANG_UTAMA\",";
                                               jsonData += "\"status\":\"raw\"";
                                               jsonData += "}";
                                               
                                               Serial.print("[Supabase] Mengirim data: ");
                                               Serial.println(jsonData);
                                               
                                               // Kirim dengan timeout
                                               http.setTimeout(10000);
                                               int httpCode = http.POST(jsonData);
                                               
                                               // Handle response
                                               if (httpCode > 0) {
                                                 Serial.printf("[Supabase] Response code: %d\n", httpCode);
                                                 
                                                 if (httpCode == HTTP_CODE_CREATED || httpCode == HTTP_CODE_OK) {
                                                   Serial.println("[Supabase] ✅ Data BERHASIL dikirim!");
                                                   String response = http.getString();
                                                   if (response.length() > 0) {
                                                     Serial.print("[Supabase] Response: ");
                                                     Serial.println(response);
                                                   }
                                                   blinkLED(2, 100); // Blink cepat 2x untuk sukses
                                                 } else {
                                                   Serial.printf("[Supabase] ❌ Response error: %d\n", httpCode);
                                                   String errorResponse = http.getString();
                                                   Serial.print("[Supabase] Error response: ");
                                                   Serial.println(errorResponse);
                                                   blinkLED(5, 100); // Blink cepat 5x untuk error
                                                 }
                                               } else {
                                                 Serial.printf("[Supabase] ❌ POST gagal, error: %s\n", 
                                                               http.errorToString(httpCode).c_str());
                                                 blinkLED(5, 100); // Blink cepat 5x untuk error
                                               }
                                               
                                               http.end();
                                             }
                                             
                                             /* ====== SETUP ====== */
                                             void setup() {
                                               Serial.begin(115200);
                                               delay(1000);
                                               
                                               // Inisialisasi GPIO
                                               pinMode(LED_PIN, OUTPUT);
                                               pinMode(BUZZER_PIN, OUTPUT);
                                               digitalWrite(LED_PIN, LOW);
                                               digitalWrite(BUZZER_PIN, LOW);
                                               
                                               Serial.println();
                                               Serial.println("==========================================");
                                               Serial.println("   ESP32-C3 RFID Reader untuk Absensi");
                                               Serial.println("==========================================");
                                               
                                               // Test LED dan Buzzer
                                               Serial.println("Test LED dan Buzzer...");
                                               digitalWrite(LED_PIN, HIGH);
                                               digitalWrite(BUZZER_PIN, HIGH);
                                               delay(500);
                                               digitalWrite(LED_PIN, LOW);
                                               digitalWrite(BUZZER_PIN, LOW);
                                               
                                               // Koneksi WiFi
                                               Serial.println("\n--- KONEKSI WIFI ---");
                                               wifiConnected = connectWiFi();
                                               
                                               // Inisialisasi PN532
                                               Serial.println("\n--- INISIALISASI PN532 ---");
                                               nfc.begin();
                                               
                                               uint32_t versiondata = nfc.getFirmwareVersion();
                                               if (!versiondata) {
                                                 Serial.println("❌ ERROR: Board PN532 tidak ditemukan!");
                                                 Serial.println("   Periksa koneksi:");
                                                 Serial.println("   - VCC  -> 3.3V");
                                                 Serial.println("   - GND  -> GND"); 
                                                 Serial.println("   - SCK  -> GPIO4");
                                                 Serial.println("   - MISO -> GPIO5");
                                                 Serial.println("   - MOSI -> GPIO6");
                                                 Serial.println("   - SS   -> GPIO7");
                                                 
                                                 while (1) {
                                                   blinkLED(2, 500); // Blink error terus menerus
                                                   delay(1000);
                                                 }
                                               }
                                               
                                               Serial.print("✅ PN532 ditemukan: PN5");
                                               Serial.println((versiondata >> 24) & 0xFF, HEX);
                                               Serial.print("   Firmware: ");
                                               Serial.print((versiondata >> 16) & 0xFF, DEC);
                                               Serial.print(".");
                                               Serial.println((versiondata >> 8) & 0xFF, DEC);
                                               
                                               // Konfigurasi PN532
                                               nfc.SAMConfig();
                                               
                                               Serial.println("\n--- SISTEM SIAP ---");
                                               Serial.println("Tempelkan kartu RFID/NFC ke reader...");
                                               Serial.println("==========================================");
                                               
                                               // Indikator sistem ready
                                               for (int i = 0; i < 3; i++) {
                                                 digitalWrite(LED_PIN, HIGH);
                                                 delay(100);
                                                 digitalWrite(LED_PIN, LOW);
                                                 delay(100);
                                               }
                                             }
                                             
                                             /* ====== LOOP ====== */
                                             void loop() {
                                               // Cek koneksi WiFi periodik
                                               checkWiFiConnection();
                                               
                                               // Handle cooldown scan
                                               if (hasLastUid && (millis() - lastScanTime > SCAN_COOLDOWN)) {
                                                 hasLastUid = false;
                                                 lastUidLength = 0;
                                                 Serial.println("[System] Cooldown selesai, siap scan baru");
                                               }
                                               
                                               // Baca kartu RFID
                                               uint8_t uid[7];
                                               uint8_t uidLength;
                                               
                                               bool success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength);
                                               
                                               if (success) {
                                                 // Cek apakah kartu sama dan masih dalam cooldown
                                                 if (isSameUid(uid, uidLength)) {
                                                   if (millis() - lastScanTime < SCAN_COOLDOWN) {
                                                     Serial.println("[System] Kartu sama, dalam cooldown...");
                                                     delay(100);
                                                     return;
                                                   }
                                                 }
                                                 
                                                 // Kartu baru terdeteksi
                                                 copyUid(uid, uidLength);
                                                 String uidHex = uidToHexString(uid, uidLength);
                                                 
                                                 Serial.println("\n🎊 KARTU TERDETEKSI!");
                                                 Serial.println("=================================");
                                                 Serial.print("UID: ");
                                                 Serial.println(uidHex);
                                                 Serial.print("Panjang: ");
                                                 Serial.print(uidLength);
                                                 Serial.println(" byte");
                                                 
                                                 // Tampilkan tipe kartu
                                                 if (uidLength == 4) {
                                                   Serial.println("Tipe: MIFARE Classic 1K/4K");
                                                 } else if (uidLength == 7) {
                                                   Serial.println("Tipe: MIFARE DESFire/Ultralight");
                                                 } else {
                                                   Serial.println("Tipe: Kartu NFC lainnya");
                                                 }
                                                 
                                                 Serial.println("=================================");
                                                 
                                                 // Indikator kartu terdeteksi
                                                 beepAndBlink(2);
                                                 
                                                 // Kirim ke Supabase
                                                 Serial.println("\n📡 Mengirim data ke Supabase...");
                                                 sendScanToSupabase(uidHex);
                                                 
                                                 // Delay sebelum siap baca lagi
                                                 delay(1000);
                                                 
                                               } else {
                                                 // Tidak ada kartu, berikan heartbeat
                                                 static unsigned long lastHeartbeat = 0;
                                                 if (millis() - lastHeartbeat > 5000) {
                                                   lastHeartbeat = millis();
                                                   
                                                   // Status indikator
                                                   if (wifiConnected) {
                                                     Serial.print("💚 Sistem OK | WiFi: ");
                                                     Serial.println(WiFi.RSSI());
                                                     digitalWrite(LED_PIN, HIGH);
                                                     delay(50);
                                                     digitalWrite(LED_PIN, LOW);
                                                   } else {
                                                     Serial.println("⚠️  Menunggu koneksi WiFi...");
                                                     blinkLED(1, 50);
                                                   }
                                                 }
                                                 
                                                 delay(100);
                                               }
                                             }
                                             
                                             
