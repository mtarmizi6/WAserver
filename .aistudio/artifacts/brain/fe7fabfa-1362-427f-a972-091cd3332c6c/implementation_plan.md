# WhatsApp Smart Chatbot & Lead Qualification Engine

Transformasi sistem sedia ada daripada bot promosi siaran kepada WhatsApp Chatbot interaktif pintar yang melayan pelanggan secara automatik, mengutip maklumat asas (nama & emel), menjawab soalan berdasarkan pangkalan pengetahuan (knowledge base) dan butang interaktif, serta menapis prospek berkualiti sebelum menyerahkan perbualan kepada Admin melalui Telegram.

## User Review & Critical Decisions

> [!IMPORTANT]
> Keputusan penting berdasarkan maklum balas anda:
> - **Format Interaksi**: Menggunakan **Butang Interaktif WhatsApp terus** (disokong oleh `baileys_helper` dan proto Baileys sedia ada), dengan mod fallback pintar teks bernombor sekiranya versi WhatsApp klien tidak menyokong butang interaktif.
> - **Pusat Pengurusan (Admin UI)**: Menggunakan **Web Dashboard komprehensif** dan **Telegram Mini App** sedia ada untuk menyusun keyword, soalan tapisan, pangkalan pengetahuan, serta senarai prospek (leads).
> - **Kriteria Penyerahan (Handoff)**: Notifikasi penyerahan perbualan ke Telegram Admin dihantar **secara automatik apabila prospek selesai menjawab soalan tapisan atau memilih minat membeli/dapatkan servis**.

---

## 1. Overview & Core Concept

### What It Does
Aplikasi ini berfungsi sebagai barisan hadapan jualan WhatsApp 24/7:
1. **Auto Trigger & Sambutan Mesra**: Apabila prospek menghantar mesej pertama, bot menyambut dengan mesej alu-aluan dan meminta nama serta emel secara berperingkat.
2. **Sesi Soal Jawab & Butang Interaktif**: Pelanggan disajikan butang interaktif untuk memilih kategori pertanyaan, produk/servis, atau soalan lazim (FAQ).
3. **Pangkalan Pengetahuan (Knowledge Base & Keyword Triggers)**: Bot memadankan keyword dan soalan pelanggan dengan jawapan rasmi yang telah dikonfigurasikan oleh admin.
4. **Penapisan Minat (Lead Qualification)**: Melalui beberapa siri soalan berpandu (bajet, keperluan, tempoh masa, kesediaan membeli), bot mengklasifikasikan tahap minat prospek (*Hot / Warm / Cold*).
5. **Handoff ke Admin melalui Telegram**: Sebaik sahaja pelanggan melepasi tapisan atau memilih untuk bercakap dengan staf/membeli, bot menghantar notifikasi segera ke Telegram Admin berserta ringkasan profil prospek, transkrip perbualan, dan pautan `wa.me` untuk membolehkan admin terus menyambung perbualan.

---

## 2. User Experience & Visual Design

Mengikuti piawaian reka bentuk **Universal Frontend Design Constitution** dan panduan **SaaS & Dashboard**:
- **Palet Warna**: Latar belakang bersih neutral (*Off-white / Slate 900*), aksen hijau WhatsApp (*#10B981 / #059669*) untuk status aktif & interaksi, ambar (*#F59E0B*) untuk prospek menunggu, dan biru laut (*#2563EB*) untuk metrik pengurusan.
- **Tipografi**: Gabungan *Plus Jakarta Sans* untuk teks tajuk dan navigasi, serta fon tabular (*tabular-nums*) untuk rekod nombor telefon, tarikh, dan kiraan mesej.
- **Top Bar Contract**: Breadcrumb bersih `WA Chatbot / Knowledge Base` di sebelah kiri dan butang tindakan pantas (contoh: *+ Tambah Keyword*, *Uji Chatbot*) di sebelah kanan.
- **Zero-Pill Discipline**: Metadata seperti masa, status bacaan, dan ID prospek dipaparkan secara kemas menggunakan pemisah tipografi (`·`) tanpa kotak pil berlebihan.

### Aliran Antara Muka Pengguna (Web & Telegram Mini App)
1. **Tab Prospek (Leads Hub)**: Senarai prospek masuk dengan nama, emel, nombor telefon, tahap minat (*Qualified / Pending / Cold*), tarikh masuk, dan pautan satu klik untuk terus WhatsApp pelanggan.
2. **Tab Pangkalan Pengetahuan (Knowledge Base & Keywords)**:
   - Pengurusan soalan lazim (FAQ).
   - Penentuan keyword trigger (contoh: "harga", "pakej", "lokasi", "servis").
   - Skrip jawapan berturutan beserta pilihan butang interaktif.
3. **Tab Aliran Tapisan (Qualification Flow Builder)**:
   - Penetapan soalan welcome, soalan pengumpulan nama & emel.
   - Tetapan 2-3 soalan tapisan (cth: "Bila anda perlukan servis ini?", "Pilihan bajet anda?").
   - Tetapan kriteria kelayakan untuk notifikasi Telegram.
4. **Simulator Chat Langsung (Live Chatbot Tester)**:
   - Panel simulasi interaktif di dalam web portal untuk admin menguji aliran perbualan, tindak balas butang, dan trigger jawapan tanpa perlu menghabiskan kuota WhatsApp sebenar.

---

## 3. Key Product Decisions & Trade-Offs

### Keputusan 1: Enjin Pemesejan Masuk (Baileys Event Listener)
- **Pendekatan Terpilih**: Mengaktifkan semula pendengar perbualan persendirian (`messages.upsert`) dalam `WhatsAppManager` dengan pengasingan sesi pelanggan (`CustomerSessionTracker`).
- **Rasional**: Memastikan bot bertindak balas secara masa nyata kepada mesej individu pelanggan tanpa mengganggu kempen posting atau modul group sedia ada.

### Keputusan 2: Sokongan Dwi-Format Butang Interaktif
- **Pendekatan Terpilih**: Menggunakan `helper.sendInteractiveMessage` (`nativeFlowMessage`) daripada pakej `baileys_helper` yang telah sedia terpasang, dengan sokongan sandaran automatik ke teks bernombor (*Numbered Menu*) jika Baileys mengesan kegagalan penghantaran ke peranti lama.
- **Rasional**: Memenuhi kehendak pengguna untuk paparan butang interaktif moden sambil memastikan 100% kadar ketercapaian kepada semua jenis pelanggan WhatsApp.

### Keputusan 3: Penyimpanan Data & State Machine
- **Pendekatan Terpilih**: Menambah jadual SQLite terstruktur (`chatbot_sessions`, `chatbot_knowledge`, `chatbot_leads`) menggunakan enjin SQLite terbina-dalam Node.js (`node:sqlite`).
- **Rasional**: Sangat pantas (in-process), bebas kependaman rangkaian, tahan runtuh (WAL mode), dan mengekalkan integriti sistem sedia ada.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ALIRAN SISTEM CHATBOT                           │
└────────────────────────────────────────────────────────────────────────┘

  [ Pelanggan WhatsApp ]
           │  (Mesej pertama / Butang ditekan)
           ▼
  ┌───────────────────────────────────────────────────────────────┐
  │  Baileys Socket (WhatsAppManager · messages.upsert)            │
  └───────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
  ┌───────────────────────────────────────────────────────────────┐
  │  Chatbot Engine (src/chatbot/engine.js)                       │
  │  1. Semak sesi pelanggan dalam DB (State: WELCOME -> Q&A)     │
  │  2. Kutip Nama & Emel (Regex & Format Validator)              │
  │  3. Padankan Keyword / Pilihan Butang dalam Knowledge Base    │
  │  4. Rekod skor & kelayakan prospek (Lead Qualification)       │
  └───────────────────────┬───────────────────────────────┬───────┘
                          │                               │
        (Hantar Respon WhatsApp)              (Jika Layak / Handoff)
                          │                               │
                          ▼                               ▼
  ┌───────────────────────────────┐   ┌───────────────────────────┐
  │  WhatsApp Sender              │   │  Telegram Alert Dispatcher│
  │  - Butang Interaktif Baileys  │   │  - Maklumat Nama & Emel   │
  │  - Teks Jawapan Pintar        │   │  - Transkrip Perbualan    │
  └───────────────────────────────┘   │  - Pautan Direct WhatsApp │
                                      └───────────────────────────┘
```

### Entiti Data Baharu (SQLite Migrations)
1. `chatbot_leads`:
   - `id`, `phone`, `name`, `email`, `status` (`NEW`, `QUALIFIED`, `HANDOFF`, `COLD`), `score`, `created_at`, `updated_at`.
2. `chatbot_sessions`:
   - `phone`, `current_step` (`AWAIT_NAME`, `AWAIT_EMAIL`, `QUALIFYING`, `FAQ`, `HANDED_OFF`), `collected_data` (JSON), `last_message_at`.
3. `chatbot_knowledge`:
   - `id`, `trigger_keyword`, `title`, `answer_text`, `buttons_json`, `priority`, `is_active`.
4. `chatbot_config`:
   - Konfigurasi welcome message, soalan tapisan, ID Telegram Admin, dan mod handoff.

---

## Verification Plan

### Ujian Automatik & Semakan Sistem:
1. **Ujian Pangkalan Data**: Memastikan jadual baharu `chatbot_leads`, `chatbot_sessions`, dan `chatbot_knowledge` terhasil dengan sempurna tanpa konflik skema.
2. **Ujian Unit Enjin Chatbot**:
   - Ujian aliran *Greeting -> Input Nama -> Input Emel*.
   - Ujian padanan *Keyword* dan respons pilihan butang.
   - Ujian pengiraan skor kelayakan dan picuan *Handoff*.
3. **Ujian Notifikasi Telegram**: Memastikan mesej ringkasan prospek berjaya dihantar ke saluran Telegram Admin dengan pautan `wa.me`.
4. **Ujian Antara Muka Web & Mini App**:
   - Semakan paparan tab baru pada portal web dan Telegram Mini App.
   - Ujian penambahan/pengemaskinian keyword dan jawapan melalui UI.
   - Ujian Live Simulator untuk interaksi maya tanpa peranti fizikal.
5. **Kompilasi & Integriti Kod**: Menjalankan semakan sintaks dan linting untuk memastikan tiada ralat.
