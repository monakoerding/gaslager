/**
 * Additional Apps Script file for the Gaslager app, alongside Code.gs.
 * Stores meter collections/photos privately in Drive, then sends one email.
 * No camp access code and no SMTP server are required.
 */
const ZAEHLER_TYPEN = { strom: ['Strom', 'kWh'], wasser: ['Wasser', 'm³'], gas: ['Gas', 'm³'] };
const ZAEHLER_ORDNER_SCHLUESSEL = 'ZAEHLER_DRIVE_FOLDER_ID';

// Run once in the Apps Script editor to authorize Drive access, without sending mail.
function zaehlerEinrichten() {
  const ordner = zaehlerHauptordner(true);
  Logger.log('Geschützter Zählerordner: ' + ordner.getUrl());
  Logger.log('Verbleibendes E-Mail-Kontingent: ' + MailApp.getRemainingDailyQuota());
}

function zaehlerHash(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function(byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function zaehlerBelegPruefen(daten) {
  if (!daten || typeof daten.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(daten.id)) throw new Error('Ungültige Erfassungsnummer.');
  if (typeof daten.receiptToken !== 'string' || !/^[0-9a-f-]{72}$/i.test(daten.receiptToken)) throw new Error('Die Empfangsbestätigung fehlt. Bitte die App neu laden.');
}

function zaehlerValidieren(daten) {
  zaehlerBelegPruefen(daten);
  if (!Array.isArray(daten.readings) || daten.readings.length < 1 || daten.readings.length > 50) throw new Error('Bitte zwischen 1 und 50 Ablesungen übermitteln.');
  const heute = Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd');
  const ids = {};
  let gesamt = 0;
  return daten.readings.map(function(wert, index) {
    if (!wert || typeof wert.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(wert.id) || Object.prototype.hasOwnProperty.call(ids, wert.id)) throw new Error('Ungültige oder doppelte Ablesungsnummer.');
    ids[wert.id] = true;
    if (!Object.prototype.hasOwnProperty.call(ZAEHLER_TYPEN, wert.type) || typeof wert.meter !== 'string' || !wert.meter.trim() || wert.meter.length > 80) throw new Error('Zählerart oder Zählernummer fehlt.');
    if (typeof wert.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(wert.date) || !Number.isFinite(Date.parse(wert.date)) || new Date(wert.date).toISOString().slice(0, 10) !== wert.date || wert.date > heute) throw new Error('Ungültiges Ablesedatum.');
    if (typeof wert.value !== 'number' || !Number.isFinite(wert.value) || wert.value < 0 || wert.value > Number.MAX_SAFE_INTEGER) throw new Error('Ungültiger Zählerstand.');
    if (typeof wert.note !== 'string' || wert.note.length > 500) throw new Error('Ungültige Notiz.');
    if (typeof wert.photo !== 'string' || wert.photo.length > 12 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(wert.photo)) throw new Error('Ein Zählerfoto fehlt oder ist ungültig.');
    const bytes = Utilities.base64Decode(wert.photo);
    const byte = function(i) { return (bytes[i] + 256) % 256; };
    if (bytes.length < 5 || byte(0) !== 255 || byte(1) !== 216 || byte(2) !== 255 || byte(bytes.length - 2) !== 255 || byte(bytes.length - 1) !== 217 || Utilities.base64Encode(bytes) !== wert.photo) throw new Error('Bitte ein JPEG-Foto pro Ablesung übermitteln.');
    gesamt += bytes.length;
    if (gesamt > 8 * 1024 * 1024) throw new Error('Die Fotos sind zusammen größer als 8 MB.');
    return {
      id: wert.id, type: wert.type, meter: wert.meter.trim(), date: wert.date,
      value: wert.value, note: wert.note.trim(), photo: wert.photo,
      blob: Utilities.newBlob(bytes, 'image/jpeg', 'zaehler-' + (index + 1) + '-' + wert.date + '.jpg')
    };
  });
}

function zaehlerHauptordner(anlegen) {
  const eigenschaften = PropertiesService.getScriptProperties();
  const id = eigenschaften.getProperty(ZAEHLER_ORDNER_SCHLUESSEL);
  if (id) return DriveApp.getFolderById(id);
  if (!anlegen) return null;
  const ordner = DriveApp.createFolder('Uhlenköper-Camp · Zählerstände');
  eigenschaften.setProperty(ZAEHLER_ORDNER_SCHLUESSEL, ordner.getId());
  return ordner;
}

function zaehlerErfassungsordner(hauptordner, id, anlegen) {
  if (!hauptordner) return null;
  const ordner = hauptordner.getFoldersByName(id);
  return ordner.hasNext() ? ordner.next() : anlegen ? hauptordner.createFolder(id) : null;
}

function zaehlerManifest(ordner) {
  const dateien = ordner.getFilesByName('erfassung.json');
  if (!dateien.hasNext()) return null;
  const datei = dateien.next();
  return { datei: datei, daten: JSON.parse(datei.getBlob().getDataAsString('UTF-8')) };
}

function zaehlerAntwort(daten) {
  return { ok: true, id: daten.id, stored: ['stored', 'sending', 'uncertain', 'sent'].indexOf(daten.status) !== -1, status: daten.status, sentAt: daten.sentAt || null };
}

function zaehlerStatus(daten) {
  zaehlerBelegPruefen(daten);
  const ordner = zaehlerErfassungsordner(zaehlerHauptordner(false), daten.id, false);
  const manifest = ordner && zaehlerManifest(ordner);
  if (!manifest || manifest.daten.receiptHash !== zaehlerHash(daten.receiptToken)) return { ok: false, error: 'Die Erfassung ist nicht verfügbar.' };
  const antwort = zaehlerAntwort(manifest.daten);
  if (antwort.status === 'uncertain' || antwort.status === 'sending') antwort.message = 'Werte und Fotos sind gespeichert. Der Versandstatus ist noch nicht bestätigt. Bitte im Camp-Postfach nach der Erfassungsnummer suchen. Es wird keine zweite E-Mail automatisch ausgelöst.';
  return antwort;
}

function zaehlerCsv(werte) {
  const zelle = function(wert) { return '"' + String(wert).replace(/^\s*[=+@-]/, function(anfang) { return "'" + anfang; }).replace(/"/g, '""') + '"'; };
  const zeilen = [['Zählerart', 'Zählernummer / Standort', 'Datum', 'Stand', 'Einheit', 'Notiz']];
  werte.forEach(function(wert) { zeilen.push([ZAEHLER_TYPEN[wert.type][0], wert.meter, wert.date, String(wert.value).replace('.', ','), ZAEHLER_TYPEN[wert.type][1], wert.note]); });
  return '\uFEFF' + zeilen.map(function(zeile) { return zeile.map(zelle).join(';'); }).join('\r\n');
}

function zaehlerEmpfangen(daten) {
  const werte = zaehlerValidieren(daten);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { ok: false, error: 'Eine Erfassung wird gerade verarbeitet. Bitte kurz warten und erneut versuchen.' };
  let manifest, ordner;
  try {
    ordner = zaehlerErfassungsordner(zaehlerHauptordner(true), daten.id, true);
    const metadaten = werte.map(function(wert) { return { id: wert.id, type: wert.type, meter: wert.meter, date: wert.date, value: wert.value, note: wert.note }; });
    const digest = zaehlerHash(JSON.stringify(metadaten) + werte.map(function(wert) { return zaehlerHash(wert.photo); }).join(''));
    manifest = zaehlerManifest(ordner);
    if (manifest) {
      if (manifest.daten.receiptHash !== zaehlerHash(daten.receiptToken)) throw new Error('Die Erfassung ist nicht verfügbar.');
      if (manifest.daten.digest !== digest) throw new Error('Die begonnene Erfassung enthält andere Daten.');
      if (manifest.daten.status === 'sent') return zaehlerAntwort(manifest.daten);
      if (manifest.daten.status === 'sending' || manifest.daten.status === 'uncertain') {
        manifest.daten.status = 'uncertain';
        manifest.datei.setContent(JSON.stringify(manifest.daten));
        return Object.assign(zaehlerAntwort(manifest.daten), { message: 'Daten und Fotos sind gespeichert. Bitte den Versand im Camp-Postfach prüfen; es wird keine zweite E-Mail automatisch ausgelöst.' });
      }
    } else {
      const eintrag = { id: daten.id, receiptHash: zaehlerHash(daten.receiptToken), digest: digest, createdAt: new Date().toISOString(), status: 'saving', readings: metadaten, photoIds: [] };
      manifest = { daten: eintrag, datei: ordner.createFile('erfassung.json', JSON.stringify(eintrag), MimeType.PLAIN_TEXT) };
    }
    // Fixed filenames permit recovery after an interrupted upload without new photos.
    const anhaenge = werte.map(function(wert) {
      const vorhanden = ordner.getFilesByName(wert.blob.getName());
      const datei = vorhanden.hasNext() ? vorhanden.next() : ordner.createFile(wert.blob);
      return { id: datei.getId(), blob: wert.blob };
    });
    const csv = Utilities.newBlob(zaehlerCsv(werte), 'text/csv', 'ablesungen-' + daten.id + '.csv');
    if (!ordner.getFilesByName(csv.getName()).hasNext()) ordner.createFile(csv);
    manifest.daten.photoIds = anhaenge.map(function(anhang) { return anhang.id; });
    manifest.daten.status = 'stored';
    manifest.datei.setContent(JSON.stringify(manifest.daten));
    if (MailApp.getRemainingDailyQuota() < 1) return Object.assign(zaehlerAntwort(manifest.daten), { message: 'Werte und Fotos sind gespeichert. Das tägliche E-Mail-Limit ist erreicht. Bitte später erneut senden.' });

    const text = werte.map(function(wert, index) {
      return (index + 1) + '. ' + ZAEHLER_TYPEN[wert.type][0] + ' · ' + wert.meter + '\nDatum: ' + wert.date + '\nStand: ' + String(wert.value).replace('.', ',') + ' ' + ZAEHLER_TYPEN[wert.type][1] + (wert.note ? '\nNotiz: ' + wert.note : '');
    }).join('\n\n');
    manifest.daten.status = 'sending';
    manifest.datei.setContent(JSON.stringify(manifest.daten));
    try {
      MailApp.sendEmail({
        to: EMPFAENGER,
        subject: 'Zählerstände · ' + werte.length + ' Ablesung(en) · ' + daten.id,
        body: 'Erfassung abgeschlossen.\nErfassungsnummer: ' + daten.id + '\n\n' + text + '\n\nDie Fotos und die CSV-Übersicht sind angehängt.\nGeschützter Camp-Speicher: ' + ordner.getUrl(),
        attachments: [csv].concat(anhaenge.map(function(anhang) { return anhang.blob; }))
      });
      manifest.daten.sentAt = new Date().toISOString();
      manifest.daten.status = 'sent';
      manifest.datei.setContent(JSON.stringify(manifest.daten));
      return zaehlerAntwort(manifest.daten);
    } catch (fehler) {
      manifest.daten.status = 'uncertain';
      manifest.datei.setContent(JSON.stringify(manifest.daten));
      return Object.assign(zaehlerAntwort(manifest.daten), { message: 'Werte und Fotos sind gespeichert. Der Mailversand konnte nicht bestätigt werden. Bitte anhand der Erfassungsnummer im Camp-Postfach prüfen.' });
    }
  } finally { lock.releaseLock(); }
}
