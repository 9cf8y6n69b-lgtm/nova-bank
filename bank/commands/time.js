// © 2026 Q3yb - Wick studio.
const { EmbedBuilder } = require('discord.js');
const { getUser, checkCooldown, formatTime, readConfig } = require('../utils/helpers');

const NAMES = {
  salary: 'راتب', tip: 'بخشيش', luck: 'حظ', dice: 'نرد', fruits: 'فواكه', gamble: 'قمار',
  trade: 'تداول', rob: 'نهب / سرقة', loan: 'قرض', invest: 'استثمار', roulette: 'روليت',
};

module.exports = {
  name: 'وقت',
  aliases: ['اوقات', 'cooldowns', 'time'],
  description: 'يعرض أوامر البنك وأوقات الانتظار لكل أمر',
  category: 'bank',

  execute: async (message) => {
    try {
      const config = readConfig();
      const cds = config?.cooldowns || {};
      const user = await getUser(message.author.id, message.guild.id);
      const keys = Object.keys(cds);
      if (!keys.length) return message.reply('ℹ️ ما فيه أوقات انتظار محددة في الإعدادات.');

      const lines = keys.map((k) => {
        const c = checkCooldown(user, k);
        const status = c.ready ? '✅ جاهز' : `⏳ ${c.remainingFormatted}`;
        return `**${NAMES[k] || k}** — الانتظار: ${formatTime(cds[k])} — ${status}`;
      });
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('⏱️ أوقات الأوامر')
        .setDescription(lines.join('\n'))
        .setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Error in time command:', e);
      await message.reply(`❌ حدث خطأ.\n\`${String(e.message).slice(0, 150)}\``);
    }
  },
};
