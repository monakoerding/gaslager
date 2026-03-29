// ============================================================
// KONFIGURATION
// ============================================================

const EMAILJS_PUBLIC_KEY  = 'mpco4Q9eqZW5qPdz_';
const EMAILJS_SERVICE_ID  = 'service_5yw7qxm';
const EMAILJS_TEMPLATE_ID = 'template_pqksn3n';
const EMAIL_TO            = 'info@uhlenkoeper-camp.de';

emailjs.init(EMAILJS_PUBLIC_KEY);

// ============================================================
// DATA
// ============================================================

const COLORS = {
  rot:    { main: '#dc2626', shadow: '#991b1b', cap: '#7f1d1d', hi: 'rgba(255,210,210,0.28)' },
  grau:   { main: '#9ca3af', shadow: '#6b7280', cap: '#374151', hi: 'rgba(255,255,255,0.22)' },
  alu:    { main: '#cbd5e1', shadow: '#94a3b8', cap: '#475569', hi: 'rgba(255,255,255,0.38)' },
  schwarz:{ main: '#374151', shadow: '#1f2937', cap: '#030712', hi: 'rgba(255,255,255,0.07)' },
};

const SIZES = {
  '33kg':  { h: 152, rx: 28 },
  '11kg':  { h: 108, rx: 24 },
  '8.2kg': { h: 92,  rx: 22 },
  '5kg':   { h: 76,  rx: 19 },
};

const ITEMS = [
  { id: 'voll_33_rot',     section: 'Voll', label: '33 kg Rot',     color: 'rot',    size: '33kg'  },
  { id: 'voll_33_grau',    section: 'Voll', label: '33 kg Grau',    color: 'grau',   size: '33kg'  },
  { id: 'voll_11_alu',     section: 'Voll', label: '11 kg Alu',     color: 'alu',    size: '11kg'  },
  { id: 'voll_11_grau',    section: 'Voll', label: '11 kg Grau',    color: 'grau',   size: '11kg'  },
  { id: 'voll_82_schwarz', section: 'Voll', label: '8,2 kg Schwarz',color: 'schwarz',size: '8.2kg' },
  { id: 'voll_5_grau',     section: 'Voll', label: '5 kg Grau',     color: 'grau',   size: '5kg'   },
  { id: 'leer_33_rot',     section: 'Leer', label: '33 kg Rot',     color: 'rot',    size: '33kg'  },
  { id: 'leer_33_grau',    section: 'Leer', label: '33 kg Grau',    color: 'grau',   size: '33kg'  },
  { id: 'leer_11_alu',     section: 'Leer', label: '11 kg Alu',     color: 'alu',    size: '11kg'  },
  { id: 'leer_11_grau',    section: 'Leer', label: '11 kg Grau',    color: 'grau',   size: '11kg'  },
  { id: 'leer_82_schwarz', section: 'Leer', label: '8,2 kg Schwarz',color: 'schwarz',size: '8.2kg' },
  { id: 'leer_5_grau',     section: 'Leer', label: '5 kg Grau',     color: 'grau',   size: '5kg'   },
];

const STORAGE_KEY = 'gaslager_history';

// ============================================================
// STATE
// ============================================================

let currentStep    = 0;
let counts         = {};
let historyEntries = [];

// ============================================================
// SVG CYLINDER GENERATOR
// ============================================================

function cylinderSVG(colorKey, sizeKey) {
  const c  = COLORS[colorKey];
  const { h, rx } = SIZES[sizeKey];
  const ry     = Math.round(rx * 0.38);
  const cx     = 50;
  const topY   = 40;
  const totalH = topY + h + ry + 18;
  const maxPx  = Math.min(totalH * 1.15, 195);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${totalH}" style="height:${maxPx}px;width:auto">
    <rect x="${cx - 15}" y="4" width="30" height="7" rx="3.5" fill="#6b7280"/>
    <rect x="${cx - 6}" y="8" width="12" height="24" rx="3" fill="#4b5563"/>
    <ellipse cx="${cx}" cy="${topY}" rx="${rx}" ry="${ry}" fill="${c.cap}"/>
    <rect x="${cx - rx}" y="${topY}" width="13" height="${h}" fill="${c.shadow}"/>
    <rect x="${cx - rx + 13}" y="${topY}" width="${rx * 2 - 13}" height="${h}" fill="${c.main}"/>
    <rect x="${cx - rx + 3}" y="${topY + 10}" width="7" height="${h - 20}" rx="3.5" fill="${c.hi}"/>
    <ellipse cx="${cx}" cy="${topY + h}" rx="${rx}" ry="${ry}" fill="${c.shadow}"/>
    <rect x="${cx - rx - 3}" y="${topY + h - ry}" width="${rx * 2 + 6}" height="${ry + 13}" rx="3" fill="${c.cap}"/>
    <ellipse cx="${cx}" cy="${topY + h + 13}" rx="${rx + 3}" ry="${Math.round(ry * 0.65)}" fill="${c.cap}"/>
  </svg>`;
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

document.getElementById('btn-start').addEventListener('click', () => {
  counts = {};
  ITEMS.forEach(item => { counts[item.id] = 0; });
  currentStep = 0;
  renderCountScreen();
  showScreen('screen-count');
});

document.getElementById('btn-history').addEventListener('click', () => {
  loadHistory();
  renderHistoryList();
  showScreen('screen-history');
});

// ============================================================
// COUNT
// ============================================================

function renderCountScreen() {
  const item  = ITEMS[currentStep];
  const total = ITEMS.length;

  document.getElementById('progress-fill').style.width  = `${((currentStep + 1) / total) * 100}%`;
  document.getElementById('progress-label').textContent = `${currentStep + 1} / ${total}`;

  const badge = document.getElementById('section-badge');
  badge.textContent = item.section.toUpperCase();
  badge.className   = 'section-badge ' + item.section.toLowerCase();

  document.getElementById('item-title').textContent  = item.label;
  document.getElementById('cylinder-wrap').innerHTML = cylinderSVG(item.color, item.size);
  document.getElementById('counter-val').textContent = counts[item.id];
}

document.getElementById('count-back').addEventListener('click', () => {
  if (currentStep === 0) {
    showScreen('screen-home');
  } else {
    currentStep--;
    renderCountScreen();
  }
});

document.getElementById('btn-minus').addEventListener('click', () => {
  const item = ITEMS[currentStep];
  if (counts[item.id] > 0) {
    counts[item.id]--;
    document.getElementById('counter-val').textContent = counts[item.id];
  }
});

document.getElementById('btn-plus').addEventListener('click', () => {
  const item = ITEMS[currentStep];
  counts[item.id]++;
  document.getElementById('counter-val').textContent = counts[item.id];
});

document.getElementById('btn-next').addEventListener('click', () => {
  if (currentStep < ITEMS.length - 1) {
    currentStep++;
    renderCountScreen();
  } else {
    renderSummaryInto(document.getElementById('summary-body'), counts);
    showScreen('screen-summary');
  }
});

// ============================================================
// SUMMARY
// ============================================================

function renderSummaryInto(container, countsData) {
  container.innerHTML = '';
  ['Voll', 'Leer'].forEach(sec => {
    const title = document.createElement('div');
    title.className   = 'summary-section-title';
    title.textContent = sec === 'Voll' ? 'VOLL' : 'LEER';
    container.appendChild(title);

    ITEMS.filter(i => i.section === sec).forEach(item => {
      const row     = document.createElement('div');
      row.className = 'summary-row';
      row.innerHTML = `<span class="summary-row-label">${item.label}</span>
                       <span class="summary-row-count">${countsData[item.id] ?? 0}</span>`;
      container.appendChild(row);
    });
  });
}

document.getElementById('summary-back').addEventListener('click', () => {
  currentStep = ITEMS.length - 1;
  renderCountScreen();
  showScreen('screen-count');
});

document.getElementById('btn-send').addEventListener('click', async () => {
  const btn = document.getElementById('btn-send');
  btn.disabled    = true;
  btn.textContent = 'Wird gesendet…';

  try {
    const dateStr = new Date().toLocaleDateString('de-DE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    // In localStorage speichern
    saveToHistory({ date: dateStr, timestamp: Date.now(), counts: { ...counts } });

    // E-Mail senden
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: EMAIL_TO,
      date:     dateStr,
      message:  buildEmailText(dateStr, counts),
    });

    showToast('Erfolgreich gesendet.');
    showScreen('screen-home');
  } catch (err) {
    console.error(err);
    showToast('Fehler. Bitte erneut versuchen.');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Fertig, senden';
  }
});

function buildEmailText(dateStr, countsData) {
  let msg = `Gaslager Inventur – ${dateStr}\n\n`;
  ['Voll', 'Leer'].forEach(sec => {
    msg += `${sec.toUpperCase()}:\n`;
    ITEMS.filter(i => i.section === sec).forEach(item => {
      msg += `  ${item.label}: ${countsData[item.id] ?? 0}\n`;
    });
    msg += '\n';
  });
  return msg;
}

// ============================================================
// HISTORY (localStorage)
// ============================================================

function saveToHistory(entry) {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  existing.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

function loadHistory() {
  historyEntries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
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
      document.getElementById('detail-title').textContent = entry.date;
      renderSummaryInto(document.getElementById('detail-body'), entry.counts);
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
