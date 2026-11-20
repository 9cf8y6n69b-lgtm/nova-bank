// © 2026 Q3yb - Wick studio.
const { AttachmentBuilder } = require('discord.js');
const { getUser, checkCooldown, setCooldown, parseAmount, formatMoney, readConfig, checkLevelUpAndJob } = require('../utils/helpers');
const { createTradeGif } = require('../utils/tradeGif');
const { randomXp } = require('../utils/rewards');

const MIN_TRADE = 1000;
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

module.exports = {
  name: 'تداول',
  aliases: ['trade', 'اسهم'],
  description: 'تداول الأسهم (ربع / نص / كامل / مبلغ) وشوف الشارت يتحرك',
  category: 'bank',

  execute: async (message, args) => {
    try {
      const config = readConfig();
      if (!config || !config.economy) return message.reply('❌ تعذر تحميل إعدادات البنك.');
      if (!args[0]) return message.reply('❌ الاستخدام: `تداول <ربع | نص | كامل | المبلغ>`');
      const user = await getUser(message.author.id, message.guild.id);
      const cd = checkCooldown(user, 'trade');
      if (!cd.ready) return message.reply(`⏰ يجب الانتظار ${cd.remainingFormatted} للتداول مرة أخرى.`);

      const amount = parseAmount(args[0], user.balance);
      if (!amount || amount <= 0) return message.reply('❌ المبلغ غير صالح!');
      if (amount < MIN_TRADE) return message.reply(`❌ الحد الأدنى للتداول ${formatMoney(MIN_TRADE)}`);
      if (amount > user.balance) return message.reply(`❌ رصيدك ما يكفي! رصيدك: ${formatMoney(user.balance)}`);

      const winRate = Number.isFinite(config.adminSettings?.winRate) ? config.adminSettings.winRate : 0.5;
      const up = Math.random() < winRate;
      const pct = up ? rand(8, 75) : rand(8, 65);
      const change = Math.round(amount * pct / 100) * (up ? 1 : -1);

      user.balance += change;
      if (up && change > user.stats.highestEarned) user.stats.highestEarned = change;
      if (!up && -change > user.stats.highestLost) user.stats.highestLost = -change;
      const xp = randomXp(config, 'trade');
      user.experience += xp;
      const leveledUp = await checkLevelUpAndJob(user, config);
      await setCooldown(user, 'trade');
      await user.save();

      let gif = null;
      try { gif = await createTradeGif({ discordUser: message.author, up, pct, amount, change }); }
      catch (e) { console.error('trade gif failed:', e); }

      const text = `${up ? '📈 صفقة رابحة' : '📉 صفقة خاسرة'}: **${change >= 0 ? '+' : '-'}${formatMoney(Math.abs(change))}** — رصيدك ${formatMoney(user.balance)}\n✨ كسبت ${xp} نقطة خبرة` + (leveledUp ? `\n🎉 وصلت للمستوى ${user.level}` : '');
      return message.reply(gif ? { content: text, files: [new AttachmentBuilder(gif, { name: 'trade.gif' })] } : text);
    } catch (e) {
      console.error('Error in trade command:', e);
      await message.reply(`❌ حدث خطأ في التداول.\n\`${String(e.message).slice(0, 150)}\``);
    }
  },
};
