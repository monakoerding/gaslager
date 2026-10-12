// ============================================================
// KONFIGURATION
// ============================================================

const EMAILJS_PUBLIC_KEY  = 'mpco4Q9eqZW5qPdz_';
const EMAILJS_SERVICE_ID  = 'service_5yw7qxm';
const EMAILJS_TEMPLATE_ID = 'template_pqksn3n';
const EMAIL_TO            = 'info@uhlenkoeper-camp.de';

// Google-Apps-Script-Web-App für das Abfallprotokoll.
// Siehe apps-script/EINRICHTUNG.md – hier die /exec-URL eintragen.
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzf_Rx3jvDZrlV1eMc0jeOPq3KRFEWmwPjF4U2GHs7TlbKX6s9aAmjqlukHsZNZ5_QJ-Q/exec';

emailjs.init(EMAILJS_PUBLIC_KEY);

// ============================================================
// DATA
// ============================================================

const GAS_ITEMS = [
  { id: 'voll_33_rot',     section: 'Voll', label: '33 kg Rot',     photo: 'Gasflaschenbilder/rot 33kg.webp'       },
  { id: 'voll_33_grau',    section: 'Voll', label: '33 kg Grau',    photo: 'Gasflaschenbilder/grau 33kg.jpg'       },
  { id: 'voll_11_alu',     section: 'Voll', label: '11 kg Alu',     photo: 'Gasflaschenbilder/Alu 11kg.webp'       },
  { id: 'voll_11_grau',    section: 'Voll', label: '11 kg Grau',    photo: 'Gasflaschenbilder/grau 11kg.webp'      },
  { id: 'voll_82_schwarz', section: 'Voll', label: '8,2 kg Schwarz',photo: 'Gasflaschenbilder/schwarz 8,2kg.webp'  },
  { id: 'voll_5_grau',     section: 'Voll', label: '5 kg Grau',     photo: 'Gasflaschenbilder/grau 5kg.webp'       },
  { id: 'leer_33_rot',     section: 'Leer', label: '33 kg Rot',     photo: 'Gasflaschenbilder/rot 33kg.webp'       },
  { id: 'leer_33_grau',    section: 'Leer', label: '33 kg Grau',    photo: 'Gasflaschenbilder/grau 33kg.jpg'       },
  { id: 'leer_11_alu',     section: 'Leer', label: '11 kg Alu',     photo: 'Gasflaschenbilder/Alu 11kg.webp'       },
  { id: 'leer_11_grau',    section: 'Leer', label: '11 kg Grau',    photo: 'Gasflaschenbilder/grau 11kg.webp'      },
  { id: 'leer_82_schwarz', section: 'Leer', label: '8,2 kg Schwarz',photo: 'Gasflaschenbilder/schwarz 8,2kg.webp'  },
  { id: 'leer_5_grau',     section: 'Leer', label: '5 kg Grau',     photo: 'Gasflaschenbilder/grau 5kg.webp'       },
];

const LOGO_AWB    = 'Müll Bilder/AWB_logo.png';
const LOGO_KEWITZ = 'Müll Bilder/kewitz_logo.jpeg';

const MUELL_ITEMS = [
  { id: 'restmuell_awb_240',    label: 'Restmüll AWB 240 L',        photo: 'Müll Bilder/restmuell 240l.png',                          logo: LOGO_AWB    },
  { id: 'restmuell_kewitz_660', label: 'Restmüll Kewitz 660 L',     photo: 'Müll Bilder/restmüll_container660l.jpg',                  logo: LOGO_KEWITZ },
  { id: 'restmuell_kewitz_240', label: 'Restmüll Kewitz 240 L',     photo: 'Müll Bilder/restmuell 240l.png',                          logo: LOGO_KEWITZ },
  { id: 'papier_blau_240',      label: 'Papier blaue Tonne 240 L',  photo: 'Müll Bilder/blaue_tonne.png'                                                },
  { id: 'papier_karton',        label: 'Papier / Kartons in cbm',   photo: 'Müll Bilder/karton_cbm.webp', step: 0.25, unit: 'cbm'                     },
  { id: 'gelbe_tonne_1100',     label: 'Gelbe Tonne 1100 L',        photo: 'Müll Bilder/Gelbe Tonne Container 660l.webp'                              },
  { id: 'gelbe_tonne_240',      label: 'Gelbe Tonne 240 L',         photo: 'Müll Bilder/GelbeTonne-240l-freigestellt__scaled__300_386.jpg'            },
  { id: 'biomuell_120',         label: 'Biomüll 120 L',             photo: 'Müll Bilder/biotonne.jpg'                                                  },
  { id: 'glas_kisten',          label: 'Glas in Kisten',            photo: 'Müll Bilder/Glas.png'                                                      },
  { id: 'elektro_sonder',       label: 'Elektro- / Sonder-Müll',    photo: 'Müll Bilder/elektroschrott.webp'                                           },
  { id: 'fett',                 label: 'Fett in Liter',             photo: 'Müll Bilder/fett.png', step: 10, unit: 'L'                          },
];

// Spalten des Abfallprotokolls (Excel). Die App zählt Behälter,
// die Tabelle führt Liter – hier findet die Umrechnung statt.
// "Elektro- / Sonder-Müll" und "Fett" stehen bewusst nur im Mailtext.
const EXCEL_COLUMNS = [
  { header: 'Restmüll in Liter (AWB)',      value: n => n('restmuell_awb_240')    * 240                                 },
  { header: 'Restmüll in Litern (Kewitz)',  value: n => n('restmuell_kewitz_660') * 660 + n('restmuell_kewitz_240') * 240 },
  { header: 'Papier blaue Tonne 240l',      value: n => n('papier_blau_240')      * 240                                 },
  { header: 'Kartons in Liter (umrechnen)', value: n => n('papier_karton')        * 1000                                },
  { header: 'Gelbe Säcke in Liter',         value: n => n('gelbe_tonne_1100')     * 1100 + n('gelbe_tonne_240')    * 240 },
  { header: 'Bioabfall in Liter',           value: n => n('biomuell_120')         * 120                                 },
  { header: 'Glas in Kisten',               value: n => n('glas_kisten')                                                },
];

const MODES = {
  gas: {
    id:         'gas',
    title:      'Gaslager',
    badge:      null,               // Badge kommt aus item.section
    sections:   ['Voll', 'Leer'],
    items:      GAS_ITEMS,
    storageKey: 'gaslager_history',
    emailTitle: 'Gaslager Inventur',
    emailTo:    EMAIL_TO,
    emailJs:    true,
  },
  muell: {
    id:         'muell',
    title:      'Müll',
    badge:      'MÜLL',             // feste Beschriftung, keine Voll/Leer-Trennung
    sections:   null,
    items:      MUELL_ITEMS,
    storageKey: 'muell_history',
    emailTitle: 'Müll Inventur',
    emailTo:    EMAIL_TO,
    toSheet:    true,               // ins Google-Abfallprotokoll eintragen
    // Pausiert: Google verschickt die Mail bereits mit Excel-Anhang.
    // Auf true setzen, um die EmailJS-Textmail wieder mitzuschicken.
    emailJs:    false,
  },
};

// ============================================================
// STATE
// ============================================================

let currentMode    = MODES.gas;
let historyMode    = MODES.gas;   // Modus der gerade angezeigten Historie
let detailMode     = MODES.gas;   // Modus des geöffneten Historien-Eintrags
let currentStep    = 0;
let counts         = {};
let historyEntries = [];

// ============================================================
// HELPERS
// ============================================================

function imgSrc(path) {
  return encodeURI(path);
}

// Zählwert anzeigen: ganze Zahlen schlicht, Bruchschritte mit Komma und Einheit.
function formatCount(item, value) {
  const num = Number(value ?? 0);
  const str = Number.isInteger(num)
    ? String(num)
    : num.toFixed(2).replace(/0$/, '').replace('.', ',');
  return item.unit ? `${str} ${item.unit}` : str;
}

function isoDate(d) {
  const pad = v => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function sectionClass(mode, item) {
  return mode.sections ? item.section.toLowerCase() : 'muell';
}

// ============================================================
// SCREEN MANAGEMENT
// ============================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ============================================================
// HOME
// ============================================================

function startCounting(mode) {
  currentMode = mode;
  counts      = {};
  mode.items.forEach(item => { counts[item.id] = 0; });
  currentStep = 0;
  renderCountScreen();
  showScreen('screen-count');
}

function openHistory(mode) {
  historyMode = mode;
  document.getElementById('history-title').textContent = 'Letzte – ' + mode.title;
  loadHistory(mode);
  renderHistoryList();
  showScreen('screen-history');
}

document.getElementById('btn-start-gas')  .addEventListener('click', () => startCounting(MODES.gas));
document.getElementById('btn-start-muell').addEventListener('click', () => startCounting(MODES.muell));
document.getElementById('btn-history-gas')  .addEventListener('click', () => openHistory(MODES.gas));
document.getElementById('btn-history-muell').addEventListener('click', () => openHistory(MODES.muell));

// ============================================================
// COUNT
// ============================================================

function renderCountScreen() {
  const mode  = currentMode;
  const item  = mode.items[currentStep];
  const total = mode.items.length;

  document.getElementById('progress-fill').style.width  = `${((currentStep + 1) / total) * 100}%`;
  document.getElementById('progress-label').textContent = `${currentStep + 1} / ${total}`;

  const cls   = sectionClass(mode, item);
  const badge = document.getElementById('section-badge');
  badge.textContent = mode.badge || item.section.toUpperCase();
  badge.className   = 'section-badge ' + cls;

  document.getElementById('screen-count').className = 'screen active count-bg-' + cls;
  document.getElementById('item-title').textContent = item.label;

  let media = '';
  if (item.logo) {
    media += `<img class="company-logo" src="${imgSrc(item.logo)}" alt="">`;
  }
  if (item.photo) {
    media += `<img class="item-photo" src="${imgSrc(item.photo)}" alt="${item.label}">`;
  }
  document.getElementById('item-media').innerHTML = media;

  const val = document.getElementById('counter-val');
  val.textContent = formatCount(item, counts[item.id]);
  val.classList.toggle('with-unit', Boolean(item.unit));
}

function changeCount(delta) {
  const item = currentMode.items[currentStep];
  const step = item.step || 1;
  const next = Math.round(((counts[item.id] ?? 0) + delta * step) * 100) / 100;
  if (next < 0) return;
  counts[item.id] = next;
  document.getElementById('counter-val').textContent = formatCount(item, next);
}

document.getElementById('count-back').addEventListener('click', () => {
  if (currentStep === 0) {
    showScreen('screen-home');
  } else {
    currentStep--;
    renderCountScreen();
  }
});

function openSummary() {
  document.getElementById('summary-title').textContent = 'Übersicht – ' + currentMode.title;
  renderSummaryInto(document.getElementById('summary-body'), currentMode, counts, true);
  showScreen('screen-summary');
}

document.getElementById('btn-list').addEventListener('click', openSummary);

document.getElementById('btn-minus').addEventListener('click', () => changeCount(-1));
document.getElementById('btn-plus') .addEventListener('click', () => changeCount(+1));

document.getElementById('btn-next').addEventListener('click', () => {
  if (currentStep < currentMode.items.length - 1) {
    currentStep++;
    renderCountScreen();
  } else {
    openSummary();
  }
});

// ============================================================
// SUMMARY
// ============================================================

function renderSummaryInto(container, mode, countsData, clickable = false) {
  container.innerHTML = '';

  // Ohne Abschnitte (Müll) wird eine einzige, flache Liste gerendert.
  const sections = mode.sections || [null];

  sections.forEach(sec => {
    if (sec) {
      const title = document.createElement('div');
      title.className   = 'summary-section-title ' + sec.toLowerCase();
      title.textContent = sec.toUpperCase();
      container.appendChild(title);
    }

    mode.items.filter(i => !sec || i.section === sec).forEach(item => {
      const cls = sectionClass(mode, item);
      const row = document.createElement('div');
      row.className = 'summary-row ' + cls;
      row.innerHTML = `<span class="summary-row-main">
                         ${item.logo ? `<img class="summary-row-logo" src="${imgSrc(item.logo)}" alt="">` : ''}
                         <span class="summary-row-label">${item.label}</span>
                       </span>
                       <span class="summary-row-count">${formatCount(item, countsData[item.id])}</span>`;
      if (clickable) {
        row.addEventListener('click', () => {
          currentStep = mode.items.indexOf(item);
          renderCountScreen();
          showScreen('screen-count');
        });
      }
      container.appendChild(row);
    });
  });
}

document.getElementById('summary-back').addEventListener('click', () => {
  currentStep = currentMode.items.length - 1;
  renderCountScreen();
  showScreen('screen-count');
});

document.getElementById('btn-send').addEventListener('click', async () => {
  const btn  = document.getElementById('btn-send');
  const mode = currentMode;
  btn.disabled    = true;
  btn.textContent = 'Wird gesendet…';

  try {
    const now     = new Date();
    const dateStr = now.toLocaleDateString('de-DE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    // In localStorage speichern (pro Bereich getrennt)
    saveToHistory(mode, { date: dateStr, timestamp: now.getTime(), mode: mode.id, counts: { ...counts } });

    // Müll geht ins Google-Abfallprotokoll; von dort kommt auch die Mail mit
    // Excel-Anhang. Schlägt das Eintragen fehl, bricht der Versand ab und die
    // Zählung kann unverändert erneut gesendet werden.
    if (mode.toSheet) {
      await sendToSheet(mode, now, dateStr);
    }

    // Textmail über EmailJS – derzeit nur für Gas, siehe emailJs in MODES.
    if (mode.emailJs) {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: mode.emailTo,
        date:     dateStr,
        message:  buildEmailText(mode, dateStr, counts),
      });
    }

    showToast('Erfolgreich gesendet.');
    showScreen('screen-home');
  } catch (err) {
    console.error(err);
    showToast(err.message === 'NO_SCRIPT_URL'
      ? 'Google-Tabelle noch nicht eingerichtet.'
      : 'Fehler. Bitte erneut versuchen.');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Fertig, senden';
  }
});

// Trägt die Zählung ins Abfallprotokoll ein; das Apps Script hängt die
// Zeile an, aktualisiert die Summe und verschickt die Mail mit Excel-Anhang.
async function sendToSheet(mode, now, dateStr) {
  if (!GOOGLE_SCRIPT_URL) throw new Error('NO_SCRIPT_URL');

  const num     = id => Number(counts[id] ?? 0);
  const payload = {
    date:    isoDate(now),
    year:    now.getFullYear(),
    headers: EXCEL_COLUMNS.map(col => col.header),
    values:  EXCEL_COLUMNS.map(col => col.value(num)),
    subject: `${mode.emailTitle} – ${dateStr}`,
    message: buildEmailText(mode, dateStr, counts),
  };

  // text/plain vermeidet den CORS-Preflight, den Apps Script nicht beantwortet.
  const res = await fetch(GOOGLE_SCRIPT_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body:    JSON.stringify(payload),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Unbekannter Fehler');
}

function buildEmailText(mode, dateStr, countsData) {
  let msg = `${mode.emailTitle} – ${dateStr}\n\n`;

  (mode.sections || [null]).forEach(sec => {
    if (sec) msg += `${sec.toUpperCase()}:\n`;
    mode.items.filter(i => !sec || i.section === sec).forEach(item => {
      msg += `${sec ? '  ' : ''}${item.label}: ${formatCount(item, countsData[item.id])}\n`;
    });
    msg += '\n';
  });

  return msg;
}

// ============================================================
// HISTORY (localStorage, pro Bereich getrennt)
// ============================================================

function saveToHistory(mode, entry) {
  const existing = JSON.parse(localStorage.getItem(mode.storageKey) || '[]');
  existing.unshift(entry);
  localStorage.setItem(mode.storageKey, JSON.stringify(existing));
}

function loadHistory(mode) {
  historyEntries = JSON.parse(localStorage.getItem(mode.storageKey) || '[]');
}

function renderHistoryList() {
  const body = document.getElementById('history-body');
  body.innerHTML = '';

  if (historyEntries.length === 0) {
    body.innerHTML = '<p class="history-empty">Noch keine Inventuren vorhanden.</p>';
    return;
  }

  historyEntries.forEach(entry => {
    const card     = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `<span class="history-card-date">${entry.date}</span>
                      <span class="history-card-arrow">&#8250;</span>`;
    card.addEventListener('click', () => {
      detailMode = MODES[entry.mode] || historyMode;
      document.getElementById('detail-title').textContent = entry.date;
      renderSummaryInto(document.getElementById('detail-body'), detailMode, entry.counts);
      showScreen('screen-history-detail');
    });
    body.appendChild(card);
  });
}

document.getElementById('history-back').addEventListener('click', () => showScreen('screen-home'));
document.getElementById('detail-back').addEventListener('click', () => showScreen('screen-history'));

// ============================================================
// TOAST
// ============================================================

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
