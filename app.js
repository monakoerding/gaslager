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


const ITEMS = [
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

  const body = document.getElementById('screen-count');
  body.className = 'screen active count-bg-' + item.section.toLowerCase();

  document.getElementById('item-title').textContent  = item.label;
  document.getElementById('cylinder-wrap').innerHTML = `<img src="${item.photo}" alt="${item.label}" style="height:195px;width:auto;object-fit:contain">`;
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

document.getElementById('btn-list').addEventListener('click', () => {
  renderSummaryInto(document.getElementById('summary-body'), counts, true);
  showScreen('screen-summary');
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
    renderSummaryInto(document.getElementById('summary-body'), counts, true);
    showScreen('screen-summary');
  }
});

// ============================================================
// SUMMARY
// ============================================================

function renderSummaryInto(container, countsData, clickable = false) {
  container.innerHTML = '';
  ['Voll', 'Leer'].forEach(sec => {
    const title = document.createElement('div');
    title.className   = 'summary-section-title ' + sec.toLowerCase();
    title.textContent = sec === 'Voll' ? 'VOLL' : 'LEER';
    container.appendChild(title);

    ITEMS.filter(i => i.section === sec).forEach(item => {
      const row     = document.createElement('div');
      row.className = 'summary-row ' + sec.toLowerCase();
      row.innerHTML = `<span class="summary-row-label">${item.label}</span>
                       <span class="summary-row-count">${countsData[item.id] ?? 0}</span>`;
      if (clickable) {
        row.addEventListener('click', () => {
          currentStep = ITEMS.indexOf(item);
          renderCountScreen();
          showScreen('screen-count');
        });
      }
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
