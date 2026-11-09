// Local test only: serves docs/ on port 5197 and runs the REAL team server code (REDEFINE Form Filler/server/Code.gs)
// in memory at /gas with Google services faked. Team code "test-team-code", owner code "test-owner-code".
// OpenAI is NOT called: each AI prompt is saved to test/prompts/<n>.txt, and the reply is read from
// test/ai-replies/<same slug>.json if it exists (written by hand for the test run). Nothing leaves this PC.
// Usage: node test/server-sim.js [--preload]   (--preload = put private/build files on the fake Drive, as if uploaded)
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), DOCS = path.join(ROOT, 'docs');
const props = {TEAM_CODE: 'test-team-code', OWNER_CODE: 'test-owner-code', OPENAI_API_KEY: 'sim'};
const files = {};
const file = name => ({getName: () => name, getBlob: () => ({getDataAsString: () => files[name]}), setContent: t => { files[name] = t; }, setTrashed: () => { delete files[name]; }, getId: () => name});
const iter = list => { let i = 0; return {hasNext: () => i < list.length, next: () => list[i++]}; };
const folderObj = {getId: () => 'f', getFilesByName: n => iter(n in files ? [file(n)] : []), createFile: (n, t) => { files[n] = t; return file(n); }, searchFiles: () => iter(Object.keys(files).map(file))};
const slug = q => q.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
let aiCalls = 0, lastAI = null;
const fakeOpenAI = (url, opt) => {
  const body = JSON.parse(opt.payload), prompt = body.input[0].content[0].text;
  lastAI = {images: body.input[0].content.filter(c => c.type === 'input_image').length, prompt};
  const q = (prompt.match(/AGENT QUESTION: ([\s\S]*)$/) || [])[1] || '';
  fs.mkdirSync(path.join(__dirname, 'prompts'), {recursive: true});
  fs.writeFileSync(path.join(__dirname, 'prompts', slug(q) + '.txt'), prompt);
  aiCalls++;
  const rf = path.join(__dirname, 'ai-replies', slug(q) + '.json');
  const text = fs.existsSync(rf) ? fs.readFileSync(rf, 'utf8')
    : JSON.stringify({kind: 'not_covered', title: '(simulated: no reply written yet)', answer: 'Test server: the prompt was saved to test/prompts/' + slug(q) + '.txt', steps: [], notes: [], guide: null, sources: [], confidence: 'low'});
  return {getResponseCode: () => 200, getContentText: () => JSON.stringify({status: 'completed', output: [{type: 'message', content: [{type: 'output_text', text}]}]})};
};
const ctx = {
  PropertiesService: {getScriptProperties: () => ({getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }})},
  CacheService: {getScriptCache: () => ({get: () => null, put: () => {}})},
  LockService: {getScriptLock: () => ({waitLock: () => {}, releaseLock: () => {}})},
  Utilities: {sleep: () => {}, formatDate: d => d.toISOString().slice(0, 10)},
  DriveApp: {getFolderById: () => folderObj, createFolder: () => folderObj},
  MimeType: {PLAIN_TEXT: 'text/plain'},
  ContentService: {MimeType: {JSON: 'json'}, createTextOutput: t => ({setMimeType: () => ({text: t})})},
  UrlFetchApp: {fetch: fakeOpenAI}, console
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, '..', 'REDEFINE Form Filler', 'server', 'Code.gs'), 'utf8'), ctx);
const call = body => JSON.parse(ctx.doPost({postData: {contents: JSON.stringify(body)}}).text);
function preload() {
  const B = path.join(ROOT, 'private', 'build');
  for (const f of fs.readdirSync(B).filter(f => /^nnaio_(pack|lib_\d)\.json$/.test(f))) {
    const m = f.match(/nnaio_(pack|lib_(\d))\.json/);
    const r = call({code: 'test-owner-code', op: 'ioput', name: m[2] ? 'lib' + m[2] : 'pack', text: fs.readFileSync(path.join(B, f), 'utf8')});
    if (!r.ok) throw new Error('preload failed ' + f + ' ' + JSON.stringify(r));
  }
}
module.exports = {call, files, props, preload, aiCalls: () => aiCalls, lastAI: () => lastAI, slug};

if (require.main === module) {
  if (process.argv.includes('--preload')) { preload(); console.log('preloaded team server files:', Object.keys(files).join(', ')); }
  const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json'};
  http.createServer((req, res) => {
    if (req.url === '/gas' && req.method === 'POST') { let b = ''; req.on('data', c => b += c); req.on('end', () => { res.writeHead(200, {'Content-Type': 'application/json'}); res.end(ctx.doPost({postData: {contents: b}}).text); }); return; }
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    if (rel.startsWith('__fixtures/')) { // local test files only (never part of the published app)
      const fx = path.join(__dirname, 'fixtures', path.basename(rel));
      if (!fs.existsSync(fx)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, {'Content-Type': 'application/pdf'}); return fs.createReadStream(fx).pipe(res);
    }
    if (rel === 'config.js') { res.writeHead(200, {'Content-Type': 'text/javascript'}); return res.end("window.NNA_CONFIG={api:location.origin+'/gas',epartner:'https://epartner-my.greateasternlife.com/'};"); }
    const f = path.join(DOCS, rel);
    if (!f.startsWith(DOCS) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    fs.createReadStream(f).pipe(res);
  }).listen(5197, '127.0.0.1', () => console.log('No Need Ask IO test server on http://localhost:5197 (team code test-team-code, owner code test-owner-code)'));
}
