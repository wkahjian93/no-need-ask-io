// Draws the app icon (ink square, gold magnifying glass = "find it yourself") into docs/icons.
const zlib = require('zlib'), fs = require('fs'), path = require('path');
function png(N, px) {
  const raw = Buffer.alloc((N * 4 + 1) * N);
  for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; for (let x = 0; x < N; x++) px(x, y).forEach((v, i) => raw[y * (N * 4 + 1) + 1 + x * 4 + i] = v); }
  const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  const crc = b => { let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(N, 0); ih.writeUInt32BE(N, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const ink = [11, 12, 16], gold = [232, 176, 75], cream = [244, 239, 228];
const mix = (a, b, m) => a.map((q, i) => Math.round(q * (1 - m) + b[i] * m));
function draw(N) {
  return png(N, (X, Y) => {
    const u = (X + 0.5) / N, v = (Y + 0.5) / N; let col = ink;
    const cx = 0.44, cy = 0.42, R = 0.22, W = 0.055, d = Math.hypot(u - cx, v - cy);
    if (d < R - W / 2) col = mix(ink, cream, 0.08);                              // lens
    const ring = Math.abs(d - R) - W / 2; if (ring < 0) col = gold; else if (ring < 1 / N) col = mix(col, gold, 1 - ring * N);
    // handle from 45deg on the ring to bottom-right
    const ax = cx + R * 0.72, ay = cy + R * 0.72, bx = 0.78, by = 0.76;
    const t = Math.max(0, Math.min(1, ((u - ax) * (bx - ax) + (v - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    const hd = Math.hypot(u - (ax + t * (bx - ax)), v - (ay + t * (by - ay))) - 0.045;
    if (hd < 0) col = gold; else if (hd < 1 / N) col = mix(col, gold, 1 - hd * N);
    // small check mark inside the lens
    const seg = (x1, y1, x2, y2) => { const tt = Math.max(0, Math.min(1, ((u - x1) * (x2 - x1) + (v - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2))); return Math.hypot(u - (x1 + tt * (x2 - x1)), v - (y1 + tt * (y2 - y1))); };
    const ck = Math.min(seg(0.35, 0.43, 0.42, 0.50), seg(0.42, 0.50, 0.55, 0.35)) - 0.028;
    if (ck < 0) col = gold; else if (ck < 1 / N) col = mix(col, gold, 1 - ck * N);
    return [...col, 255];
  });
}
const out = path.join(__dirname, '..', 'docs', 'icons');
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, 'icon-192.png'), draw(192));
fs.writeFileSync(path.join(out, 'icon-512.png'), draw(512));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), draw(180));
console.log('icons written');
