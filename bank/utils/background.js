// خلفية الصور: ألوان (من colorOverrides) أو صورة مرفوعة
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { getSettings } = require('./settings');
const preview = require('./preview');

const BG_PATH = path.join(__dirname, '..', 'data', 'background.jpg');
let cache = { mtime: 0, img: null };

async function getBgImage() {
  try {
    const st = fs.statSync(BG_PATH);
    if (cache.img && cache.mtime === st.mtimeMs) return cache.img;
    cache = { mtime: st.mtimeMs, img: await loadImage(fs.readFileSync(BG_PATH)) };
    return cache.img;
  } catch { return null; }
}

// يرسم الخلفية داخل المنطقة المقصوصة ويرجع true لو استخدم صورة
async function drawBackground(ctx, W, H, COLORS) {
  const mode = preview.state.current?.mode || getSettings().cardBackground;
  if (mode === 'image') {
    const img = await getBgImage();
    if (img) {
      const s = Math.max(W / img.width, H / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(0, 0, W, H); // يخلي النصوص مقروءة
      return true;
    }
  }
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, COLORS.bgTop); bg.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  return false;
}

// يحوّل أي صورة (رابط) إلى JPEG مناسب ويحفظها
async function saveBackgroundFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('تعذر تحميل الصورة');
  return saveBackgroundFromBuffer(Buffer.from(await res.arrayBuffer()));
}
async function saveBackgroundFromBuffer(buf) {
  const img = await loadImage(buf);
  const W = 1200, H = 800, s = Math.max(W / img.width, H / img.height);
  const cv = createCanvas(W, H), x = cv.getContext('2d');
  x.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
  fs.mkdirSync(path.dirname(BG_PATH), { recursive: true });
  fs.writeFileSync(BG_PATH, cv.toBuffer('image/jpeg', 85));
  cache = { mtime: 0, img: null };
}
module.exports = { BG_PATH, drawBackground, saveBackgroundFromUrl, saveBackgroundFromBuffer };
