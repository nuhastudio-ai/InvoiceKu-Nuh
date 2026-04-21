# 📖 InvoiceKu – Panduan Instalasi & Deploy

Panduan lengkap untuk menghubungkan database Google Sheets dan men-deploy ke **GitHub** + **Vercel**.

---

## 🗂 Struktur File

```
invoiceku/
├── index.html        ← Aplikasi utama
├── gas-backend.js    ← Kode Google Apps Script (untuk database)
└── INSTALL.md        ← Panduan ini
```

---

## 🔗 Bagian 1 – Setup Database Google Sheets

### Langkah 1: Buka Google Spreadsheet

Buka spreadsheet kamu di link berikut:
👉 [https://docs.google.com/spreadsheets/d/1OLU8tajTsQjTrcKDGrWgiPGwFN-bVMq3Y4pvi55V3zM/edit](https://docs.google.com/spreadsheets/d/1OLU8tajTsQjTrcKDGrWgiPGwFN-bVMq3Y4pvi55V3zM/edit)

Pastikan sudah ada sheet bernama **`InvoiceKu`**. Jika belum, buat sheet baru dengan nama tersebut.

### Langkah 2: Inisialisasi Header (Opsional, bisa otomatis)

Jika baris 1 masih kosong, isi dengan header berikut (salin satu baris, setiap kolom dipisah Tab):

```
No. Dokumen	Jenis	Tgl Terbit	Tgl Jatuh Tempo/Bayar	Nama Pelanggan	No. HP	Email	Alamat	Detail Item	Subtotal	Diskon(%)	PPN(%)	Total	Metode Bayar	Bank/eWallet	No. Rekening	Atas Nama	Catatan	Status	Timestamp
```

> 💡 Header juga akan dibuat otomatis saat kamu pertama kali menjalankan fungsi `initSheet()` di Apps Script.

### Langkah 3: Buka Apps Script

1. Di Google Sheets, klik menu **Extensions → Apps Script**
2. Hapus semua kode yang ada di editor
3. Buka file `gas-backend.js` dan salin **seluruh isinya**
4. Tempel ke editor Apps Script
5. Pastikan `SPREADSHEET_ID` di baris atas sesuai dengan ID spreadsheet kamu:
   ```
   const SPREADSHEET_ID = '1OLU8tajTsQjTrcKDGrWgiPGwFN-bVMq3Y4pvi55V3zM';
   ```
6. Klik **💾 Save** (Ctrl+S)

### Langkah 4: Jalankan initSheet (1 kali saja)

1. Di dropdown fungsi (atas editor), pilih `initSheet`
2. Klik ▶ **Run**
3. Izinkan akses saat diminta (Allow)
4. Cek spreadsheet — header baris 1 seharusnya sudah terbuat

### Langkah 5: Deploy sebagai Web App

1. Klik tombol **Deploy → New deployment**
2. Di bagian "Select type", pilih **Web app**
3. Isi konfigurasi:
   - **Description**: InvoiceKu Backend
   - **Execute as**: Me (akun Google kamu)
   - **Who has access**: **Anyone** ⚠️ (ini penting agar bisa diakses dari web)
4. Klik **Deploy**
5. **Salin URL** yang muncul — bentuknya seperti:
   ```
   https://script.google.com/macros/s/AKfycbxxxxxxxxxx/exec
   ```

### Langkah 6: Masukkan URL ke Aplikasi

1. Buka `index.html` di browser
2. Klik ⚙️ (Pengaturan) di kanan atas
3. Tempel URL Apps Script ke kolom **URL Google Apps Script**
4. Klik **Simpan**

✅ Selesai! Sekarang tombol "Simpan ke Database" akan aktif.

---

## 🚀 Bagian 2 – Deploy ke GitHub + Vercel

InvoiceKu adalah **aplikasi statis** (tidak perlu server Node.js). Deploy sangat mudah.

### Langkah 1: Buat Repository GitHub

1. Buka [https://github.com](https://github.com) → **New repository**
2. Nama repository: `invoiceku` (atau apapun)
3. Visibility: **Public** (gratis di Vercel) atau Private
4. Klik **Create repository**

### Langkah 2: Upload File

**Cara A – Upload lewat GitHub Web (mudah):**

1. Di halaman repository, klik **"uploading an existing file"** atau tombol **Add file → Upload files**
2. Upload kedua file: `index.html` dan `gas-backend.js`
3. Tambahkan commit message, klik **Commit changes**

**Cara B – Via Git (jika sudah install Git):**

```bash
git init
git add index.html gas-backend.js INSTALL.md
git commit -m "Initial commit InvoiceKu"
git branch -M main
git remote add origin https://github.com/NAMA_USER/invoiceku.git
git push -u origin main
```

### Langkah 3: Deploy ke Vercel

1. Buka [https://vercel.com](https://vercel.com) → Login dengan akun GitHub
2. Klik **"Add New… → Project"**
3. Pilih repository `invoiceku` → **Import**
4. Konfigurasi:
   - **Framework Preset**: Other (atau None)
   - **Root Directory**: `./` (biarkan default)
   - **Build Command**: *(kosongkan)*
   - **Output Directory**: `./` atau `.`
5. Klik **Deploy**

Vercel akan men-deploy dan memberikan URL seperti:
```
https://invoiceku.vercel.app
```

### Langkah 4: Custom Domain (Opsional)

Di Vercel → Settings → Domains → tambahkan domain kamu sendiri.

---

## 🔄 Update Aplikasi

Setiap kali kamu mengubah `index.html` dan push ke GitHub, Vercel otomatis **re-deploy**.

```bash
git add index.html
git commit -m "Update fitur baru"
git push
```

git add index.html
git commit -m "Menambahkan fitur baru dari PC berbeda"
git push -u origin main

---

## ⚙️ Pengaturan Tambahan Google Apps Script

Jika kamu mengubah kode `gas-backend.js`, kamu perlu **re-deploy**:

1. Buka Apps Script Editor
2. **Deploy → Manage deployments**
3. Klik ✏️ Edit di deployment yang ada
4. Di "Version", pilih **New version**
5. Klik **Deploy**

> ⚠️ URL Apps Script **tidak berubah** saat re-deploy dengan cara ini.

---

## ❓ FAQ

**Q: Data tersimpan di mana?**  
A: Di Google Sheets yang kamu miliki. InvoiceKu hanya sebagai antarmuka (frontend).

**Q: Apakah data aman?**  
A: Spreadsheet ada di Google Drive kamu. Hanya yang punya link Apps Script yang bisa kirim/baca data.

**Q: Bisa pakai tanpa internet?**  
A: Aplikasi bisa dibuka offline, tapi fitur simpan ke database butuh koneksi internet.

**Q: Biaya deploy ke Vercel?**  
A: Gratis untuk proyek personal/kecil (Hobby plan). Tidak perlu kartu kredit.

**Q: Bagaimana jika Apps Script berubah URL?**  
A: Update URL di ⚙️ Pengaturan aplikasi, simpan ulang.

---

## 📞 Struktur Database (Referensi)

| Kolom | Isi |
|-------|-----|
| No. Dokumen | INV/2025/01/001 |
| Jenis | invoice / receipt |
| Tgl Terbit | YYYY-MM-DD |
| Tgl Jatuh Tempo/Bayar | YYYY-MM-DD |
| Nama Pelanggan | Nama klien |
| No. HP | +62 8xx |
| Email | email@... |
| Alamat | Jalan, Kota |
| Detail Item | Nama (qty×harga); ... |
| Subtotal | angka |
| Diskon(%) | 0-100 |
| PPN(%) | 0-100 |
| Total | angka |
| Metode Bayar | Transfer Bank / QRIS / dll |
| Bank/eWallet | BRI / BCA / OVO / dll |
| No. Rekening | angka |
| Atas Nama | Nama pemilik |
| Catatan | teks bebas |
| Status | Belum Bayar / Lunas |
| Timestamp | ISO 8601 |

---

*InvoiceKu – dibuat untuk kemudahan pengelolaan invoice usaha kecil & menengah Indonesia.*
