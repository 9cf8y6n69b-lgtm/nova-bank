// © لوحة تحكم NOVA — أوامر سلاش + أزرار + نوافذ (داخل ديسكورد)
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  ChannelSelectMenuBuilder, ChannelType,
} = require('discord.js');
const BankUser = require('../models/BankUser');
const { getUser, formatMoney, formatTime } = require('../utils/helpers');
const { getSettings, updateSettings, updateConfig, readConfig, parseDuration } = require('../utils/settings');
const { saveBackgroundFromUrl, saveBackgroundFromBuffer } = require('../utils/background');
const backup = require('../utils/backup');

const EPH = 64; // رسائل مخفية
const KEYS = { راتب: 'salary', بخشيش: 'tip', حظ: 'luck', قمار: 'gamble', نرد: 'dice', فواكه: 'fruits', تظهر: 'fruits', تداول: 'trade', نهب: 'rob', سرقة: 'rob', روليت: 'roulette', قرض: 'loan', استثمار: 'invest' };
const NAMES = { salary: 'راتب', tip: 'بخشيش', luck: 'حظ', gamble: 'قمار', dice: 'نرد', fruits: 'فواكه', trade: 'تداول', rob: 'نهب', roulette: 'روليت', loan: 'قرض', invest: 'استثمار' };
const ACTIVITY = { لعب: 0, مشاهدة: 3, استماع: 2, منافسة: 5 };
const STATE = { متصل: 'online', غائب: 'idle', مشغول: 'dnd', مخفي: 'invisible' };
const HEX = /^#?([0-9a-f]{6})$/i;

let ctx = null; // { client, isAdmin(member), isOwner(userId) }
function init(c) { ctx = c; }

// ---------------- أوامر السلاش ----------------
const userOpt = { type: 6, name: 'المستخدم', description: 'العضو', required: true };
const sub = (name, description, options = []) => ({ type: 1, name, description, options });
const DEFS = [
  { name: 'لوحة', description: 'لوحة تحكم البنك (للإدارة)', default_member_permissions: '8', dm_permission: false },
  {
    name: 'ادارة', description: 'أوامر إدارة البنك', default_member_permissions: '8', dm_permission: false,
    options: [
      sub('اضافة', 'إضافة فلوس لعضو', [userOpt, { type: 4, name: 'المبلغ', description: 'المبلغ', required: true, min_value: 1 }]),
      sub('سحب', 'سحب فلوس من عضو', [userOpt, { type: 4, name: 'المبلغ', description: 'المبلغ', required: true, min_value: 1 }]),
      sub('تجميد', 'تجميد حساب عضو', [userOpt]),
      sub('فك_تجميد', 'فك تجميد حساب عضو', [userOpt]),
      sub('تصفير', 'تصفير حساب عضو بالكامل', [userOpt]),
      sub('تصفير_فلوس', 'تصفير فلوس الجميع (يبقى الباقي)', [{ type: 3, name: 'تأكيد', description: 'اكتب: تأكيد', required: true }]),
      sub('تصفير_الكل', 'مسح كل الحسابات (فلوس، مستوى، كل شي)', [{ type: 3, name: 'تأكيد', description: 'اكتب: تأكيد', required: true }]),
      sub('روم', 'تحديد روم أوامر البنك', [
        { type: 3, name: 'الوضع', description: 'ماذا تفعل', required: true, choices: [{ name: 'هذا الروم فقط', value: 'set' }, { name: 'إضافة روم', value: 'add' }, { name: 'إزالة روم', value: 'remove' }, { name: 'السماح لكل الرومات', value: 'clear' }] },
        { type: 7, name: 'القناة', description: 'الروم', required: false, channel_types: [0, 5] },
      ]),
      sub('بريفكس', 'تغيير البريفكس (اتركه فاضي = بدون بريفكس)', [{ type: 3, name: 'الرمز', description: 'مثل ! أو .', required: false, max_length: 5 }]),
      sub('حالة', 'تغيير حالة البوت', [
        { type: 3, name: 'النص', description: 'نص الحالة', required: true, max_length: 100 },
        { type: 3, name: 'النوع', description: 'نوع النشاط', required: false, choices: Object.keys(ACTIVITY).map((k) => ({ name: k, value: k })) },
        { type: 3, name: 'الظهور', description: 'متصل / غائب ...', required: false, choices: Object.keys(STATE).map((k) => ({ name: k, value: k })) },
      ]),
      sub('خلفية', 'خلفية صور البنك (صورة أو ألوان)', [
        { type: 11, name: 'صورة', description: 'صورة الخلفية', required: false },
        { type: 3, name: 'لون_اعلى', description: 'مثل #1b1f3b', required: false },
        { type: 3, name: 'لون_اسفل', description: 'مثل #0d1020', required: false },
        { type: 5, name: 'افتراضي', description: 'رجوع للخلفية الافتراضية', required: false },
      ]),
      sub('وقت', 'وقت انتظار أمر', [{ type: 3, name: 'الامر', description: 'مثل راتب / قمار', required: true }, { type: 3, name: 'المدة', description: 'مثل 30د أو 12س أو 45ث', required: true }]),
      sub('خبرة', 'خبرة أمر (عشوائي بين الحدين)', [{ type: 3, name: 'الامر', description: 'مثل راتب / قمار', required: true }, { type: 4, name: 'اقل', description: 'الحد الأدنى', required: true, min_value: 0 }, { type: 4, name: 'اعلى', description: 'الحد الأعلى', required: true, min_value: 0 }]),
      sub('نسخة', 'إرسال نسخة احتياطية الآن'),
      sub('استرجاع', 'استرجاع نسخة احتياطية (للمالك فقط)', [{ type: 11, name: 'ملف', description: 'ملف النسخة backup-....json', required: true }]),
    ],
  },
];

async function registerCommands(client) {
  for (const guild of client.guilds.cache.values()) {
    try { await guild.commands.set(DEFS); console.log(`✅ Slash commands registered in ${guild.name}`); }
    catch (e) { console.error(`❌ Slash register failed in ${guild?.name}: ${e.message} (تأكد إن البوت مضاف بصلاحية applications.commands)`); }
  }
}

// ---------------- أدوات ----------------
const idFrom = (s) => (String(s || '').match(/\d{15,20}/) || [])[0];
const afterChange = (reason) => backup.requestBackup(ctx.client, reason, 3000);
async function ensureAdmin(i) {
  const ok = i.inGuild() && ctx.isAdmin(i.member);
  if (!ok) await i.reply({ content: '❌ للإدارة فقط.', flags: EPH }).catch(() => {});
  return ok;
}
async function allUsers(guildId) { return await BankUser.find({ guildId }); }

async function dashboardPayload(guild) {
  const s = getSettings();
  const users = await allUsers(guild.id);
  const total = users.reduce((a, u) => a + (u.balance || 0), 0);
  const frozen = users.filter((u) => u.frozen).length;
  const rooms = Array.isArray(s.bankChannels) ? s.bankChannels.filter((x) => String(x).trim()) : [];
  const st = s.status || {};
  const cds = Object.entries(readConfig().cooldowns || {}).map(([k, v]) => `${NAMES[k] || k}: ${formatTime(v)}`).join(' • ') || '—';
  const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎛️ لوحة تحكم NOVA STORE')
    .addFields(
      { name: '👥 الحسابات', value: `${users.length} حساب • ❄️ ${frozen} مجمّد\n💰 مجموع الفلوس: ${formatMoney(total)}`, inline: true },
      { name: '🔤 البريفكس', value: s.prefix ? `\`${s.prefix}\`` : 'بدون', inline: true },
      { name: '📍 رومات الأوامر', value: rooms.length ? rooms.map((r) => `<#${r}>`).join(' ') : 'كل الرومات', inline: false },
      { name: '🤖 حالة البوت', value: st.text ? `${Object.keys(ACTIVITY).find((k) => ACTIVITY[k] === (st.type ?? 0)) || 'لعب'}: ${st.text} (${Object.keys(STATE).find((k) => STATE[k] === (st.state || 'online'))})` : 'افتراضية', inline: false },
      { name: '🖼️ خلفية الصور', value: s.cardBackground === 'image' ? 'صورة مرفوعة' : `ألوان ${s.colorOverrides?.bgTop ? `(${s.colorOverrides.bgTop} → ${s.colorOverrides.bgBottom || '?'})` : 'افتراضية'}`, inline: true },
      { name: '💾 النسخ الاحتياطي', value: `إلى \`${backup.targetId()}\`\nكل تغيير بيانات بعد ${Number.isFinite(s.backupDelaySec) ? (s.backupDelaySec || 'إيقاف') : 300} ثانية`, inline: true },
      { name: '⏱️ أوقات الأوامر', value: cds.slice(0, 1000) },
    ).setTimestamp();
  const b = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  const components = [
    new ActionRowBuilder().addComponents(b('dash_add', '💰 إضافة فلوس', ButtonStyle.Success), b('dash_sub', '💸 سحب فلوس', ButtonStyle.Danger), b('dash_freeze', '❄️ تجميد'), b('dash_unfreeze', '🔥 فك تجميد'), b('dash_resetu', '♻️ تصفير حساب')),
    new ActionRowBuilder().addComponents(b('dash_prefix', '🔤 البريفكس'), b('dash_status', '🤖 حالة البوت'), b('dash_bg', '🖼️ الألوان/الخلفية'), b('dash_timing', '⏱️ وقت/خبرة'), b('dash_backup', '💾 نسخة الآن', ButtonStyle.Primary)),
    new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('dash_rooms').setPlaceholder('📍 اختر رومات أوامر البنك').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(10)),
    new ActionRowBuilder().addComponents(b('dash_roomsclear', '📍 السماح لكل الرومات'), b('dash_resetmoney', '🧹 تصفير فلوس الجميع', ButtonStyle.Danger), b('dash_resetall', '🗑️ مسح كل الحسابات', ButtonStyle.Danger), b('dash_refresh', '🔄 تحديث')),
  ];
  return { embeds: [embed], components };
}

const input = (id, label, opts = {}) => new ActionRowBuilder().addComponents(
  new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(opts.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(opts.required !== false).setPlaceholder(opts.ph || '').setMaxLength(opts.max || 100));
const modal = (id, title, ...rows) => new ModalBuilder().setCustomId(id).setTitle(title).addComponents(...rows);

// ---------------- العمليات (مشتركة بين السلاش واللوحة) ----------------
const ops = {
  async money(guild, userId, amount, sign) {
    const u = await getUser(userId, guild.id);
    const before = u.balance;
    u.balance = sign > 0 ? u.balance + amount : Math.max(0, u.balance - amount);
    await u.save();
    afterChange(`${sign > 0 ? 'إضافة' : 'سحب'} فلوس`);
    return `✅ ${sign > 0 ? 'أضفت' : 'سحبت'} ${formatMoney(Math.abs(u.balance - before))} — رصيد <@${userId}> الآن ${formatMoney(u.balance)}`;
  },
  async freeze(guild, userId, on) {
    const u = await getUser(userId, guild.id); u.frozen = on; await u.save();
    afterChange(on ? 'تجميد حساب' : 'فك تجميد');
    return on ? `❄️ تم تجميد حساب <@${userId}>` : `🔥 تم فك تجميد حساب <@${userId}>`;
  },
  async resetUser(guild, userId) {
    await BankUser.deleteOne({ userId, guildId: guild.id }); afterChange('تصفير حساب');
    return `♻️ تم تصفير حساب <@${userId}> بالكامل`;
  },
  async resetMoney(guild) {
    const list = await allUsers(guild.id); for (const u of list) { u.balance = 0; await u.save(); }
    afterChange('تصفير فلوس الجميع'); return `🧹 تم تصفير فلوس ${list.length} حساب`;
  },
  async resetAll(guild) {
    const n = await BankUser.countDocuments({ guildId: guild.id }); await BankUser.deleteMany({ guildId: guild.id });
    afterChange('مسح كل الحسابات'); return `🗑️ تم مسح ${n} حساب`;
  },
  prefix(p) { updateSettings({ prefix: p || '' }); afterChange('تغيير البريفكس'); return p ? `✅ البريفكس صار \`${p}\`` : '✅ صار بدون بريفكس'; },
  rooms(mode, ids, current) {
    let list = (Array.isArray(current) ? current : []).map(String).filter((x) => x.trim());
    if (mode === 'set') list = ids; else if (mode === 'add') list = [...new Set([...list, ...ids])];
    else if (mode === 'remove') list = list.filter((x) => !ids.includes(x)); else list = [];
    updateSettings({ bankChannels: list }); afterChange('تغيير رومات الأوامر');
    return list.length ? `✅ أوامر البنك تشتغل فقط في: ${list.map((r) => `<#${r}>`).join(' ')}` : '✅ أوامر البنك تشتغل في كل الرومات';
  },
  status(text, type, state) {
    updateSettings({ status: { text, type: ACTIVITY[type] ?? 0, state: STATE[state] || 'online' } });
    ctx.applyStatus(); afterChange('تغيير حالة البوت'); return `✅ تم تغيير حالة البوت: ${text}`;
  },
  async backgroundBuffer(buf) {
    await saveBackgroundFromBuffer(buf); updateSettings({ cardBackground: 'image' }); afterChange('تغيير الخلفية');
    return '✅ تم تعيين صورة الخلفية';
  },
  async background({ imageUrl, top, bottom, reset }) {
    if (reset) { updateSettings({ cardBackground: 'colors', colorOverrides: {} }); afterChange('خلفية افتراضية'); return '✅ رجعت الخلفية الافتراضية'; }
    const patch = {};
    if (imageUrl) { await saveBackgroundFromUrl(imageUrl); patch.cardBackground = 'image'; }
    if (top || bottom) {
      const cur = getSettings().colorOverrides || {};
      const ov = { ...cur };
      if (top) { if (!HEX.test(top)) throw new Error('اللون الأعلى غير صحيح (مثل #1b1f3b)'); ov.bgTop = '#' + top.replace('#', ''); }
      if (bottom) { if (!HEX.test(bottom)) throw new Error('اللون الأسفل غير صحيح (مثل #0d1020)'); ov.bgBottom = '#' + bottom.replace('#', ''); }
      patch.colorOverrides = ov; if (!imageUrl) patch.cardBackground = 'colors';
    }
    if (!Object.keys(patch).length) throw new Error('حدد صورة أو لون');
    updateSettings(patch); afterChange('تغيير الخلفية');
    return patch.cardBackground === 'image' ? '✅ تم تعيين صورة الخلفية' : '✅ تم تغيير ألوان الخلفية';
  },
  timing(cmd, time, xpMin, xpMax) {
    const key = KEYS[cmd] || cmd; const out = [];
    updateConfig((cfg) => {
      cfg.cooldowns = cfg.cooldowns || {}; cfg.economy = cfg.economy || {};
      if (time) { const ms = parseDuration(time); if (ms === null) throw new Error('المدة غير صحيحة (مثل 30د أو 12س)'); cfg.cooldowns[key] = ms; out.push(`الوقت ${formatTime(ms)}`); }
      if (xpMin != null && xpMax != null) {
        cfg.economy.experience = cfg.economy.experience || {};
        cfg.economy.experience[key] = { ...(cfg.economy.experience[key] || {}), xpMin: Math.min(xpMin, xpMax), xpMax: Math.max(xpMin, xpMax) };
        out.push(`الخبرة ${Math.min(xpMin, xpMax)}-${Math.max(xpMin, xpMax)}`);
      }
    });
    if (!out.length) throw new Error('حدد وقت أو خبرة');
    afterChange('تغيير وقت/خبرة'); return `✅ ${NAMES[key] || key}: ${out.join(' • ')}`;
  },
  async backupNow() { const ok = await backup.sendBackup(ctx.client, 'يدوية'); return ok ? '✅ أرسلت النسخة الاحتياطية' : '❌ ما قدرت أرسل النسخة (تأكد إن الخاص مفتوح أو البوت يشوف الروم)'; },
  async restore(url) {
    const n = backup.applyBackup(await (await fetch(url)).text()); ctx.applyStatus();
    return `✅ تم الاسترجاع: ${n} حساب والإعدادات والخلفية.`;
  },
};

// ---------------- سلاش ----------------
async function handleSlash(i) {
  if (!(await ensureAdmin(i))) return;
  if (i.commandName === 'لوحة') return i.reply({ ...(await dashboardPayload(i.guild)), flags: EPH });
  if (i.commandName !== 'ادارة') return;
  const sc = i.options.getSubcommand();
  const g = i.guild, o = i.options;
  const wait = () => i.deferReply({ flags: EPH });
  try {
    let msg;
    if (sc === 'اضافة' || sc === 'سحب') { await wait(); msg = await ops.money(g, o.getUser('المستخدم').id, o.getInteger('المبلغ'), sc === 'اضافة' ? 1 : -1); }
    else if (sc === 'تجميد' || sc === 'فك_تجميد') { await wait(); msg = await ops.freeze(g, o.getUser('المستخدم').id, sc === 'تجميد'); }
    else if (sc === 'تصفير') { await wait(); msg = await ops.resetUser(g, o.getUser('المستخدم').id); }
    else if (sc === 'تصفير_فلوس' || sc === 'تصفير_الكل') {
      await wait();
      if (o.getString('تأكيد') !== 'تأكيد') msg = '⚠️ للتنفيذ اكتب في خانة التأكيد: تأكيد';
      else msg = sc === 'تصفير_فلوس' ? await ops.resetMoney(g) : await ops.resetAll(g);
    }
    else if (sc === 'روم') { await wait(); const ch = o.getChannel('القناة') || i.channel; msg = ops.rooms(o.getString('الوضع'), [ch.id], getSettings().bankChannels); }
    else if (sc === 'بريفكس') { await wait(); msg = ops.prefix((o.getString('الرمز') || '').trim()); }
    else if (sc === 'حالة') { await wait(); msg = ops.status(o.getString('النص'), o.getString('النوع') || 'لعب', o.getString('الظهور') || 'متصل'); }
    else if (sc === 'خلفية') { await wait(); const img = o.getAttachment('صورة'); msg = await ops.background({ imageUrl: img?.url, top: o.getString('لون_اعلى'), bottom: o.getString('لون_اسفل'), reset: o.getBoolean('افتراضي') }); }
    else if (sc === 'وقت') { await wait(); msg = ops.timing(o.getString('الامر'), o.getString('المدة')); }
    else if (sc === 'خبرة') { await wait(); msg = ops.timing(o.getString('الامر'), null, o.getInteger('اقل'), o.getInteger('اعلى')); }
    else if (sc === 'نسخة') { await wait(); msg = await ops.backupNow(); }
    else if (sc === 'استرجاع') {
      await wait();
      if (!ctx.isOwner(i.user.id) && i.user.id !== backup.targetId()) msg = '❌ الاسترجاع للمالك فقط.';
      else msg = await ops.restore(o.getAttachment('ملف').url);
    }
    return i.editReply(msg);
  } catch (e) {
    console.error('dashboard slash error:', e);
    const text = `❌ ${String(e.message).slice(0, 300)}`;
    return (i.deferred || i.replied) ? i.editReply(text).catch(() => {}) : i.reply({ content: text, flags: EPH }).catch(() => {});
  }
}

// ---------------- أزرار / قوائم / نوافذ ----------------
async function handleComponent(i) {
  if (!(await ensureAdmin(i))) return;
  const id = i.customId;
  try {
    if (i.isChannelSelectMenu() && id === 'dash_rooms') {
      const msg = ops.rooms('set', i.values, []);
      await i.update(await dashboardPayload(i.guild)); return i.followUp({ content: msg, flags: EPH });
    }
    if (i.isButton()) {
      if (id === 'dash_refresh') return i.update(await dashboardPayload(i.guild));
      if (id === 'dash_roomsclear') { const m = ops.rooms('clear', [], []); await i.update(await dashboardPayload(i.guild)); return i.followUp({ content: m, flags: EPH }); }
      if (id === 'dash_backup') { await i.deferReply({ flags: EPH }); return i.editReply(await ops.backupNow()); }
      if (id === 'dash_add') return i.showModal(modal('dash_m_add', 'إضافة فلوس', input('user', 'العضو (منشن أو ID)', { ph: '123456789012345678' }), input('amount', 'المبلغ', { ph: '50000' })));
      if (id === 'dash_sub') return i.showModal(modal('dash_m_sub', 'سحب فلوس', input('user', 'العضو (منشن أو ID)'), input('amount', 'المبلغ')));
      if (id === 'dash_freeze') return i.showModal(modal('dash_m_freeze', 'تجميد حساب', input('user', 'العضو (منشن أو ID)')));
      if (id === 'dash_unfreeze') return i.showModal(modal('dash_m_unfreeze', 'فك تجميد', input('user', 'العضو (منشن أو ID)')));
      if (id === 'dash_resetu') return i.showModal(modal('dash_m_resetu', 'تصفير حساب', input('user', 'العضو (منشن أو ID)')));
      if (id === 'dash_prefix') return i.showModal(modal('dash_m_prefix', 'البريفكس', input('p', 'الرمز (اتركه فاضي = بدون بريفكس)', { required: false, max: 5, ph: '! أو .' })));
      if (id === 'dash_status') return i.showModal(modal('dash_m_status', 'حالة البوت', input('text', 'النص'), input('type', 'النوع: لعب / مشاهدة / استماع / منافسة', { required: false }), input('state', 'الظهور: متصل / غائب / مشغول / مخفي', { required: false })));
      if (id === 'dash_bg') return i.showModal(modal('dash_m_bg', 'ألوان الخلفية', input('top', 'اللون الأعلى (مثل #1b1f3b)', { required: false }), input('bottom', 'اللون الأسفل (مثل #0d1020)', { required: false }), input('mode', 'الوضع: افتراضي / صورة', { required: false, ph: 'افتراضي = رجوع للأصل، صورة = تفعيل الصورة المرفوعة' })));
      if (id === 'dash_timing') return i.showModal(modal('dash_m_timing', 'وقت وخبرة أمر', input('cmd', 'الأمر (راتب / قمار / ...)'), input('time', 'الوقت (30د / 12س / 45ث)', { required: false }), input('xmin', 'خبرة أقل', { required: false }), input('xmax', 'خبرة أعلى', { required: false })));
      if (id === 'dash_resetmoney' || id === 'dash_resetall') {
        const yes = id === 'dash_resetmoney' ? 'dash_yes_money' : 'dash_yes_all';
        return i.reply({ content: id === 'dash_resetmoney' ? '⚠️ تصفير فلوس **كل** الأعضاء؟' : '⚠️ مسح **كل** الحسابات (فلوس + مستوى + كل شي)؟', flags: EPH,
          components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(yes).setLabel('تأكيد').setStyle(ButtonStyle.Danger))] });
      }
      if (id === 'dash_yes_money' || id === 'dash_yes_all') {
        await i.deferUpdate(); const m = id === 'dash_yes_money' ? await ops.resetMoney(i.guild) : await ops.resetAll(i.guild);
        return i.editReply({ content: m, components: [] });
      }
    }
    if (i.isModalSubmit()) {
      const v = (k) => (i.fields.getTextInputValue(k) || '').trim();
      await i.deferReply({ flags: EPH });
      let msg;
      if (id === 'dash_m_add' || id === 'dash_m_sub') {
        const uid = idFrom(v('user')), amt = parseInt(v('amount').replace(/[,\s]/g, ''), 10);
        if (!uid || !(amt > 0)) throw new Error('العضو أو المبلغ غير صحيح');
        msg = await ops.money(i.guild, uid, amt, id === 'dash_m_add' ? 1 : -1);
      } else if (['dash_m_freeze', 'dash_m_unfreeze', 'dash_m_resetu'].includes(id)) {
        const uid = idFrom(v('user')); if (!uid) throw new Error('العضو غير صحيح');
        msg = id === 'dash_m_resetu' ? await ops.resetUser(i.guild, uid) : await ops.freeze(i.guild, uid, id === 'dash_m_freeze');
      } else if (id === 'dash_m_prefix') msg = ops.prefix(v('p'));
      else if (id === 'dash_m_status') msg = ops.status(v('text'), v('type') || 'لعب', v('state') || 'متصل');
      else if (id === 'dash_m_bg') {
        const mode = v('mode');
        if (mode === 'صورة') { updateSettings({ cardBackground: 'image' }); afterChange('تفعيل صورة الخلفية'); msg = '✅ فعّلت صورة الخلفية (ارفعها بـ `/ادارة خلفية`)'; }
        else msg = await ops.background({ top: v('top'), bottom: v('bottom'), reset: mode === 'افتراضي' });
      } else if (id === 'dash_m_timing') {
        const a = v('xmin'), b = v('xmax');
        msg = ops.timing(v('cmd'), v('time') || null, a ? parseInt(a, 10) : null, b ? parseInt(b, 10) : null);
      } else return;
      return i.editReply(msg);
    }
  } catch (e) {
    console.error('dashboard component error:', e);
    const text = `❌ ${String(e.message).slice(0, 300)}`;
    return (i.deferred || i.replied) ? i.editReply({ content: text }).catch(() => {}) : i.reply({ content: text, flags: EPH }).catch(() => {});
  }
}

module.exports = { ops, init, registerCommands, handleSlash, handleComponent, dashboardPayload, DEFS };
