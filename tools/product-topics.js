// Product index for the AI library: one entry per GE product / rider, built from its Agency Manual + FAQ
// (private/source/products-nov18/*.txt). Each entry: the names agents use (abbreviation, codes, Chinese name),
// which documents and their dates, the Agency Manual's opening (plan codes, design, who can buy it, benefits)
// and the questions its FAQ answers. The heading carries [names and codes] so the server can tell when a question
// names this product and read its manual first.
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'private', 'source', 'products-nov18');

// n: product, k: type, a: what agents call it, f: file name patterns
const PRODUCTS = [
  {n: 'SmartProtect You (SPY-100 / SPY-80)', k: 'Investment-linked basic plan', a: 'spy, spy-100, spy100, spy-80, spy80, smartprotect you, 0519, 0531, 8004, 8006', f: [/^Agency Manual_SmartProtect You \(SPY-100\)/, /^Agency Manual_SmartProtect You \(SPY-80\)/, /^FAQ - SmartProtect You \(0519, 0531\)/]},
  {n: 'SmartProtect Wealth Plus', k: 'Investment-linked basic plan', a: 'spwp, smartprotect wealth plus, 0525', f: [/SmartProtect Wealth Plus/]},
  {n: 'SmartProtect Junior', k: 'Investment-linked basic plan for children', a: 'spj, smartprotect junior, 0495, child plan, kids plan, 儿童计划', f: [/SmartProtect Junior/]},
  {n: 'Smart Revive Max', k: 'Investment-linked basic plan', a: 'srm, smart revive max, 0562', f: [/Smart Revive Max/]},
  {n: 'Smart Wealth Global', k: 'Investment-linked basic plan', a: 'swg, smart wealth global, 8031', f: [/Smart Wealth Global/]},
  {n: 'Prestige Wealth Global', k: 'Investment-linked basic plan', a: 'pwg, prestige wealth global, 8033', f: [/Prestige Wealth Global/]},
  {n: 'GREAT Wealth Enhancer', k: 'basic plan', a: 'gwe, great wealth enhancer, wealth enhancer, 0549', f: [/GREAT Wealth Enhancer/]},
  {n: 'Smart Health Protector (3.0 mil)', k: 'Investment-linked medical rider (medical card)', a: 'shp, shp2, smart health protector, medical card, 医药卡, 精明医疗保健, kad perubatan', f: [/^Agency Manual - Smart Health Protector_3\.0mil/, /^FAQ_Smart Health Protector_3mil/]},
  {n: 'Smart Health Protector with Wellness Reward', k: 'Investment-linked medical rider (medical card) with wellness reward', a: 'shp wellness, wellness reward, smart health protector wellness reward, 医药卡', f: [/Smart Health Protector with Wellness Reward/, /Smart Health Protector_Wellness Reward/]},
  {n: 'GREAT MediValue (3.0 mil)', k: 'standalone medical plan (medical card)', a: 'gmv, great medivalue, medivalue, u904, u906, u908, u910, u912, medical card, 医药卡', f: [/GREAT MediValue/]},
  {n: 'Smart Baby Shield Plus', k: 'plan for babies / pregnancy', a: 'sbs, sbs+, sbsp, smart baby shield plus, baby shield, baby plan, 婴儿, 孕妇, 怀孕保险', f: [/Smart Baby Shield Plus/]},
  {n: 'Smart Multi Critical Care', k: 'critical illness rider (multiple claims)', a: 'smcc, smart multi critical care, multi critical care, u189, u822, multiple ci, 多重危疾', f: [/Smart Multi Critical Care/]},
  {n: 'Smart Critical Relief', k: 'critical illness rider', a: 'scr, smart critical relief, u190, u837', f: [/Smart Critical Relief/]},
  {n: 'Smart Early Payout CriticalCare', k: 'early-stage critical illness rider', a: 'sepcc, smart early payout criticalcare, early payout, early stage ci, u806, 早期危疾', f: [/Smart Early Payout CriticalCare/]},
  {n: 'IL Critical Illness Benefit Rider', k: 'investment-linked critical illness rider', a: 'il ci rider, ci benefit rider, u807, 危疾附加', f: [/IL Critical Illness Benefit Rider \(U807\)/]},
  {n: 'IL Critical Illness Plus Rider', k: 'investment-linked critical illness rider', a: 'il ci plus, ci plus rider, u140, u811', f: [/IL Critical Illness Plus Rider/]},
  {n: 'IL Critical Illness Benefit Advance Rider', k: 'investment-linked critical illness rider (advance payment)', a: 'ci advance, ci benefit advance, u170', f: [/IL Critical Illness Benefit Advance Rider/]},
  {n: 'IL Premium Waiver on CI Rider', k: 'investment-linked waiver rider', a: 'premium waiver ci, waiver on ci, u808, 保费豁免', f: [/IL Premium Waiver on CI Rider/]},
  {n: 'IL Payer Benefit Extra Rider', k: 'investment-linked payer waiver rider', a: 'payer benefit, payer extra, payor, u810, 付款人豁免', f: [/IL Payer Benefit Extra Rider \(U810\)/]},
  {n: 'IL Payer Benefit Extra Rider (Junior)', k: 'investment-linked payer waiver rider for juvenile policies', a: 'payer benefit junior, payer jr, u148', f: [/^U148_/]},
  {n: 'IL Premium Waiver Extra Rider (Junior)', k: 'investment-linked waiver rider for juvenile policies', a: 'premium waiver junior, waiver jr, u147', f: [/^U147_/]},
  {n: 'IL GIO Payer Rider', k: 'investment-linked payer rider (guaranteed issue)', a: 'gio payer, u940', f: [/IL GIO Payer Rider/]},
  {n: 'IL Hospitalisation Benefits Rider', k: 'investment-linked hospital income rider', a: 'hospitalisation benefit, hospital income, u75, u803, 住院津贴', f: [/IL Hospitalisation Benefits/]},
  {n: 'IL Accidental Death and Dismemberment Benefits Rider', k: 'investment-linked accident rider', a: 'add rider, accidental death dismemberment, u801, u72, il add, 意外', f: [/IL Accidental Death and Dismemberment/, /IL Accident Death and Disbursement/]},
  {n: 'IL Comprehensive Accident Benefits Xtra Rider', k: 'investment-linked accident rider', a: 'comprehensive accident, accident xtra, u802, 意外', f: [/IL Comprehensive Accident Benefits Xtra/]},
  {n: 'IL Accidental Guard Rider', k: 'investment-linked accident rider', a: 'accidental guard, u347, 意外', f: [/IL Accidental Guard Rider/]}
];

const tidy = s => s.replace(/--- page \d+ ---/g, ' ').replace(/Page \d+ of \d+/gi, ' ').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dateOf(name) {
  let m = name.match(/(?:^|[^0-9])(20\d{2})(\d{2})(\d{2})(?![0-9])/); if (m && +m[2] <= 12) return `${+m[3]} ${MON[+m[2] - 1]} ${m[1]}`;
  m = name.match(/(?:^|[^0-9])(\d{2})(\d{2})(20\d{2})(?![0-9])/); if (m && +m[2] <= 12) return `${+m[1]} ${MON[+m[2] - 1]} ${m[3]}`;
  m = name.match(/(\d{1,2})\s?(JAN|FEB|MAR|APR|MAY|JUNE?|JULY?|AUG|SEPT?|OCT|NOV|DEC)(\d{2,4})?(?![A-Z])/i);
  if (m) return `${+m[1]} ${m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase()}${m[3] ? ' ' + (m[3].length === 2 ? '20' + m[3] : m[3]) : ''}`;
  return '';
}

function topics() {
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.txt')) : [];
  const out = [], syn = {}, used = new Set();
  for (const P of PRODUCTS) {
    const docs = P.f.map(re => files.filter(f => re.test(f) && !used.has(f))).flat();
    if (!docs.length) continue; docs.forEach(f => used.add(f));
    const texts = docs.map(f => ({name: f.replace(/\.txt$/, ''), text: tidy(fs.readFileSync(path.join(DIR, f), 'utf8'))}));
    const am = texts.filter(d => !/FAQ/i.test(d.name)), faq = texts.filter(d => /FAQ/i.test(d.name));
    const codes = [...new Set(texts.flatMap(d => (d.text.match(/\b(?:U ?\d{2,3}|0[1-9]\d{2}|80\d{2})\b/g) || []).map(c => c.replace(/\s/g, ''))))].slice(0, 16);
    const zh = (am.map(d => (d.text.match(/Plan Name\s*:\s*[A-Za-z0-9 ()+.\-]+?\s*([㐀-鿿][㐀-鿿()（）\s]*)/) || [])[1]).find(Boolean) || '').trim();
    if (zh) syn[zh.replace(/\s/g, '')] = P.n.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const qs = faq.flatMap(d => [...d.text.matchAll(/(?:^|\n)\s*(?:Q\s*\d*[.:)]?|\d{1,2}[.)])\s*([^\n?]{10,200}\?)/g)].map(m => m[1].replace(/\s+/g, ' ').trim())).slice(0, 30);
    // own names and codes only: documents also mention the plans a rider attaches to, which would mis-route questions
    // category words ("medical card", 意外) describe many products, so they never count as naming this one
    const GENERIC = /^(medical card|医药卡|kad perubatan|child plan|kids plan|baby plan|儿童计划|婴儿|孕妇|怀孕保险|意外|危疾附加|保费豁免|付款人豁免|住院津贴|hospital income|early stage ci|multiple ci|多重危疾|早期危疾|early payout|wellness reward|payer benefit|hospitalisation benefit|add rider|il ci rider)$/i;
    const tags = [...new Set(P.a.split(',').map(s => s.trim()).filter(t => !GENERIC.test(t)).concat(zh ? [zh.replace(/\s/g, '')] : []))];
    const lead = am.length ? am : texts;
    out.push({h: `Product: ${P.n} [${tags.join(', ')}]`,
      x: [`Product: ${P.n} (${P.k}).`,
        `Agents also call it: ${P.a}.${zh ? ' Chinese name: ' + zh + '.' : ''}`,
        codes.length ? `Codes mentioned in its documents (its own, plus plans or riders it works with): ${codes.join(', ')}.` : '',
        `GE documents: ${texts.map(d => d.name + (dateOf(d.name) ? ` (${dateOf(d.name)})` : '')).join('; ')}.`,
        `From the Agency Manual (${lead[0].name}): ${lead[0].text.slice(0, 2600)}`,
        qs.length ? `The FAQ answers: ${qs.join(' | ')}` : ''].filter(Boolean).join('\n')});
  }
  return {topics: out, syn, unused: files.filter(f => !used.has(f))};
}

module.exports = {topics, PRODUCTS};
if (require.main === module) {
  const r = topics();
  console.log(r.topics.length, 'products; unused files:', r.unused.length, r.unused.join(' | '));
  console.log('Chinese names:', JSON.stringify(r.syn));
  console.log(r.topics.map(t => t.h.slice(0, 120)).join('\n'));
}
