// © 2026 Q3yb - Wick studio.
const { AttachmentBuilder } = require('discord.js');
const { getUser } = require('../utils/helpers');
const { createProfileCard } = require('../utils/gameCards');

module.exports = {
  name: 'بروفايل',
  aliases: ['profile', 'بروفايلي', 'ملفي', 'ملف'],
  description: 'بروفايلك: فلوسك، أرباحك، خسايرك، وظيفتك وشريط الخبرة',
  category: 'bank',
  execute: async (message) => {
    try {
      const target = message.mentions.users.first() || message.author;
      if (target.bot) return message.reply('❌ البوتات ما عندها حساب!');
      const user = await getUser(target.id, message.guild.id);
      const buf = await createProfileCard({ user, discordUser: target, guild: message.guild });
      return message.reply({ files: [new AttachmentBuilder(buf, { name: 'profile.png' })] });
    } catch (e) {
      console.error('Error in profile command:', e);
      await message.reply(`❌ حدث خطأ في البروفايل.\n\`${String(e.message).slice(0, 150)}\``);
    }
  },
};
