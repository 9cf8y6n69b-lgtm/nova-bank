// قراءة/كتابة إعدادات البنك (bank-config.json) — تُستخدم من لوحة التحكم
const fs = require('fs');
const path = require('path');
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'bank-config.json');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}
function writeConfig(cfg) {
  const tmp = CONFIG_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, CONFIG_PATH);
}
const getSettings = () => readConfig().adminSettings || {};
function updateSettings(patch) {
  const cfg = readConfig();
  cfg.adminSettings = { ...(cfg.adminSettings || {}), ...patch };
  writeConfig(cfg);
  return cfg.adminSettings;
}
function updateConfig(fn) { const cfg = readConfig(); fn(cfg); writeConfig(cfg); return cfg; }

// 30د / 12س / 45ث / رقم (ثواني) -> ملي ثانية
function parseDuration(s) {
  const m = String(s || '').trim().match(/^(\d+(?:\.\d+)?)\s*(ث|ثانية|s|د|دقيقة|m|س|ساعة|h)?$/i);
  if (!m) return null;
  const u = (m[2] || 'ث').toLowerCase();
  const mult = ['د', 'دقيقة', 'm'].includes(u) ? 60000 : ['س', 'ساعة', 'h'].includes(u) ? 3600000 : 1000;
  return Math.round(parseFloat(m[1]) * mult);
}
module.exports = { CONFIG_PATH, readConfig, writeConfig, getSettings, updateSettings, updateConfig, parseDuration };
