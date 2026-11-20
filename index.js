// © 2026 Q3yb - Wick studio.
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Render يحتاج بورت مفتوح
let webServer = null;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// الموقع يفتح فوراً (Render يحتاج بورت مفتوح)
try { webServer = require('./bank/admin/web').start(client, () => applyStatus()); } catch (e) { console.error('web:', e); require('http').createServer((_, r) => r.end('ok')).listen(process.env.PORT || 3000); }

let handleBankCommand = async () => false;
let handleBankInteraction = async () => {};
let BankUser = null;

try {
  const bankSystem = require('./bank/index.js');
  if (typeof bankSystem.handleBankCommand === 'function') handleBankCommand = bankSystem.handleBankCommand;
  if (typeof bankSystem.handleBankInteraction === 'function') handleBankInteraction = bankSystem.handleBankInteraction;
  if (bankSystem.bankCommands) client.bankCommands = bankSystem.bankCommands;
  BankUser = require('./bank/models/BankUser');
  console.log('✅ Bank system loaded successfully');
} catch (error) {
  console.error('❌ Failed to load Bank System:', error);
}

const readAdminSettings = () => {
  try {
    const filePath = path.join(__dirname, 'admin_settings.json');
    if (!fs.existsSync(filePath)) return { adminRoles: [], eventRoles: [] };
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return { adminRoles: [], eventRoles: [] }; }
};
const hasAdminPermission = (member) => {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const s = readAdminSettings();
  if (!s.adminRoles) return false;
  return member.roles.cache.some((r) => s.adminRoles.map(String).includes(r.id));
};
const hasEventPermission = (member) => {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const s = readAdminSettings();
  if (!s.eventRoles) return false;
  return member.roles.cache.some((r) => s.eventRoles.map(String).includes(r.id));
};

// ================= النسخ الاحتياطي + لوحة التحكم =================
const OWNER_ID = process.env.OWNER_ID;
let backup = null, dashboard = null, settingsUtil = null;
try {
  backup = require('./bank/utils/backup');
  dashboard = require('./bank/admin/dashboard');
  settingsUtil = require('./bank/utils/settings');
} catch (e) { console.error('❌ Failed to load dashboard/backup:', e); }

const isOwner = (id) => !!OWNER_ID && id === OWNER_ID;
const isAdminMember = (member) => !!member && (hasAdminPermission(member) || isOwner(member.id));

// حالة البوت من الإعدادات
function applyStatus() {
  const st = settingsUtil?.getSettings().status;
  try {
    if (st?.text) client.user.setPresence({ status: st.state || 'online', activities: [{ name: st.text, type: st.type ?? 0 }] });
    else client.user.setPresence({ status: 'online', activities: [{ name: 'Wick Studio', type: 0 }] });
  } catch (e) { console.error('status:', e.message); }
}

client.on('clientReady', async () => {
  console.log(`${client.user.username} is Online`);
  if (dashboard) {
    dashboard.init({ client, isAdmin: isAdminMember, isOwner, applyStatus });
    dashboard.registerCommands(client).catch((e) => console.error('slash register:', e.message));
  }
  applyStatus();
  if (backup && BankUser) {
    await backup.autoRestore(client);
    applyStatus();
    BankUser.__setOnChange(() => backup.onDataChange(client));
    const hours = Number(process.env.AUTO_BACKUP_HOURS ?? 6);
    if (hours > 0) setInterval(() => backup.sendBackup(client, 'تلقائية').catch((e) => console.error('auto backup:', e.message)), hours * 3600000);
  }
});
client.on('guildCreate', () => { if (dashboard) dashboard.registerCommands(client).catch(() => {}); });

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // البريفكس (فاضي = بدون)
  const prefix = settingsUtil?.getSettings().prefix || '';
  let content = message.content.trim();
  if (prefix) { if (!content.startsWith(prefix)) return; content = content.slice(prefix.length).trim(); }
  const parts = content.split(/ +/);
  const commandName = parts.shift()?.toLowerCase();
  const args = parts;
  if (!commandName) return;

  // ---- لوحة التحكم (نص): لوحة ----
  if (dashboard && ['لوحة', 'dashboard', 'داشبورد'].includes(commandName)) {
    if (!isAdminMember(message.member)) return message.reply('❌ للإدارة فقط.');
    try { return await message.reply(await dashboard.dashboardPayload(message.guild)); }
    catch (e) { console.error(e); return message.reply(`❌ ${e.message}`); }
  }

  // ---- أوامر المالك: نسخة / استرجاع ----
  if (backup && BankUser && ['!backup', 'backup', 'نسخة'].includes(commandName)) {
    if (!isOwner(message.author.id)) return message.reply('❌ للمالك فقط.');
    const ok = await backup.sendBackup(client, 'يدوية');
    return message.reply(ok ? '✅ أرسلت النسخة.' : '❌ ما قدرت أرسل النسخة (تأكد إن الخاص مفتوح أو البوت يشوف الروم).');
  }
  if (backup && BankUser && ['!restore', 'restore', 'استرجاع'].includes(commandName)) {
    if (!isOwner(message.author.id)) return message.reply('❌ للمالك فقط.');
    const att = message.attachments.first();
    if (!att) return message.reply('❌ أرفق ملف النسخة مع الأمر.');
    try {
      const n = backup.applyBackup(await (await fetch(att.url)).text());
      applyStatus();
      return message.reply(`✅ تم الاسترجاع: ${n} حساب مع الإعدادات والخلفية.`);
    } catch (e) { return message.reply(`❌ فشل الاسترجاع: ${e.message}`); }
  }

  if (typeof handleBankCommand === 'function') {
    try { await handleBankCommand(message, commandName, args); }
    catch (error) { console.error('[Bank Command Error]:', error); }
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (dashboard && interaction.isChatInputCommand()) return await dashboard.handleSlash(interaction);
    if (dashboard && interaction.customId?.startsWith('dash_')) return await dashboard.handleComponent(interaction);
    if (typeof handleBankInteraction === 'function') await handleBankInteraction(interaction);
  } catch (error) { console.error('[Interaction Error]:', error); }
});

client.login(process.env.TOKEN).then(() => console.log('✅ Bot logged in successfully'))
  .catch((e) => console.error('❌ Startup error:', e));

module.exports = { client, hasAdminPermission, hasEventPermission, readAdminSettings };
