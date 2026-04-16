/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║          InvoiceKu – Google Apps Script Backend          ║
 * ║  Salin seluruh kode ini ke Google Apps Script Editor     ║
 * ║  Extensions → Apps Script → Tempel → Deploy as Web App  ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Ganti SPREADSHEET_ID di bawah dengan ID spreadsheet kamu.
 * ID ada di URL: docs.google.com/spreadsheets/d/[ID_INI]/edit
 */

const SPREADSHEET_ID = '1OLU8tajTsQjTrcKDGrWgiPGwFN-bVMq3Y4pvi55V3zM';
const SHEET_NAME     = 'InvoiceKu';

// ── Header kolom (pastikan baris 1 spreadsheet sesuai ini) ──
const HEADERS = [
  'No. Dokumen', 'Jenis', 'Tgl Terbit', 'Tgl Jatuh Tempo/Bayar',
  'Nama Pelanggan', 'No. HP', 'Email', 'Alamat', 'Detail Item',
  'Subtotal', 'Diskon(%)', 'PPN(%)', 'Total', 'Metode Bayar',
  'Bank/eWallet', 'No. Rekening', 'Atas Nama', 'Catatan', 'Status', 'Timestamp'
];

// ────────────────────────────────────────────
// CORS helper
// ────────────────────────────────────────────
function output(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ────────────────────────────────────────────
// GET – ambil semua data
// ────────────────────────────────────────────
function doGet(e) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) return output({ success: false, message: 'Sheet "' + SHEET_NAME + '" tidak ditemukan' });

    const values  = sheet.getDataRange().getValues();
    if (values.length <= 1) return output({ success: true, data: [] });

    const headers = values[0];
    const rows = values.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
      return obj;
    });

    return output({ success: true, data: rows });
  } catch (err) {
    return output({ success: false, message: err.toString() });
  }
}

// ────────────────────────────────────────────
// POST – simpan / update / hapus
// ────────────────────────────────────────────
function doPost(e) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    let   sheet = ss.getSheetByName(SHEET_NAME);

    // Auto-buat sheet + header jika belum ada
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
    }

    const data = JSON.parse(e.postData.contents);

    // ── SAVE (tambah baru) ──
    if (data.action === 'save') {
      sheet.appendRow([
        data.noDoc        || '',
        data.jenis        || '',
        data.tglTerbit    || '',
        data.tglJatuhTempo|| '',
        data.namaPelanggan|| '',
        data.noHp         || '',
        data.email        || '',
        data.alamat       || '',
        data.detailItem   || '',
        data.subtotal     || 0,
        data.diskon       || 0,
        data.ppn          || 0,
        data.total        || 0,
        data.metodeBayar  || '',
        data.bankEwallet  || '',
        data.noRekening   || '',
        data.atasNama     || '',
        data.catatan      || '',
        data.status       || 'Belum Bayar',
        new Date().toISOString()
      ]);
      return output({ success: true, message: 'Data disimpan: ' + data.noDoc });
    }

    // ── UPDATE (edit data) ──
    if (data.action === 'update') {
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.noDoc)) {
          const row = i + 1; // 1-indexed
          if (data.tglTerbit    !== undefined) sheet.getRange(row, 3).setValue(data.tglTerbit);
          if (data.tglJatuhTempo!== undefined) sheet.getRange(row, 4).setValue(data.tglJatuhTempo);
          if (data.namaPelanggan!== undefined) sheet.getRange(row, 5).setValue(data.namaPelanggan);
          if (data.noHp         !== undefined) sheet.getRange(row, 6).setValue(data.noHp);
          if (data.email        !== undefined) sheet.getRange(row, 7).setValue(data.email);
          if (data.diskon       !== undefined) sheet.getRange(row, 11).setValue(data.diskon);
          if (data.ppn          !== undefined) sheet.getRange(row, 12).setValue(data.ppn);
          if (data.metodeBayar  !== undefined) sheet.getRange(row, 14).setValue(data.metodeBayar);
          if (data.catatan      !== undefined) sheet.getRange(row, 18).setValue(data.catatan);
          if (data.status       !== undefined) sheet.getRange(row, 19).setValue(data.status);
          return output({ success: true, message: 'Data diperbarui: ' + data.noDoc });
        }
      }
      return output({ success: false, message: 'Data tidak ditemukan: ' + data.noDoc });
    }

    // ── DELETE (hapus baris) ──
    if (data.action === 'delete') {
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.noDoc)) {
          sheet.deleteRow(i + 1);
          return output({ success: true, message: 'Dihapus: ' + data.noDoc });
        }
      }
      return output({ success: false, message: 'Tidak ditemukan: ' + data.noDoc });
    }

    return output({ success: false, message: 'Aksi tidak dikenali: ' + data.action });

  } catch (err) {
    return output({ success: false, message: err.toString() });
  }
}

// ────────────────────────────────────────────
// UTIL – inisialisasi header (jalankan manual 1x)
// ────────────────────────────────────────────
function initSheet() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  // Set header jika baris 1 kosong
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const isEmpty  = firstRow.every(v => v === '');
  if (isEmpty) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#1e2d42')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log('Header berhasil dibuat!');
  } else {
    Logger.log('Header sudah ada, skip.');
  }
}
