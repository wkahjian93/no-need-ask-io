// Underwriting index for the AI library, built from GE's Field Underwriting Guide (Oct 2026)
// (private/source/uw/Field Underwriting Guide (Oct 2026).txt, extracted from the PDF).
// One entry per medical condition in the guide's tables (what underwriting considers, the reports/tests needed,
// Best Case / Worst Case), family-history entries, and one entry per other page (BMI charts, occupation,
// residency, limits, substandard ratings, glossary...). Also returns Chinese -> English search words, because
// the library search only understands Chinese words that have an English mapping.
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, '..', 'private', 'source', 'uw', 'Field Underwriting Guide (Oct 2026).txt');
const GUIDE = 'Field Underwriting Guide (Oct 2026)';

// everyday words (Malay / Manglish / Chinese) -> the guide's English condition words
const COMMON = {
  'kencing manis': 'diabetes mellitus', 'sugar': 'diabetes', 'gula': 'diabetes', '糖尿': 'diabetes mellitus', '血糖': 'diabetes blood sugar',
  'darah tinggi': 'hypertension high blood pressure', 'high blood': 'hypertension', 'bp': 'hypertension blood pressure', '血压': 'hypertension blood pressure',
  'sakit jantung': 'heart disease', 'jantung': 'heart', 'bypass': 'coronary artery bypass heart', 'stent': 'angioplasty stent heart', 'angin ahmar': 'stroke', 'strok': 'stroke',
  'kanser': 'cancer', 'barah': 'cancer', '癌': 'cancer', '肿瘤': 'tumour growth', 'ketulan': 'lump growth', 'benjolan': 'lump', '肿块': 'lump growth', '囊肿': 'cyst',
  'lelah': 'asthma', 'semput': 'asthma', '哮喘': 'asthma', 'batuk kering': 'tuberculosis', 'tb': 'tuberculosis',
  'buah pinggang': 'kidney', '肾': 'kidney', 'batu karang': 'kidney stone', '肾石': 'kidney stone', 'hati': 'liver', '肝': 'liver', 'fatty liver': 'fatty liver', '脂肪肝': 'fatty liver',
  'hep b': 'hepatitis b', 'hepb': 'hepatitis b', '乙肝': 'hepatitis b', '肝炎': 'hepatitis', 'tiroid': 'thyroid', '甲状腺': 'thyroid',
  'kemurungan': 'depression', '忧郁': 'depression', '抑郁': 'depression', 'anxiety': 'anxiety mental', 'gila': 'mental disorder', '精神': 'mental disorder',
  'gemuk': 'overweight obesity bmi', 'overweight': 'overweight obesity bmi', 'fat': 'overweight obesity bmi', '肥胖': 'obesity bmi', '胖': 'overweight bmi', 'berat badan': 'weight bmi', '体重': 'weight bmi', 'bmi': 'bmi height weight',
  'kolesterol': 'cholesterol', '胆固醇': 'cholesterol', 'sawan': 'epilepsy convulsion', '羊癫疯': 'epilepsy',
  'mengandung': 'pregnancy pregnant', 'hamil': 'pregnancy pregnant', '怀孕': 'pregnancy pregnant', 'pregnant': 'pregnancy',
  'pembedahan': 'surgery operation', 'operation': 'surgery operation', 'operate': 'surgery', '开刀': 'surgery operation', '手术': 'surgery operation',
  'slipped disc': 'prolapsed intervertebral disc spine', 'sakit belakang': 'back pain spine', '腰痛': 'back pain spine', 'gastrik': 'gastritis', '胃': 'gastritis stomach',
  'kurang darah': 'anaemia', '贫血': 'anaemia', 'thalassemia': 'thalassaemia', '地中海贫血': 'thalassaemia', 'migraine': 'migraine headache', 'sakit kepala': 'headache',
  'smoker': 'smoking', 'merokok': 'smoking', '吸烟': 'smoking', 'alcohol': 'alcohol', 'arak': 'alcohol', '喝酒': 'alcohol',
  'pekerjaan': 'occupation', 'occupation': 'occupation', '职业': 'occupation', 'foreigner': 'foreign residency citizenship', 'warga asing': 'foreign residency', '外国人': 'foreign residency citizenship',
  // the question itself: "can my client buy insurance?"
  'boleh beli': 'underwriting', 'boleh ambil insurans': 'underwriting', '能买': 'underwriting', '可以买': 'underwriting', '能不能买': 'underwriting', '投保': 'underwriting', '核保': 'underwriting',
  'can buy': 'underwriting', 'can he buy': 'underwriting', 'can she buy': 'underwriting', 'can still buy': 'underwriting', 'insurable': 'underwriting', 'accept': 'underwriting', 'loading': 'loading underwriting', 'exclusion': 'exclusion underwriting'
};

const CJK = /[㐀-鿿]/;
const isCjkLine = s => CJK.test(s) && !/[a-z]{4,}/i.test(s.replace(/G6PD|TIA|MI|HIV/g, ''));
const clean = s => s.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();

const TABLE = path.join(path.dirname(FILE), 'fug-table.json'); // column-by-column table from tools/uw-table.js (preferred)

/* condition rows from the clean table: each column kept apart, so Best Case / Worst Case read correctly */
function fromTable(rows) {
  const out = [], syn = {};
  for (const r of rows) {
    const family = /^FAMILY HISTORY/i.test(r.title), label = (family ? 'Family history of ' : '') + r.name.replace(/\s+/g, ' ');
    const prev = out[out.length - 1];
    const part = `Underwriting considerations:\n${r.cons || '-'}\nUnderwriting requirements (reports, tests):\n${r.req || '-'}\nCase scenario:\n${r.scen || '-'}`;
    if (prev && prev.cond === label) { prev.x += `\n(continued p${r.page})\n` + part; continue; }
    out.push({cond: label, h: `Underwriting: ${label} (${r.zh.replace(/\s+/g, '')}) - ${GUIDE}, p${r.page}`,
      x: `${GUIDE}, page ${r.page}${family ? ', Family History table (the condition is in a parent or sibling, not the applicant)' : r.section ? ', ' + r.section : ''}.\nCondition: ${label} (${r.zh}).\n${part}`});
    for (const zh of r.zh.split(/[\/、,，]/).map(z => z.replace(/[\s()（）]/g, '')).filter(z => z.length >= 2 && CJK.test(z))) if (!syn[zh]) syn[zh] = r.name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  out.forEach(e => delete e.cond);
  return {out, syn};
}

function topics() {
  if (!fs.existsSync(FILE)) return {topics: [], syn: {}};
  if (fs.existsSync(TABLE)) { // clean table for the condition pages + the plain text for every other page
    const t = fromTable(JSON.parse(fs.readFileSync(TABLE, 'utf8'))), tablePages = new Set(JSON.parse(fs.readFileSync(TABLE, 'utf8')).map(r => r.page));
    const parts = fs.readFileSync(FILE, 'utf8').split(/\n--- page (\d+) ---\n/), pages = [];
    for (let i = 1; i < parts.length; i += 2) {
      const page = +parts[i], body = parts[i + 1] || '', title = (body.split('\n').map(s => s.trim()).find(l => /[A-Za-z]{3}/.test(l) && !/^\d+$/.test(l)) || '').replace(/\s+/g, ' ');
      if (!tablePages.has(page) && page >= 4 && clean(body).length > 120) pages.push({h: `Underwriting guide: ${title.slice(0, 80)} (p${page})`, x: clean(`${GUIDE}, page ${page}: ${title}\n${body}`)});
    }
    return {topics: t.out.concat(pages), syn: Object.assign({}, t.syn, COMMON), clean: true};
  }
  const parts = fs.readFileSync(FILE, 'utf8').split(/\n--- page (\d+) ---\n/), out = [], syn = {};
  let section = '';
  const push = (h, x) => out.push({h: h.slice(0, 200), x: clean(x)});
  for (let i = 1; i < parts.length; i += 2) {
    const page = +parts[i], body = parts[i + 1] || '', L = body.split('\n').map(s => s.trim()).filter(Boolean);
    const title = (L.find(l => /[A-Za-z]{3}/.test(l) && !/^\d+$/.test(l)) || '').replace(/\s+/g, ' ');
    if (!/MEDICAL CONDITION\s+UNDERWRITING CONSIDERATIONS/i.test(body)) {
      if (page >= 4 && clean(body).length > 120) push(`Underwriting guide: ${title.slice(0, 80)} (p${page})`, `${GUIDE}, page ${page}: ${title}\n${body}`);
      continue;
    }
    const family = /^FAMILY HISTORY/i.test(title);
    const sec = L.find(l => /^[A-N]\. [A-Z]/.test(l)); if (sec) section = sec.replace(/\s+/g, ' ');
    // condition blocks start at an English name line followed by its Chinese name line
    const starts = [];
    for (let k = 0; k < L.length - 1; k++) {
      if (/^[•\-]/.test(L[k]) || !/[A-Za-z]/.test(L[k]) || CJK.test(L[k]) || L[k].length > 70 || !isCjkLine(L[k + 1])) continue;
      if (/^(MEDICAL IMPAIRMENTS|MEDICAL CONDITION)/i.test(L[k]) || /^[A-N]\. /.test(L[k])) continue;
      let name = L[k]; if (k > 0 && /[\/,(]$/.test(L[k - 1]) && !/^[•\-]/.test(L[k - 1])) name = L[k - 1] + ' ' + name; // names split over two lines
      starts.push({k, name: name.replace(/\s+/g, ' ').replace(/\s*\/\s*$/, ''), zh: L[k + 1]});
    }
    starts.forEach((s, j) => {
      const block = L.slice(s.k, j + 1 < starts.length ? starts[j + 1].k : L.length).join('\n');
      const prev = out[out.length - 1], label = family ? `Family history of ${s.name}` : s.name;
      if (prev && prev.cond === label) { prev.x = clean(prev.x + '\n(continued p' + page + ')\n' + block); return; } // same condition carried over a page
      const e = {h: `Underwriting: ${label} (${s.zh.replace(/\s+/g, '')}) - ${GUIDE}, p${page}`,
        x: `${GUIDE}, page ${page}${family ? ', Family History table (the condition is in a parent or sibling, not the applicant)' : section ? ', ' + section : ''}.\n` +
           `Condition: ${label} (${s.zh}).\nColumns: Underwriting considerations | Underwriting requirements (reports, tests) | Case scenario (Best Case / Worst Case).\n${block}`, cond: label};
      out.push(e);
      // Chinese condition names -> English search words
      for (const zh of s.zh.split(/[\/、,，]/).map(z => z.replace(/[\s()（）]/g, '')).filter(z => z.length >= 2 && CJK.test(z))) if (!syn[zh]) syn[zh] = s.name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    });
  }
  out.forEach(e => delete e.cond);
  return {topics: out, syn: Object.assign({}, syn, COMMON)};
}

module.exports = {topics, GUIDE};
if (require.main === module) {
  const r = topics(), cond = r.topics.filter(t => /^Underwriting: /.test(t.h));
  console.log(r.topics.length, 'entries:', cond.length, 'conditions,', r.topics.length - cond.length, 'other pages;', Object.keys(r.syn).length, 'search words');
  console.log(cond.slice(0, 6).map(t => t.h).join('\n'));
  console.log('---'); console.log(cond.find(t => /Hypertension/.test(t.h) && !/Family/.test(t.h)).x.slice(0, 900));
}
