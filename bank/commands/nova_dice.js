// © 2026 Q3yb - Wick studio.
const { AttachmentBuilder } = require('discord.js');
const { getUser, checkCooldown, setCooldown, formatMoney, readConfig, checkLevelUpAndJob, randomInt } = require('../utils/helpers');
const { createDiceCard } = require('../utils/gameCards');
const { randomXp } = require('../utils/rewards');
const { readBet } = require('../utils/bet');

module.exports = {
  name: 'نرد',
  aliases: ['dice'],
  description: 'نرد ضد البوت (ربع / نص / كامل / مبلغ)',
  category: 'bank',
  execute: async (message, args) => {
    try {
      const config = readConfig();
      if (!config?.economy) return message.reply('❌ تعذر تحميل إعدادات البنك.');
      const user = await getUser(message.author.id, message.guild.id);
      const cd = checkCooldown(user, 'dice');
      if (!cd.ready) return message.reply(`⏰ يجب الانتظار ${cd.remainingFormatted} للعب النرد مرة أخرى.`);
      const bet = readBet(args[0], user);
      if (bet.error) return message.reply(bet.error);
      const amount = bet.amount;

      const winRate = Number.isFinite(config.adminSettings?.winRate) ? config.adminSettings.winRate : 0.5;
      const r = Math.random();
      const result = r < 0.1 ? 'tie' : r < 0.1 + winRate * 0.9 ? 'win' : 'lose';
      let userRoll, botRoll;
      if (result === 'tie') userRoll = botRoll = randomInt(1, 6);
      else if (result === 'win') { userRoll = randomInt(2, 6); botRoll = randomInt(1, userRoll - 1); }
      else { botRoll = randomInt(2, 6); userRoll = randomInt(1, botRoll - 1); }
      const change = result === 'win' ? amount : result === 'lose' ? -amount : 0;

      user.balance += change;
      if (change > user.stats.highestEarned) user.stats.highestEarned = change;
      if (-change > user.stats.highestLost) user.stats.highestLost = -change;
      const xp = randomXp(config, 'dice');
      user.experience += xp;
      const leveledUp = await checkLevelUpAndJob(user, config);
      await setCooldown(user, 'dice');
      await user.save();

      const text = `✨ كسبت ${xp} نقطة خبرة` + (leveledUp ? `\n🎉 وصلت للمستوى ${user.level}` : '');
      try {
        const buf = await createDiceCard({ discordUser: message.author, botUser: message.client.user, userRoll, botRoll, result, amount, guild: message.guild });
        return message.reply({ content: text, files: [new AttachmentBuilder(buf, { name: 'dice.png' })] });
      } catch (e) {
        console.error('dice card failed:', e.message);
        return message.reply(`🎲 أنت ${userRoll} ضد البوت ${botRoll} — ${result === 'win' ? 'فزت' : result === 'lose' ? 'خسرت' : 'تعادل'} ${formatMoney(amount)}\n${text}`);
      }
    } catch (e) {
      console.error('Error in dice command:', e);
      await message.reply(`❌ حدث خطأ في النرد.\n\`${String(e.message).slice(0, 150)}\``);
    }
  },
};
