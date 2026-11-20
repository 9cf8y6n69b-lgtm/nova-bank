// © 2026 Q3yb - Wick studio.
const { getUser, formatMoney } = require('../utils/helpers');
module.exports = {
  name: 'رصيد',
  aliases: ['فلوس', 'فلوسي', 'balance', 'bal'],
  description: 'يعرض رصيدك',
  category: 'bank',
  execute: async (message) => {
    const target = message.mentions.users.first() || message.author;
    if (target.bot) return message.reply('❌ البوتات ما عندها حساب!');
    const u = await getUser(target.id, message.guild.id);
    return message.reply(`💰 رصيد **${target.username}**: ${formatMoney(u.balance)}`);
  },
};
