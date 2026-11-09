// Finds the red highlight box in each screenshot (private/shots/*.png) and writes a crop rectangle for phones
// to private/shots/crops.json, so wide screenshots are cut down around the place to tap.
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const DIR = path.join(__dirname, '..', 'private', 'shots');

function decode(buf) { // minimal PNG decoder: 8-bit, colour type 2 (RGB) or 6 (RGBA), not interlaced
  let p = 8, W, H, ct, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { W = d.readUInt32BE(0); H = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12]) throw new Error('unsupported png'); }
    if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 0; if (!ch) throw new Error('colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = W * ch, out = Buffer.alloc(H * stride);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)], src = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[y * stride + x - ch] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= ch && y ? out[(y - 1) * stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return {W, H, ch, px: out};
}

const crops = {};
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.png'))) {
  const {W, H, ch, px} = decode(fs.readFileSync(path.join(DIR, f)));
  let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * ch, r = px[i], g = px[i + 1], b = px[i + 2];
    if (r > 230 && g < 60 && b > 40 && b < 90) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } // #ff1f3d border
  }
  const id = f.replace('.png', '');
  if (n < 30) { crops[id] = null; continue; }
  // keep full height; cut width to about 2x the box (at least 560px) when the screenshot is much wider
  const want = Math.max(560, (x1 - x0) * 1.9 + 120);
  if (W <= want * 1.15) { crops[id] = null; continue; }
  const cx = (x0 + x1) / 2; let L = Math.round(cx - want / 2); L = Math.max(0, Math.min(W - want, L));
  crops[id] = [L, 0, Math.round(want), H];
}
fs.writeFileSync(path.join(DIR, 'crops.json'), JSON.stringify(crops, null, 1));
console.log(Object.entries(crops).map(([k, v]) => k + ': ' + (v ? v.join(',') : 'full')).join('\n'));
