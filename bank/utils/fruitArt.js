// رسم فواكه بالكود (ما تحتاج صور ولا خطوط)
const TAU = Math.PI * 2;
const circle = (c, x, y, r, f) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = f; c.fill(); };
const ell = (c, x, y, rx, ry, f, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fillStyle = f; c.fill(); };
const leaf = (c, x, y, w, h, rot) => ell(c, x, y, w, h, '#3fae49', rot);
const shine = (c, x, y, r) => ell(c, x, y, r * 0.22, r * 0.12, 'rgba(255,255,255,0.45)', -0.6);

const ART = {
  apple(c, x, y, r) {
    circle(c, x - r * 0.28, y + r * 0.05, r * 0.72, '#e53935'); circle(c, x + r * 0.28, y + r * 0.05, r * 0.72, '#e53935');
    ell(c, x, y + r * 0.2, r * 0.85, r * 0.7, '#e53935');
    c.strokeStyle = '#6d4c41'; c.lineWidth = r * 0.1; c.beginPath(); c.moveTo(x, y - r * 0.55); c.lineTo(x + r * 0.08, y - r * 0.95); c.stroke();
    leaf(c, x + r * 0.35, y - r * 0.8, r * 0.3, r * 0.14, -0.5); shine(c, x - r * 0.4, y - r * 0.15, r);
  },
  orange(c, x, y, r) {
    circle(c, x, y + r * 0.05, r * 0.92, '#fb8c00'); circle(c, x, y + r * 0.05, r * 0.92, 'rgba(255,204,128,0.25)');
    for (let i = 0; i < 9; i++) circle(c, x + Math.cos(i * 2.1) * r * 0.5, y + Math.sin(i * 1.7) * r * 0.5, r * 0.04, 'rgba(230,81,0,0.6)');
    leaf(c, x + r * 0.15, y - r * 0.88, r * 0.3, r * 0.13, -0.4); shine(c, x - r * 0.4, y - r * 0.25, r);
  },
  lemon(c, x, y, r) {
    ell(c, x, y, r * 1.0, r * 0.68, '#fdd835', -0.35);
    ell(c, x + r * 0.95, y - r * 0.4, r * 0.14, r * 0.1, '#fdd835', -0.35); ell(c, x - r * 0.95, y + r * 0.4, r * 0.14, r * 0.1, '#fdd835', -0.35);
    leaf(c, x + r * 0.5, y - r * 0.75, r * 0.28, r * 0.12, -0.6); shine(c, x - r * 0.25, y - r * 0.2, r);
  },
  grapes(c, x, y, r) {
    const pts = [[-0.5, -0.45], [0, -0.5], [0.5, -0.45], [-0.25, -0.05], [0.25, -0.05], [-0.5, 0.0], [0.5, 0.0], [0, 0.4], [-0.25, 0.4], [0.25, 0.4], [0, 0.75]];
    pts.forEach(([a, b]) => { circle(c, x + a * r, y + b * r, r * 0.3, '#7b1fa2'); ell(c, x + a * r - r * 0.08, y + b * r - r * 0.1, r * 0.07, r * 0.05, 'rgba(255,255,255,0.5)'); });
    c.strokeStyle = '#6d4c41'; c.lineWidth = r * 0.1; c.beginPath(); c.moveTo(x, y - r * 0.6); c.lineTo(x + r * 0.1, y - r * 0.95); c.stroke();
    leaf(c, x + r * 0.4, y - r * 0.85, r * 0.3, r * 0.14, -0.4);
  },
  cherry(c, x, y, r) {
    c.strokeStyle = '#558b2f'; c.lineWidth = r * 0.09; c.beginPath();
    c.moveTo(x - r * 0.45, y + r * 0.25); c.quadraticCurveTo(x - r * 0.2, y - r * 0.5, x + r * 0.15, y - r * 0.9);
    c.moveTo(x + r * 0.45, y + r * 0.3); c.quadraticCurveTo(x + r * 0.35, y - r * 0.5, x + r * 0.15, y - r * 0.9); c.stroke();
    circle(c, x - r * 0.45, y + r * 0.3, r * 0.42, '#c62828'); circle(c, x + r * 0.45, y + r * 0.35, r * 0.42, '#d32f2f');
    leaf(c, x + r * 0.45, y - r * 0.8, r * 0.3, r * 0.13, -0.3); shine(c, x - r * 0.55, y + r * 0.15, r * 0.7);
  },
  tomato(c, x, y, r) {
    ell(c, x, y + r * 0.1, r * 0.95, r * 0.8, '#e53935'); ell(c, x - r * 0.3, y + r * 0.1, r * 0.2, r * 0.7, 'rgba(255,255,255,0.08)');
    c.fillStyle = '#43a047'; c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * TAU / 10, rr = i % 2 ? r * 0.12 : r * 0.42; c.lineTo(x + Math.cos(a) * rr, y - r * 0.6 + Math.sin(a) * rr * 0.6); }
    c.closePath(); c.fill(); shine(c, x - r * 0.45, y - r * 0.1, r);
  },
  diamond(c, x, y, r) {
    const P = [[-0.8, -0.2], [-0.45, -0.7], [0.45, -0.7], [0.8, -0.2], [0, 0.85]];
    c.beginPath(); P.forEach(([a, b], i) => (i ? c.lineTo(x + a * r, y + b * r) : c.moveTo(x + a * r, y + b * r))); c.closePath(); c.fillStyle = '#29b6f6'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = r * 0.05; c.stroke();
    c.beginPath(); c.moveTo(x - 0.8 * r, y - 0.2 * r); c.lineTo(x + 0.8 * r, y - 0.2 * r); c.moveTo(x - 0.45 * r, y - 0.7 * r); c.lineTo(x - 0.2 * r, y - 0.2 * r); c.lineTo(x, y + 0.85 * r); c.moveTo(x + 0.45 * r, y - 0.7 * r); c.lineTo(x + 0.2 * r, y - 0.2 * r); c.lineTo(x, y + 0.85 * r); c.stroke();
  },
  watermelon(c, x, y, r) {
    c.beginPath(); c.arc(x, y - r * 0.25, r * 1.0, 0, Math.PI); c.closePath(); c.fillStyle = '#2e7d32'; c.fill();
    c.beginPath(); c.arc(x, y - r * 0.25, r * 0.85, 0, Math.PI); c.closePath(); c.fillStyle = '#e53935'; c.fill();
    [[-0.45, 0.25], [0, 0.4], [0.45, 0.25], [-0.2, 0.0], [0.25, 0.05]].forEach(([a, b]) => ell(c, x + a * r, y + b * r - r * 0.1, r * 0.06, r * 0.1, '#212121', 0.3));
  },
  strawberry(c, x, y, r) {
    c.beginPath(); c.moveTo(x - r * 0.8, y - r * 0.5); c.quadraticCurveTo(x, y - r * 0.9, x + r * 0.8, y - r * 0.5); c.quadraticCurveTo(x + r * 0.7, y + r * 0.4, x, y + r * 0.95); c.quadraticCurveTo(x - r * 0.7, y + r * 0.4, x - r * 0.8, y - r * 0.5); c.fillStyle = '#e53935'; c.fill();
    [[-0.4, -0.2], [0.1, -0.3], [0.45, -0.1], [-0.2, 0.15], [0.25, 0.2], [0, 0.55], [-0.45, 0.25], [0.5, 0.3]].forEach(([a, b]) => ell(c, x + a * r, y + b * r, r * 0.05, r * 0.08, '#ffeb3b'));
    [-0.6, -0.3, 0, 0.3, 0.6].forEach((a) => leaf(c, x + a * r * 0.9, y - r * 0.68, r * 0.22, r * 0.1, a * 0.9));
  },
  banana(c, x, y, r) {
    c.beginPath(); c.moveTo(x - r * 0.9, y - r * 0.2); c.quadraticCurveTo(x - r * 0.2, y + r * 1.0, x + r * 0.95, y - r * 0.55);
    c.quadraticCurveTo(x + r * 0.2, y + r * 0.45, x - r * 0.9, y - r * 0.2); c.fillStyle = '#fdd835'; c.fill();
    c.strokeStyle = '#a1887f'; c.lineWidth = r * 0.11; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - r * 0.9, y - r * 0.2); c.lineTo(x - r * 0.98, y - r * 0.38); c.moveTo(x + r * 0.95, y - r * 0.55); c.lineTo(x + r * 1.0, y - r * 0.7); c.stroke();
  },
  kiwi(c, x, y, r) {
    circle(c, x, y, r * 0.9, '#6d4c41'); circle(c, x, y, r * 0.78, '#8bc34a'); circle(c, x, y, r * 0.22, '#f1f8e9');
    for (let i = 0; i < 12; i++) ell(c, x + Math.cos(i * TAU / 12) * r * 0.45, y + Math.sin(i * TAU / 12) * r * 0.45, r * 0.05, r * 0.09, '#212121', i * TAU / 12);
  },
};
const NAMES = { apple: 'تفاح', orange: 'برتقال', lemon: 'ليمون', grapes: 'عنب', cherry: 'كرز', tomato: 'طماطم', diamond: 'ألماس', watermelon: 'بطيخ', strawberry: 'فراولة', banana: 'موز', kiwi: 'كيوي' };
const EMOJI = { apple: '🍎', orange: '🍊', lemon: '🍋', grapes: '🍇', cherry: '🍒', tomato: '🍅', diamond: '💎', watermelon: '🍉', strawberry: '🍓', banana: '🍌', kiwi: '🥝' };
// size = ضلع المربع المتاح للرسم
function drawFruit(ctx, name, cx, cy, size) { ctx.save(); (ART[name] || ART.apple)(ctx, cx, cy, size * 0.42); ctx.restore(); }
module.exports = { drawFruit, NAMES, EMOJI, ALL: Object.keys(ART) };
