/**
 * Uhlenköper-Camp – Abfallprotokoll
 *
 * Nimmt eine Müllzählung aus der Web-App entgegen, trägt sie als Zeile in das
 * Tabellenblatt des jeweiligen Jahres ein, aktualisiert die Summenzeile und
 * verschickt die Zählung per Mail mit der kompletten Tabelle als Excel-Anhang.
 *
 * Einrichtung: siehe EINRICHTUNG.md
 */

// Die App verschickt die Zählung selbst als Textmail über EmailJS.
// Steht dies auf true, schickt Google zusätzlich eine zweite Mail mit der
// kompletten Tabelle als Excel-Anhang.
const MAIL_MIT_ANHANG = true;

const EMPFAENGER        = 'info@uhlenkoeper-camp.de';
const TITEL_ZEILE_1     = 'Uhlenköper-Camp Uelzen';
const TITEL_ZEILE_2     = 'Wertstoffinsel Abfallprotokolle';
const KOPF_ZEILE        = 3;
const ERSTE_DATEN_ZEILE = 4;

// ============================================================
// WEB-APP-ENDPUNKTE
// ============================================================

function doGet() {
  return ContentService.createTextOutput(
    'Abfallprotokoll-Endpunkt ist aktiv. Zählungen werden per POST entgegengenommen.'
  );
}

function doPost(e) {
  try {
    const daten = JSON.parse(e.postData.contents);
    const blatt = jahresBlatt(daten.year, daten.headers);

    // Beim erneuten Senden derselben Zählung (z.B. nachdem die Mail
    // fehlgeschlagen ist) darf keine zweite Zeile entstehen.
    const neu = zeileAnhaengen(blatt, daten);
    if (neu) {
      summeAktualisieren(blatt, daten.headers.length);
      SpreadsheetApp.flush();
    }

    if (MAIL_MIT_ANHANG) mailVerschicken(daten);
    return alsJson({ ok: true, neu: neu });
  } catch (fehler) {
    return alsJson({ ok: false, error: String(fehler) });
  }
}

function alsJson(objekt) {
  return ContentService
    .createTextOutput(JSON.stringify(objekt))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// TABELLENBLATT
// ============================================================

/** Blatt des Jahres holen; existiert es noch nicht, wird es angelegt. */
function jahresBlatt(jahr, ueberschriften) {
  const tabelle = SpreadsheetApp.getActiveSpreadsheet();
  const name    = String(jahr);
  const vorhanden = tabelle.getSheetByName(name);
  if (vorhanden) return vorhanden;

  const blatt      = tabelle.insertSheet(name, 0);
  const spaltenZahl = ueberschriften.length + 1; // + Datumsspalte

  blatt.getRange(1, 1).setValue(TITEL_ZEILE_1);
  blatt.getRange(2, 1).setValue(TITEL_ZEILE_2);
  blatt.getRange(1, 1, 1, spaltenZahl - 1).merge();
  blatt.getRange(2, 1, 1, spaltenZahl - 1).merge();
  blatt.getRange(1, 1, 2, 1).setFontWeight('bold');

  blatt.getRange(KOPF_ZEILE, 1).setValue('Datum:');
  blatt.getRange(KOPF_ZEILE, 2, 1, ueberschriften.length).setValues([ueberschriften]);
  blatt.getRange(KOPF_ZEILE, 1, 1, spaltenZahl)
       .setFontWeight('bold')
       .setWrap(true)
       .setVerticalAlignment('bottom');

  blatt.setFrozenRows(KOPF_ZEILE);
  blatt.setColumnWidth(1, 110);
  for (let spalte = 2; spalte <= spaltenZahl; spalte++) {
    blatt.setColumnWidth(spalte, 120);
  }
  return blatt;
}

/** Letzte Zeile, die in Spalte A ein Datum trägt. */
function letzteDatenZeile(blatt) {
  for (let zeile = blatt.getLastRow(); zeile >= ERSTE_DATEN_ZEILE; zeile--) {
    if (blatt.getRange(zeile, 1).getValue() instanceof Date) return zeile;
  }
  return ERSTE_DATEN_ZEILE - 1;
}

/** Trägt die Zählung ein. Gibt false zurück, wenn sie schon drinsteht. */
function zeileAnhaengen(blatt, daten) {
  summeEntfernen(blatt);

  // Nullwerte bleiben leer, damit die Tabelle so ruhig aussieht wie bisher.
  const werte = [zuDatum(daten.date)].concat(daten.values.map(wert => wert ? wert : ''));
  if (bereitsVorhanden(blatt, werte)) return false;

  const zeile = letzteDatenZeile(blatt) + 1;
  blatt.getRange(zeile, 1, 1, werte.length).setValues([werte]);
  blatt.getRange(zeile, 1).setNumberFormat('dd.MM.yyyy');
  return true;
}

/** Steht diese Zählung (gleiches Datum, gleiche Werte) schon in der Tabelle? */
function bereitsVorhanden(blatt, werte) {
  const letzte = letzteDatenZeile(blatt);
  if (letzte < ERSTE_DATEN_ZEILE) return false;

  const datum = werte[0].getTime();

  for (let zeile = letzte; zeile >= ERSTE_DATEN_ZEILE; zeile--) {
    const vorhanden = blatt.getRange(zeile, 1, 1, werte.length).getValues()[0];
    if (!(vorhanden[0] instanceof Date)) continue;
    if (vorhanden[0].getTime() !== datum) break;   // Zeilen sind nach Datum sortiert

    const gleich = werte.every((wert, i) =>
      i === 0 || String(vorhanden[i] === '' ? '' : vorhanden[i]) === String(wert));
    if (gleich) return true;
  }
  return false;
}

/** Alte Summenzeile samt allem darunter wegräumen – sie wird neu gesetzt. */
function summeEntfernen(blatt) {
  const letzte = blatt.getLastRow();
  for (let zeile = ERSTE_DATEN_ZEILE; zeile <= letzte; zeile++) {
    if (String(blatt.getRange(zeile, 1).getValue()).trim() === 'Summe') {
      blatt.deleteRows(zeile, letzte - zeile + 1);
      return;
    }
  }
}

function summeAktualisieren(blatt, spaltenZahl) {
  const letzte = letzteDatenZeile(blatt);
  const zeile  = letzte + 2; // eine Leerzeile Abstand, wie in der Vorlage

  blatt.getRange(zeile, 1).setValue('Summe').setFontWeight('bold');

  for (let spalte = 2; spalte <= spaltenZahl + 1; spalte++) {
    const buchstabe = spaltenBuchstabe(spalte);
    blatt.getRange(zeile, spalte)
         .setFormula(`=SUM(${buchstabe}${ERSTE_DATEN_ZEILE}:${buchstabe}${letzte})`)
         .setFontWeight('bold');
  }
}

function spaltenBuchstabe(nummer) {
  let name = '';
  while (nummer > 0) {
    const rest = (nummer - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    nummer = Math.floor((nummer - 1) / 26);
  }
  return name;
}

/** "2026-08-03" ohne Zeitzonenverschiebung in ein Datum wandeln. */
function zuDatum(iso) {
  const [jahr, monat, tag] = iso.split('-').map(Number);
  return new Date(jahr, monat - 1, tag);
}

// ============================================================
// MAIL
// ============================================================

function mailVerschicken(daten) {
  const tabelle = SpreadsheetApp.getActiveSpreadsheet();
  const url     = 'https://docs.google.com/spreadsheets/d/' + tabelle.getId() + '/export?format=xlsx';

  const anhang = UrlFetchApp
    .fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } })
    .getBlob()
    .setName(daten.date + ' Abfallprotokoll ' + daten.year + '.xlsx');

  MailApp.sendEmail({
    to:          EMPFAENGER,
    subject:     daten.subject,
    body:        daten.message,
    attachments: [anhang],
  });
}

// ============================================================
// TEST (im Editor ausführbar, ohne Web-App)
// ============================================================

function testZaehlung() {
  const heute = new Date();
  const iso   = Utilities.formatDate(heute, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  doPost({ postData: { contents: JSON.stringify({
    date:    iso,
    year:    heute.getFullYear(),
    headers: [
      'Restmüll in Liter (AWB)',
      'Restmüll in Litern (Kewitz)',
      'Papier blaue Tonne 240l',
      'Kartons in Liter (umrechnen)',
      'Gelbe Säcke in Liter',
      'Bioabfall in Liter',
      'Glas in Kisten',
    ],
    values:  [240, 660, 240, 250, 1340, 120, 3],
    subject: 'Müll Inventur – Test',
    message: 'Testeintrag aus dem Apps-Script-Editor.',
  }) } });
}
