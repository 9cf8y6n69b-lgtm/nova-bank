// © 2026 Q3yb - Wick studio.
const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, parseAmount, formatMoney, readConfig, checkLevelUpAndJob } = require('../utils/helpers');
const { createInvestCard } = require('../utils/investCard');
const { accrue } = require('../utils/investing');
const { randomXp } = require('../utils/rewards');

const MIN_INVEST = 1000;

function buttons(userId, user) {
  const hasProfit = user.investment.profit > 0;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`invest_q_${userId}`).setLabel('سحب ربع الأرباح').setStyle(ButtonStyle.Secondary).setDisabled(!hasProfit),
    new ButtonBuilder().setCustomId(`invest_h_${userId}`).setLabel('سحب نص الأرباح').setStyle(ButtonStyle.Secondary).setDisabled(!hasProfit),
    new ButtonBuilder().setCustomId(`invest_f_${userId}`).setLabel('سحب كل الأرباح').setStyle(ButtonStyle.Success).setDisabled(!hasProfit),
    new ButtonBuilder().setCustomId(`invest_box_${userId}`).setLabel('سحب الصندوق كامل').setStyle(ButtonStyle.Danger).setDisabled(user.investment.principal <= 0),
  );
}

module.exports = {
  name: 'استثمار',
  aliases: ['invest', 'استثمر'],
  description: 'استثمر فلوسك (ربع / نص / كامل / مبلغ) واسحب الأرباح',
  category: 'bank',

  execute: async (message, args) => {
    try {
      const config = readConfig();
      const user = await getUser(message.author.id, message.guild.id);
      accrue(user);

      let note = '';
      if (args[0]) {
        const amount = parseAmount(args[0], user.balance);
        if (!amount || amount <= 0) return message.reply('❌ الاستخدام: `استثمار <ربع | نص | كامل | المبلغ>`');
        if (amount < MIN_INVEST) return message.reply(`❌ الحد الأدنى للاستثمار ${formatMoney(MIN_INVEST)}`);
        if (amount > user.balance) return message.reply(`❌ رصيدك ما يكفي! رصيدك: ${formatMoney(user.balance)}`);
        user.balance -= amount;
        const inv = user.investment;
        if (!inv.lastTick || inv.principal <= 0) inv.lastTick = new Date();
        inv.principal += amount;
        inv.totalInvested += amount;
        user.stats.totalInvested = (user.stats.totalInvested || 0) + amount;
        const xp = randomXp(config, 'invest');
        user.experience += xp;
        const leveledUp = await checkLevelUpAndJob(user, config);
        note = `✅ تم استثمار **${formatMoney(amount)}** — ✨ ${xp} خبرة` + (leveledUp ? `\n🎉 وصلت للمستوى ${user.level}` : '');
      }
      await user.save();

      const buf = await createInvestCard(user, message.author, message.guild);
      return message.reply({
        content: note || undefined,
        files: [new AttachmentBuilder(buf, { name: 'invest.png' })],
        components: [buttons(message.author.id, user)],
      });
    } catch (e) {
      console.error('Error in invest command:', e);
      await message.reply(`❌ حدث خطأ في الاستثمار.\n\`${String(e.message).slice(0, 150)}\``);
    }
  },

  handleInteraction: async (interaction) => {
    if (!interaction.isButton()) return;
    const [, kind, ownerId] = interaction.customId.split('_');
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: '❌ هذا الصندوق مو لك!', ephemeral: true });
    }
    await interaction.deferUpdate();
    const user = await getUser(interaction.user.id, interaction.guild.id);
    accrue(user);
    const inv = user.investment;
    let take = 0;
    if (kind === 'box') {
      take = Math.max(0, inv.principal + inv.profit);
      inv.principal = 0; inv.profit = 0; inv.lastTick = null;
    } else if (inv.profit > 0) {
      take = Math.floor(inv.profit * ({ q: 0.25, h: 0.5, f: 1 }[kind] || 0));
      inv.profit -= take;
    }
    user.balance += take;
    if (take > user.stats.highestEarned) user.stats.highestEarned = take;
    await user.save();
    const buf = await createInvestCard(user, interaction.user, interaction.guild);
    await interaction.editReply({
      content: take > 0 ? `💰 تم سحب **${formatMoney(take)}** إلى رصيدك` : 'ℹ️ ما فيه أرباح للسحب.',
      files: [new AttachmentBuilder(buf, { name: 'invest.png' })],
      attachments: [],
      components: [buttons(interaction.user.id, user)],
    });
  },
};
