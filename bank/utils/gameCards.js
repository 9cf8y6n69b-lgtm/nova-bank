// بطاقات الألعاب والتحويل والتوب والبروفايل بنفس ستايل البنك
const { loadImage } = require('@napi-rs/canvas');
const { newCard, finishCard, drawAvatar, rr, FONT } = require('./cardKit');
const { formatMoney, getExpNeededForNextLevel } = require('./helpers');
const { drawFruit, NAMES: FRUIT_NAMES } = require('./fruitArt');

const EMOJI = (s) => `${s}px AppEmoji, AppFont, sans-serif`;
const sign = (n) => (n >= 0 ? '+' : '-') + formatMoney(Math.abs(n));

function emoji(ctx, text, x, y, size) {
  ctx.save(); ctx.textAlign = 'center'; ctx.font = EMOJI(size); ctx.fillText(text, x, y); ctx.restore();
}
function box(ctx, x, y, w, h, r, COLORS, fill = 'rgba(255,255,255,0.08)') {
  rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = COLORS.cardBorder || COLORS.line; ctx.stroke();
}
function glow(ctx, color, blur, fn) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore(); }

// ---------------- قمار ----------------
async function createGambleCard({ discordUser, fruits, state, amount, change, guild }) {
  // fruits = أسماء فواكه من fruitArt | state: 'spin' | 'win' | 'lose' | 'push'
  const card = await newCard(900, 490, guild);
  const { ctx, COLORS } = card;
  await drawAvatar(ctx, discordUser, 190, 215, 70, COLORS);
  ctx.textAlign = 'center'; ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 28);
  ctx.fillText(discordUser.username, 190, 330);
  ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('', 20); ctx.fillText(`الرهان: ${formatMoney(amount)}`, 190, 365);

  box(ctx, 330, 120, 510, 230, 28, COLORS);
  fruits.forEach((f, i) => {
    const x = 352 + i * 160;
    box(ctx, x, 150, 150, 150, 22, COLORS, 'rgba(0,0,0,0.25)');
    drawFruit(ctx, f, x + 75, y0(225), 150);
  });
  const col = state === 'win' ? COLORS.green : state === 'lose' ? COLORS.red : COLORS.text;
  const label = { spin: 'جاري السحب...', win: 'مبروك فزت!', lose: 'حظ أوفر المرة الجاية', push: 'تعادل - رجعنا لك رهانك' }[state];
  ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.font = FONT('bold', 32);
  glow(ctx, col, state === 'win' ? 16 : 0, () => ctx.fillText(label, 585, 395));
  if (state === 'win' || state === 'lose') { ctx.font = FONT('bold', 30); ctx.fillText(sign(change), 585, 442); }
  return finishCard(card);
}
const y0 = (v) => v;

// ---------------- نرد ----------------
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function drawDie(ctx, cx, cy, size, n, COLORS) {
  rr(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.2); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.fillStyle = '#1b1b1b';
  for (const [dx, dy] of PIPS[n] || []) { ctx.beginPath(); ctx.arc(cx + dx * size * 0.26, cy + dy * size * 0.26, size * 0.075, 0, Math.PI * 2); ctx.fill(); }
}
async function createDiceCard({ discordUser, botUser, userRoll, botRoll, result, amount, guild }) {
  const card = await newCard(900, 570, guild);
  const { ctx, COLORS } = card;
  const col = result === 'win' ? COLORS.green : result === 'lose' ? COLORS.red : COLORS.text;
  ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.font = FONT('bold', 46);
  const top = result === 'tie' ? `تعادل ${formatMoney(0)}` : (result === 'win' ? '+' : '-') + formatMoney(amount);
  glow(ctx, col, 16, () => ctx.fillText(top, 450, 150));

  const sides = [[210, discordUser, userRoll, result === 'win'], [690, botUser, botRoll, result === 'lose']];
  for (const [x, u, roll, winner] of sides) {
    ctx.fillStyle = COLORS.text;
    emoji(ctx, result === 'tie' ? '😐' : winner ? '😄' : '😭', x, 235, 54);
    await drawAvatar(ctx, u, x, 320, 55, COLORS);
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 22); ctx.fillText(u.username, x, 405);
    drawDie(ctx, x, 455, 56, roll, COLORS);
  }
  ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('bold', 56); ctx.textAlign = 'center'; ctx.fillText('VS', 450, 340);
  return finishCard(card);
}

// ---------------- روليت ----------------
const SEG_COLORS = ['#c0392b', '#2c3e50', '#27ae60', '#8e44ad', '#d68910', '#16a085', '#2874a6', '#b03a2e', '#1e8449', '#7d3c98'];
async function createRouletteCard({ discordUser, mults, bet, rotation, resultIndex, change, guild }) {
  const card = await newCard(900, 610, guild);
  const { ctx, COLORS } = card;
  const cx = 300, cy = 330, R = 195, n = mults.length, seg = (Math.PI * 2) / n;

  ctx.beginPath(); ctx.arc(cx, cy, R + 12, 0, Math.PI * 2); ctx.fillStyle = '#d4af37'; ctx.fill();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation);
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i * seg;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a0 + seg); ctx.closePath();
    ctx.fillStyle = SEG_COLORS[i % SEG_COLORS.length]; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.rotate(a0 + seg / 2); ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = FONT('bold', 17);
    ctx.fillText(mults[i] === 0 ? 'خسارة' : formatMoney(Math.round(bet * mults[i])), R - 12, 6); ctx.restore();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fillStyle = '#d4af37'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fillStyle = '#222'; ctx.fill();
  // المؤشر
  ctx.beginPath(); ctx.moveTo(cx - 20, cy - R - 28); ctx.lineTo(cx + 20, cy - R - 28); ctx.lineTo(cx, cy - R + 6); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.stroke();

  // يمين: العضو والنتيجة
  await drawAvatar(ctx, discordUser, 700, 190, 55, COLORS);
  ctx.textAlign = 'center'; ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 26); ctx.fillText(discordUser.username, 700, 288);
  ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('', 20); ctx.fillText(`الرهان: ${formatMoney(bet)}`, 700, 322);
  if (resultIndex == null) {
    ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 30); ctx.fillText('العجلة تدور...', 700, 420);
  } else {
    const col = change > 0 ? COLORS.green : change < 0 ? COLORS.red : COLORS.text;
    ctx.fillStyle = col; ctx.font = FONT('bold', 34);
    glow(ctx, col, change > 0 ? 16 : 0, () => ctx.fillText(change > 0 ? 'فزت!' : change < 0 ? 'خسرت!' : 'تعادل', 700, 395));
    ctx.font = FONT('bold', 38); ctx.fillText(change === 0 ? '±0' : sign(change), 700, 450);
  }
  return finishCard(card);
}

// ---------------- تحويل ----------------
function arrow(ctx, x1, x2, y, color) {
  const dir = x2 > x1 ? 1 : -1;
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x1, y - 7); ctx.lineTo(x2 - dir * 28, y - 7); ctx.lineTo(x2 - dir * 28, y - 24);
  ctx.lineTo(x2, y); ctx.lineTo(x2 - dir * 28, y + 24); ctx.lineTo(x2 - dir * 28, y + 7); ctx.lineTo(x1, y + 7); ctx.closePath(); ctx.fill();
}
async function createTransferCard({ from, to, amount, balance, guild }) {
  const card = await newCard(900, 440, guild);
  const { ctx, COLORS } = card;
  await drawAvatar(ctx, from, 150, 250, 65, COLORS);
  await drawAvatar(ctx, to, 750, 250, 65, COLORS);
  ctx.textAlign = 'center'; ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 24);
  ctx.fillText(from.username, 150, 350); ctx.fillText(to.username, 750, 350);
  ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('', 18); ctx.fillText('المرسل', 150, 380); ctx.fillText('المستلم', 750, 380);
  arrow(ctx, 260, 640, 225, COLORS.green);
  arrow(ctx, 640, 260, 285, COLORS.textMuted);
  ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 44);
  glow(ctx, COLORS.green, 14, () => ctx.fillText(formatMoney(amount), 450, 170));
  ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('', 20); ctx.fillText('تم التحويل بنجاح', 450, 335);
  if (balance != null) ctx.fillText(`رصيدك الآن ${formatMoney(balance)}`, 450, 370);
  return finishCard(card);
}

// ---------------- فواكه (لعبة الذاكرة) ----------------
// mode: show (الفواكه ظاهرة) | hide (مخفية) | reveal (النتيجة)
async function createMemoryCard({ grid, mode, ask, picked, guild }) {
  const card = await newCard(900, 610, guild);
  const { ctx, COLORS } = card;
  ctx.textAlign = 'center'; ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 32);
  if (mode === 'show') ctx.fillText('احفظ أماكن الفواكه ..', 450, 150);
  else if (mode === 'hide') {
    const t = `وين كان مكان ${FRUIT_NAMES[grid[ask]]} ؟`;
    const w = ctx.measureText(t).width;
    ctx.fillText(t, 450 - 40, 150);
    drawFruit(ctx, grid[ask], 450 - 40 + w / 2 + 50, 140, 76);
  } else {
    const ok = picked === ask;
    ctx.fillStyle = ok ? COLORS.green : COLORS.red; ctx.fillText(ok ? 'صح! حفظك قوي' : 'غلط! هذا مكانها', 450, 150);
  }
  for (let i = 0; i < 10; i++) {
    const x = 47 + (i % 5) * 164, y = 195 + Math.floor(i / 5) * 164;
    let fill = 'rgba(0,0,0,0.25)';
    if (mode === 'reveal' && i === ask) fill = 'rgba(76,217,100,0.35)';
    else if (mode === 'reveal' && i === picked) fill = 'rgba(255,92,92,0.35)';
    box(ctx, x, y, 150, 150, 22, COLORS, fill);
    ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('bold', 18); ctx.textAlign = 'left'; ctx.fillText(String(i + 1), x + 14, y + 28);
    if (mode === 'hide') { ctx.textAlign = 'center'; ctx.font = FONT('bold', 70); ctx.fillStyle = COLORS.textMuted; ctx.fillText('؟', x + 75, y + 98); }
    else drawFruit(ctx, grid[i], x + 75, y + 78, 150);
  }
  return finishCard(card);
}

// ---------------- توب ----------------
async function createTopCard({ title, subtitle, rows, guild }) {
  const H = 170 + Math.max(rows.length, 1) * 58 + 50;
  const card = await newCard(900, H, guild);
  const { ctx, COLORS } = card;
  ctx.textAlign = 'center'; ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 38);
  glow(ctx, COLORS.green, 10, () => ctx.fillText(title, 450, 145));
  ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('', 18); ctx.fillText(subtitle || '', 450, 172 - 0);
  if (!rows.length) { ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('', 28); ctx.fillText('لا توجد بيانات بعد', 450, 300); }
  const medals = ['#ffd700', '#c0c0c0', '#cd7f32'];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], y = 195 + i * 58;
    rr(ctx, 55, y, 790, 50, 16); ctx.fillStyle = i < 3 ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.06)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = medals[i] || COLORS.textMuted; ctx.font = FONT('bold', 26); ctx.fillText(String(i + 1), 95, y + 35);
    try {
      const av = await loadImage(r.avatarURL);
      ctx.save(); ctx.beginPath(); ctx.arc(155, y + 25, 19, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(av, 136, y + 6, 38, 38); ctx.restore();
    } catch { ctx.beginPath(); ctx.arc(155, y + 25, 19, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill(); }
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 24); ctx.fillText(String(r.name).slice(0, 20), 190, y + 34);
    ctx.textAlign = 'right'; ctx.fillStyle = i === 0 ? COLORS.green : COLORS.text; ctx.font = FONT('bold', 24); ctx.fillText(r.value, 825, y + 34);
  }
  return finishCard(card);
}

// ---------------- بروفايل ----------------
async function createProfileCard({ user, discordUser, guild }) {
  const card = await newCard(900, 520, guild);
  const { ctx, COLORS } = card;
  await drawAvatar(ctx, discordUser, 190, 195, 70, COLORS);
  ctx.textAlign = 'center'; ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 30); ctx.fillText(discordUser.username, 190, 310);
  rr(ctx, 100, 328, 180, 36, 18); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
  ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('bold', 19); ctx.fillText(user.job || 'عاطل', 190, 353);

  const rows = [
    ['فلوسه', formatMoney(user.balance), COLORS.text],
    ['أرباحه', formatMoney(user.stats.highestEarned), COLORS.green],
    ['خسايره', formatMoney(user.stats.highestLost), COLORS.red],
    ['المستوى', String(user.level), COLORS.text],
  ];
  rows.forEach(([l, v, c], i) => {
    const y = 140 + i * 66;
    box(ctx, 360, y, 480, 54, 18, COLORS);
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.textMuted; ctx.font = FONT('', 21); ctx.fillText(l, 820, y + 35);
    ctx.textAlign = 'left'; ctx.fillStyle = c; ctx.font = FONT('bold', 25); ctx.fillText(v, 385, y + 36);
  });

  const need = getExpNeededForNextLevel(user.level), pct = Math.max(0, Math.min(1, user.experience / need));
  rr(ctx, 70, 425, 760, 30, 15); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
  if (pct > 0) { rr(ctx, 70, 425, Math.max(30, 760 * pct), 30, 15); ctx.fillStyle = COLORS.green; ctx.fill(); }
  ctx.textAlign = 'center'; ctx.fillStyle = COLORS.text; ctx.font = FONT('bold', 18);
  ctx.fillText(`XP ${user.experience} / ${need}`, 450, 446);
  return finishCard(card);
}

module.exports = { createGambleCard, createDiceCard, createRouletteCard, createTransferCard, createMemoryCard, createTopCard, createProfileCard };
