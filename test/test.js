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
console.log('\n7. Chat: follow-up questions remember the conversation (only for that request)');
t('follow-up sends the earlier question to the AI and still finds the right documents', () => {
  const q = 'how about for SRM?', r = S.call({code: 'test-team-code', op: 'ioask', question: q, history: [{q: 'SPYE2 free look period how many days?', a: 'SPYE2 has a 15-day free-look period.'}]});
  assert.ok(!r.error, r.error);
  assert.ok(r.sources.slice(0, 5).some(s => /Smart Revive Max/i.test(s.h)), 'no SRM document in top 5');
  const p = fs.readFileSync(path.join(__dirname, 'prompts', S.slug(q) + '.txt'), 'utf8');
  assert.ok(/CONVERSATION SO FAR[\s\S]*SPYE2 free look period/.test(p), 'history missing from prompt');
  assert.ok(/Facts must still come from the SOURCES/.test(p), 'follow-up rule missing');
});
t('only the last 4 turns are sent, each trimmed', () => {
  const q = 'what is the GE5 blood test', h = Array.from({length: 10}, (_, i) => ({q: 'old question number ' + i, a: 'x'.repeat(5000)}));
  S.call({code: 'test-team-code', op: 'ioask', question: q, history: h});
  const p = fs.readFileSync(path.join(__dirname, 'prompts', S.slug(q) + '.txt'), 'utf8');
  assert.ok(!/old question number 5/.test(p) && /old question number 6/.test(p) && /old question number 9/.test(p), 'wrong turns kept');
  assert.ok(!/x{1501}/.test(p), 'answer not trimmed');
});
t('a first question has no conversation block', () => {
  const p = fs.readFileSync(path.join(__dirname, 'prompts', S.slug('SPYE2 free look period how many days?') + '.txt'), 'utf8');
  assert.ok(!/CONVERSATION SO FAR \(oldest first\)/.test(p));
});
t('bad history is ignored, not an error', () => assert.ok(!S.call({code: 'test-team-code', op: 'ioask', question: 'what is GE5', history: 'nonsense'}).error));
t('the app never saves questions on the phone', () => assert.ok(!/save\('nnaio\.recent', (?!null)/.test(fs.readFileSync(path.join(__dirname, '..', 'docs', 'app.js'), 'utf8'))));
console.log('\n8. Photos and PDFs attached to a question');
const IMG = Buffer.from('fake-jpeg-bytes-for-test').toString('base64');
t('photos reach the AI with the question, plus the attachment rule', () => {
  const q = 'what does this error mean', r = S.call({code: 'test-team-code', op: 'ioask', question: q, images: [IMG, IMG, IMG]});
  assert.ok(!r.error, r.error);
  const ai = S.lastAI(); assert.strictEqual(ai.images, 3);
  assert.ok(/9\. ATTACHMENTS: the agent attached 3 image/.test(ai.prompt) && /Never repeat names, IC/.test(ai.prompt));
});
t('PDF text goes in the prompt, marked as not a GE source, and helps the search', () => {
  const r = S.call({code: 'test-team-code', op: 'ioask', question: 'can this be reinstated, which form?', doc: '[statement.pdf]\nPlan: SmartProtect You Exclusive 2 (SPYE2)\nPolicy status: Lapsed\nreinstatement'});
  assert.ok(!r.error, r.error);
  const ai = S.lastAI(); assert.strictEqual(ai.images, 0);
  assert.ok(/ATTACHED PDF TEXT \(from the agent, not a GE source\):\n\[statement\.pdf\]/.test(ai.prompt));
  assert.ok(r.sources.slice(0, 6).some(s => /reinstat/i.test(s.h)), r.sources.slice(0, 6).map(s => s.h).join(' / '));
});
t('up to 8 images: a 9th is refused', () => assert.strictEqual(S.call({code: 'test-team-code', op: 'ioask', question: 'what is this', images: Array(9).fill(IMG)}).error, 'invalid_request'));
t('oversized or non-image data is refused', () => {
  assert.strictEqual(S.call({code: 'test-team-code', op: 'ioask', question: 'what is this', images: ['A'.repeat(3000001)]}).error, 'invalid_request');
  assert.strictEqual(S.call({code: 'test-team-code', op: 'ioask', question: 'what is this', images: ['<script>alert(1)</script>']}).error, 'invalid_request');
});
t('no attachments: no attachment rule in the prompt', () => {
  S.call({code: 'test-team-code', op: 'ioask', question: 'what is GE5 blood test'});
  assert.ok(!/9\. ATTACHMENTS/.test(S.lastAI().prompt) && S.lastAI().images === 0);
});
t('the old photo reader (Form Filler / What-If) still sends at most 5 images', () => {
  S.call({code: 'test-team-code', op: 'ai', prompt: 'read these', images: Array(7).fill(IMG)});
  assert.strictEqual(S.lastAI().images, 5);
});
t('locked sample PDF exists for the browser test', () => assert.ok(fs.readFileSync(path.join(__dirname, 'fixtures', 'locked-sample.pdf'), 'latin1').includes('/Encrypt')));
console.log('\n9. Nearest panel clinics (worked out on the phone)');
const NEAR = require('../docs/near.js'), CLN = require('../tools/clinics.js');
const CP = CLN.forPack();
t('all 538 clinics in GE\'s listing are parsed, each with a phone, address and postcode', () => {
  const raw = CLN.parseClinics(); assert.strictEqual(raw.length, 538);
  assert.ok(raw.every(c => c.address && /^\d{5}$/.test(c.pc)), 'clinic without postcode');
  assert.ok(raw.filter(c => c.tel).length > 520, 'phones missing');
});
t('every clinic gets a map position inside Malaysia', () => {
  assert.strictEqual(CP.unplaced.length, 0, CP.unplaced.join('; '));
  assert.ok(CP.clinics.every(c => c.lat > 0.8 && c.lat < 7.5 && c.lng > 99.5 && c.lng < 119.5), 'position outside Malaysia');
});
t('distance check: KL to Penang is about 290 km in a straight line', () => { const d = NEAR.km([3.139, 101.687], [5.414, 100.329]); assert.ok(d > 280 && d < 300, d); });
const PEN = NEAR.place('11900', CP.geo, CP.clinics);
t('postcode 11900 is Bayan Lepas, Penang', () => assert.ok(PEN && PEN.at[0] > 5.2 && PEN.at[0] < 5.5 && PEN.at[1] > 100.1 && PEN.at[1] < 100.4, JSON.stringify(PEN)));
t('5 nearest to 11900 are all Penang island clinics, nearest first', () => {
  const r = NEAR.nearest(CP.clinics, PEN.at, {n: 5});
  assert.strictEqual(r.length, 5);
  assert.ok(r.every(x => /PENANG|PULAU PINANG|BAYAN|GELUGOR|JELUTONG|AIR ITAM|GEORGE ?TOWN|BALIK PULAU|\b11\d{3}\b/i.test(x.c.a)), r.map(x => x.c.a).join(' / '));
  assert.ok(r.every((x, i) => !i || r[i - 1].km <= x.km));
});
t('typed towns work: "Bayan Lepas", "ipoh", "Taman Melawati", "Farlim"', () => {
  for (const [q, lat, lng] of [['Bayan Lepas', 5.3, 100.28], ['ipoh', 4.6, 101.08], ['Taman Melawati', 3.21, 101.72], ['Farlim', 5.39, 100.28], ['Sungai Besar', 3.67, 100.98], ['Kajang', 2.99, 101.79]]) {
    const p = NEAR.place(q, CP.geo, CP.clinics);
    assert.ok(p && Math.abs(p.at[0] - lat) < 0.15 && Math.abs(p.at[1] - lng) < 0.2, q + ' -> ' + JSON.stringify(p));
  }
});
t('"Taman Melawati" (KL) is not mixed up with Bukit Melawati (Kuala Selangor)', () => {
  const p = NEAR.place('Taman Melawati', CP.geo, CP.clinics), first = NEAR.nearest(CP.clinics, p.at, {n: 1})[0];
  assert.ok(p.at[1] > 101.6 && /MELAWATI|53100/.test(first.c.a), JSON.stringify(p) + ' ' + first.c.n);
});
t('"Farlim" puts O2 Klinik (Farlim) first', () => assert.strictEqual(NEAR.nearest(CP.clinics, NEAR.place('Farlim', CP.geo, CP.clinics).at, {n: 1})[0].c.n, 'O2 KLINIK (FARLIM)'));
t('searching by clinic name: "pan-medic" finds all 3 Pan-Medic clinics; postcodes are not name searches', () => {
  assert.strictEqual(NEAR.byName('pan-medic', CP.clinics).length, 3);
  assert.strictEqual(NEAR.byName('11900', CP.clinics).length, 0);
});
t('clinics come from the new CSV listing, each with its state and area', () => {
  assert.ok(CP.clinics.every(c => c.st && c.ar), 'state/area missing');
  assert.ok(CP.clinics.some(c => c.st === 'Pulau Pinang') && CP.clinics.some(c => c.st === 'Sabah'));
});
t('AI library spells out the tests, so "treadmill test in Kulim" finds the Kulim clinics', () => {
  const lib = CLN.libraryText().find(g => /Kulim/.test(g.head));
  assert.ok(lib && /Treadmill\/Stress Electrocardiogram/.test(CLN.libraryText().map(g => g.body).join('\n')));
});
t('an unknown postcode falls back to its area, marked rough', () => { const p = NEAR.place('16479', CP.geo, CP.clinics); assert.ok(p && p.rough); });
t('nonsense place gives no result', () => assert.strictEqual(NEAR.place('zzqxw', CP.geo, CP.clinics), null));
t('"needs a treadmill ECG" only returns clinics that list TMX2', () => assert.ok(NEAR.nearest(CP.clinics, PEN.at, {need: 'TMX2'}).every(x => x.c.fac.includes('TMX2'))));
t('the clinic list only reaches phones inside the team pack (not in the public app)', () => {
  const pub = fs.readdirSync(path.join(__dirname, '..', 'docs')).map(f => f.endsWith('.js') ? fs.readFileSync(path.join(__dirname, '..', 'docs', f), 'utf8') : '').join('');
  assert.ok(!/AGOOD CLINIC|MEGAN AVENUE/.test(pub));
});
t('asking "nearest panel clinic" opens the clinic finder', () => assert.ok(/nearest\|dekat\|terdekat/.test(fs.readFileSync(path.join(__dirname, '..', 'docs', 'app.js'), 'utf8'))));
t('question too long is refused', () => assert.strictEqual(S.call({code: 'test-team-code', op: 'ioask', question: 'x'.repeat(700)}).error, 'invalid_request'));
t('short plan code "sig" does not match "signature"', () => assert.ok(!M.terms('change of signature', SYN).includes('smartinvest')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
