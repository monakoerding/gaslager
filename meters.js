// Zählerstände are independent of the existing gas and waste inventory state.
(() => {
  const $ = id => document.getElementById(id);
  const types = { strom: ['Strom', 'kWh'], wasser: ['Wasser', 'm³'], gas: ['Gas', 'm³'] };
  const statusNames = { draft: 'Entwurf', pending: 'Übermittlung noch nicht bestätigt', stored: 'Gespeichert · Versand ausstehend', sending: 'Versand läuft', uncertain: 'Gespeichert · Versandstatus unklar', sent: 'Gespeichert · E-Mail übergeben' };
  const form = $('meters-form');
  const fields = $('meters-fields');
  let db, active = null, entries = [], preparedPhoto = null, previewUrl, photoVersion = 0;
  let busy = false, verified = false, detailId = null;
  const imageUrls = new Map();

  function message(id, text, error = false) {
    $(id).textContent = text;
    $(id).dataset.error = String(error);
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function today() { return isoDate(new Date()); }
  function setDate() { $('meters-date').value = today(); $('meters-date').max = today(); }
  setDate();

  function request(action, mode = 'readonly') {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collections', mode);
      const result = action(tx.objectStore('collections'));
      tx.oncomplete = () => resolve(result.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  async function persist(entry) {
    await request(store => store.put(entry), 'readwrite');
    entries = [entry, ...entries.filter(item => item.id !== entry.id)].sort((a, b) => b.createdAt - a.createdAt);
  }
  const ready = (async () => {
    try {
      db = await new Promise((resolve, reject) => {
        const open = indexedDB.open('gaslager-meter-readings', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('collections', { keyPath: 'id' });
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
        open.onblocked = () => message('meters-form-status', 'Bitte andere Tabs der App schließen und die Seite neu laden.', true);
      });
      db.onversionchange = () => {
        db.close();
        fields.disabled = true;
        $('meters-to-summary').disabled = true;
        message('meters-form-status', 'Bitte die App neu laden, um den lokalen Speicher zu aktualisieren.', true);
      };
      entries = await request(store => store.getAll());
      entries.sort((a, b) => b.createdAt - a.createdAt);
      active = entries.find(entry => entry.status !== 'sent') || null;
      fields.disabled = false;
      updateButtons();
      message('meters-form-status', 'Entwürfe werden in diesem Browser gespeichert. Nach „Fertig, senden“ liegen Werte und Fotos zusätzlich zentral beim Camp.');
      return true;
    } catch {
      message('meters-form-status', 'Der lokale Speicher ist nicht verfügbar. Bitte Browserspeicher zulassen und die App neu laden.', true);
      return false;
    }
  })();

  function updateButtons() {
    $('meters-to-summary').disabled = busy || !active?.records.length;
    $('meters-to-summary').textContent = `Zur Übersicht${active ? ` (${active.records.length})` : ''}`;
    $('meters-send').disabled = busy || !active?.records.length;
    $('meters-send').textContent = busy ? 'Wird verarbeitet …' : active?.status === 'uncertain' || active?.status === 'sending' ? 'Versandstatus prüfen' : active && active.status !== 'draft' ? 'Erneut senden' : 'Fertig, senden';
    $('meters-add-another').hidden = Boolean(active && active.status !== 'draft');
    $('meters-add-another').disabled = busy;
  }
  async function openCapture() {
    showScreen('screen-meters');
    if (!(await ready)) return;
    if (active && active.status !== 'draft') return openSummary();
    fields.disabled = busy;
    updateButtons();
  }
  function resetPhoto() {
    preparedPhoto = null;
    photoVersion++;
    $('meters-photo').setCustomValidity('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    $('meters-preview').removeAttribute('src');
    $('meters-preview').hidden = true;
  }
  async function compressPhoto(file) {
    if (!file.type.startsWith('image/')) throw new Error('Bitte eine Bilddatei auswählen.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Bitte ein Foto mit höchstens 15 MB auswählen.');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Das Foto kann nicht gelesen werden. Bitte JPEG, PNG oder WebP verwenden.'));
        image.src = url;
      });
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Dieser Browser kann das Foto nicht verarbeiten.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Das Foto konnte nicht vorbereitet werden.')), 'image/jpeg', .88));
    } finally { URL.revokeObjectURL(url); }
  }
  $('meters-photo').addEventListener('change', async () => {
    resetPhoto();
    const file = $('meters-photo').files[0];
    if (!file) return;
    const version = photoVersion;
    $('meters-photo').setCustomValidity('Bitte warten, bis das Foto vorbereitet ist.');
    message('meters-form-status', 'Foto wird vorbereitet …');
    try {
      const blob = await compressPhoto(file);
      if (version !== photoVersion) return;
      preparedPhoto = blob;
      $('meters-photo').setCustomValidity('');
      previewUrl = URL.createObjectURL(blob);
      $('meters-preview').src = previewUrl;
      $('meters-preview').hidden = false;
      message('meters-form-status', 'Foto bereit. Bitte den Zählerstand prüfen und hinzufügen.');
    } catch (error) {
      if (version !== photoVersion) return;
      $('meters-photo').setCustomValidity(error.message);
      message('meters-form-status', error.message, true);
    }
  });
  $('meters-type').addEventListener('change', () => { $('meters-unit').textContent = `(${types[$('meters-type').value][1]})`; });
  for (const id of ['meters-name', 'meters-value']) $(id).addEventListener('input', () => $(id).setCustomValidity(''));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !(await ready) || (active && active.status !== 'draft')) return;
    const text = $('meters-value').value.trim();
    const value = Number(text.replace(',', '.'));
    $('meters-name').setCustomValidity($('meters-name').value.trim() ? '' : 'Bitte eine Zählernummer oder einen Standort eingeben.');
    $('meters-value').setCustomValidity(/^\d+([.,]\d{1,6})?$/.test(text) && value <= Number.MAX_SAFE_INTEGER ? '' : 'Bitte 0 oder einen positiven Zählerstand mit höchstens 6 Nachkommastellen eingeben.');
    $('meters-date').max = today();
    if (!form.reportValidity()) return;
    if (!preparedPhoto) { message('meters-form-status', 'Bitte ein lesbares Foto auswählen.', true); return; }
    if ((active?.records.length || 0) >= 50) { message('meters-form-status', 'Bitte diese Erfassung mit maximal 50 Ablesungen zuerst abschließen.', true); return; }
    const record = { id: crypto.randomUUID(), type: $('meters-type').value, meter: $('meters-name').value.trim(), date: $('meters-date').value, value, note: $('meters-note').value.trim(), photo: preparedPhoto };
    const entry = active || { id: crypto.randomUUID(), receiptToken: crypto.randomUUID() + crypto.randomUUID(), createdAt: Date.now(), status: 'draft', records: [] };
    if (entry.records.reduce((sum, r) => sum + r.photo.size, record.photo.size) > 8 * 1024 * 1024) { message('meters-form-status', 'Eine Erfassung kann insgesamt höchstens 8 MB verkleinerte Fotos enthalten. Bitte ein kleineres Foto verwenden oder die vorhandenen Ablesungen zuerst abschließen.', true); return; }
    busy = true;
    fields.disabled = true;
    updateButtons();
    try {
      const updated = { ...entry, records: [...entry.records, record] };
      await persist(updated);
      active = updated;
      $('meters-value').value = '';
      $('meters-note').value = '';
      $('meters-photo').value = '';
      resetPhoto();
      message('meters-form-status', `${active.records.length} Ablesung(en) lokal gespeichert. Weitere Zähler erfassen oder zur Übersicht wechseln.`);
      $('meters-name').focus();
    } catch {
      message('meters-form-status', 'Speichern fehlgeschlagen. Bitte den Browserspeicher prüfen. Deine Eingaben bleiben erhalten.', true);
    } finally { busy = false; fields.disabled = false; updateButtons(); }
  });

  function renderRecords(containerId, entry, editable = false) {
    (imageUrls.get(containerId) || []).forEach(url => URL.revokeObjectURL(url));
    const urls = [];
    imageUrls.set(containerId, urls);
    $(containerId).replaceChildren();
    for (const record of entry.records) {
      const card = node('article', 'meters-record');
      card.append(node('h3', '', record.meter));
      card.append(node('p', '', `${types[record.type][0]} · ${new Date(record.date + 'T12:00:00').toLocaleDateString('de-DE')}`));
      card.append(node('p', 'meters-reading', `${record.value.toLocaleString('de-DE', { maximumFractionDigits: 6 })} ${types[record.type][1]}`));
      if (record.note) card.append(node('p', '', record.note));
      const image = node('img', 'meters-photo');
      image.alt = `Zählerfoto für ${record.meter}`;
      image.loading = 'lazy';
      image.src = URL.createObjectURL(record.photo);
      urls.push(image.src);
      const actions = node('div', 'meters-actions');
      const download = node('a', 'meters-text-button', 'Foto herunterladen');
      download.href = image.src;
      download.download = `zaehler-${record.date}-${record.id}.jpg`;
      actions.append(download);
      if (editable) {
        const remove = node('button', 'meters-text-button meters-delete', 'Entfernen');
        remove.type = 'button';
        remove.disabled = busy;
        remove.setAttribute('aria-label', `Ablesung für ${record.meter} entfernen`);
        remove.addEventListener('click', async () => {
          if (busy || active.status !== 'draft' || !confirm(`Ablesung für „${record.meter}“ mit Foto entfernen?`)) return;
          busy = true;
          updateButtons();
          try {
            const updated = { ...active, records: active.records.filter(r => r.id !== record.id) };
            await persist(updated);
            active = updated;
          } catch { message('meters-send-status', 'Die Ablesung konnte nicht entfernt werden.', true); }
          finally { busy = false; renderRecords(containerId, active, true); updateButtons(); }
        });
        actions.append(remove);
      }
      card.append(image, actions);
      $(containerId).append(card);
    }
    if (!entry.records.length) $(containerId).append(node('p', 'meters-hint', 'Noch keine Ablesungen. Füge zuerst einen Zählerstand mit Foto hinzu.'));
  }
  function openSummary() {
    if (!active) return openCapture();
    renderRecords('meters-summary-list', active, active.status === 'draft');
    updateButtons();
    message('meters-send-status', statusNames[active.status]);
    showScreen('screen-meter-summary');
  }
  function unsaved() { return $('meters-value').value.trim() || $('meters-note').value.trim() || $('meters-photo').files.length; }
  $('meters-to-summary').addEventListener('click', () => {
    if (unsaved()) { message('meters-form-status', 'Bitte die angefangene Ablesung zuerst hinzufügen oder die Eingaben leeren.', true); return; }
    openSummary();
  });
  async function post(payload) {
    const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(110000) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Die Erfassung konnte nicht übermittelt werden.');
    return result;
  }
  async function verifyEndpoint() {
    if (verified) return;
    if (!GOOGLE_SCRIPT_URL) throw new Error('Der Zählerstand-Versand ist noch nicht eingerichtet.');
    const url = new URL(GOOGLE_SCRIPT_URL);
    url.searchParams.set('feature', 'meters');
    try {
      const response = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (!response.ok || data.feature !== 'meter-readings' || data.version !== 1) throw new Error();
      verified = true;
    } catch { throw new Error('Der Zählerstand-Versand ist noch nicht freigeschaltet oder nicht erreichbar. Deine Erfassung bleibt lokal gespeichert.'); }
  }
  async function base64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    return btoa(binary);
  }
  $('meters-send').addEventListener('click', async () => {
    if (busy || !active?.records.length) return;
    busy = true;
    updateButtons();
    renderRecords('meters-summary-list', active, active.status === 'draft');
    try {
      await verifyEndpoint();
      if (active.status === 'draft') { const pending = { ...active, status: 'pending' }; await persist(pending); active = pending; }
      renderRecords('meters-summary-list', active);
      message('meters-send-status', 'Werte und Fotos werden gespeichert. Anschließend wird die gemeinsame E-Mail versendet …');
      const statusOnly = active.status === 'uncertain' || active.status === 'sending';
      const payload = { kind: statusOnly ? 'meter-status' : 'meter-readings', id: active.id, receiptToken: active.receiptToken };
      if (!statusOnly) payload.readings = await Promise.all(active.records.map(async r => ({ id: r.id, type: r.type, meter: r.meter, date: r.date, value: r.value, note: r.note, photo: await base64(r.photo) })));
      const result = await post(payload);
      if (result.id !== active.id || result.stored !== true || !['stored', 'sending', 'uncertain', 'sent'].includes(result.status)) throw new Error('Die zentrale Speicherung konnte noch nicht bestätigt werden. Bitte später erneut versuchen.');
      const updated = { ...active, status: result.status, storageConfirmed: true, sentAt: result.sentAt || null };
      await persist(updated);
      active = updated;
      if (result.status === 'sent') {
        active = null;
        form.reset();
        setDate();
        resetPhoto();
        $('meters-unit').textContent = '(kWh)';
        showToast('Gespeichert und übergeben.');
        showScreen('screen-home');
      } else message('meters-send-status', result.message || statusNames[result.status], true);
    } catch (error) { message('meters-send-status', `${error.message} Deine lokalen Ablesungen bleiben erhalten.`, true); }
    finally { busy = false; updateButtons(); if (active) renderRecords('meters-summary-list', active, active.status === 'draft'); }
  });

  $('btn-start-meters').addEventListener('click', openCapture);
  $('meters-back').addEventListener('click', () => { if (!busy) showScreen('screen-home'); });
  $('meters-summary-back').addEventListener('click', () => { if (!busy) active?.status === 'draft' ? openCapture() : showScreen('screen-home'); });
  $('meters-add-another').addEventListener('click', openCapture);
  $('meters-history-back').addEventListener('click', () => showScreen('screen-home'));
  $('meters-detail-back').addEventListener('click', () => showScreen('screen-meter-history'));
  $('meters-resume').addEventListener('click', () => { active = entries.find(entry => entry.id === detailId); openSummary(); });
  $('btn-history-meters').addEventListener('click', async () => {
    showScreen('screen-meter-history');
    const container = $('meters-history-list');
    container.replaceChildren();
    if (!(await ready)) { container.append(node('p', 'history-empty', 'Der lokale Verlauf ist nicht verfügbar.')); return; }
    const history = entries.filter(entry => entry.records.length);
    if (!history.length) container.append(node('p', 'history-empty', 'Noch keine Ablesungen vorhanden.'));
    for (const entry of history) {
      const button = node('button', 'history-card meters-history-card');
      button.type = 'button';
      const label = node('span', 'history-card-date', new Date(entry.createdAt).toLocaleString('de-DE'));
      label.append(node('small', '', `${entry.records.length} Ablesung(en) · ${statusNames[entry.status]}`));
      button.append(label, node('span', 'history-card-arrow', '›'));
      button.addEventListener('click', () => {
        detailId = entry.id;
        $('meters-detail-title').textContent = new Date(entry.createdAt).toLocaleDateString('de-DE');
        message('meters-detail-status', `${statusNames[entry.status]}${entry.status === 'sent' ? ' an info@uhlenkoeper-camp.de' : ''}`);
        renderRecords('meters-detail-list', entry);
        $('meters-resume').hidden = entry.status === 'sent';
        showScreen('screen-meter-detail');
      });
      container.append(button);
    }
  });
})();
