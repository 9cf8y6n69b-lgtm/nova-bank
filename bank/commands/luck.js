// © 2026 Q3yb - Wick studio.
const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getUser, checkCooldown, setCooldown, formatMoney, checkLevelUpAndJob, readConfig, randomInt, weightedRandom } = require('../utils/helpers');
const { createRewardCard } = require('../utils/rewardCard');
const { randomXp } = require('../utils/rewards');
const CONFIG = require('../utils/canvas-config');

module.exports = {
  name: 'حظ',
  aliases: ['luck'],
  description: 'جرّب حظك: موارد متنوعة أو فلوس',
  category: 'bank',
  execute: async (message) => {
    try {
      const config = readConfig();
      if (!config || !config.economy) return message.reply('❌ تعذر تحميل إعدادات البنك.');
      const user = await getUser(message.author.id, message.guild.id);
      const cd = checkCooldown(user, 'luck');
      if (!cd.ready) return message.reply(`⏰ يجب الانتظار ${cd.remainingFormatted} لتجربة حظك مرة أخرى.`);

      const mats = config.material_definitions || {};
      const matIds = Object.keys(mats);
      // أنواع الجوائز وأوزانها (انت وحظك)
      const { item: prize } = weightedRandom([
        { kind: 'money', tier: 'small', weight: 38 },
        { kind: 'money', tier: 'big', weight: 8 },
        { kind: 'money', tier: 'jackpot', weight: 1.5 },
        ...(matIds.length ? [{ kind: 'material', weight: 45 }] : []),
        { kind: 'nothing', weight: 7.5 },
      ]);

      let amountText, subtitle, amountColor, iconPath = null;
      const gains = {};
      if (prize.kind === 'money') {
        const range = { small: [500, 5000], big: [10000, 40000], jackpot: [100000, 300000] }[prize.tier];
        const money = randomInt(range[0], range[1]);
        user.balance += money; gains.money = money;
        if (money > user.stats.highestEarned) user.stats.highestEarned = money;
        amountText = `+${formatMoney(money)}`;
        subtitle = prize.tier === 'jackpot' ? '🎰 جاكبوت! حظك نار' : 'حظك طلع لك فلوس';
      } else if (prize.kind === 'material') {
        const id = matIds[randomInt(0, matIds.length - 1)];
        const amount = randomInt(5, 60);
        user.materials[id] = (user.materials[id] || 0) + amount;
        const name = mats[id].name || id;
        amountText = `${amount} ${name}`;
        subtitle = `حظك طلع لك ${name}`;
        amountColor = '#FFD166';
        const rel = CONFIG.images.materials?.[id];
        if (rel) iconPath = path.join(__dirname, '../utils', rel);
      } else {
        amountText = 'ولا شي';
        subtitle = 'للأسف حظك سيء هالمرة';
        amountColor = '#FF5C5C';
      }

      const xp = randomXp(config, 'luck');
      user.experience += xp;
      const leveledUp = await checkLevelUpAndJob(user, config);
      await setCooldown(user, 'luck');
      await user.save();

      const text = `✨ كسبت ${xp} نقطة خبرة` + (leveledUp ? `\n🎉 وصلت للمستوى ${user.level} ووظيفتك الجديدة **${user.job}**` : '');
      try {
        const buf = await createRewardCard({
          user, discordUser: message.author, guildOrId: message.guild,
          amountText, amountColor, subtitle, iconPath,
          footer: `رصيدك الآن ${formatMoney(user.balance)}`,
        });
        return message.reply({ content: text, files: [new AttachmentBuilder(buf, { name: 'luck.png' })] });
      } catch (e) {
        console.error('luck card failed:', e.message);
        const embed = new EmbedBuilder().setColor('#FFD166').setTitle('🍀 حظ').setDescription(`${subtitle}\n**${amountText}**\n${text}`);
        return message.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error in luck command:', error);
      await message.reply(`❌ حدث خطأ أثناء تجربة الحظ.\n\`${String(error.message).slice(0, 150)}\``);
    }
  },
};
