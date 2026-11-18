// Builds the PRIVATE knowledge files from private/source + private/guides.js + private/build/shots.
//   private/build/nnaio_pack.json      -> phones download this (guides + screenshots + search words)
//   private/build/nnaio_lib_<n>.json   -> stays on the team server; searched there for AI answers
// Run: node tools/build-pack.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), P = path.join(ROOT, 'private'), OUT = path.join(P, 'build');
const guides = require(path.join(P, 'guides.js'));
const SYN = require('./synonyms.js');
// underwriting index (Field Underwriting Guide): its Chinese condition names + everyday Malay/Chinese words become search words too
const UW = require('./uw-topics.js').topics();
for (const k in UW.syn) if (!(k in SYN)) SYN[k] = UW.syn[k];
// product index (Agency Manuals + FAQs): Chinese plan names become search words
const PROD = require('./product-topics.js').topics();
for (const k in PROD.syn) if (!(k in SYN)) SYN[k] = PROD.syn[k];
Object.assign(SYN, {gwe: 'great wealth enhancer 0549', sbs: 'smart baby shield plus', smcc: 'smart multi critical care', scr: 'smart critical relief', sepcc: 'smart early payout criticalcare'});
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
// GE documents added later (private/source/docs-*/ *.txt, one file per PDF / deck / ePartner page, "--- page N ---" markers):
// chunks of ~1,800 characters labelled with the document name and pages, so answers can cite them
for (const dir of fs.readdirSync(path.join(P, 'source')).filter(d => /^docs-/.test(d) && !/-csm$/.test(d)).sort()) { // *-csm = CS manual, used by the CS index below
  const added = dir.replace(/^docs-/, ''), label = `GE document (added ${added})`;
  for (const f of fs.readdirSync(path.join(P, 'source', dir)).filter(f => f.endsWith('.txt')).sort()) {
    const name = f.replace(/\.txt$/, ''), text = fs.readFileSync(path.join(P, 'source', dir, f), 'utf8');
    const pages = text.split(/\n--- (?:page|slide) (\d+) ---\n/);
    let buf = '', from = null, to = null;
    const flush = () => { if (clean(buf).length >= 40) chunks.push({s: label, h: `${name}${from ? ` (p${from}${to !== from ? '–' + to : ''})` : ''}`.slice(0, 200), x: clean(buf)}); buf = ''; from = to = null; };
    if (pages.length < 3) { push(label, name, text); continue; }
    for (let i = 1; i < pages.length; i += 2) {
      const n = pages[i], body = clean(pages[i + 1] || '');
      if (!body) continue;
      if (buf && buf.length + body.length > 1800) flush();
      if (body.length > 2200) { for (let k = 0; k < body.length; k += 1800) chunks.push({s: label, h: `${name} (p${n})`.slice(0, 200), x: body.slice(k, k + 1950)}); continue; }
      buf += (buf ? '\n' : '') + body; from = from || n; to = n;
    }
    flush();
  }
}
// Underwriting index: one entry per medical condition in the Field Underwriting Guide (+ family history, BMI, occupation,
// residency and other pages). "Can my client buy insurance with X?" is answered from these (the server reads them first).
for (const t of UW.topics) chunks.push({s: 'Study Pack: Underwriting index (Field Underwriting Guide, Oct 2026)', h: t.h.slice(0, 200), x: t.x});
// Product index: one entry per GE product / rider (Agency Manual + FAQ). A question naming a product reads its entry first.
for (const t of PROD.topics) chunks.push({s: 'Study Pack: Product index (Agency Manuals & FAQs)', h: t.h.slice(0, 300), x: t.x});
// CS transaction index: one entry per Customer Service transaction (what agents call it in EN/中文/BM, which GE guide
// + FAQ, key rules, FAQ questions). Curated like the Study Pack, so it is labelled as part of it (the server ranks those first).
for (const t of require('./cs-topics.js').topics().topics) chunks.push({s: 'Study Pack: CS transaction index (from GE CS guides, Sep 2025 – Jan 2026)', h: t.h.slice(0, 200), x: t.x});
// NB panel clinics, one chunk group per area
// (from GE_Panel_Clinics_Nov2026.csv: one line per clinic, tests spelled out, so "treadmill in Kulim" finds it)
for (const sec of require('./clinics.js').libraryText()) push('NB Panel Clinic Listing (Nov 2026)', 'Panel clinics: ' + sec.head, sec.body, 2400);

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
