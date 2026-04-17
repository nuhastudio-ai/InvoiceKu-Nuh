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

// ── Nama Sheet ──
const SHEET_NAME      = 'InvoiceKu';
const CUSTOMER_SHEET  = 'Customers';
const ITEMS_SHEET     = 'Items';
const SETTINGS_SHEET  = 'Settings';

// ── Header kolom (pastikan baris 1 spreadsheet sesuai ini) ──
const HEADERS = [
  'No. Dokumen', 'Jenis', 'Tgl Terbit', 'Tgl Jatuh Tempo/Bayar',
  'Nama Pelanggan', 'No. HP', 'Email', 'Alamat', 'Detail Item',
  'Subtotal', 'Diskon(%)', 'PPN(%)', 'Total', 'Metode Bayar',
  'Bank/eWallet', 'No. Rekening', 'Atas Nama', 'Catatan', 'Status', 'Timestamp'
];

const CUSTOMER_HEADERS = ['id', 'name', 'phone', 'email', 'address', 'note'];
const ITEMS_HEADERS    = ['id', 'name', 'unit', 'buyPrice', 'sellPrice', 'desc'];
const SETTINGS_HEADERS = ['key', 'value'];

// ────────────────────────────────────────────
// CORS helper
// ────────────────────────────────────────────
function output(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ────────────────────────────────────────────
// UTIL – Ambil data dari satu sheet jadi array of object
// ────────────────────────────────────────────
function fetchSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
    return obj;
  });
}

// ────────────────────────────────────────────
// UTIL – Pastikan sheet + header ada (auto-buat jika belum)
// ────────────────────────────────────────────
function ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#1e2d42')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ────────────────────────────────────────────
// GET – ambil semua data (invoices + customers + items)
// ────────────────────────────────────────────
function doGet(e) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    // ── Invoice data ──
    let invoiceRows = [];
    if (sheet) {
      const values = sheet.getDataRange().getValues();
      if (values.length > 1) {
        const headers = values[0];
        invoiceRows = values.slice(1).map(row => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
          return obj;
        });
      }
    }

    // ── Customers data ──
    const customersData = fetchSheetData(ss, CUSTOMER_SHEET);

    // ── Items / Katalog data ──
    const itemsData = fetchSheetData(ss, ITEMS_SHEET);

    // ── Settings dari cloud ──
    const settingsRows = fetchSheetData(ss, SETTINGS_SHEET);
    const settingsObj  = {};
    settingsRows.forEach(r => { if (r.key) settingsObj[r.key] = r.value; });

    return output({
      success:   true,
      data:      invoiceRows,    // backward-compatible: invoice rows
      customers: customersData,  // customer list
      items:     itemsData,      // item/catalog list
      settings:  Object.keys(settingsObj).length > 0 ? settingsObj : null
    });

  } catch (err) {
    return output({ success: false, message: err.toString() });
  }
}

// ────────────────────────────────────────────
// POST – simpan / update / hapus (invoice, customer, item)
// ────────────────────────────────────────────
function doPost(e) {
  try {
    const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
    const data = JSON.parse(e.postData.contents);

    // ══════════════════════════════
    // ── INVOICE: SAVE (tambah baru) ──
    // ══════════════════════════════
    if (data.action === 'save') {
      let sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        sheet.appendRow(HEADERS);
      }
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

    // ══════════════════════════════
    // ── INVOICE: UPDATE ──
    // ══════════════════════════════
    if (data.action === 'update') {
      const sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) return output({ success: false, message: 'Sheet invoice tidak ditemukan' });
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.noDoc)) {
          const row = i + 1;
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

    // ══════════════════════════════
    // ── INVOICE: DELETE ──
    // ══════════════════════════════
    if (data.action === 'delete') {
      const sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) return output({ success: false, message: 'Sheet invoice tidak ditemukan' });
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.noDoc)) {
          sheet.deleteRow(i + 1);
          return output({ success: true, message: 'Dihapus: ' + data.noDoc });
        }
      }
      return output({ success: false, message: 'Tidak ditemukan: ' + data.noDoc });
    }

    // ══════════════════════════════
    // ── CUSTOMER: SAVE / UPDATE ──
    // ══════════════════════════════
    if (data.action === 'saveCustomer') {
      const sheet  = ensureSheet(ss, CUSTOMER_SHEET, CUSTOMER_HEADERS);
      const values = sheet.getDataRange().getValues();

      // Cek apakah id sudah ada → update
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.id)) {
          sheet.getRange(i + 1, 1, 1, CUSTOMER_HEADERS.length).setValues([[
            data.id,
            data.name    || '',
            data.phone   || '',
            data.email   || '',
            data.address || '',
            data.note    || ''
          ]]);
          return output({ success: true, message: 'Customer diperbarui: ' + data.name });
        }
      }

      // Belum ada → tambah baris baru
      sheet.appendRow([
        data.id,
        data.name    || '',
        data.phone   || '',
        data.email   || '',
        data.address || '',
        data.note    || ''
      ]);
      return output({ success: true, message: 'Customer ditambahkan: ' + data.name });
    }

    // ══════════════════════════════
    // ── CUSTOMER: DELETE ──
    // ══════════════════════════════
    if (data.action === 'deleteCustomer') {
      const sheet = ss.getSheetByName(CUSTOMER_SHEET);
      if (!sheet) return output({ success: false, message: 'Sheet Customers tidak ditemukan' });
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.id)) {
          sheet.deleteRow(i + 1);
          return output({ success: true, message: 'Customer dihapus: ' + data.id });
        }
      }
      return output({ success: false, message: 'Customer tidak ditemukan: ' + data.id });
    }

    // ══════════════════════════════
    // ── ITEM: SAVE / UPDATE ──
    // ══════════════════════════════
    if (data.action === 'saveItem') {
      const sheet  = ensureSheet(ss, ITEMS_SHEET, ITEMS_HEADERS);
      const values = sheet.getDataRange().getValues();

      // Cek apakah id sudah ada → update
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.id)) {
          sheet.getRange(i + 1, 1, 1, ITEMS_HEADERS.length).setValues([[
            data.id,
            data.name      || '',
            data.unit      || '',
            data.buyPrice  || 0,
            data.sellPrice || 0,
            data.desc      || ''
          ]]);
          return output({ success: true, message: 'Item diperbarui: ' + data.name });
        }
      }

      // Belum ada → tambah baris baru
      sheet.appendRow([
        data.id,
        data.name      || '',
        data.unit      || '',
        data.buyPrice  || 0,
        data.sellPrice || 0,
        data.desc      || ''
      ]);
      return output({ success: true, message: 'Item ditambahkan: ' + data.name });
    }

    // ══════════════════════════════
    // ── ITEM: DELETE ──
    // ══════════════════════════════
    if (data.action === 'deleteItem') {
      const sheet = ss.getSheetByName(ITEMS_SHEET);
      if (!sheet) return output({ success: false, message: 'Sheet Items tidak ditemukan' });
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.id)) {
          sheet.deleteRow(i + 1);
          return output({ success: true, message: 'Item dihapus: ' + data.id });
        }
      }
      return output({ success: false, message: 'Item tidak ditemukan: ' + data.id });
    }

    // ══════════════════════════════
    // ── SETTINGS: SAVE ──
    // ══════════════════════════════
    if (data.action === 'saveSettings') {
      const sheet = ensureSheet(ss, SETTINGS_SHEET, SETTINGS_HEADERS);
      const values = sheet.getDataRange().getValues();

      // Field yang disimpan di cloud (kecualikan logoDataUrl karena base64 besar)
      const skipKeys = ['action', 'logoDataUrl'];
      const toSave   = Object.entries(data).filter(([k]) => !skipKeys.includes(k));

      toSave.forEach(([key, val]) => {
        let found = false;
        for (let i = 1; i < values.length; i++) {
          if (String(values[i][0]) === key) {
            sheet.getRange(i + 1, 2).setValue(String(val));
            found = true; break;
          }
        }
        if (!found) sheet.appendRow([key, String(val)]);
      });

      return output({ success: true, message: 'Settings disimpan ke cloud.' });
    }

    return output({ success: false, message: 'Aksi tidak dikenali: ' + data.action });

  } catch (err) {
    return output({ success: false, message: err.toString() });
  }
}

// ────────────────────────────────────────────
// UTIL – inisialisasi semua header (jalankan manual 1x)
// ────────────────────────────────────────────
function initSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Sheet InvoiceKu
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (firstRow.every(v => v === '')) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#1e2d42').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log('Header InvoiceKu dibuat!');
  } else { Logger.log('Header InvoiceKu sudah ada, skip.'); }

  // Sheet Customers
  ensureSheet(ss, CUSTOMER_SHEET, CUSTOMER_HEADERS);
  Logger.log('Sheet Customers siap.');

  // Sheet Items
  ensureSheet(ss, ITEMS_SHEET, ITEMS_HEADERS);
  Logger.log('Sheet Items siap.');

  // Sheet Settings
  ensureSheet(ss, SETTINGS_SHEET, SETTINGS_HEADERS);
  Logger.log('Sheet Settings siap.');
}
