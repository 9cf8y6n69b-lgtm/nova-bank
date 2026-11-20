// © 2026 Q3yb - Wick studio.
const { AttachmentBuilder } = require('discord.js');
const { getUser, formatMoney, formatTime } = require('../utils/helpers');
const { createRewardCard } = require('../utils/rewardCard');

const PRICE_PER_HOUR = 1000000;
const MAX_HOURS = 6;
const HOUR = 3600000;

function protectionLeft(user) {
  const p = user.protection;
  if (!p?.active || !p.expiresAt) return 0;
  const left = new Date(p.expiresAt).getTime() - Date.now();
  return left > 0 ? left : 0;
}

module.exports = {
  name: 'حماية',
  aliases: ['protect', 'حمايه'],
  description: 'حماية من السرقة: مليون للساعة، وأعلى حد 6 ساعات',
  category: 'bank',
  protectionLeft,

  execute: async (message, args) => {
    try {
      const user = await getUser(message.author.id, message.guild.id);
      const left = protectionLeft(user);
      const hours = parseInt(String(args[0] || '').replace(/[^\d]/g, ''), 10);

      if (!hours) {
        return message.reply(
          `🛡️ **الحماية من السرقة**\nالسعر: ${formatMoney(PRICE_PER_HOUR)} لكل ساعة (أعلى حد ${MAX_HOURS} ساعات)\n` +
          (left ? `حمايتك الحالية: **${formatTime(left)}** متبقية` : 'ما عندك حماية حالياً') +
          '\nالاستخدام: `حماية <عدد الساعات>`'
        );
      }
      if (hours < 1 || hours > MAX_HOURS) return message.reply(`❌ عدد الساعات من 1 إلى ${MAX_HOURS}.`);
      if (left + hours * HOUR > MAX_HOURS * HOUR + 1000) {
        return message.reply(`❌ أعلى حد للحماية ${MAX_HOURS} ساعات، وعندك متبقي ${formatTime(left)}.`);
      }
      const cost = hours * PRICE_PER_HOUR;
      if (user.balance < cost) return message.reply(`❌ رصيدك ما يكفي! تحتاج ${formatMoney(cost)}`);

      user.balance -= cost;
      user.protection.active = true;
      user.protection.expiresAt = new Date(Date.now() + left + hours * HOUR);
      await user.save();

      try {
        const buf = await createRewardCard({
          user, discordUser: message.author, guildOrId: message.guild,
          amountText: `-${formatMoney(cost)}`, amountColor: '#FF5C5C',
          subtitle: `🛡️ تم تفعيل الحماية لمدة ${hours} ساعة`,
          footer: `المتبقي ${formatTime(left + hours * HOUR)}`,
        });
        return message.reply({ files: [new AttachmentBuilder(buf, { name: 'protect.png' })] });
      } catch {
        return message.reply(`🛡️ تم تفعيل الحماية لمدة ${hours} ساعة بمبلغ ${formatMoney(cost)}.`);
      }
    } catch (e) {
      console.error('Error in protect command:', e);
      await message.reply(`❌ حدث خطأ في الحماية.\n\`${String(e.message).slice(0, 150)}\``);
    }
  },
};
