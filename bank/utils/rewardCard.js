// بطاقة مكافأة فخمة (راتب / بخشيش / حظ) بنفس ستايل البروفايل
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const CONFIG = require('./canvas-config');
const { getActiveColors, getActiveBranding } = require('./canvas'); // يسجّل الخطوط أيضاً

const W = 800, H = 440, PAD = 20, RADIUS = 35;
const FONT = (w, s) => `${w} ${s}px AppFont, Arial, sans-serif`;

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

async function drawHeader(ctx, COLORS, guildOrId) {
  const b = getActiveBranding(guildOrId);
  const size = 40, lx = 60, ly = 40;
  try {
    const img = await loadImage(b.iconURL || path.join(__dirname, CONFIG.images.logo));
    if (b.iconURL) { ctx.save(); ctx.beginPath(); ctx.arc(lx + size / 2, ly + size / 2, size / 2, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, lx, ly, size, size); ctx.restore(); }
    else ctx.drawImage(img, lx, ly, size, size);
  } catch { rr(ctx, lx, ly, size, size, 8); ctx.fillStyle = COLORS.logoBg; ctx.fill(); }
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const parts = b.name.split(' ');
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') + ' ' : '';
  const last = parts[parts.length - 1];
  ctx.font = '700 28px Arial'; ctx.fillStyle = COLORS.textMuted; ctx.fillText(first, 115, 60);
  const w1 = ctx.measureText(first).width;
  ctx.font = '800 28px Arial'; ctx.fillStyle = COLORS.text; ctx.fillText(last, 115 + w1, 60);
  ctx.fillStyle = COLORS.text;
  rr(ctx, 720, 50, 32, 4, 2); ctx.fill(); rr(ctx, 720, 60, 32, 4, 2); ctx.fill();
}

/**
 * opts: { user, discordUser, guildOrId, amountText, amountColor, subtitle, iconPath, footer }
 */
async function createRewardCard(opts) {
  const { user, discordUser, guildOrId, amountText, subtitle, iconPath, footer } = opts;
  const COLORS = { ...(await getActiveColors(guildOrId)), ...(require('./preview').state.current?.colors || {}) };
  const amountColor = opts.amountColor || COLORS.green;
  const canvas = createCanvas(W, H);
  const ctx = require('./cardKit').fixBidi(canvas.getContext('2d'));

  rr(ctx, PAD, PAD, W - PAD * 2, H - PAD * 2, RADIUS);
  ctx.save(); ctx.clip();

  await require('./background').drawBackground(ctx, W, H, COLORS);

  // لمعة قطرية
  ctx.save();
  ctx.beginPath(); ctx.moveTo(0, H * 0.7); ctx.lineTo(W, H * 0.2); ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath();
  const shine = ctx.createLinearGradient(0, 0, W, H);
  shine.addColorStop(0, 'rgba(255,255,255,0.10)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine; ctx.fill(); ctx.restore();

  // توهج خلف الصورة
  const glow = ctx.createRadialGradient(W / 2, 165, 10, W / 2, 165, 150);
  glow.addColorStop(0, 'rgba(255,255,255,0.16)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 60, W, 220);

  ctx.beginPath(); ctx.moveTo(PAD, 90); ctx.lineTo(W - PAD, 90);
  ctx.lineWidth = 1; ctx.strokeStyle = COLORS.line; ctx.stroke();

  await drawHeader(ctx, COLORS, guildOrId);

  // صورة العضو
  const ax = W / 2, ay = 160, ar = 46;
  try {
    const av = await loadImage(discordUser.displayAvatarURL({ extension: 'png', size: 128 }));
    ctx.save(); ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(av, ax - ar, ay - ar, ar * 2, ar * 2); ctx.restore();
  } catch {}
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.text; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(ax, ay, ar + 7, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.line; ctx.lineWidth = 2; ctx.stroke();

  // الاسم
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 26);
  ctx.fillText(discordUser.username, ax, 242);

  // المبلغ (مع أيقونة اختيارية)
  ctx.font = FONT('bold', 46);
  const tw = ctx.measureText(amountText).width;
  let iconW = 0, icon = null;
  if (iconPath) { try { icon = await loadImage(iconPath); iconW = 54; } catch {} }
  const startX = ax - (tw + iconW) / 2;
  if (icon) ctx.drawImage(icon, startX, 262, 46, 46);
  ctx.textAlign = 'left';
  ctx.shadowColor = amountColor; ctx.shadowBlur = 14;
  ctx.fillStyle = amountColor; ctx.fillText(amountText, startX + iconW, 302);
  ctx.shadowBlur = 0;

  // السطر السفلي
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('', 21);
  ctx.fillText(subtitle || '', ax, 340);
  if (footer) { ctx.font = FONT('', 17); ctx.fillText(footer, ax, 366); }

  // الفيزا
  ctx.textAlign = 'left';
  try { const v = await loadImage(path.join(__dirname, CONFIG.images.visa)); ctx.drawImage(v, 60, 355, 55, 28); }
  catch { ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 15); ctx.fillText('VISA', 60, 372); }
  ctx.fillStyle = COLORS.text; ctx.font = '15px monospace';
  ctx.fillText(user.visaNumber || '0000000000000000', 60, 400);

  ctx.restore();
  rr(ctx, PAD, PAD, W - PAD * 2, H - PAD * 2, RADIUS);
  ctx.lineWidth = 12; ctx.strokeStyle = COLORS.border; ctx.stroke();

  return canvas.toBuffer('image/png');
}

module.exports = { createRewardCard };
