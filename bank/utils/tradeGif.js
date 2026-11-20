// صورة متحركة (GIF) لصفقة تداول: سهم يرتفع أو ينزل
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { encodeGif } = require('./gif');
const { formatMoney, randomInt } = require('./helpers');
require('./canvas'); // تسجيل الخطوط

const W = 640, H = 360, POINTS = 44, FRAMES = 26;
// ألوان مناسبة لباليت GIF
const C = { bg: '#141414', panel: '#1f1f1f', grid: '#333333', text: '#ffffff', muted: '#999999',
  up: '#33ff66', down: '#ff3333', upFill: '#003300', downFill: '#330000', gold: '#ffcc33' };
const FONT = (w, s) => `${w} ${s}px AppFont, Arial, sans-serif`;

const TICKERS = ['NOVA', 'ORBT', 'ZETA', 'LUNA', 'APEX', 'QNTM', 'VEGA', 'HELX', 'AURA', 'TITN'];

function makePath(up, pct) {
  const end = 100 * (1 + (up ? 1 : -1) * pct / 100);
  const pts = [100];
  let noise = 0;
  for (let i = 1; i < POINTS; i++) {
    const t = i / (POINTS - 1);
    noise += (Math.random() - 0.5) * 9;
    const envelope = Math.sin(Math.PI * t); // الضوضاء تختفي عند الطرفين
    pts.push(100 + (end - 100) * t + noise * envelope);
  }
  pts[POINTS - 1] = end;
  return pts;
}

async function createTradeGif({ discordUser, ticker, up, pct, amount, change }) {
  ticker = ticker || TICKERS[randomInt(0, TICKERS.length - 1)];
  const pts = makePath(up, pct);
  const lo = Math.min(...pts) - 6, hi = Math.max(...pts) + 6;
  const cx = (i) => 40 + (i / (POINTS - 1)) * 560;
  const cy = (v) => 290 - ((v - lo) / (hi - lo)) * 190;
  const color = up ? C.up : C.down;

  let avatar = null;
  try { avatar = await loadImage(discordUser.displayAvatarURL({ extension: 'png', size: 64 })); } catch {}

  const frames = [];
  for (let f = 0; f < FRAMES + 1; f++) {
    const final = f === FRAMES;
    const vis = final ? POINTS : Math.max(2, Math.ceil(POINTS * (f + 1) / FRAMES));
    const cv = createCanvas(W, H), x = require('./cardKit').fixBidi(cv.getContext('2d'));
    x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
    x.fillStyle = C.panel; x.beginPath(); x.roundRect(20, 70, 600, 250, 18); x.fill();
    x.strokeStyle = C.grid; x.lineWidth = 1;
    for (let g = 0; g < 5; g++) { const y = 100 + g * 47; x.beginPath(); x.moveTo(40, y); x.lineTo(600, y); x.stroke(); }

    // منطقة تحت الخط
    x.beginPath(); x.moveTo(cx(0), 300);
    for (let i = 0; i < vis; i++) x.lineTo(cx(i), cy(pts[i]));
    x.lineTo(cx(vis - 1), 300); x.closePath(); x.fillStyle = up ? C.upFill : C.downFill; x.fill();
    // الخط
    x.beginPath();
    for (let i = 0; i < vis; i++) (i ? x.lineTo(cx(i), cy(pts[i])) : x.moveTo(cx(i), cy(pts[i])));
    x.strokeStyle = color; x.lineWidth = 4; x.lineJoin = 'round'; x.stroke();
    // النقطة الحالية
    x.beginPath(); x.arc(cx(vis - 1), cy(pts[vis - 1]), 7, 0, Math.PI * 2); x.fillStyle = C.text; x.fill();
    x.beginPath(); x.arc(cx(vis - 1), cy(pts[vis - 1]), 4, 0, Math.PI * 2); x.fillStyle = color; x.fill();

    // الهيدر
    const cur = pts[vis - 1], curPct = cur - 100;
    x.textAlign = 'left'; x.fillStyle = C.text; x.font = FONT('bold', 30); x.fillText(ticker, 30, 48);
    x.fillStyle = C.muted; x.font = FONT('', 16); x.fillText('NOVA EXCHANGE', 30, 64);
    x.textAlign = 'right'; x.fillStyle = curPct >= 0 ? C.up : C.down; x.font = FONT('bold', 30);
    x.fillText(`${curPct >= 0 ? '▲' : '▼'} ${Math.abs(curPct).toFixed(1)}%`, 610, 48);
    x.fillStyle = C.muted; x.font = FONT('', 16); x.fillText(`$${cur.toFixed(2)}`, 610, 64);

    // الشريط السفلي
    if (avatar) { x.save(); x.beginPath(); x.arc(44, 339, 14, 0, Math.PI * 2); x.clip(); x.drawImage(avatar, 30, 325, 28, 28); x.restore(); }
    x.textAlign = 'left'; x.fillStyle = C.text; x.font = FONT('bold', 17); x.fillText(discordUser.username, 66, 345);
    x.textAlign = 'right'; x.fillStyle = C.muted; x.font = FONT('', 17); x.fillText(`المبلغ: ${formatMoney(amount)}`, 610, 345);

    // نتيجة الصفقة
    if (final) {
      x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(20, 70, 600, 250);
      x.textAlign = 'center'; x.fillStyle = color; x.font = FONT('bold', 54);
      x.fillText(up ? 'صفقة رابحة' : 'صفقة خاسرة', 320, 175);
      x.font = FONT('bold', 42); x.fillText(`${change >= 0 ? '+' : '-'}${formatMoney(Math.abs(change))}`, 320, 235);
      x.fillStyle = C.gold; x.font = FONT('', 22); x.fillText(`${up ? '+' : '-'}${pct}%`, 320, 275);
    }
    frames.push({ data: x.getImageData(0, 0, W, H).data, delay: final ? 5000 : (f < 6 ? 90 : 60) });
  }
  return encodeGif(frames, W, H);
}

module.exports = { createTradeGif, TICKERS };
