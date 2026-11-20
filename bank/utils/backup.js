// نسخ احتياطي موحّد: يرسل لـ BACKUP_TARGET_ID (قناة أو شخص) عند كل تغيير
const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const BankUser = require('../models/BankUser');
const { getSettings } = require('./settings');

const ROOT = path.join(__dirname, '..', '..');
const TEXT_FILES = ['bank/config/bank-config.json', 'bank/config/cars-config.json', 'admin_settings.json',
  'bank/data/auction.json', 'bank/data/harraj.json', 'bank/data/marketPrices.json'];
const BIN_FILES = ['bank/data/background.jpg'];
const DEFAULT_TARGET = '1345715711095472280';
const targetId = () => process.env.BACKUP_TARGET_ID || DEFAULT_TARGET;

function buildBackup() {
  const files = {}, binary = {};
  for (const f of TEXT_FILES) { try { files[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch {} }
  for (const f of BIN_FILES) { try { binary[f] = fs.readFileSync(path.join(ROOT, f)).toString('base64'); } catch {} }
  return JSON.stringify({ version: 2, createdAt: new Date().toISOString(), users: BankUser.__dump(), files, binary });
}
function applyBackup(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.users)) throw new Error('ملف غير صالح');
  const n = BankUser.__load(data.users);
  for (const f of TEXT_FILES) {
    if (data.files && typeof data.files[f] === 'string') {
      try { JSON.parse(data.files[f]); fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), data.files[f]); } catch {}
    }
  }
  for (const f of BIN_FILES) {
    if (data.binary && typeof data.binary[f] === 'string') {
      try { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), Buffer.from(data.binary[f], 'base64')); } catch {}
    }
  }
  return n;
}
const makeAttachment = () => new AttachmentBuilder(Buffer.from(buildBackup()), { name: `backup-${new Date().toISOString().slice(0, 10)}.json` });

async function resolveTarget(client) {
  const id = targetId();
  try { const ch = await client.channels.fetch(id); if (ch?.isTextBased?.()) return ch; } catch {}
  try { return await client.users.fetch(id); } catch {}
  return null;
}

async function sendBackup(client, reason) {
  const content = `💾 نسخة احتياطية (${reason}) — ${BankUser.__count()} حساب`;
  const tries = [await resolveTarget(client)];
  if (process.env.OWNER_ID && process.env.OWNER_ID !== targetId()) tries.push(await client.users.fetch(process.env.OWNER_ID).catch(() => null));
  for (const t of tries) {
    if (!t) continue;
    try { await t.send({ content, files: [makeAttachment()] }); return true; } catch (e) { console.error('backup send failed:', e.message); }
  }
  return false;
}

// تأخير ذكي: لو فيه نسخة مجدولة أبكر نتركها، ولو الجديدة أبكر نقدّمها
let timer = null, dueAt = 0;
function requestBackup(client, reason, delayMs = 3000) {
  const due = Date.now() + delayMs;
  if (timer && dueAt <= due) return;
  if (timer) clearTimeout(timer);
  dueAt = due;
  timer = setTimeout(() => { timer = null; dueAt = 0; sendBackup(client, reason).catch(() => {}); }, delayMs);
}
// تغييرات البيانات العادية (فلوس، ألعاب...) — بفاصل يتحدد من اللوحة (0 = إيقاف)
function onDataChange(client) {
  const sec = Number.isFinite(getSettings().backupDelaySec) ? getSettings().backupDelaySec : 300;
  if (sec > 0) requestBackup(client, 'تغيير بيانات', sec * 1000);
}

// يرجّع آخر نسخة تلقائياً لو البيانات فاضية (بعد تحديث/إعادة تشغيل Render)
async function autoRestore(client) {
  if (BankUser.__count() > 0) return;
  try {
    const t = await resolveTarget(client);
    if (!t) return console.log('ℹ️ ما قدرت أوصل لمكان النسخ الاحتياطية');
    const box = t.messages ? t : await t.createDM();
    const msgs = await box.messages.fetch({ limit: 50 });
    const m = msgs.find((x) => x.author.id === client.user.id && x.attachments.some((a) => a.name?.startsWith('backup-')));
    if (!m) return console.log('ℹ️ ما لقيت نسخة سابقة');
    const att = m.attachments.find((a) => a.name?.startsWith('backup-'));
    const n = applyBackup(await (await fetch(att.url)).text());
    console.log(`✅ تم استرجاع آخر نسخة تلقائياً (${n} حساب)`);
  } catch (e) { console.error('autoRestore failed:', e.message); }
}
module.exports = { buildBackup, applyBackup, makeAttachment, sendBackup, requestBackup, onDataChange, autoRestore, targetId };
