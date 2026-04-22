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
  'Bank/eWallet', 'No. Rekening', 'Atas Nama', 'Catatan', 'Status', 'Timestamp', 'InvRef'
];

const CUSTOMER_HEADERS = ['id', 'name', 'phone', 'email', 'address', 'note'];
const ITEMS_HEADERS    = ['id', 'name', 'unit', 'buyPrice', 'sellPrice', 'desc', 'variants', 'wholesalePrices'];
const SETTINGS_HEADERS = ['key', 'value'];
const PM_SHEET        = 'PaymentMethods';
const PM_HEADERS      = ['id', 'name', 'type', 'bank', 'account', 'holder'];

// ────────────────────────────────────────────
// CORS helper
// ────────────────────────────────────────────
function output(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Konversi nilai sel Spreadsheet ke string yang aman untuk JSON.
 * Jika nilainya Date object, format sebagai DD/MM/YYYY.
 * Jika nilainya number/string/boolean, kembalikan apa adanya.
 */
function cellToSafe(val) {
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const d = val.getDate().toString().padStart(2,'0');
    const m = (val.getMonth()+1).toString().padStart(2,'0');
    const y = val.getFullYear();
    return d + '/' + m + '/' + y;
  }
  return val !== undefined ? val : '';
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
    headers.forEach((h, i) => { obj[h] = cellToSafe(row[i]); });
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
  } else {
    // ── Migrasi: tambah kolom baru yang belum ada (tanpa hapus data lama) ──
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missingHeaders  = headers.filter(h => !existingHeaders.includes(h));
    if (missingHeaders.length > 0) {
      const startCol = existingHeaders.length + 1;
      missingHeaders.forEach((h, i) => {
        const col = startCol + i;
        sheet.getRange(1, col).setValue(h)
          .setBackground('#1e2d42')
          .setFontColor('#ffffff')
          .setFontWeight('bold');
      });
    }
  }
  return sheet;
}

// ────────────────────────────────────────────
// UTIL – Pastikan sheet InvoiceKu + migrasi kolom baru (InvRef, dll)
// ────────────────────────────────────────────
function ensureInvoiceSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#1e2d42').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  // Migrasi: tambah kolom yang belum ada (misal InvRef)
  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const missing = HEADERS.filter(h => !existingHeaders.includes(h));
  if (missing.length > 0) {
    const startCol = existingHeaders.length + 1;
    missing.forEach((h, i) => {
      const col = startCol + i;
      sheet.getRange(1, col).setValue(h)
        .setBackground('#1e2d42').setFontColor('#ffffff').setFontWeight('bold');
    });
  }
  return sheet;
}

/**
 * Buat array row berdasarkan header aktual sheet sehingga aman
 * meski kolom baru ditambahkan di kemudian hari.
 */
function buildInvoiceRow(headers, d, noDoc, timestamp) {
  return headers.map(h => {
    switch (h) {
      case 'No. Dokumen':           return noDoc                  || '';
      case 'Jenis':                 return d.jenis                || '';
      case 'Tgl Terbit':            return d.tglTerbit            || '';
      case 'Tgl Jatuh Tempo/Bayar': return d.tglJatuhTempo        || '';
      case 'Nama Pelanggan':        return d.namaPelanggan        || '';
      case 'No. HP':                return d.noHp                 || '';
      case 'Email':                 return d.email                || '';
      case 'Alamat':                return d.alamat               || '';
      case 'Detail Item':           return d.detailItem           || '';
      case 'Subtotal':              return d.subtotal             || 0;
      case 'Diskon(%)':             return d.diskon               || 0;
      case 'PPN(%)':                return d.ppn                  || 0;
      case 'Total':                 return d.total                || 0;
      case 'Metode Bayar':          return d.metodeBayar          || '';
      case 'Bank/eWallet':          return d.bankEwallet          || '';
      case 'No. Rekening':          return d.noRekening           || '';
      case 'Atas Nama':             return d.atasNama             || '';
      case 'Catatan':               return d.catatan              || '';
      case 'Status':                return d.status               || 'Belum Bayar';
      case 'Timestamp':             return timestamp              || new Date().toISOString();
      case 'InvRef':                return d.invRef               || '';
      default:                      return '';
    }
  });
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
          headers.forEach((h, i) => { obj[h] = cellToSafe(row[i]); });
          return obj;
        });
      }
    }

    // ── Customers data ──
    const customersData = fetchSheetData(ss, CUSTOMER_SHEET);

    // ── Items / Katalog data ──
    const itemsData = fetchSheetData(ss, ITEMS_SHEET);

    // ── Payment Methods ──
    const pmData = fetchSheetData(ss, PM_SHEET);

    // ── Settings dari cloud ──
    const settingsRows = fetchSheetData(ss, SETTINGS_SHEET);
    const settingsObj  = {};
    settingsRows.forEach(r => { if (r.key) settingsObj[r.key] = r.value; });

    return output({
      success:        true,
      data:           invoiceRows,
      customers:      customersData,
      items:          itemsData,
      paymentMethods: pmData,
      settings:       Object.keys(settingsObj).length > 0 ? settingsObj : null
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
    // ── INVOICE: SAVE ATOMIC (nomor otomatis + simpan dalam 1 lock) ──
    // Ini adalah aksi utama saat user klik Simpan / Cetak & Simpan.
    // Menggunakan LockService agar tidak ada 2 user dapat nomor yang sama.
    // ══════════════════════════════
    if (data.action === 'saveInvoiceAtomic') {
      const lock = LockService.getScriptLock();
      try { lock.waitLock(10000); }
      catch(e) { return output({ success: false, message: 'Server padat, coba lagi sebentar.' }); }

      try {
        const sheet   = ensureInvoiceSheet(ss);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

        // ── Hitung nomor dokumen berikutnya ──
        const settingsSheet = ensureSheet(ss, SETTINGS_SHEET, SETTINGS_HEADERS);
        const sValues       = settingsSheet.getDataRange().getValues();
        const prefix        = data.prefix   || 'INV';
        const datePart      = data.datePart || '';
        const counterKey    = 'counter_' + prefix.toLowerCase() + '_' + datePart;

        let nextVal = 1;
        let found   = false;
        for (let i = 1; i < sValues.length; i++) {
          if (String(sValues[i][0]) === counterKey) {
            nextVal = (parseInt(sValues[i][1]) || 0) + 1;
            settingsSheet.getRange(i + 1, 2).setValue(nextVal);
            found = true;
            break;
          }
        }
        if (!found) {
          settingsSheet.appendRow([counterKey, 1]);
          nextVal = 1;
        }

        const noDoc = prefix + '-' + datePart + String(nextVal).padStart(3, '0');

        // ── Simpan baris invoice ──
        sheet.appendRow(buildInvoiceRow(headers, data, noDoc, new Date().toISOString()));

        return output({ success: true, noDoc, counter: nextVal });

      } finally {
        lock.releaseLock();
      }
    }

    // ══════════════════════════════
    // ── PEEK NEXT COUNTER (pratinjau nomor, TANPA increment) ──
    // ══════════════════════════════
    if (data.action === 'peekNextCounter') {
      const sheet  = ensureSheet(ss, SETTINGS_SHEET, SETTINGS_HEADERS);
      const values = sheet.getDataRange().getValues();
      const prefix      = data.prefix   || 'INV';
      const datePart    = data.datePart || '';
      const counterKey  = 'counter_' + prefix.toLowerCase() + '_' + datePart;

      let currentVal = 0;
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === counterKey) {
          currentVal = parseInt(values[i][1]) || 0;
          break;
        }
      }
      const nextVal = currentVal + 1;
      const noDoc   = prefix + '-' + datePart + String(nextVal).padStart(3, '0');
      return output({ success: true, noDoc, counter: nextVal });
    }

    // ══════════════════════════════
    // ── INVOICE: SAVE MANUAL (pakai noDoc dari frontend) ──
    // ══════════════════════════════
    if (data.action === 'save') {
      const sheet   = ensureInvoiceSheet(ss);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      sheet.appendRow(buildInvoiceRow(headers, data, data.noDoc, new Date().toISOString()));
      return output({ success: true, message: 'Data disimpan: ' + data.noDoc });
    }

    // ══════════════════════════════
    // ── INVOICE: UPDATE (header-aware) ──
    // ══════════════════════════════
    if (data.action === 'update') {
      const sheet = ensureInvoiceSheet(ss);
      const values = sheet.getDataRange().getValues();
      const headers = values[0];

      // Buat map header → index kolom (1-based)
      const colOf = {};
      headers.forEach((h, i) => { colOf[h] = i + 1; });

      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.noDoc)) {
          const row = i + 1;
          const set = (h, v) => { if (colOf[h] && v !== undefined) sheet.getRange(row, colOf[h]).setValue(v); };
          set('Tgl Terbit',            data.tglTerbit);
          set('Tgl Jatuh Tempo/Bayar', data.tglJatuhTempo);
          set('Nama Pelanggan',        data.namaPelanggan);
          set('No. HP',                data.noHp);
          set('Email',                 data.email);
          set('Alamat',                data.alamat);
          set('Detail Item',           data.detailItem);
          set('Subtotal',              data.subtotal);
          set('Diskon(%)',             data.diskon);
          set('PPN(%)',                data.ppn);
          set('Total',                 data.total);
          set('Metode Bayar',          data.metodeBayar);
          set('Catatan',               data.catatan);
          set('Status',                data.status);
          set('InvRef',                data.invRef);
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
      const headers = values[0]; // pakai header aktual sheet (sudah migrasi)

      // Helper: buat array row berdasarkan header aktual
      function buildItemRow(d) {
        return headers.map(h => {
          if (h === 'id')             return d.id || '';
          if (h === 'name')           return d.name || '';
          if (h === 'unit')           return d.unit || '';
          if (h === 'buyPrice')       return d.buyPrice || 0;
          if (h === 'sellPrice')      return d.sellPrice || 0;
          if (h === 'desc')           return d.desc || '';
          if (h === 'variants')       return JSON.stringify(d.variants || []);
          if (h === 'wholesalePrices') return JSON.stringify(d.wholesalePrices || []);
          return '';
        });
      }

      // Cek apakah id sudah ada → update
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.id)) {
          sheet.getRange(i + 1, 1, 1, headers.length).setValues([buildItemRow(data)]);
          return output({ success: true, message: 'Item diperbarui: ' + data.name });
        }
      }

      // Belum ada → tambah baris baru
      sheet.appendRow(buildItemRow(data));
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
    // ── PAYMENT METHOD: SAVE / UPDATE ──
    // ══════════════════════════════
    if (data.action === 'savePaymentMethod') {
      const sheet  = ensureSheet(ss, PM_SHEET, PM_HEADERS);
      const values = sheet.getDataRange().getValues();

      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.id)) {
          sheet.getRange(i + 1, 1, 1, PM_HEADERS.length).setValues([[
            data.id, data.name||'', data.type||'', data.bank||'', data.account||'', data.holder||''
          ]]);
          return output({ success: true, message: 'Metode diperbarui: ' + data.name });
        }
      }
      sheet.appendRow([data.id, data.name||'', data.type||'', data.bank||'', data.account||'', data.holder||'']);
      return output({ success: true, message: 'Metode ditambahkan: ' + data.name });
    }

    // ══════════════════════════════
    // ── PAYMENT METHOD: DELETE ──
    // ══════════════════════════════
    if (data.action === 'deletePaymentMethod') {
      const sheet = ss.getSheetByName(PM_SHEET);
      if (!sheet) return output({ success: false, message: 'Sheet PaymentMethods tidak ditemukan' });
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.id)) {
          sheet.deleteRow(i + 1);
          return output({ success: true, message: 'Metode dihapus: ' + data.id });
        }
      }
      return output({ success: false, message: 'Metode tidak ditemukan: ' + data.id });
    }

    // ══════════════════════════════
    // ── COUNTER: AMBIL NOMOR URUT BERIKUTNYA (ATOMIK) ──
    // Dipakai jika frontend ingin nomor saja tanpa langsung simpan data.
    // Untuk simpan + nomor sekaligus, gunakan saveInvoiceAtomic.
    // ══════════════════════════════
    if (data.action === 'getNextCounter') {
      // Gunakan LockService agar multi-user tidak tabrakan
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(8000); // tunggu max 8 detik
      } catch(e) {
        return output({ success: false, message: 'Server sibuk, coba lagi.' });
      }

      try {
        const sheet  = ensureSheet(ss, SETTINGS_SHEET, SETTINGS_HEADERS);
        const values = sheet.getDataRange().getValues();
        const prefix   = data.prefix  || 'INV';   // 'INV' atau 'NP'
        const datePart = data.datePart || '';       // format ddmmyy, misal '200426'
        const counterKey = 'counter_' + prefix.toLowerCase() + '_' + datePart;

        let found    = false;
        let nextVal  = 1;
        for (let i = 1; i < values.length; i++) {
          if (String(values[i][0]) === counterKey) {
            const cur = parseInt(values[i][1]) || 0;
            nextVal   = cur + 1;
            sheet.getRange(i + 1, 2).setValue(nextVal);
            found = true;
            break;
          }
        }
        if (!found) {
          sheet.appendRow([counterKey, 1]);
          nextVal = 1;
        }

        const noDoc = prefix + '-' + datePart + String(nextVal).padStart(3, '0');
        return output({ success: true, counter: nextVal, noDoc: noDoc });

      } finally {
        lock.releaseLock();
      }
    }

    // ══════════════════════════════
    // ── SETTINGS: SAVE ──
    // ══════════════════════════════
    if (data.action === 'saveSettings') {
      const sheet = ensureSheet(ss, SETTINGS_SHEET, SETTINGS_HEADERS);
      const values = sheet.getDataRange().getValues();

      // Field yang disimpan di cloud (kecualikan base64 besar)
      const skipKeys = ['action', 'logoDataUrl', 'stampDataUrl'];
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
// UTIL – inisialisasi semua header (jalankan manual 1x, atau otomatis saat pertama kali)
// ────────────────────────────────────────────
function initSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Sheet InvoiceKu (dengan migrasi kolom otomatis)
  ensureInvoiceSheet(ss);
  Logger.log('Sheet InvoiceKu siap (dengan migrasi kolom).');

  // Sheet Customers
  ensureSheet(ss, CUSTOMER_SHEET, CUSTOMER_HEADERS);
  Logger.log('Sheet Customers siap.');

  // Sheet Items
  ensureSheet(ss, ITEMS_SHEET, ITEMS_HEADERS);
  Logger.log('Sheet Items siap.');

  // Sheet Settings
  ensureSheet(ss, SETTINGS_SHEET, SETTINGS_HEADERS);
  Logger.log('Sheet Settings siap.');

  // Sheet PaymentMethods
  ensureSheet(ss, PM_SHEET, PM_HEADERS);
  Logger.log('Sheet PaymentMethods siap.');
}