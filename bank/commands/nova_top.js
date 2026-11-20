// © 2026 Q3yb - Wick studio.
const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const BankUser = require('../models/BankUser');
const { formatMoney } = require('../utils/helpers');
const { createTopCard } = require('../utils/gameCards');

const CATS = {
  rich: { title: 'توب الأغنياء', sub: 'أغنى 10 أشخاص', val: (u) => u.balance + (u.bank || 0), fmt: formatMoney },
  thieves: { title: 'توب الحراميّة', sub: 'أعلى مبلغ سرقة', val: (u) => u.stats?.highestStolen || 0, fmt: formatMoney },
  lands: { title: 'توب العقارات', sub: 'البيوت والعقارات', val: (u) => (u.lands || []).length, fmt: (n) => `${n} عقار` },
};
const ALIASES = { غني: 'rich', اغنياء: 'rich', أغنياء: 'rich', فلوس: 'rich', حراميه: 'thieves', حرامية: 'thieves', حراميّة: 'thieves', سرقة: 'thieves', عقارات: 'lands', عقار: 'lands', بيوت: 'lands', ارض: 'lands', أرض: 'lands' };

async function build(client, guild, cat) {
  const c = CATS[cat];
  const all = await BankUser.find({ guildId: guild.id });
  const top = all.map((u) => ({ u, v: c.val(u) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
  const rows = await Promise.all(top.map(async ({ u, v }) => {
    const du = await client.users.fetch(u.userId).catch(() => null);
    return { name: du?.username || 'مجهول', avatarURL: du ? du.displayAvatarURL({ extension: 'png', size: 64, forceStatic: true }) : '', value: c.fmt(v) };
  }));
  return createTopCard({ title: c.title, subtitle: c.sub, rows, guild });
}
const buttons = (uid, cat) => new ActionRowBuilder().addComponents(
  ...Object.entries(CATS).map(([k, v]) => new ButtonBuilder().setCustomId(`top_${k}_${uid}`).setLabel(v.title).setStyle(k === cat ? ButtonStyle.Success : ButtonStyle.Secondary)),
);

module.exports = {
  name: 'توب',
  aliases: ['top', 'المتصدرين'],
  description: 'توب الأغنياء / الحراميّة / العقارات',
  category: 'bank',
  execute: async (message, args) => {
    try {
      const cat = ALIASES[args[0]] || (CATS[args[0]] ? args[0] : 'rich');
      const buf = await build(message.client, message.guild, cat);
      return message.reply({ files: [new AttachmentBuilder(buf, { name: 'top.png' })], components: [buttons(message.author.id, cat)] });
    } catch (e) {
      console.error('Error in top command:', e);
      await message.reply(`❌ حدث خطأ في التوب.\n\`${String(e.message).slice(0, 150)}\``);
    }
  },
  handleInteraction: async (interaction) => {
    if (!interaction.isButton()) return;
    const [, cat, ownerId] = interaction.customId.split('_');
    if (!CATS[cat]) return interaction.reply({ content: '❌ قسم غير معروف.', ephemeral: true });
    if (interaction.user.id !== ownerId) return interaction.reply({ content: '❌ اكتب `توب` بنفسك عشان تتحكم بالأزرار.', ephemeral: true });
    await interaction.deferUpdate();
    const buf = await build(interaction.client, interaction.guild, cat);
    await interaction.editReply({ files: [new AttachmentBuilder(buf, { name: 'top.png' })], attachments: [], components: [buttons(ownerId, cat)] });
  },
};
