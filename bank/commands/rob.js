// © 2026 Q3yb - Wick studio.
const { AttachmentBuilder } = require('discord.js');
const { getUser, checkCooldown, setCooldown, formatMoney, formatTime, readConfig, randomInt, checkLevelUpAndJob } = require('../utils/helpers');
const { createRewardCard } = require('../utils/rewardCard');
const { randomXp } = require('../utils/rewards');

const MIN_VICTIM_BALANCE = 50000;

function protectionLeft(user) {
  const p = user.protection;
  if (!p?.active || !p.expiresAt) return 0;
  const left = new Date(p.expiresAt).getTime() - Date.now();
  return left > 0 ? left : 0;
}

module.exports = {
  name: 'نهب',
  aliases: ['سرقة', 'سرقه', 'rob', 'steal'],
  description: 'سرقة فلوس عضو (له شروط: حماية، روم صوتي، رصيد)',
  category: 'bank',

  execute: async (message, args) => {
    try {
      const config = readConfig();
      if (!config || !config.economy) return message.reply('❌ تعذر تحميل إعدادات البنك.');
      const admin = config.adminSettings || {};

      let target = message.mentions.users.first();
      if (!target && args[0]) target = await message.client.users.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null);
      if (!target) return message.reply('❌ الاستخدام: `نهب @الشخص`');
      if (target.bot) return message.reply('❌ ما تقدر تسرق بوت!');
      if (target.id === message.author.id) return message.reply('❌ ما تقدر تسرق نفسك!');

      const thief = await getUser(message.author.id, message.guild.id);
      const cd = checkCooldown(thief, 'rob');
      if (!cd.ready) return message.reply(`⏰ يجب الانتظار ${cd.remainingFormatted} للسرقة مرة أخرى.`);

      // الضحية في روم صوتي
      if (admin.voiceProtectionEnabled !== false) {
        const member = message.guild.members.cache.get(target.id) || await message.guild.members.fetch(target.id).catch(() => null);
        if (member?.voice?.channelId) return message.reply('🔊 الشخص بروم صوتي، ما يمديك تسرق!');
      }

      const victim = await getUser(target.id, message.guild.id);
      const left = protectionLeft(victim);
      if (left) return message.reply(`🛡️ الشخص عنده حماية — ومدة الحماية (${formatTime(left)})`);
      if (victim.balance < MIN_VICTIM_BALANCE) return message.reply('💸 المستخدم فلوسه قليلة!');

      // تنبيه الضحية في الخاص
      try {
        await target.send(`فيه شخص بيسرقك الحققق على فلوسك يبعد حيي\n-# لاتعلم احد اني علمتك 👀!\n<#${message.channel.id}>`);
      } catch {}

      const rate = Number.isFinite(admin.robSuccessRate) ? admin.robSuccessRate : 0.4;
      const success = Math.random() < rate;
      let amount, amountText, subtitle, color;

      if (success) {
        amount = Math.max(1, Math.floor(victim.balance * randomInt(8, 25) / 100));
        victim.balance -= amount;
        thief.balance += amount;
        thief.stats.totalStolen += amount;
        if (amount > (thief.stats.highestStolen || 0)) thief.stats.highestStolen = amount;
        if (amount > thief.stats.highestEarned) thief.stats.highestEarned = amount;
        victim.stats.totalRobbed += amount;
        if (amount > victim.stats.highestLost) victim.stats.highestLost = amount;
        amountText = `+${formatMoney(amount)}`; subtitle = `سرقت ${target.username} بنجاح`; color = undefined;
        await victim.save();
      } else {
        amount = Math.floor(thief.balance * 0.1);
        thief.balance -= amount;
        if (amount > thief.stats.highestLost) thief.stats.highestLost = amount;
        amountText = `-${formatMoney(amount)}`; subtitle = 'فشلت السرقة وتم تغريمك'; color = '#FF5C5C';
      }

      const xp = randomXp(config, 'rob');
      thief.experience += xp;
      const leveledUp = await checkLevelUpAndJob(thief, config);
      await setCooldown(thief, 'rob');
      await thief.save();

      const text = `✨ كسبت ${xp} نقطة خبرة` + (leveledUp ? `\n🎉 وصلت للمستوى ${thief.level}` : '');
      try {
        const buf = await createRewardCard({
          user: thief, discordUser: message.author, guildOrId: message.guild,
          amountText, amountColor: color, subtitle, footer: `رصيدك الآن ${formatMoney(thief.balance)}`,
        });
        return message.reply({ content: text, files: [new AttachmentBuilder(buf, { name: 'rob.png' })] });
      } catch {
        return message.reply(`${subtitle}: ${amountText}\n${text}`);
      }
    } catch (e) {
      console.error('Error in rob command:', e);
      await message.reply(`❌ حدث خطأ في السرقة.\n\`${String(e.message).slice(0, 150)}\``);
    }
  },
};
