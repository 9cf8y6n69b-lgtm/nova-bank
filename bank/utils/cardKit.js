// أدوات مشتركة لرسم بطاقات البنك بنفس ستايل البروفايل
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const CONFIG = require('./canvas-config');
const { getActiveColors, getActiveBranding } = require('./canvas'); // يسجّل الخطوط أيضاً
const { drawBackground } = require('./background');
const preview = require('./preview');

const PAD = 20, RADIUS = 35;
const FONT = (w, s) => `${w} ${s}px AppFont, Arial, sans-serif`;

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

async function drawHeader(ctx, COLORS, guildOrId, W) {
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
  rr(ctx, W - 80, 50, 32, 4, 2); ctx.fill(); rr(ctx, W - 80, 60, 32, 4, 2); ctx.fill();
  ctx.textBaseline = 'alphabetic';
}

/** يرسم الخلفية + الإطار الداخلي + الهيدر ويرجع { canvas, ctx, COLORS, W, H } */
async function newCard(W, H, guildOrId) {
  let COLORS = await getActiveColors(guildOrId);
  if (preview.state.current?.colors) COLORS = { ...COLORS, ...preview.state.current.colors };
  const canvas = createCanvas(W, H);
  const ctx = fixBidi(canvas.getContext('2d'));
  rr(ctx, PAD, PAD, W - PAD * 2, H - PAD * 2, RADIUS);
  ctx.save(); ctx.clip();
  const hasImage = await drawBackground(ctx, W, H, COLORS);
  ctx.save();
  ctx.globalAlpha = hasImage ? 0 : 1;
  ctx.beginPath(); ctx.moveTo(0, H * 0.7); ctx.lineTo(W, H * 0.2); ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath();
  const shine = ctx.createLinearGradient(0, 0, W, H);
  shine.addColorStop(0, 'rgba(255,255,255,0.10)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.moveTo(PAD, 90); ctx.lineTo(W - PAD, 90);
  ctx.lineWidth = 1; ctx.strokeStyle = COLORS.line; ctx.stroke();
  await drawHeader(ctx, COLORS, guildOrId, W);
  return { canvas, ctx, COLORS, W, H };
}

function finishCard(card) {
  const { ctx, canvas, COLORS, W, H } = card;
  ctx.restore();
  rr(ctx, PAD, PAD, W - PAD * 2, H - PAD * 2, RADIUS);
  ctx.lineWidth = 12; ctx.strokeStyle = COLORS.border; ctx.stroke();
  return canvas.toBuffer('image/png');
}

async function drawAvatar(ctx, discordUser, x, y, r, COLORS) {
  try {
    const av = await loadImage(discordUser.displayAvatarURL({ extension: 'png', size: 128 }));
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(av, x - r, y - r, r * 2, r * 2); ctx.restore();
  } catch {}
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.text; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.line; ctx.lineWidth = 2; ctx.stroke();
}


// يمنع انعكاس الأرقام والمبالغ ($10K) داخل النص العربي
const LRI = '\u2066', PDI = '\u2069';
function fixBidi(ctx) {
  const orig = ctx.fillText.bind(ctx);
  ctx.fillText = (t, x, y, w) => {
    t = String(t);
    if (/[\u0600-\u06FF]/.test(t)) t = t.replace(/[+\-]?\$?\d[\d.,]*[A-Za-z]*%?|[A-Za-z][A-Za-z ]*[A-Za-z]/g, (m) => LRI + m + PDI);
    return w === undefined ? orig(t, x, y) : orig(t, x, y, w);
  };
  return ctx;
}

module.exports = { fixBidi, newCard, finishCard, drawAvatar, rr, FONT, CONFIG };
