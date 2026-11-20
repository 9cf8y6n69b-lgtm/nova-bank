// مشفّر GIF بسيط بدون مكتبات خارجية (باليت ثابتة 256 لون + LZW)
const PAL = new Uint8Array(256 * 3);
for (let i = 0; i < 216; i++) { PAL[i * 3] = Math.floor(i / 36) * 51; PAL[i * 3 + 1] = Math.floor((i % 36) / 6) * 51; PAL[i * 3 + 2] = (i % 6) * 51; }
for (let i = 0; i < 40; i++) { const v = Math.round(i * 255 / 39); PAL[(216 + i) * 3] = v; PAL[(216 + i) * 3 + 1] = v; PAL[(216 + i) * 3 + 2] = v; }

function quantize(rgba, w, h) {
  const out = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const cr = Math.round(r / 51), cg = Math.round(g / 51), cb = Math.round(b / 51);
    const e1 = (r - cr * 51) ** 2 + (g - cg * 51) ** 2 + (b - cb * 51) ** 2;
    const avg = (r + g + b) / 3, gi = Math.round(avg * 39 / 255), gv = Math.round(gi * 255 / 39);
    const e2 = (r - gv) ** 2 + (g - gv) ** 2 + (b - gv) ** 2;
    out[p] = e2 < e1 ? 216 + gi : cr * 36 + cg * 6 + cb;
  }
  return out;
}

function lzw(indices) {
  const MIN = 8, CLEAR = 256, EOI = 257;
  const bytes = [];
  let cur = 0, bits = 0;
  const put = (code, size) => { cur |= code << bits; bits += size; while (bits >= 8) { bytes.push(cur & 255); cur >>>= 8; bits -= 8; } };
  let dict = new Map(), next = 258, size = 9;
  put(CLEAR, size);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = prefix * 256 + k;
    const hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    put(prefix, size);
    if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
    else { put(CLEAR, size); dict = new Map(); next = 258; size = 9; }
    prefix = k;
  }
  put(prefix, size); put(EOI, size);
  if (bits > 0) bytes.push(cur & 255);
  return { bytes, MIN };
}

/** frames: [{ data: Uint8ClampedArray(RGBA), delay: ms }] */
function encodeGif(frames, w, h) {
  const out = [];
  const w16 = (v) => out.push(v & 255, (v >> 8) & 255);
  out.push(...Buffer.from('GIF89a'));
  w16(w); w16(h); out.push(0xF7, 0, 0);
  for (let i = 0; i < PAL.length; i++) out.push(PAL[i]);
  out.push(0x21, 0xFF, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0);
  for (const f of frames) {
    out.push(0x21, 0xF9, 4, 0x00); w16(Math.max(2, Math.round(f.delay / 10))); out.push(0, 0);
    out.push(0x2C); w16(0); w16(0); w16(w); w16(h); out.push(0);
    const { bytes, MIN } = lzw(quantize(f.data, w, h));
    out.push(MIN);
    for (let i = 0; i < bytes.length; i += 255) { const n = Math.min(255, bytes.length - i); out.push(n); for (let j = 0; j < n; j++) out.push(bytes[i + j]); }
    out.push(0);
  }
  out.push(0x3B);
  return Buffer.from(out);
}
module.exports = { encodeGif };
