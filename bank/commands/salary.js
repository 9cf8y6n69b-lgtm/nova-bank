// © 2026 Q3yb - Wick studio.
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getUser, checkCooldown, setCooldown, formatMoney, checkLevelUpAndJob, readConfig } = require('../utils/helpers');
const { createRewardCard } = require('../utils/rewardCard');
const { randomXp, jobSalary } = require('../utils/rewards');

module.exports = {
  name: 'راتب',
  aliases: ['salary', 'wage'],
  description: 'استلام الراتب حسب وظيفتك',
  category: 'bank',
  execute: async (message) => {
    try {
      const config = readConfig();
      if (!config || !config.economy) return message.reply('❌ تعذر تحميل إعدادات البنك.');
      const user = await getUser(message.author.id, message.guild.id);
      const cd = checkCooldown(user, 'salary');
      if (!cd.ready) return message.reply(`⏰ يجب الانتظار ${cd.remainingFormatted} لأخذ الراتب مرة أخرى.`);

      const salary = jobSalary(config, user.job);
      const xp = randomXp(config, 'salary');
      user.balance += salary;
      if (salary > user.stats.highestEarned) user.stats.highestEarned = salary;
      user.experience += xp;
      const leveledUp = await checkLevelUpAndJob(user, config);
      await setCooldown(user, 'salary');
      await user.save();

      const text = `✨ كسبت ${xp} نقطة خبرة` + (leveledUp ? `\n🎉 وصلت للمستوى ${user.level} ووظيفتك الجديدة **${user.job}**` : '');
      try {
        const buf = await createRewardCard({
          user, discordUser: message.author, guildOrId: message.guild,
          amountText: `+${formatMoney(salary)}`,
          subtitle: `تم إيداع الراتب ، الوظيفة (${user.job})`,
          footer: `رصيدك الآن ${formatMoney(user.balance)}`,
        });
        return message.reply({ content: text, files: [new AttachmentBuilder(buf, { name: 'salary.png' })] });
      } catch (e) {
        console.error('salary card failed:', e.message);
        const embed = new EmbedBuilder().setColor('#00FF00').setTitle('💰 راتب')
          .setDescription(`تم إيداع الراتب ، الوظيفة (${user.job})\n${formatMoney(salary)}\n${text}`)
          .addFields({ name: 'رصيدك الجديد', value: formatMoney(user.balance) });
        return message.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error in salary command:', error);
      await message.reply(`❌ حدث خطأ أثناء محاولة أخذ الراتب.\n\`${String(error.message).slice(0, 150)}\``);
    }
  },
};
