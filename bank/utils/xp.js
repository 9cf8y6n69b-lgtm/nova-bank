// خبرة تلقائية لأي أمر بنك نجح (ما عدا الأوامر اللي تعطي خبرة بنفسها) + ترقية وظيفة عند رفع اللفل
const BankUser = require('../models/BankUser');
const { readConfig, checkLevelUpAndJob, assignJobByLevel, formatMoney } = require('./helpers');
const { randomXp } = require('./rewards');

const KEYMAP = { راتب: 'salary', بخشيش: 'tip', حظ: 'luck', قمار: 'gamble', نرد: 'dice', فواكه: 'fruits', تظهر: 'fruits', تداول: 'trade', نهب: 'rob', سرقة: 'rob', روليت: 'roulette', استثمار: 'invest', قرض: 'loan' };
const IGNORE = new Set(['experience', 'level', 'job', 'updatedAt']);
const fingerprint = (u) => { if (!u) return ''; const o = {}; for (const k of Object.keys(u)) if (!IGNORE.has(k)) o[k] = u[k]; return JSON.stringify(o); };

async function snapshot(userId, guildId) {
  const u = await BankUser.findOne({ userId, guildId });
  return u ? { fp: fingerprint(u), xp: u.experience, level: u.level, job: u.job } : null;
}

// يُستدعى بعد تنفيذ الأمر. يرجع نص تهنئة بالترقية (أو null)
async function afterCommand(commandName, userId, guildId, before) {
  if (!before) return null;
  const config = readConfig();
  const exp = config?.economy?.experience || {};
  const key = [KEYMAP[commandName], commandName].find((k) => k && exp[k]);
  const u = await BankUser.findOne({ userId, guildId });
  if (!u) return null;
  if (!config?.economy?.jobs?.[u.job]) { assignJobByLevel(u, config); before.job = u.job; await u.save(); }
  let changed = false;
  if (key && u.experience === before.xp && u.level === before.level && fingerprint(u) !== before.fp) {
    u.experience += randomXp(config, key);
    await checkLevelUpAndJob(u, config);
    await u.save();
    changed = true;
  }
  if (u.job !== before.job) {
    const salary = config?.economy?.jobs?.[u.job]?.salary;
    return `🎉 <@${userId}> وصلت المستوى **${u.level}** وترقّيت لوظيفة **${u.job}**${salary ? ` — راتبك ${formatMoney(salary)}` : ''}`;
  }
  return null;
}
module.exports = { snapshot, afterCommand };
