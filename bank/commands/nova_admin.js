// © 2026 Q3yb - Wick studio.
// أوامر الإدارة: أوقات، خبرة، فلوس، نسب، إضافة/خصم/تصفير
const fs = require('fs');
const path = require('path');
const { PermissionFlagsBits } = require('discord.js');
const BankUser = require('../models/BankUser');
const { getUser, formatMoney, formatTime, readConfig } = require('../utils/helpers');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'bank-config.json');
const KEYS = { راتب: 'salary', بخشيش: 'tip', حظ: 'luck', قمار: 'gamble', نرد: 'dice', تظهر: 'fruits', فواكه: 'fruits', تداول: 'trade', نهب: 'rob', سرقة: 'rob', روليت: 'roulette', قرض: 'loan', استثمار: 'invest' };
const NAMES = { salary: 'راتب', tip: 'بخشيش', luck: 'حظ', gamble: 'قمار', dice: 'نرد', fruits: 'تظهر', trade: 'تداول', rob: 'نهب', roulette: 'روليت', loan: 'قرض', invest: 'استثمار' };

function save(cfg) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); }
function parseDuration(s) {
  const m = String(s || '').match(/^(\d+(?:\.\d+)?)\s*(ث|ثانية|s|د|دقيقة|m|س|ساعة|h)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = (m[2] || 'ث').toLowerCase();
  const mult = ['د', 'دقيقة', 'm'].includes(u) ? 60000 : ['س', 'ساعة', 'h'].includes(u) ? 3600000 : 1000;
  return Math.round(n * mult);
}
const num = (v) => { const n = parseInt(String(v || '').replace(/[,\s]/g, ''), 10); return Number.isFinite(n) ? n : null; };
const HELP = [
  '🛠️ **أوامر الإدارة** (`ادارة ...`)',
  '`ادارة عرض` — يعرض كل الإعدادات الحالية',
  '`ادارة وقت <الأمر> <المدة>` — مثال: `ادارة وقت راتب 12س` أو `30د` أو `45ث`',
  '`ادارة خبرة <الأمر> <أقل> <أعلى>` — الخبرة العشوائية لكل لعبة',
  '`ادارة راتب <الوظيفة> <المبلغ>` — راتب وظيفة معينة',
  '`ادارة فلوس بخشيش <أقل> <أعلى>` — مبلغ البخشيش',
  '`ادارة نسبة فوز <0-100>` — نسبة الفوز في الألعاب والتداول',
  '`ادارة نسبة سرقة <0-100>` — نسبة نجاح النهب',
  '`ادارة اضافة @شخص <مبلغ>` / `ادارة خصم @شخص <مبلغ>`',
  '`ادارة تصفير @شخص` — يصفّر حساب شخص',
  '`ادارة تصفير_الكل تأكيد` — يصفّر كل الحسابات',
].join('\n');

module.exports = {
  name: 'ادارة',
  aliases: ['إدارة', 'admin_bank', 'ضبط'],
  description: 'أوامر إدارة البنك (للإدارة فقط)',
  category: 'admin',
  execute: async (message, args) => {
    try {
      const isOwner = process.env.OWNER_ID && message.author.id === process.env.OWNER_ID;
      if (!isOwner && !message.member?.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ للإدارة فقط.');
      const sub = args[0];
      if (!sub) return message.reply(HELP);
      const cfg = readConfig();
      if (!cfg) return message.reply('❌ تعذر قراءة ملف الإعدادات.');
      cfg.cooldowns = cfg.cooldowns || {}; cfg.economy = cfg.economy || {}; cfg.adminSettings = cfg.adminSettings || {};
      const guildId = message.guild.id;

      if (sub === 'عرض') {
        const cds = Object.entries(cfg.cooldowns).map(([k, v]) => `${NAMES[k] || k}: ${formatTime(v)}`).join(' | ') || '—';
        const xp = Object.entries(cfg.economy.experience || {}).map(([k, v]) => `${NAMES[k] || k}: ${v.xpMin ?? '?'}-${v.xpMax ?? v.xpAward ?? '?'}`).join(' | ') || '—';
        const jobs = Object.entries(cfg.economy.jobs || {}).map(([k, v]) => `${k}: ${formatMoney(v.salary || 0)}`).join(' | ') || '—';
        const tip = cfg.economy.rewards?.tip;
        return message.reply(
          `⏱️ **الأوقات**\n${cds}\n\n✨ **الخبرة**\n${xp}\n\n💼 **الرواتب**\n${jobs}\n\n🎁 **البخشيش**: ${tip ? `${formatMoney(tip.min)} - ${formatMoney(tip.max)}` : 'حسب الوظيفة'}\n🎯 **نسبة الفوز**: ${Math.round((cfg.adminSettings.winRate ?? 0.5) * 100)}% | 🦹 **نسبة السرقة**: ${Math.round((cfg.adminSettings.robSuccessRate ?? 0.4) * 100)}%`
        );
      }
      if (sub === 'وقت') {
        const key = KEYS[args[1]] || args[1];
        const ms = parseDuration(args[2]);
        if (!args[1] || ms === null) return message.reply('❌ مثال: `ادارة وقت راتب 12س`');
        cfg.cooldowns[key] = ms; save(cfg);
        return message.reply(`✅ وقت **${NAMES[key] || key}** صار ${formatTime(ms)}`);
      }
      if (sub === 'خبرة') {
        const key = KEYS[args[1]] || args[1]; const a = num(args[2]); const b = num(args[3]);
        if (!args[1] || a === null || b === null) return message.reply('❌ مثال: `ادارة خبرة قمار 10 60`');
        cfg.economy.experience = cfg.economy.experience || {};
        cfg.economy.experience[key] = { ...(cfg.economy.experience[key] || {}), xpMin: Math.min(a, b), xpMax: Math.max(a, b) }; save(cfg);
        return message.reply(`✅ خبرة **${NAMES[key] || key}** صارت من ${Math.min(a, b)} إلى ${Math.max(a, b)} (عشوائي كل مرة)`);
      }
      if (sub === 'راتب') {
        const job = args[1]; const v = num(args[2]);
        if (!job || v === null) return message.reply('❌ مثال: `ادارة راتب عاطل 5000`');
        if (!cfg.economy.jobs?.[job]) return message.reply(`❌ وظيفة غير موجودة. الموجود: ${Object.keys(cfg.economy.jobs || {}).join(' ، ')}`);
        cfg.economy.jobs[job].salary = v; save(cfg);
        return message.reply(`✅ راتب **${job}** صار ${formatMoney(v)}`);
      }
      if (sub === 'فلوس') {
        const what = args[1]; const a = num(args[2]); const b = num(args[3]);
        if (what !== 'بخشيش' || a === null || b === null) return message.reply('❌ مثال: `ادارة فلوس بخشيش 500 3000`');
        cfg.economy.rewards = cfg.economy.rewards || {};
        cfg.economy.rewards.tip = { min: Math.min(a, b), max: Math.max(a, b) }; save(cfg);
        return message.reply(`✅ البخشيش صار من ${formatMoney(Math.min(a, b))} إلى ${formatMoney(Math.max(a, b))}`);
      }
      if (sub === 'نسبة') {
        const v = num(args[2]);
        if (v === null || v < 0 || v > 100 || !['فوز', 'سرقة'].includes(args[1])) return message.reply('❌ مثال: `ادارة نسبة فوز 45`');
        if (args[1] === 'فوز') cfg.adminSettings.winRate = v / 100; else cfg.adminSettings.robSuccessRate = v / 100;
        save(cfg);
        return message.reply(`✅ نسبة ${args[1]} صارت ${v}%`);
      }
      if (sub === 'اضافة' || sub === 'خصم') {
        const target = message.mentions.users.first();
        const v = num(args.filter((a) => !/^<@!?\d+>$/.test(a))[1]);
        if (!target || !v || v <= 0) return message.reply(`❌ مثال: \`ادارة ${sub} @الشخص 10000\``);
        const u = await getUser(target.id, guildId);
        u.balance = sub === 'اضافة' ? u.balance + v : Math.max(0, u.balance - v);
        await u.save();
        return message.reply(`✅ ${sub === 'اضافة' ? 'أضفت' : 'خصمت'} ${formatMoney(v)} — رصيد ${target.username} الآن ${formatMoney(u.balance)}`);
      }
      if (sub === 'تصفير') {
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ مثال: `ادارة تصفير @الشخص`');
        await BankUser.deleteOne({ userId: target.id, guildId });
        return message.reply(`✅ تم تصفير حساب ${target.username}`);
      }
      if (sub === 'تصفير_الكل') {
        if (args[1] !== 'تأكيد' && args[1] !== 'تاكيد') return message.reply('⚠️ هذا يمسح **كل** الحسابات! اكتب: `ادارة تصفير_الكل تأكيد`');
        const n = await BankUser.countDocuments({ guildId });
        await BankUser.deleteMany({ guildId });
        return message.reply(`✅ تم تصفير ${n} حساب.`);
      }
      return message.reply(HELP);
    } catch (e) {
      console.error('Error in admin command:', e);
      await message.reply(`❌ حدث خطأ.\n\`${String(e.message).slice(0, 150)}\``);
    }
  },
};
