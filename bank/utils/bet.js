const { parseAmount, formatMoney } = require('./helpers');
// يقرأ مبلغ الرهان (ربع / نص / كامل / رقم) ويتحقق منه
function readBet(arg, user, min = 100) {
  if (!arg) return { error: '❌ حدد المبلغ: ربع / نص / كامل / رقم' };
  const amount = parseAmount(String(arg), user.balance);
  if (!amount || amount <= 0) return { error: '❌ المبلغ غير صالح!' };
  if (amount < min) return { error: `❌ الحد الأدنى ${formatMoney(min)}` };
  if (amount > user.balance) return { error: `❌ رصيدك ما يكفي! رصيدك: ${formatMoney(user.balance)}` };
  return { amount };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
module.exports = { readBet, sleep, pick };
