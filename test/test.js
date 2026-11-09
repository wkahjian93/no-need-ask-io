// Test run: node test/test.js
// 1) the 17 questions agents ask the IO most + messy real-life wording -> right guide, instantly, no AI
// 2) fact questions go to the AI; client details are caught before sending
// 3) the real team server code (in memory): pack download, owner-only upload, AI search finds the right documents
const assert = require('assert'), fs = require('fs'), path = require('path');
const M = require('../docs/match.js'), G = require('../private/guides.js'), SYN = require('../tools/synonyms.js');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); } };

console.log('\n1. The 17 common questions (instant guide, no AI)');
const COMMON = [
  ['How to do TCF?', 'tcf'], ['How to download MPOS?', 'mpos'], ['How to check DCMS figures ANP FYC QFYLP NOC?', 'dcms'],
  ['How to login epartner when got bug?', 'login'], ['How to check commission?', 'commission'], ['How to download forms?', 'forms'],
  ['How to check client details?', 'client-details'], ['How to call customer service or new business department?', 'hotline'],
  ['How to check inbox?', 'inbox'], ['How to use ICM?', 'icm'], ['How to check underwriting guide?', 'underwriting'],
  ['How to check product details?', 'product'], ['How to update PDF passcode?', 'pdf-passcode'],
  ['How to download customer PDF / e-policy after inforce?', 'e-policy'], ['How to check customer service submission status?', 'cs-status'],
  ['How to check and submit ROP?', 'rop'], ['How to check customer service manual?', 'cs-manual']
];
for (const [q, id] of COMMON) t(`"${q}" -> ${id}`, () => { const b = M.best(q, G, SYN); assert.ok(b.confident, 'not confident, top ' + (b.top && b.top.guide.id)); assert.strictEqual(b.top.guide.id, id); });

console.log('\n2. Messy real-life wording (English / 中文 / BM / Manglish)');
const MESSY = [
  ['boss my epartner keep loading cannot go in', 'login'], ['IO, how to check my comm ah?', 'commission'], ['怎样查佣金', 'commission'],
  ['nak download borang mana', 'forms'], ['客户的保费几时到期', 'client-details'], ['where to change nominee', 'cs-manual'],
  ['medical checkup clinic near penang', 'panel'], ['how to submit claim for client death', 'claim'], ['mpos cannot update, where download new version', 'mpos'],
  ['client wants tax relief statement', 'premium-statement'], ['Macam mana nak hantar ICM?', 'icm'], ['怎样下载电子保单？', 'e-policy'],
  ['my ANP how much already, where to see', 'dcms'], ['pdf cannot open, ask password', 'pdf-passcode']
];
for (const [q, id] of MESSY) t(`"${q}" -> ${id}`, () => { const b = M.best(q, G, SYN); assert.strictEqual(b.top && b.top.guide.id, id); });

console.log('\n3. Fact questions go to the AI (not a where-to-click guide)');
for (const q of ['SPYE2 free look period how many days?', 'What is the entry age for SPYE2?', '客户想换受益人要准备什么文件？', 'Can client add rider after policy inforce?', 'What is the commission rate for SPYE2?'])
  t(`"${q}" -> AI`, () => assert.ok(!M.best(q, G, SYN).confident));

console.log('\n4. Client details are caught before anything is sent');
t('IC number', () => assert.deepStrictEqual(M.personalData('client IC 900101-07-1234 due date?'), ['an IC number']));
t('phone + policy number', () => assert.strictEqual(M.personalData('call 012-345 6789 about policy 0123456789').length, 2));
t('email', () => assert.ok(M.personalData('send to tan.mei@gmail.com').includes('an email address')));
t('normal question passes', () => assert.deepStrictEqual(M.personalData('How to check commission for 15th?'), []));
t('stripped version has no digits left', () => assert.ok(!/\d{6,}/.test(M.stripPersonal('IC 900101071234 phone 0123456789'))));
t('form codes are not mistaken for client data', () => assert.deepStrictEqual(M.personalData('where is form CSD-PSF07-V15?'), []));

console.log('\n5. Every guide is complete');
for (const g of G) t(`guide ${g.id}`, () => {
  assert.ok(g.title && g.steps.length && g.kw.length && g.src);
  for (const s of g.steps) if (s.shot) assert.ok(fs.existsSync(path.join(__dirname, '..', 'private', 'build', 'shots', s.shot + '.jpg')), 'missing screenshot ' + s.shot);
});

console.log('\n6. Team server (real Code.gs, in memory)');
const S = require('./server-sim.js');
t('agents cannot upload', () => assert.strictEqual(S.call({code: 'test-team-code', op: 'ioput', name: 'pack', text: '{}'}).error, 'not_allowed'));
t('wrong code is refused', () => assert.strictEqual(S.call({code: 'nope', op: 'iopack'}).error, 'unauthorized'));
t('no pack yet -> clear message', () => assert.strictEqual(S.call({code: 'test-team-code', op: 'iopack'}).error, 'no_pack'));
t('owner rejects a wrong file', () => assert.strictEqual(S.call({code: 'test-owner-code', op: 'ioput', name: 'pack', text: JSON.stringify({app: 'other', pad: 'x'.repeat(200)})}).error, 'invalid_request'));
t('owner upload of pack + library', () => { S.preload(); assert.ok(S.files['nnaio_pack.json'] && S.files['nnaio_lib_1.json']); });
let ver;
t('agent downloads the pack once', () => { const r = S.call({code: 'test-team-code', op: 'iopack', have: ''}); ver = r.ver; assert.ok(JSON.parse(r.text).guides.length === G.length); });
t('second time: "same", no download', () => assert.strictEqual(S.call({code: 'test-team-code', op: 'iopack', have: ver}).same, true));
const AI = [
  ['SPYE2 free look period how many days?', /free-?look/i],
  ['客户想换受益人要准备什么文件？', /Change of Nominee/i],
  ['Client admitted to hospital, how does the guarantee letter work?', /Healthcare|Guarantee|Claims and Healthcare/i],
  ['what blood test is GE5', /Blood Test|GE5|New Business Medical/i]
];
for (const [q, re] of AI) t(`AI search for "${q}" finds ${re}`, () => {
  const r = S.call({code: 'test-team-code', op: 'ioask', question: q});
  assert.ok(!r.error, r.error); assert.ok(r.sources.slice(0, 3).some(s => re.test(s.h)), r.sources.slice(0, 3).map(s => s.h).join(' / '));
  const p = fs.readFileSync(path.join(__dirname, 'prompts', S.slug(q) + '.txt'), 'utf8');
  assert.ok(/Use ONLY the SOURCES/.test(p) && p.length < 40000, 'prompt rules or size');
});
t('question too long is refused', () => assert.strictEqual(S.call({code: 'test-team-code', op: 'ioask', question: 'x'.repeat(700)}).error, 'invalid_request'));
t('short plan code "sig" does not match "signature"', () => assert.ok(!M.terms('change of signature', SYN).includes('smartinvest')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
