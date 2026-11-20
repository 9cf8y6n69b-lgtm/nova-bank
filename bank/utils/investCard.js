const { newCard, finishCard, drawAvatar, rr, FONT } = require('./cardKit');
const { formatMoney } = require('./helpers');

async function createInvestCard(user, discordUser, guildOrId) {
  const inv = user.investment;
  const card = await newCard(900, 480, guildOrId);
  const { ctx, COLORS } = card;
  const sign = (n) => (n >= 0 ? '+' : '-') + formatMoney(Math.abs(n));

  // يسار: العضو وإحصائياته
  await drawAvatar(ctx, discordUser, 210, 165, 50, COLORS);
  ctx.textAlign = 'center'; ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 26);
  ctx.fillText(discordUser.username, 210, 250);
  const rows = [
    ['المبالغ التي دفعتها', formatMoney(inv.totalInvested), COLORS.text],
    ['أعلى مبلغ جاك', formatMoney(inv.highestWin), COLORS.green],
    ['الربح من الاستثمار', sign(inv.profit), inv.profit >= 0 ? COLORS.green : COLORS.red],
  ];
  rows.forEach(([label, value, color], i) => {
    const y = 305 + i * 50;
    rr(ctx, 50, y - 28, 330, 40, 14); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('', 18); ctx.fillText(label, 365, y);
    ctx.textAlign = 'left'; ctx.fillStyle = color; ctx.font = FONT('bold', 20); ctx.fillText(value, 65, y);
  });

  // يمين: صندوق الاستثمار
  rr(ctx, 470, 125, 380, 320, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = COLORS.cardBorder; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('bold', 24); ctx.fillText('صندوق الاستثمار', 660, 175);
  ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 50);
  ctx.shadowColor = COLORS.green; ctx.shadowBlur = 14;
  ctx.fillText(formatMoney(inv.principal + inv.profit), 660, 262); ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('', 20);
  ctx.fillText(`رأس المال: ${formatMoney(inv.principal)}`, 660, 312);
  ctx.fillStyle = inv.profit >= 0 ? COLORS.green : COLORS.red; ctx.font = FONT('bold', 28);
  ctx.fillText(`الأرباح: ${sign(inv.profit)}`, 660, 362);
  ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('', 16);
  ctx.fillText('اسحب الأرباح من الأزرار بالأسفل', 660, 415);

  return finishCard(card);
}
module.exports = { createInvestCard };
