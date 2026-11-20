// © 2026 Q3yb - Wick studio.
const { EmbedBuilder } = require('discord.js');
module.exports = {
  name: 'اوامر',
  aliases: ['مساعدة', 'help', 'الاوامر', 'أوامر'],
  description: 'قائمة أوامر البنك',
  category: 'bank',
  execute: async (message) => {
    const e = new EmbedBuilder().setColor('#5865F2').setTitle('🏦 أوامر NOVA STORE')
      .addFields(
        { name: '💰 الفلوس', value: '`رصيد` `بروفايل` `راتب` `بخشيش` `حظ` `تحويل @شخص مبلغ`' },
        { name: '🎮 الألعاب (ربع / نص / كامل / مبلغ)', value: '`قمار` `نرد` `روليت` `تظهر`' },
        { name: '📈 الاستثمار', value: '`استثمار <مبلغ>` `تداول <مبلغ>`' },
        { name: '🦹 السرقة', value: '`نهب @شخص` `حماية <ساعات>`' },
        { name: '🏆 أخرى', value: '`توب` `وقت`' },
        { name: '🛠️ الإدارة', value: '`ادارة` — للأدمن فقط' },
      );
    return message.reply({ embeds: [e] });
  },
};
