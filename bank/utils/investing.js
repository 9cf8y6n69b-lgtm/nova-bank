// منطق الاستثمار: الأرباح تتراكم كل ساعة بنسبة عشوائية
const { randomInt } = require('./helpers');
const HOUR = 3600000;
const MIN_RATE = -50, MAX_RATE = 150; // بالـ "من عشرة آلاف" في الساعة: من -0.5% إلى +1.5%

function accrue(user) {
  const inv = user.investment;
  if (!inv) return;
  if (!(inv.principal > 0)) { inv.principal = 0; inv.lastTick = null; return; }
  const now = Date.now();
  if (!inv.lastTick) { inv.lastTick = new Date(now); return; }
  const hours = Math.min(72, Math.floor((now - new Date(inv.lastTick).getTime()) / HOUR));
  if (hours <= 0) return;
  for (let i = 0; i < hours; i++) {
    const gain = Math.round(inv.principal * randomInt(MIN_RATE, MAX_RATE) / 10000);
    inv.profit += gain;
    if (gain > inv.highestWin) inv.highestWin = gain;
  }
  if (inv.profit < -inv.principal * 0.5) inv.profit = -Math.floor(inv.principal * 0.5);
  inv.lastTick = new Date(new Date(inv.lastTick).getTime() + hours * HOUR);
}

module.exports = { accrue };
