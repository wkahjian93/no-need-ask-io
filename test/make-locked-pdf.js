// Makes test/fixtures/locked-sample.pdf: a one-page, password-protected PDF (password 1234, RC4 40-bit like many
// e-statements) with made-up details, to test opening locked PDFs in the app. Run: node test/make-locked-pdf.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PAD = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex');
const md5 = b => crypto.createHash('md5').update(b).digest();
function rc4(key, data) {
  const s = [...Array(256).keys()]; let j = 0;
  for (let i = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; [s[i], s[j]] = [s[j], s[i]]; }
  const out = Buffer.alloc(data.length); let i = 0; j = 0;
  for (let k = 0; k < data.length; k++) { i = (i + 1) & 255; j = (j + s[i]) & 255; [s[i], s[j]] = [s[j], s[i]]; out[k] = data[k] ^ s[(s[i] + s[j]) & 255]; }
  return out;
}
const pad = pw => Buffer.concat([Buffer.from(pw, 'latin1'), PAD]).subarray(0, 32);
const USER = '1234', OWNER = 'owner-' + USER, P = -44, ID = md5(Buffer.from('nnaio-locked-sample'));
const O = rc4(md5(pad(OWNER)).subarray(0, 5), pad(USER));
const pBytes = Buffer.alloc(4); pBytes.writeInt32LE(P);
const KEY = md5(Buffer.concat([pad(USER), O, pBytes, ID])).subarray(0, 5);
const U = rc4(KEY, PAD);
const objKey = (n, g) => md5(Buffer.concat([KEY, Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, g & 255, (g >> 8) & 255])])).subarray(0, 10);

const lines = [
  ['SAMPLE ONLY - made-up test data', 10],
  ['Policy Statement', 18],
  ['Policyholder: TEST PERSON', 11],
  ['Policy number: 0000000000', 11],
  ['Plan: SmartProtect You Exclusive 2 (SPYE2)', 11],
  ['Policy status: Lapsed', 11],
  ['Premium due date: 15 Oct 2026', 11],
  ['Grace period ended: 14 Nov 2026', 11],
  ['Modal premium: RM 250.00 monthly', 11],
  ['Please contact your agent about reinstatement of this policy.', 11]
];
let y = 760, content = 'BT\n';
for (const [t, size] of lines) { content += `/F1 ${size} Tf 1 0 0 1 60 ${y} Tm (${t.replace(/[()\\]/g, '\\$&')}) Tj\n`; y -= size + 14; }
content += 'ET\n';
const stream = rc4(objKey(4, 0), Buffer.from(content, 'latin1'));

const objs = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  null, // the encrypted content stream
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Filter /Standard /V 1 /R 2 /O <${O.toString('hex')}> /U <${U.toString('hex')}> /P ${P} >>`
];
const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')], offs = [];
let pos = parts[0].length;
objs.forEach((o, i) => {
  const b = o === null
    ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${stream.length} >>\nstream\n`, 'latin1'), stream, Buffer.from('\nendstream\nendobj\n', 'latin1')])
    : Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1');
  offs.push(pos); parts.push(b); pos += b.length;
});
let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Encrypt 6 0 R /ID [<${ID.toString('hex')}> <${ID.toString('hex')}>] >>\nstartxref\n${pos}\n%%EOF\n`;
parts.push(Buffer.from(xref, 'latin1'));
const out = path.join(__dirname, 'fixtures', 'locked-sample.pdf');
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, Buffer.concat(parts));
console.log('wrote', out, '(password ' + USER + ')');
