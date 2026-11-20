// دوال مشتركة لأوامر المكافآت
const { randomInt } = require('./helpers');

// خبرة عشوائية لكل لعبة. تقدر تحددها من bank-config.json:
// economy.experience.<cmd>.xpMin / xpMax  (أو xpAward كحد أعلى)
function randomXp(config, key) {
  const e = config?.economy?.experience?.[key] || {};
  const max = Number.isFinite(e.xpMax) ? e.xpMax : (Number.isFinite(e.xpAward) && e.xpAward > 0 ? e.xpAward : 50);
  const min = Number.isFinite(e.xpMin) ? e.xpMin : Math.max(1, Math.floor(max / 3));
  return randomInt(Math.min(min, max), Math.max(min, max));
}

function jobSalary(config, job) {
  const jobs = config?.economy?.jobs || {};
  const s = Number(jobs[job || 'عاطل']?.salary ?? jobs['عاطل']?.salary);
  return Number.isFinite(s) ? s : 500;
}

module.exports = { randomXp, jobSalary };
