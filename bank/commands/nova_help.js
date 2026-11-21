// © 2026 Q3yb - Wick studio.
// قائمة أوامر NOVA STORE: تقرأ كل أوامر مجلد commands تلقائياً (بدون أوامر الإدارة) وتقسمها بأقسام
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// أوامر الإدارة ما تظهر في القائمة
const HIDDEN = new Set(['ادارة', 'اعداد', 'اوامر']);

// ترتيب الأقسام وأوامر كل قسم (اللي مو موجود فعلياً يتخطاه، واللي مو مذكور هنا يروح قسم "أخرى")
const SECTIONS = [
  ['الترفيه والحظ', ['مزاد', 'كراج', 'حراج', 'هجولة', 'أرض', 'سوق', 'نرد', 'روليت', 'حظ', 'فواكه', 'استثمار', 'قمار', 'تداول', 'بخشيش', 'شراء', 'بيع', 'تصليح', 'مخالفة']],
  ['المعلومات', ['بروفايل', 'رصيد', 'توب', 'وقت']],
  ['الرصيد والبنك', ['راتب', 'تحويل', 'قرض', 'سداد']],
  ['الحماية والسرقة', ['نهب', 'حماية']],
  ['العلاقات', ['زواج', 'طلاق', 'زواجي']],
];

function loadNames() {
  const names = new Set();
  for (const file of fs.readdirSync(__dirname).filter((f) => f.endsWith('.js'))) {
    try {
      const cmd = require(path.join(__dirname, file));
      if (!cmd || !cmd.name || cmd.category === 'admin' || HIDDEN.has(cmd.name)) continue;
      names.add(cmd.name);
    } catch (e) { console.error('help: skip', file, e.message); }
  }
  return names;
}

module.exports = {
  name: 'اوامر',
  aliases: ['مساعدة', 'help', 'الاوامر', 'أوامر'],
  description: 'قائمة أوامر البنك',
  category: 'bank',
  execute: async (message) => {
    const names = loadNames();
    const used = new Set();
    const blocks = [];
    for (const [title, list] of SECTIONS) {
      const present = list.filter((n) => names.has(n));
      present.forEach((n) => used.add(n));
      if (present.length) blocks.push(`**${title}**\n${present.join('\n')}`);
    }
    const rest = [...names].filter((n) => !used.has(n));
    if (rest.length) blocks.push(`**أخرى**\n${rest.join('\n')}`);

    const embed = new EmbedBuilder()
      .setColor('#7c5cdb')
      .setTitle('Bank Commands')
      .setDescription(blocks.join('\n\n'))
      .setTimestamp();

    const payload = { embeds: [embed] };
    const url = process.env.SUPPORT_URL;
    if (url && /^https?:\/\//.test(url)) {
      payload.components = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('الدعم الفني').setStyle(ButtonStyle.Link).setURL(url))];
    }
    return message.reply(payload);
  },
};
