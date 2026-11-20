// © 2026 Q3yb - Wick studio.
const { AttachmentBuilder } = require('discord.js');
const { getUser, formatMoney, parseAmount, readConfig } = require('../utils/helpers');
const { createTransferCard } = require('../utils/gameCards');

module.exports = {
  name: 'تحويل',
  aliases: ['حول', 'transfer', 'pay'],
  description: 'تحويل فلوس لعضو: تحويل @الشخص المبلغ',
  category: 'bank',
  execute: async (message, args) => {
    try {
      const config = readConfig();
      if (config?.adminSettings?.transferEnabled === false) return message.reply('❌ التحويل معطّل حالياً.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ الاستخدام: `تحويل @الشخص <المبلغ>`');
      if (target.bot) return message.reply('❌ ما تقدر تحول لبوت!');
      if (target.id === message.author.id) return message.reply('❌ ما تقدر تحول لنفسك!');
      const rest = args.filter((a) => !/^<@!?\d+>$/.test(a));
      if (!rest[0]) return message.reply('❌ حدد المبلغ.');

      const sender = await getUser(message.author.id, message.guild.id);
      const amount = parseAmount(rest[0], sender.balance);
      if (!amount || amount <= 0) return message.reply('❌ المبلغ غير صالح!');
      if (amount > sender.balance) return message.reply(`❌ رصيدك ما يكفي! رصيدك: ${formatMoney(sender.balance)}`);
      const receiver = await getUser(target.id, message.guild.id);

      sender.balance -= amount;
      receiver.balance += amount;
      await sender.save();
      await receiver.save();
      try {
        const buf = await createTransferCard({ from: message.author, to: target, amount, balance: sender.balance, guild: message.guild });
        return message.reply({ content: `${target}`, files: [new AttachmentBuilder(buf, { name: 'transfer.png' })] });
      } catch (e) {
        console.error('transfer card failed:', e.message);
        return message.reply(`✅ تم تحويل ${formatMoney(amount)} إلى ${target}`);
      }
    } catch (e) {
      console.error('Error in transfer command:', e);
      await message.reply(`❌ حدث خطأ في التحويل.\n\`${String(e.message).slice(0, 150)}\``);
    }
  },
};
