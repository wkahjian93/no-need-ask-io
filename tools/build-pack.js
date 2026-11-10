// Builds the PRIVATE knowledge files from private/source + private/guides.js + private/build/shots.
//   private/build/nnaio_pack.json      -> phones download this (guides + screenshots + search words)
//   private/build/nnaio_lib_<n>.json   -> stays on the team server; searched there for AI answers
// Run: node tools/build-pack.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), P = path.join(ROOT, 'private'), OUT = path.join(P, 'build');
const guides = require(path.join(P, 'guides.js'));
const SYN = require('./synonyms.js');
const ver = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

// ---------- 1. core pack (phones) ----------
const shots = {}, missing = [];
for (const g of guides) for (const s of g.steps) if (s.shot && !shots[s.shot]) {
  const f = path.join(OUT, 'shots', s.shot + '.jpg');
  if (!fs.existsSync(f)) { missing.push(s.shot); continue; }
  shots[s.shot] = fs.readFileSync(f).toString('base64');
}
if (missing.length) { console.error('Missing screenshots:', missing); process.exit(1); }
// panel clinics with map positions (for "nearest 5"); see tools/clinics.js and tools/geocode-clinics.js
const CL = require('./clinics.js').forPack();
console.log('panel clinics placed:', CL.clinics.length, JSON.stringify(CL.counts), CL.unplaced.length ? 'NOT placed: ' + CL.unplaced.join('; ') : '');
const pack = {app: 'nnaio', ver, built: new Date().toISOString(), source: 'ePartner Study Pack + screenshots, 9 Nov 2026', guides, shots, syn: SYN,
  clinics: CL.clinics, geo: CL.geo, clinicsSource: 'GE New Business Panel Clinic Listing (ePartner), extracted 9 Nov 2026. Map positions © OpenStreetMap contributors (ODbL) and GeoNames (CC BY 4.0).'};
fs.writeFileSync(path.join(OUT, 'nnaio_pack.json'), JSON.stringify(pack));

// ---------- 2. library chunks (server) ----------
const chunks = [];
const clean = s => s.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
function push(src, head, text, max = 1800) {
  text = clean(text); if (text.length < 40) return;
  for (let i = 0; i < text.length; i += max) {
    let piece = text.slice(i, i + max + 150); // small overlap
    chunks.push({s: src, h: head.slice(0, 200), x: piece});
  }
}
function splitBy(md, re) { // returns [{head, body}]
  const out = []; let cur = null;
  for (const line of md.split('\n')) {
    if (re.test(line)) { if (cur) out.push(cur); cur = {head: line.replace(/^#+\s*/, ''), body: ''}; }
    else if (cur) cur.body += line + '\n';
  }
  if (cur) out.push(cur);
  return out;
}
const read = f => fs.readFileSync(path.join(P, 'source', f), 'utf8');

// Study pack: the curated answers (highest trust)
for (const sec of splitBy(read('study_pack.md'), /^#{2,4} /)) push('Study Pack (9 Nov 2026)', sec.head, sec.body, 2200);
// Operations PDFs (CS manual, NB, claims, healthcare, user guides)
for (const sec of splitBy(read('ePartner_Operations_fulltext.md'), /^## /)) {
  const m = sec.body.match(/^Source: (.*)$/m), body = sec.body.replace(/^Source: .*$/m, '').replace(/\[p(\d+)\]/g, '(p$1)');
  push('ePartner Operations PDF', sec.head + (m ? ' | ' + path.basename(m[1]) : ''), body);
}
// Product PDFs (ILP)
for (const sec of splitBy(read('ePartner_ILP_products_fulltext.md'), /^## /)) {
  const m = sec.body.match(/^Source: (.*)$/m), body = sec.body.replace(/^Source: .*$/m, '').replace(/\[p(\d+)\]/g, '(p$1)');
  push('ePartner Product PDF (ILP)', sec.head + (m ? ' | ' + path.basename(m[1]) : ''), body);
}
// Website pages (menus, document names, where things are)
for (const sec of splitBy(read('ePartner_full_crawl.md'), /^## PAGE /)) {
  const body = sec.body.replace(/^- \[([^\]]+)\]\([^)]*\)/gm, '- $1').replace(/\((?:DAM|\/content)[^)]*\)/g, '');
  push('ePartner page', sec.head, body);
}
// NB panel clinics, one chunk group per area
for (const sec of splitBy(read('ePartner_NB_Panel_Clinics.md'), /^## /)) push('NB Panel Clinic Listing (9 Nov 2026)', 'Panel clinics: ' + sec.head, sec.body, 2400);

// split into server parts of <= 3.5 MB each
const parts = []; let cur = [], size = 0;
for (const c of chunks) {
  const n = JSON.stringify(c).length;
  if (size + n > 3500000 && cur.length) { parts.push(cur); cur = []; size = 0; }
  cur.push(c); size += n;
}
if (cur.length) parts.push(cur);
const catalog = guides.map(g => ({id: g.id, title: g.title}));
fs.readdirSync(OUT).filter(f => /^nnaio_lib_\d+\.json$/.test(f)).forEach(f => fs.unlinkSync(path.join(OUT, f)));
parts.forEach((p, i) => fs.writeFileSync(path.join(OUT, `nnaio_lib_${i + 1}.json`),
  JSON.stringify({app: 'nnaio-lib', ver, part: i + 1, of: parts.length, catalog: i === 0 ? catalog : undefined, syn: i === 0 ? SYN : undefined, chunks: p})));

const kb = f => Math.round(fs.statSync(path.join(OUT, f)).size / 1024);
console.log(`ver ${ver}: ${guides.length} guides, ${Object.keys(shots).length} screenshots, pack ${kb('nnaio_pack.json')} KB`);
console.log(`library: ${chunks.length} chunks in ${parts.length} parts: ` + parts.map((p, i) => kb(`nnaio_lib_${i + 1}.json`) + ' KB').join(', '));
