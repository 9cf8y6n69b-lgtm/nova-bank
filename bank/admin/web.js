// © لوحة تحكم NOVA (موقع) — تشتغل على نفس رابط Render، محمية بكلمة سر DASHBOARD_PASSWORD
const http = require('http');
const crypto = require('crypto');
const BankUser = require('../models/BankUser');
const helpers = require('../utils/helpers');
const { getSettings, updateSettings, updateConfig, readConfig, parseDuration } = require('../utils/settings');
const backup = require('../utils/backup');
const preview = require('../utils/preview');
const dashboard = require('./dashboard');

const { formatMoney, formatTime } = helpers;
const PASSWORD = () => process.env.DASHBOARD_PASSWORD || '';
const TOKEN = () => crypto.createHmac('sha256', PASSWORD() || 'x').update('nova-dash-v1').digest('hex');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NAMES = { salary: 'راتب', tip: 'بخشيش', luck: 'حظ', gamble: 'قمار', dice: 'نرد', fruits: 'فواكه', trade: 'تداول', rob: 'نهب', roulette: 'روليت', loan: 'قرض', invest: 'استثمار' };
const HEX = /^#[0-9a-f]{6}$/i;
const fails = new Map();

let client = null, applyStatusFn = () => {};

function parseCookies(req) { const o = {}; (req.headers.cookie || '').split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); }); return o; }
const isAuthed = (req) => PASSWORD() && parseCookies(req).nova_s === TOKEN();
function readBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(new Error('الملف كبير')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function send(res, code, body, type = 'text/html; charset=utf-8', headers = {}) { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers }); res.end(body); }
const redirect = (res, to, headers = {}) => { res.writeHead(303, { Location: to, ...headers }); res.end(); };

// ---------------- صفحات ----------------
const CSS = `
:root{--bg:#0f1220;--card:#181c33;--line:#2a3058;--text:#fff;--mut:#9aa3d0;--pri:#5865F2;--ok:#4CD964;--bad:#ff5c5c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;line-height:1.5}
header{position:sticky;top:0;background:#12162b;border-bottom:1px solid var(--line);padding:10px 14px;display:flex;gap:8px;align-items:center;z-index:5;overflow-x:auto;white-space:nowrap}
header b{margin-inline-end:8px}header a{color:var(--mut);text-decoration:none;padding:6px 10px;border-radius:8px;font-size:14px}header a:hover{background:var(--line);color:#fff}
main{max-width:980px;margin:0 auto;padding:14px}section{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:16px}
h2{margin:0 0 12px;font-size:18px}h3{margin:14px 0 8px;font-size:15px;color:var(--mut)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.stat{background:#10142a;border:1px solid var(--line);border-radius:12px;padding:12px}.stat b{display:block;font-size:20px}.stat span{color:var(--mut);font-size:13px}
label{display:block;font-size:13px;color:var(--mut);margin:8px 0 4px}input,select,button,textarea{font:inherit;color:#fff;background:#10142a;border:1px solid var(--line);border-radius:10px;padding:9px 11px;max-width:100%}
input[type=color]{padding:2px;height:42px;width:70px}input[type=checkbox]{width:auto}button{background:var(--pri);border:0;cursor:pointer;font-weight:600}button.red{background:#c0392b}button.gray{background:#2a3058}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:end}.row>div{flex:1;min-width:130px}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:6px;border-bottom:1px solid var(--line);text-align:right}td input{width:100%;min-width:70px}
.msg{padding:10px 14px;border-radius:10px;margin-bottom:14px;background:#1c3a2a;border:1px solid #2e7d4a}.msg.err{background:#3a1c1c;border-color:#7d2e2e}
.prev{width:100%;max-width:560px;border-radius:14px;border:1px solid var(--line);display:block;margin-top:10px}.small{color:var(--mut);font-size:12px}.chk{display:flex;gap:6px;align-items:center;margin:4px 0;color:#fff}
@media(max-width:600px){main{padding:8px}section{padding:12px}}`;

const page = (title, body) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
const loginPage = (err) => page('دخول — NOVA', `<main style="max-width:380px;margin-top:12vh"><section><h2>🎛️ لوحة تحكم NOVA</h2>${err ? `<div class="msg err">${esc(err)}</div>` : ''}<form method="post" action="/login"><label>كلمة السر</label><input type="password" name="password" autofocus style="width:100%"><br><br><button style="width:100%">دخول</button></form></section></main>`);
const noPassPage = () => page('إعداد', `<main style="max-width:520px;margin-top:10vh"><section><h2>⚠️ لازم تحدد كلمة سر</h2><p>في Render ← Environment أضف متغير: <b>DASHBOARD_PASSWORD</b> وقيمته كلمة سر قوية، ثم أعد التشغيل.</p></section></main>`);

function opt(v, label, sel) { return `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(label)}</option>`; }
const tr = (...tds) => `<tr>${tds.map((t) => `<td>${t}</td>`).join('')}</tr>`;

async function dashboardPage(guild, flash) {
  const gid = guild.id;
  const cfg = readConfig(), s = cfg.adminSettings || {};
  const users = await BankUser.find({ guildId: gid });
  const total = users.reduce((a, u) => a + (u.balance || 0), 0);
  const frozen = users.filter((u) => u.frozen).length;
  const nameOf = (id) => client.users.cache.get(id)?.username || id;
  const top = users.slice().sort((a, b) => b.balance - a.balance).slice(0, 15);
  const rooms = (Array.isArray(s.bankChannels) ? s.bankChannels : []).map(String).filter((x) => x.trim());
  const channels = [...guild.channels.cache.values()].filter((c) => c.isTextBased?.() && !c.isThread?.() && c.type !== 2).sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0));
  const jobs = Object.entries(cfg.economy?.jobs || {}).sort((a, b) => (a[1].levelRequired || 0) - (b[1].levelRequired || 0));
  const exp = cfg.economy?.experience || {}, cds = cfg.cooldowns || {};
  const keys = [...new Set([...Object.keys(NAMES), ...Object.keys(cds), ...Object.keys(exp)])];
  const mats = cfg.material_definitions || {};
  const colors = { bgTop: '#1b1f3b', bgBottom: '#0d1020', ...(s.colorOverrides || {}) };
  const st = s.status || {};
  const guilds = [...client.guilds.cache.values()];
  const G = `<input type="hidden" name="g" value="${esc(gid)}">`;

  return page('لوحة تحكم NOVA', `
<header><b>🎛️ NOVA</b><a href="#home">الرئيسية</a><a href="#accounts">الحسابات</a><a href="#economy">الاقتصاد</a><a href="#market">السوق</a><a href="#look">المظهر</a><a href="#bot">البوت</a><a href="#backup">النسخ</a>
<form method="post" action="/logout" style="margin-inline-start:auto"><button class="gray">خروج</button></form></header>
<main>
${flash ? `<div class="msg${flash.err ? ' err' : ''}">${esc(flash.text)}</div>` : ''}
${guilds.length > 1 ? `<form method="get"><label>السيرفر</label><select name="g" onchange="this.form.submit()">${guilds.map((x) => opt(x.id, x.name, x.id === gid)).join('')}</select></form>` : ''}

<section id="home"><h2>📊 الرئيسية — ${esc(guild.name)}</h2>
<div class="grid"><div class="stat"><b>${users.length}</b><span>حساب</span></div><div class="stat"><b>${esc(formatMoney(total))}</b><span>مجموع الفلوس</span></div><div class="stat"><b>${frozen}</b><span>مجمّد</span></div><div class="stat"><b>${esc(s.prefix || 'بدون')}</b><span>البريفكس</span></div></div>
<h3>أغنى الأعضاء</h3><table>${top.map((u, i) => tr(i + 1, esc(nameOf(u.userId)), `<span class="small">${esc(u.userId)}</span>`, esc(formatMoney(u.balance)), `Lv ${u.level} • ${esc(u.job)}`, u.frozen ? '❄️' : '')).join('') || tr('لا يوجد حسابات')}</table></section>

<section id="accounts"><h2>👥 الحسابات</h2>
<form method="post" action="/act/money">${G}<div class="row"><div><label>العضو (ID أو منشن)</label><input name="user" list="ul" required><datalist id="ul">${top.map((u) => `<option value="${esc(u.userId)}">${esc(nameOf(u.userId))}</option>`).join('')}</datalist></div>
<div><label>المبلغ</label><input name="amount" type="number" min="1" required></div><div><button name="op" value="add">💰 إضافة</button> <button class="red" name="op" value="sub">💸 سحب</button></div></div></form>
<form method="post" action="/act/acct">${G}<div class="row"><div><label>العضو (ID أو منشن)</label><input name="user" list="ul" required></div>
<div><button name="op" value="freeze" class="gray">❄️ تجميد</button> <button name="op" value="unfreeze" class="gray">🔥 فك تجميد</button> <button name="op" value="reset" class="red" onclick="return confirm('تصفير الحساب بالكامل؟')">♻️ تصفير</button></div></div></form>
<h3>تصفير جماعي</h3><form method="post" action="/act/bulk">${G}<div class="row"><div><label>اكتب: تأكيد</label><input name="confirm"></div><div><button name="op" value="money" class="red">🧹 تصفير فلوس الجميع</button> <button name="op" value="all" class="red">🗑️ مسح كل الحسابات</button></div></div></form></section>

<section id="economy"><h2>⚙️ الاقتصاد</h2>
<form method="post" action="/act/jobs">${G}<h3>الوظائف (تترقّى تلقائياً عند الوصول للمستوى)</h3>
<table><tr><th>الوظيفة</th><th>الراتب</th><th>المستوى المطلوب</th><th>حذف</th></tr>
${jobs.map(([n, j]) => tr(`<input name="jn" value="${esc(n)}" readonly>`, `<input name="js" type="number" value="${j.salary || 0}">`, `<input name="jl" type="number" value="${j.levelRequired || 1}">`, `<input type="checkbox" name="jdel" value="${esc(n)}">`)).join('')}
${tr('<input name="njn" placeholder="وظيفة جديدة">', '<input name="njs" type="number" placeholder="الراتب">', '<input name="njl" type="number" placeholder="المستوى">', '')}</table><br><button>حفظ الوظائف</button></form>
<form method="post" action="/act/timing">${G}<h3>الأوامر: وقت الانتظار والخبرة (عشوائي بين الحدين)</h3>
<table><tr><th>الأمر</th><th>الوقت (30د / 12س / 45ث)</th><th>خبرة أقل</th><th>خبرة أعلى</th></tr>
${keys.map((k) => tr(`${esc(NAMES[k] || k)}<input type="hidden" name="tk" value="${esc(k)}">`, `<input name="tt" value="${cds[k] ? esc(formatTime(cds[k]).replace(/ و /g, ' ')) : ''}" placeholder="${cds[k] ? Math.round(cds[k] / 1000) + 'ث' : ''}">`, `<input name="tmin" type="number" value="${exp[k]?.xpMin ?? ''}">`, `<input name="tmax" type="number" value="${exp[k]?.xpMax ?? exp[k]?.xpAward ?? ''}">`)).join('')}</table>
<p class="small">اترك خانة الوقت فاضية عشان ما تتغير. تقدر تكتب الوقت ثواني: 1800ث أو 30د.</p><button>حفظ الأوقات والخبرة</button></form>
<form method="post" action="/act/rates">${G}<h3>النسب والقواعد</h3><div class="row"><div><label>نسبة الفوز في الألعاب والتداول (%)</label><input name="win" type="number" min="0" max="100" value="${Math.round((s.winRate ?? 0.5) * 100)}"></div>
<div><label>نسبة نجاح السرقة (%)</label><input name="rob" type="number" min="0" max="100" value="${Math.round((s.robSuccessRate ?? 0.4) * 100)}"></div></div>
<label class="chk"><input type="checkbox" name="voice" ${s.voiceProtectionEnabled !== false ? 'checked' : ''}> حماية من يكون في روم صوتي</label>
<label class="chk"><input type="checkbox" name="transfer" ${s.transferEnabled !== false ? 'checked' : ''}> السماح بالتحويل</label><br><button>حفظ</button></form></section>

<section id="market"><h2>🛒 السوق</h2><form method="post" action="/act/market">${G}
<table><tr><th>المادة</th><th>سعر الشراء</th><th>سعر البيع</th></tr>
${Object.keys(mats).map((m) => { const p = helpers.getMaterialPrices?.(m) || mats[m]; return tr(`${esc(mats[m].emoji || '')} ${esc(mats[m].name || m)}<input type="hidden" name="mk" value="${esc(m)}">`, `<input name="mb" type="number" value="${p.buyPrice ?? ''}">`, `<input name="ms" type="number" value="${p.sellPrice ?? ''}">`); }).join('')}</table>
<label class="chk"><input type="checkbox" name="freezeprices" ${s.marketFrozen ? 'checked' : ''}> تثبيت الأسعار (إيقاف التذبذب التلقائي كل 3 دقايق)</label><br><button>حفظ أسعار السوق</button></form></section>

<section id="look"><h2>🎨 المظهر (معاينة حيّة)</h2>
<form method="post" action="/act/colors">${G}<div class="row"><div><label>اللون الأعلى</label><input type="color" name="top" id="ctop" value="${esc(colors.bgTop)}"></div><div><label>اللون الأسفل</label><input type="color" name="bottom" id="cbot" value="${esc(colors.bgBottom)}"></div>
<div><label>نوع الخلفية</label><select name="mode" id="cmode">${opt('colors', 'ألوان', s.cardBackground !== 'image')}${opt('image', 'صورة مرفوعة', s.cardBackground === 'image')}</select></div>
<div><label>معاينة على بطاقة</label><select id="ccard">${opt('profile', 'البروفايل')}${opt('salary', 'الراتب')}${opt('gamble', 'القمار')}${opt('dice', 'النرد')}${opt('transfer', 'التحويل')}</select></div></div>
<label>اسم البنك على البطاقات</label><input name="brand" value="${esc(s.brandName || 'NOVA STORE')}"><br><br>
<button>💾 حفظ المظهر</button> <button class="gray" name="reset" value="1">↩️ الافتراضي</button></form>
<h3>رفع صورة خلفية</h3><input type="file" id="bgfile" accept="image/*"> <button type="button" id="bgup">⬆️ رفع وتفعيل</button> <span id="bgst" class="small"></span>
<img id="prev" class="prev" alt="معاينة" src="/preview.png?g=${esc(gid)}&card=profile&top=${encodeURIComponent(colors.bgTop)}&bottom=${encodeURIComponent(colors.bgBottom)}&mode=${s.cardBackground === 'image' ? 'image' : 'colors'}">
<p class="small">الصورة تتغير مباشرة وأنت تحرك الألوان.</p></section>

<section id="bot"><h2>🤖 البوت</h2>
<form method="post" action="/act/prefix">${G}<div class="row"><div><label>البريفكس (فاضي = بدون)</label><input name="p" value="${esc(s.prefix || '')}" maxlength="5"></div><div><button>حفظ</button></div></div></form>
<form method="post" action="/act/rooms">${G}<h3>رومات أوامر البنك (بدون اختيار = كل الرومات)</h3>
<div style="max-height:220px;overflow:auto;background:#10142a;border-radius:10px;padding:8px">${channels.map((c) => `<label class="chk"><input type="checkbox" name="room" value="${c.id}" ${rooms.includes(c.id) ? 'checked' : ''}> #${esc(c.name)}</label>`).join('')}</div><br><button>حفظ الرومات</button></form>
<form method="post" action="/act/status">${G}<h3>حالة البوت</h3><div class="row"><div><label>النص</label><input name="text" value="${esc(st.text || '')}"></div>
<div><label>النوع</label><select name="type">${opt('لعب', 'يلعب', (st.type ?? 0) === 0)}${opt('مشاهدة', 'يشاهد', st.type === 3)}${opt('استماع', 'يستمع', st.type === 2)}${opt('منافسة', 'ينافس', st.type === 5)}</select></div>
<div><label>الظهور</label><select name="state">${opt('متصل', 'متصل', !st.state || st.state === 'online')}${opt('غائب', 'غائب', st.state === 'idle')}${opt('مشغول', 'مشغول', st.state === 'dnd')}${opt('مخفي', 'مخفي', st.state === 'invisible')}</select></div></div><br><button>حفظ الحالة</button></form></section>

<section id="backup"><h2>💾 النسخ الاحتياطي</h2><p class="small">تُرسل النسخة تلقائياً إلى <b>${esc(backup.targetId())}</b> عند أي تغيير من هنا.</p>
<form method="post" action="/act/backup">${G}<button>📤 أرسل نسخة الآن</button></form>
<form method="post" action="/act/backupdelay">${G}<div class="row"><div><label>نسخة تلقائية بعد تغييرات الفلوس والألعاب (ثواني، 0 = إيقاف)</label><input name="sec" type="number" min="0" value="${Number.isFinite(s.backupDelaySec) ? s.backupDelaySec : 300}"></div><div><button>حفظ</button></div></div></form>
<h3>استرجاع نسخة</h3><input type="file" id="rfile" accept=".json"> <button type="button" class="red" id="rup">♻️ استرجاع</button> <span id="rst" class="small"></span></section>
</main>
<script>
const G=${JSON.stringify(gid)};
const img=document.getElementById('prev');let t=null;
function upd(){clearTimeout(t);t=setTimeout(()=>{img.src='/preview.png?g='+G+'&card='+ccard.value+'&top='+encodeURIComponent(ctop.value)+'&bottom='+encodeURIComponent(cbot.value)+'&mode='+cmode.value+'&t='+Date.now()},120)}
['ctop','cbot'].forEach(i=>document.getElementById(i).addEventListener('input',upd));['cmode','ccard'].forEach(i=>document.getElementById(i).addEventListener('change',upd));
const b64=(f)=>new Promise((r,j)=>{const x=new FileReader();x.onload=()=>r(x.result.split(',')[1]);x.onerror=j;x.readAsDataURL(f)});
document.getElementById('bgup').onclick=async()=>{const f=document.getElementById('bgfile').files[0];if(!f)return;bgst.textContent='جاري الرفع...';
 const r=await fetch('/api/bg',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({g:G,data:await b64(f)})});const j=await r.json();bgst.textContent=j.msg;if(j.ok){cmode.value='image';upd()}};
document.getElementById('rup').onclick=async()=>{const f=document.getElementById('rfile').files[0];if(!f)return;if(!confirm('الاسترجاع يستبدل كل البيانات الحالية. متأكد؟'))return;rst.textContent='جاري الاسترجاع...';
 const r=await fetch('/api/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:await f.text()})});const j=await r.json();rst.textContent=j.msg;};
</script>`);
}

// ---------------- الإجراءات ----------------
const idFrom = (s) => (String(s || '').match(/\d{15,20}/) || [])[0];
const num = (v) => { const n = parseInt(String(v ?? '').replace(/[,\s]/g, ''), 10); return Number.isFinite(n) ? n : null; };
const pct = (v) => Math.max(0, Math.min(100, num(v) ?? 0)) / 100;
const after = (r) => backup.requestBackup(client, r, 3000);

const ACTIONS = {
  async money(f, guild) {
    const uid = idFrom(f.get('user')), amt = num(f.get('amount'));
    if (!uid || !(amt > 0)) throw new Error('العضو أو المبلغ غير صحيح');
    return dashboard.ops.money(guild, uid, amt, f.get('op') === 'add' ? 1 : -1);
  },
  async acct(f, guild) {
    const uid = idFrom(f.get('user')); if (!uid) throw new Error('العضو غير صحيح');
    const op = f.get('op');
    return op === 'reset' ? dashboard.ops.resetUser(guild, uid) : dashboard.ops.freeze(guild, uid, op === 'freeze');
  },
  async bulk(f, guild) {
    if (f.get('confirm') !== 'تأكيد') throw new Error('اكتب كلمة: تأكيد');
    return f.get('op') === 'money' ? dashboard.ops.resetMoney(guild) : dashboard.ops.resetAll(guild);
  },
  async jobs(f) {
    const names = f.getAll('jn'), sal = f.getAll('js'), lvl = f.getAll('jl'), del = new Set(f.getAll('jdel'));
    updateConfig((cfg) => {
      cfg.economy = cfg.economy || {}; const jobs = {};
      names.forEach((n, i) => { if (!del.has(n)) jobs[n] = { salary: Math.max(0, num(sal[i]) ?? 0), levelRequired: Math.max(1, num(lvl[i]) ?? 1) }; });
      const nn = (f.get('njn') || '').trim();
      if (nn) jobs[nn] = { salary: Math.max(0, num(f.get('njs')) ?? 0), levelRequired: Math.max(1, num(f.get('njl')) ?? 1) };
      if (!Object.keys(jobs).length) throw new Error('لازم تبقى وظيفة وحدة على الأقل');
      cfg.economy.jobs = jobs;
    });
    after('تعديل الوظائف'); return '✅ تم حفظ الوظائف';
  },
  async timing(f) {
    const k = f.getAll('tk'), t = f.getAll('tt'), a = f.getAll('tmin'), b = f.getAll('tmax');
    updateConfig((cfg) => {
      cfg.cooldowns = cfg.cooldowns || {}; cfg.economy = cfg.economy || {}; cfg.economy.experience = cfg.economy.experience || {};
      k.forEach((key, i) => {
        if (t[i] && t[i].trim()) { const ms = parseDuration(t[i].replace(/\s+/g, '')); if (ms === null) throw new Error(`وقت غير صحيح للأمر ${NAMES[key] || key}`); cfg.cooldowns[key] = ms; }
        const lo = num(a[i]), hi = num(b[i]);
        if (lo !== null && hi !== null) cfg.economy.experience[key] = { ...(cfg.economy.experience[key] || {}), xpMin: Math.min(lo, hi), xpMax: Math.max(lo, hi) };
      });
    });
    after('تعديل الأوقات والخبرة'); return '✅ تم حفظ الأوقات والخبرة';
  },
  async rates(f) {
    updateSettings({ winRate: pct(f.get('win')), robSuccessRate: pct(f.get('rob')), voiceProtectionEnabled: f.has('voice'), transferEnabled: f.has('transfer') });
    after('تعديل النسب'); return '✅ تم حفظ النسب';
  },
  async market(f) {
    const mk = f.getAll('mk'), mb = f.getAll('mb'), ms = f.getAll('ms');
    updateConfig((cfg) => {
      cfg.material_definitions = cfg.material_definitions || {};
      mk.forEach((m, i) => { const b = num(mb[i]), s = num(ms[i]); if (cfg.material_definitions[m] && b > 0) { cfg.material_definitions[m].buyPrice = b; if (s > 0) cfg.material_definitions[m].sellPrice = s; } });
    });
    mk.forEach((m, i) => { const b = num(mb[i]), s = num(ms[i]); const p = helpers.getMaterialPrices?.(m); if (p && b > 0) { p.buyPrice = b; if (s > 0) p.sellPrice = s; } });
    try { require('fs').writeFileSync(require('path').join(__dirname, '..', 'data', 'marketPrices.json'), JSON.stringify(Object.fromEntries(mk.map((m) => [m, helpers.getMaterialPrices?.(m) || {}])), null, 2)); } catch {}
    const frozen = f.has('freezeprices'); updateSettings({ marketFrozen: frozen });
    if (frozen) { if (global.marketPriceInterval) clearInterval(global.marketPriceInterval); global.marketPriceInterval = null; }
    else if (!global.marketPriceInterval) helpers.startPriceUpdater?.();
    after('تعديل السوق'); return `✅ تم حفظ أسعار السوق${frozen ? ' (الأسعار مثبّتة)' : ''}`;
  },
  async colors(f) {
    if (f.get('reset')) return dashboard.ops.background({ reset: true });
    const top = f.get('top'), bottom = f.get('bottom'), mode = f.get('mode');
    if (!HEX.test(top) || !HEX.test(bottom)) throw new Error('لون غير صحيح');
    updateSettings({ colorOverrides: { bgTop: top, bgBottom: bottom }, cardBackground: mode === 'image' ? 'image' : 'colors', brandName: (f.get('brand') || 'NOVA STORE').trim().slice(0, 30) });
    after('تغيير المظهر'); return '✅ تم حفظ المظهر';
  },
  async prefix(f) { return dashboard.ops.prefix((f.get('p') || '').trim()); },
  async rooms(f) { const ids = f.getAll('room').filter((x) => /^\d{15,20}$/.test(x)); return dashboard.ops.rooms(ids.length ? 'set' : 'clear', ids, []); },
  async status(f) { return dashboard.ops.status((f.get('text') || '').trim() || 'Wick Studio', f.get('type') || 'لعب', f.get('state') || 'متصل'); },
  async backup() { return dashboard.ops.backupNow(); },
  async backupdelay(f) { const n = Math.max(0, num(f.get('sec')) ?? 300); updateSettings({ backupDelaySec: n }); after('تعديل فاصل النسخ'); return n ? `✅ نسخة تلقائية بعد ${n} ثانية من أول تغيير` : '✅ تم إيقاف النسخ التلقائية لتغييرات الألعاب'; },
};

// ---------------- المعاينة ----------------
async function renderPreview(guild, q) {
  const { createProfileCard, createGambleCard, createDiceCard, createTransferCard } = require('../utils/gameCards');
  const { createRewardCard } = require('../utils/rewardCard');
  const av = client.user?.displayAvatarURL?.({ extension: 'png', size: 128 }) || '';
  const me = { id: '1', username: 'اسم العضو', displayAvatarURL: () => av };
  const bot = { id: '2', username: client.user?.username || 'NOVA', displayAvatarURL: () => av };
  const doc = { balance: 1250000, job: Object.keys(readConfig().economy?.jobs || { عاطل: 1 })[2] || 'موظف', level: 7, experience: 160, visaNumber: '4111222233334444', stats: { highestEarned: 480000, highestLost: 120000 } };
  const colors = {}; if (HEX.test(q.get('top'))) colors.bgTop = q.get('top'); if (HEX.test(q.get('bottom'))) colors.bgBottom = q.get('bottom');
  const mode = q.get('mode') === 'image' ? 'image' : 'colors';
  const card = q.get('card');
  return preview.withPreview({ colors, mode }, async () => {
    if (card === 'salary') return createRewardCard({ user: doc, discordUser: me, guildOrId: guild, amountText: '+$14K', subtitle: `تم إيداع الراتب ، الوظيفة (${doc.job})`, footer: 'رصيدك الآن $1.2M' });
    if (card === 'gamble') return createGambleCard({ discordUser: me, fruits: ['cherry', 'grapes', 'diamond'], state: 'win', amount: 10000, change: 30000, guild });
    if (card === 'dice') return createDiceCard({ discordUser: me, botUser: bot, userRoll: 5, botRoll: 2, result: 'win', amount: 10000, guild });
    if (card === 'transfer') return createTransferCard({ from: me, to: bot, amount: 25000, balance: 98000, guild });
    return createProfileCard({ user: doc, discordUser: me, guild });
  });
}

// ---------------- السيرفر ----------------
function pickGuild(gid) { return client.guilds.cache.get(gid) || client.guilds.cache.first(); }

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (p === '/health') return send(res, 200, 'ok', 'text/plain');
  if (!PASSWORD()) return send(res, 200, noPassPage());

  if (p === '/login' && req.method === 'POST') {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress; const f = fails.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - f.t > 60000) { f.n = 0; f.t = Date.now(); }
    if (f.n >= 5) return send(res, 429, loginPage('محاولات كثيرة، انتظر دقيقة'));
    const pw = new URLSearchParams((await readBody(req, 4096)).toString()).get('password') || '';
    const a = crypto.createHash('sha256').update(pw).digest(), b = crypto.createHash('sha256').update(PASSWORD()).digest();
    if (crypto.timingSafeEqual(a, b)) { fails.delete(ip); return redirect(res, '/', { 'Set-Cookie': `nova_s=${TOKEN()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}` }); }
    f.n++; fails.set(ip, f); return send(res, 401, loginPage('كلمة السر غلط'));
  }
  if (!isAuthed(req)) return send(res, 200, loginPage());
  if (p === '/logout') return redirect(res, '/', { 'Set-Cookie': 'nova_s=; Max-Age=0; Path=/' });

  if (p === '/preview.png') {
    const guild = pickGuild(url.searchParams.get('g'));
    try { return send(res, 200, await renderPreview(guild, url.searchParams), 'image/png'); }
    catch (e) { console.error('preview:', e); return send(res, 500, 'preview error', 'text/plain'); }
  }
  if (p === '/api/bg' && req.method === 'POST') {
    try { const j = JSON.parse((await readBody(req)).toString()); await dashboard.ops.backgroundBuffer(Buffer.from(j.data, 'base64')); return send(res, 200, JSON.stringify({ ok: true, msg: '✅ تم رفع الصورة وتفعيلها' }), 'application/json'); }
    catch (e) { return send(res, 200, JSON.stringify({ ok: false, msg: '❌ ' + e.message }), 'application/json'); }
  }
  if (p === '/api/restore' && req.method === 'POST') {
    try { const j = JSON.parse((await readBody(req)).toString()); const n = backup.applyBackup(j.text); applyStatusFn(); return send(res, 200, JSON.stringify({ ok: true, msg: `✅ تم الاسترجاع: ${n} حساب` }), 'application/json'); }
    catch (e) { return send(res, 200, JSON.stringify({ ok: false, msg: '❌ ' + e.message }), 'application/json'); }
  }
  if (p.startsWith('/act/') && req.method === 'POST') {
    const f = new URLSearchParams((await readBody(req, 2 * 1024 * 1024)).toString());
    const guild = pickGuild(f.get('g')); const name = p.slice(5); let flash;
    try { if (!ACTIONS[name]) throw new Error('إجراء غير معروف'); flash = { text: String(await ACTIONS[name](f, guild)).replace(/<@!?(\d+)>/g, (_, i) => client.users.cache.get(i)?.username || i).replace(/<#(\d+)>/g, (_, i) => '#' + (guild.channels.cache.get(i)?.name || i)) }; }
    catch (e) { console.error('web action:', e); flash = { text: '❌ ' + e.message, err: true }; }
    const sec = { money: 'accounts', acct: 'accounts', bulk: 'accounts', jobs: 'economy', timing: 'economy', rates: 'economy', market: 'market', colors: 'look', prefix: 'bot', rooms: 'bot', status: 'bot', backup: 'backup', backupdelay: 'backup' }[name] || 'home';
    return send(res, 200, (await dashboardPage(guild, flash)).replace('</body>', `<script>location.hash='${sec}'</script></body>`));
  }
  if (p === '/') {
    const guild = pickGuild(url.searchParams.get('g'));
    if (!guild) return send(res, 200, page('NOVA', '<main><section>البوت مو داخل أي سيرفر بعد.</section></main>'));
    return send(res, 200, await dashboardPage(guild));
  }
  return send(res, 404, 'Not found', 'text/plain');
}

function start(c, applyStatus) {
  client = c; if (applyStatus) applyStatusFn = applyStatus;
  dashboard.init({ client: c, applyStatus: () => applyStatusFn(), isAdmin: () => true, isOwner: () => true });
  const server = http.createServer((req, res) => handle(req, res).catch((e) => { console.error('web:', e); try { send(res, 500, 'خطأ في السيرفر', 'text/plain'); } catch {} }));
  server.listen(process.env.PORT || 3000, () => console.log(`🌐 Dashboard on port ${process.env.PORT || 3000}${PASSWORD() ? '' : ' (DASHBOARD_PASSWORD غير محدد!)'}`));
  return server;
}
module.exports = { start };
