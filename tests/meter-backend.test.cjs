const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function environment() {
  let nextId = 0;
  const objects = new Map();
  const properties = new Map();
  const mails = [];
  let quota = 10;
  let mailFailure = false;
  let lockHeld = false;
  const iterator = values => { let i = 0; return { hasNext: () => i < values.length, next: () => values[i++] }; };
  const blob = (value, type, name) => ({ bytes: Buffer.isBuffer(value) ? value : typeof value === 'string' ? Buffer.from(value) : Buffer.from(value.map(b => (b + 256) % 256)), type, name,
    getName() { return this.name; }, getDataAsString() { return this.bytes.toString('utf8'); } });
  class File {
    constructor(name, data) { this.name = name; this.data = data; this.id = String(++nextId); objects.set(this.id, this); }
    getId() { return this.id; }
    getBlob() { return this.data; }
    setContent(text) { this.data = blob(text, 'text/plain', this.name); return this; }
  }
  class Folder {
    constructor(name) { this.name = name; this.id = String(++nextId); this.folders = []; this.files = []; objects.set(this.id, this); }
    getId() { return this.id; }
    getUrl() { return 'https://drive.example/' + this.id; }
    createFolder(name) { const folder = new Folder(name); this.folders.push(folder); return folder; }
    getFoldersByName(name) { return iterator(this.folders.filter(f => f.name === name)); }
    getFilesByName(name) { return iterator(this.files.filter(f => f.name === name)); }
    createFile(value, text, type) { const b = typeof value === 'string' ? blob(text, type, value) : value; const file = new File(b.name, b); this.files.push(file); return file; }
  }
  const context = vm.createContext({
    console, MimeType: { PLAIN_TEXT: 'text/plain' },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (algorithm, value) => Array.from(crypto.createHash('sha256').update(value).digest()).map(b => b > 127 ? b - 256 : b),
      base64Decode: value => Array.from(Buffer.from(value, 'base64')).map(b => b > 127 ? b - 256 : b),
      base64Encode: value => Buffer.from(value.map(b => (b + 256) % 256)).toString('base64'),
      formatDate: date => date.toISOString().slice(0, 10), newBlob: blob
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
    DriveApp: { createFolder: name => new Folder(name), getFolderById: id => objects.get(id) },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (lockHeld) return false; lockHeld = true; return true; }, releaseLock: () => { lockHeld = false; } }) },
    MailApp: { getRemainingDailyQuota: () => quota, sendEmail: mail => {
      const root = objects.get(properties.get('ZAEHLER_DRIVE_FOLDER_ID'));
      assert.ok(root.folders[0].files.some(file => file.name.endsWith('.jpg')), 'photo stored before email');
      const manifest = root.folders[0].files.find(file => file.name === 'erfassung.json');
      assert.equal(JSON.parse(manifest.data.getDataAsString()).status, 'sending');
      mails.push(mail);
      if (mailFailure) throw new Error('SMTP result unknown');
    } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) }
  });
  for (const file of ['Code.gs', 'Zaehlerstaende.gs']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script', file), 'utf8'), context, { filename: file });
  const post = value => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(value) } }).text);
  return { context, post, mails, objects, properties, setQuota: value => { quota = value; }, failMail: () => { mailFailure = true; }, lock: () => { lockHeld = true; } };
}

function collection() {
  return { kind: 'meter-readings', id: crypto.randomUUID(), receiptToken: crypto.randomUUID() + crypto.randomUUID(), readings: [{ id: crypto.randomUUID(), type: 'strom', meter: 'Zähler 12', date: '2026-01-01', value: 1234.56, note: '=formula', photo: Buffer.from([255, 216, 255, 224, 0, 0, 255, 217]).toString('base64') }] };
}

module.exports = { environment };

if (require.main === module) {
test('capability check is read-only; meter collections save photos and send one fixed-recipient email', () => {
  const env = environment();
  assert.equal(JSON.parse(env.context.doGet({ parameter: { feature: 'meters' } }).text).feature, 'meter-readings');
  assert.equal(env.objects.size, 0);
  const batch = collection();
  const result = env.post(batch);
  assert.equal(result.ok, true);
  assert.equal(result.stored, true);
  assert.equal(result.status, 'sent');
  assert.ok(result.sentAt);
  assert.equal(env.mails.length, 1);
  assert.equal(env.mails[0].to, 'info@uhlenkoeper-camp.de');
  assert.equal(env.mails[0].attachments.length, 2);
  assert.match(env.mails[0].attachments[0].getDataAsString(), /'=formula/);
  assert.equal(env.post(batch).status, 'sent');
  assert.equal(env.mails.length, 1, 'retry never creates another email');
  const status = env.post({ kind: 'meter-status', id: batch.id, receiptToken: batch.receiptToken });
  assert.equal(status.status, 'sent');
  assert.equal(status.readings, undefined, 'status endpoint exposes no private readings or photos');
});

test('payload changes, invalid photos, future dates and foreign receipts are rejected', () => {
  const env = environment();
  const batch = collection();
  env.post(batch);
  const changed = structuredClone(batch);
  changed.readings[0].value++;
  assert.equal(env.post(changed).ok, false);
  assert.equal(env.post({ kind: 'meter-status', id: batch.id, receiptToken: crypto.randomUUID() + crypto.randomUUID() }).ok, false);
  for (const mutate of [
    input => { input.readings[0].photo = 'bad'; },
    input => { input.readings[0].value = -1; },
    input => { input.readings[0].type = '__proto__'; },
    input => { input.readings[0].date = '2026-02-30'; },
    input => { input.readings[0].date = '2999-01-01'; },
    input => { input.readings[0].meter = ' '; },
    input => { input.readings.push({ ...input.readings[0] }); }
  ]) {
    const value = collection(); mutate(value); assert.equal(env.post(value).ok, false);
  }
  assert.equal(env.mails.length, 1);
});

test('daily mail quota preserves a stored collection that can be retried', () => {
  const env = environment();
  env.setQuota(0);
  const batch = collection();
  assert.equal(env.post(batch).status, 'stored');
  assert.equal(env.mails.length, 0);
  env.setQuota(10);
  assert.equal(env.post(batch).status, 'sent');
  assert.equal(env.mails.length, 1);
  const root = env.objects.get(env.properties.get('ZAEHLER_DRIVE_FOLDER_ID'));
  assert.equal(root.folders.length, 1);
  assert.equal(root.folders[0].files.filter(file => file.name.endsWith('.jpg')).length, 1);
});

test('uncertain delivery and concurrent requests do not trigger duplicate mail', () => {
  const env = environment();
  env.failMail();
  const batch = collection();
  assert.equal(env.post(batch).status, 'uncertain');
  assert.equal(env.post(batch).status, 'uncertain');
  assert.equal(env.mails.length, 1);
  const locked = environment();
  locked.lock();
  assert.equal(locked.post(collection()).ok, false);
  assert.equal(locked.objects.size, 0);
});

test('existing waste route and its email handler are retained', () => {
  const env = environment();
  let rowCalls = 0, mailCalls = 0;
  env.context.jahresBlatt = () => ({});
  env.context.zeileAnhaengen = () => { rowCalls++; return false; };
  env.context.mailVerschicken = () => { mailCalls++; };
  const result = env.post({ year: 2026, date: '2026-01-01', headers: [], values: [] });
  assert.equal(result.ok, true);
  assert.equal(rowCalls, 1);
  assert.equal(mailCalls, 1);
  assert.equal(env.objects.size, 0, 'waste request does not create meter folders');
});
}
