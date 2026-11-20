// © 2026 Q3yb - Wick studio.
// فواكه: تشوف الأماكن ثم تختفي، وتختار مكان فاكهة واحدة (محاولة وحدة فقط)
const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, checkCooldown, setCooldown, formatMoney, readConfig, checkLevelUpAndJob, randomInt } = require('../utils/helpers');
const { createMemoryCard } = require('../utils/gameCards');
const { randomXp } = require('../utils/rewards');
const { sleep } = require('../utils/bet');
const { ALL, NAMES, EMOJI } = require('../utils/fruitArt');

const SHOW_MS = 5000;
const games = new Map();
const shuffle = (a) => a.slice().sort(() => Math.random() - 0.5);
const file = (b) => new AttachmentBuilder(b, { name: 'memory.png' });

function rows(gameId, picked, ask) {
  const out = [];
  for (let r = 0; r < 2; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 5; c++) {
      const i = r * 5 + c;
      const b = new ButtonBuilder().setCustomId(`nv_memo_${gameId}_${i}`).setLabel(String(i + 1)).setStyle(ButtonStyle.Secondary);
      if (picked != null) {
        b.setDisabled(true);
        if (i === ask) b.setStyle(ButtonStyle.Success); else if (i === picked) b.setStyle(ButtonStyle.Danger);
      }
      row.addComponents(b);
    }
    out.push(row);
  }
  return out;
}

module.exports = {
  name: 'فواكه',
  aliases: ['تظهر', 'fruits', 'ذاكرة'],
  interactionKey: 'memo',
  description: 'لعبة الذاكرة: احفظ أماكن الفواكه، تختفي، واختر مكان الفاكهة المطلوبة (محاولة وحدة)',
  category: 'bank',

  execute: async (message) => {
    try {
      const config = readConfig();
      if (!config?.economy) return message.reply('❌ تعذر تحميل إعدادات البنك.');
      const user = await getUser(message.author.id, message.guild.id);
      const cd = checkCooldown(user, 'fruits');
      if (!cd.ready) return message.reply(`⏰ يجب الانتظار ${cd.remainingFormatted} للعب مرة أخرى.`);
      await setCooldown(user, 'fruits');

      const grid = shuffle(ALL).slice(0, 10);
      const ask = randomInt(0, 9);
      const gameId = message.id;
      games.set(gameId, { owner: message.author.id, guildId: message.guild.id, grid, ask });
      setTimeout(() => games.delete(gameId), 5 * 60 * 1000).unref?.();

      const sent = await message.reply({ content: `🧠 **احفظ أماكن الفواكه!** تختفي بعد ${SHOW_MS / 1000} ثواني...`, files: [file(await createMemoryCard({ grid, mode: 'show', guild: message.guild }))] });
      await sleep(SHOW_MS);
      await sent.edit({
        content: `${EMOJI[grid[ask]]} **وين كان مكان ${NAMES[grid[ask]]}؟** اختر الرقم (محاولة وحدة فقط)`,
        attachments: [], files: [file(await createMemoryCard({ grid, mode: 'hide', ask, guild: message.guild }))], components: rows(gameId),
      });
    } catch (e) {
      console.error('Error in memory command:', e);
      await message.reply(`❌ حدث خطأ في اللعبة.\n\`${String(e.message).slice(0, 150)}\``);
    }
  },

  handleInteraction: async (interaction) => {
    if (!interaction.isButton()) return;
    const [, , gameId, idxStr] = interaction.customId.split('_');
    const g = games.get(gameId);
    if (!g) return interaction.reply({ content: '⌛ انتهت هذي اللعبة.', ephemeral: true });
    if (interaction.user.id !== g.owner) return interaction.reply({ content: '❌ هذي اللعبة مو لك!', ephemeral: true });
    games.delete(gameId); // محاولة وحدة فقط
    await interaction.deferUpdate();

    const picked = Number(idxStr);
    const ok = picked === g.ask;
    const config = readConfig();
    const reward = ok ? randomInt(5000, 30000) : 0;
    const user = await getUser(g.owner, g.guildId);
    user.balance += reward;
    if (reward > user.stats.highestEarned) user.stats.highestEarned = reward;
    const xp = randomXp(config, 'fruits');
    user.experience += xp;
    const leveledUp = await checkLevelUpAndJob(user, config);
    await user.save();

    const buf = await createMemoryCard({ grid: g.grid, mode: 'reveal', ask: g.ask, picked, guild: interaction.guild });
    await interaction.editReply({
      content: (ok ? `✅ صح! ربحت **${formatMoney(reward)}**` : `❌ غلط! مكان ${NAMES[g.grid[g.ask]]} كان رقم **${g.ask + 1}**`) + `\n✨ ${xp} خبرة` + (leveledUp ? `\n🎉 وصلت للمستوى ${user.level}` : ''),
      attachments: [], files: [file(buf)], components: rows(gameId, picked, g.ask),
    });
  },
};
