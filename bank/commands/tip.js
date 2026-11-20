// © 2026 Q3yb - Wick studio.
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getUser, checkCooldown, setCooldown, formatMoney, checkLevelUpAndJob, readConfig, randomInt } = require('../utils/helpers');
const { createRewardCard } = require('../utils/rewardCard');
const { randomXp, jobSalary } = require('../utils/rewards');

module.exports = {
  name: 'بخشيش',
  aliases: ['tip'],
  description: 'بخشيش عشوائي حسب وظيفتك',
  category: 'bank',
  execute: async (message) => {
    try {
      const config = readConfig();
      if (!config || !config.economy) return message.reply('❌ تعذر تحميل إعدادات البنك.');
      const user = await getUser(message.author.id, message.guild.id);
      const cd = checkCooldown(user, 'tip');
      if (!cd.ready) return message.reply(`⏰ يجب الانتظار ${cd.remainingFormatted} لأخذ بخشيش مرة أخرى.`);

      // نفس الراتب لكن السعر يختلف: من 20% إلى 80% من راتب وظيفتك
      const base = jobSalary(config, user.job);
      const fixed = config.economy.rewards?.tip; // من أمر ادارة فلوس بخشيش
      const tip = fixed && Number.isFinite(fixed.min) && Number.isFinite(fixed.max)
        ? randomInt(Math.min(fixed.min, fixed.max), Math.max(fixed.min, fixed.max))
        : Math.max(100, Math.round(randomInt(Math.floor(base * 0.2), Math.floor(base * 0.8)) / 10) * 10);
      const xp = randomXp(config, 'tip');
      user.balance += tip;
      if (tip > user.stats.highestEarned) user.stats.highestEarned = tip;
      user.experience += xp;
      const leveledUp = await checkLevelUpAndJob(user, config);
      await setCooldown(user, 'tip');
      await user.save();

      const text = `✨ كسبت ${xp} نقطة خبرة` + (leveledUp ? `\n🎉 وصلت للمستوى ${user.level} ووظيفتك الجديدة **${user.job}**` : '');
      try {
        const buf = await createRewardCard({
          user, discordUser: message.author, guildOrId: message.guild,
          amountText: `+${formatMoney(tip)}`,
          subtitle: 'حصلت على بخشيش!',
          footer: `رصيدك الآن ${formatMoney(user.balance)}`,
        });
        return message.reply({ content: text, files: [new AttachmentBuilder(buf, { name: 'tip.png' })] });
      } catch (e) {
        console.error('tip card failed:', e.message);
        const embed = new EmbedBuilder().setColor('#00FF00').setTitle('💵 بخشيش')
          .setDescription(`حصلت على بخشيش بقيمة ${formatMoney(tip)}!\n${text}`)
          .addFields({ name: 'رصيدك الجديد', value: formatMoney(user.balance) });
        return message.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error in tip command:', error);
      await message.reply(`❌ حدث خطأ أثناء البخشيش.\n\`${String(error.message).slice(0, 150)}\``);
    }
  },
};
