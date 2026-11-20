// © 2026 Q3yb - Wick studio.
const { AttachmentBuilder } = require('discord.js');
const { getUser, checkCooldown, setCooldown, formatMoney, readConfig, checkLevelUpAndJob } = require('../utils/helpers');
const { createRouletteCard } = require('../utils/gameCards');
const { randomXp } = require('../utils/rewards');
const { readBet, sleep } = require('../utils/bet');

// مضاعفات العجلة (مضروبة في الرهان). المتوسط أقل من 1 = البنك يربح شوي
const MULTS = [0, 0.5, 0, 1, 0, 1.5, 0.25, 2, 0, 3];
const file = (b) => new AttachmentBuilder(b, { name: 'roulette.png' });

module.exports = {
  name: 'روليت',
  aliases: ['roulette', 'عجلة', 'عجلة_الحظ'],
  description: 'عجلة روليت فيها مبالغ وأنت وحظك (ربع / نص / كامل / مبلغ)',
  category: 'bank',
  execute: async (message, args) => {
    try {
      const config = readConfig();
      if (!config?.economy) return message.reply('❌ تعذر تحميل إعدادات البنك.');
      const user = await getUser(message.author.id, message.guild.id);
      const cd = checkCooldown(user, 'roulette');
      if (!cd.ready) return message.reply(`⏰ يجب الانتظار ${cd.remainingFormatted} للروليت مرة أخرى.`);
      const bet = readBet(args[0] || '1000', user);
      if (bet.error) return message.reply(bet.error);
      const amount = bet.amount;

      const idx = Math.floor(Math.random() * MULTS.length);
      const win = Math.round(amount * MULTS[idx]);
      const change = win - amount;

      user.balance += change;
      if (change > user.stats.highestEarned) user.stats.highestEarned = change;
      if (-change > user.stats.highestLost) user.stats.highestLost = -change;
      const xp = randomXp(config, 'roulette');
      user.experience += xp;
      const leveledUp = await checkLevelUpAndJob(user, config);
      await setCooldown(user, 'roulette');
      await user.save();

      const text = `✨ كسبت ${xp} نقطة خبرة` + (leveledUp ? `\n🎉 وصلت للمستوى ${user.level}` : '');
      const seg = (Math.PI * 2) / MULTS.length;
      const finalRot = -(idx + 0.5) * seg - Math.PI * 4;
      const start = finalRot + Math.PI * 4 + Math.random() * 2;
      const mk = (rot, done) => createRouletteCard({ discordUser: message.author, mults: MULTS, bet: amount, rotation: rot, resultIndex: done ? idx : null, change, guild: message.guild });
      let sent;
      try {
        sent = await message.reply({ files: [file(await mk(start, false))] });
        for (const f of [0.35, 0.7, 0.9]) {
          await sleep(900);
          await sent.edit({ attachments: [], files: [file(await mk(start + (finalRot - start) * f, false))] });
        }
        await sleep(900);
        await sent.edit({ content: text, attachments: [], files: [file(await mk(finalRot, true))] });
      } catch (e) {
        console.error('roulette card failed:', e.message);
        const t = `🎡 ${change >= 0 ? 'ربحت' : 'خسرت'} ${formatMoney(Math.abs(change))}\n${text}`;
        return sent ? sent.edit({ content: t, attachments: [], files: [] }).catch(() => {}) : message.reply(t);
      }
    } catch (e) {
      console.error('Error in roulette command:', e);
      await message.reply(`❌ حدث خطأ في الروليت.\n\`${String(e.message).slice(0, 150)}\``);
    }
  },
};
