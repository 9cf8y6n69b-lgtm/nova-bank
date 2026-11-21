// بطاقة السوق بنفس ستايل بطاقات NOVA STORE
const path = require('path');
const { loadImage } = require('@napi-rs/canvas');
const { newCard, finishCard, rr, FONT } = require('./cardKit');
const { formatMoney, readConfig, getMaterialPrices } = require('./helpers');

const IMG_DIR = path.join(__dirname, '../../img/bank/market');
const cache = new Map();
async function matImage(id) {
  if (cache.has(id)) return cache.get(id);
  let img = null;
  try { img = await loadImage(path.join(IMG_DIR, `${id}.png`)); } catch {}
  cache.set(id, img);
  return img;
}

async function createMarketImage(user, discordUser, guildOrId) {
  const config = readConfig();
  const defs = config?.material_definitions || {};
  const ids = Object.keys(defs);
  const card = await newCard(900, 560, guildOrId || user?.guildId);
  const { ctx, COLORS } = card;

  const cols = 3, tw = 250, th = 190, gap = 20, x0 = 55, y0 = 112;
  for (let i = 0; i < ids.length && i < 6; i++) {
    const id = ids[i], def = defs[id];
    const x = x0 + (i % cols) * (tw + gap), y = y0 + Math.floor(i / cols) * (th + 15);
    rr(ctx, x, y, tw, th, 24); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.cardBorder || COLORS.line; ctx.stroke();

    const img = await matImage(id);
    if (img) {
      const s = Math.min(80 / img.width, 80 / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.drawImage(img, x + tw / 2 - w / 2, y + 12 + (80 - h) / 2, w, h);
    }
    const owned = user?.materials?.[id] || 0;
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('bold', 18);
    ctx.fillText(`x${owned}`, x + 16, y + 34);

    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 24);
    ctx.fillText(def.name, x + tw / 2, y + 120);
    const p = getMaterialPrices(id);
    ctx.font = FONT('bold', 18);
    ctx.fillStyle = COLORS.green; ctx.fillText(`شراء ${formatMoney(p.buyPrice)}`, x + tw / 2, y + 150);
    ctx.fillStyle = COLORS.red; ctx.fillText(`بيع ${formatMoney(p.sellPrice)}`, x + tw / 2, y + 175);
  }

  ctx.textAlign = 'center'; ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('', 20);
  ctx.fillText(`${discordUser?.username || ''}  •  رصيدك ${formatMoney(user?.balance || 0)}`, 450, 525);
  return finishCard(card);
}
module.exports = { createMarketImage };
