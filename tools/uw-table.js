// Re-read the Field Underwriting Guide PDF keeping its table columns apart (plain text extraction interleaves them).
// For every page with the 4-column condition table it finds the column edges from the header words and cuts each
// condition row into: Condition | Underwriting considerations | Underwriting requirements | Case scenario.
// Run: node tools/uw-table.js "<path to FIELD UNDERWRITING GUIDE.pdf>"  -> private/source/uw/fug-table.json
const fs = require('fs'), path = require('path');
global.window = global; global.navigator = {userAgent: 'node'}; global.document = {currentScript: null};
require(path.join(__dirname, '..', 'docs', 'vendor', 'pdf.min.js'));
const lib = global.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = path.join(__dirname, '..', 'docs', 'vendor', 'pdf.worker.min.js');
const CJK = /[㐀-鿿]/;

(async () => {
  const doc = await lib.getDocument({data: new Uint8Array(fs.readFileSync(process.argv[2])), disableWorker: true, isEvalSupported: false}).promise;
  const rows = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items.filter(it => it.str.trim())
      .map(it => ({s: it.str, x: it.transform[4], y: it.transform[5]}));
    const find = re => items.find(it => re.test(it.s));
    const hCons = find(/UNDERWRITING CONSIDERATIONS/i), hReq = find(/UNDERWRITING REQUIREMENTS/i), hCase = find(/CASE SCENARIO/i);
    if (!hCons || !hReq || !hCase) continue;
    const headY = hCons.y, edges = [hCons.x - 8, hReq.x - 8, hCase.x - 8];
    const col = x => x < edges[0] ? 0 : x < edges[1] ? 1 : x < edges[2] ? 2 : 3;
    const body = items.filter(it => it.y < headY - 2 && !/^\d{1,3}$/.test(it.s.trim()) && !/Click on the hyperlink/i.test(it.s));
    // a new row starts at a column-0 line that is not a bullet, right above its Chinese name
    const c0 = body.filter(it => col(it.x) === 0).sort((a, b) => b.y - a.y);
    const lines = []; for (const it of c0) { const l = lines.find(l => Math.abs(l.y - it.y) < 2); if (l) l.s += ' ' + it.s; else lines.push({y: it.y, s: it.s}); }
    const starts = [];
    lines.forEach((l, i) => {
      const t = l.s.trim(), next = lines[i + 1], prev = lines[i - 1];
      if (!/[A-Za-z]/.test(t) || CJK.test(t) || /^[•\-]/.test(t) || /^[A-N]\. /.test(t) || /^MEDICAL/i.test(t)) return;
      if (next && CJK.test(next.s) && !(prev && !CJK.test(prev.s) && /[\/,(]$/.test(prev.s.trim()) && starts.length && starts[starts.length - 1].y === prev.y)) starts.push({y: l.y});
      else if (prev && starts.length && starts[starts.length - 1].y === prev.y && next && CJK.test(next.s)) {} // second line of a two-line name
    });
    if (!starts.length) continue;
    const sec = body.find(it => /^[A-N]\. [A-Z]/.test(it.s.trim()));
    const title = items.filter(it => it.y > headY + 2).sort((a, b) => b.y - a.y).map(it => it.s).join(' ').replace(/\s+/g, ' ').trim();
    starts.forEach((st, j) => {
      const top = st.y + 3, bottom = j + 1 < starts.length ? starts[j + 1].y + 3 : -1e9;
      const inRow = body.filter(it => it.y <= top && it.y > bottom);
      const cols = [0, 1, 2, 3].map(c => {
        const its = inRow.filter(it => col(it.x) === c).sort((a, b) => b.y - a.y || a.x - b.x), out = [];
        for (const it of its) { const l = out[out.length - 1]; if (l && Math.abs(l.y - it.y) < 2) l.s += ' ' + it.s; else out.push({y: it.y, s: it.s}); }
        return out.map(l => l.s.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n(?!•)/g, ' ').replace(/ ?• ?/g, '\n• ').trim();
      });
      const nameLines = cols[0].split(/\s(?=[㐀-鿿])/);
      rows.push({page: p, title, section: sec ? sec.s.trim() : '', name: cols[0].replace(/\s*[㐀-鿿][\s\S]*$/, '').trim(), zh: (cols[0].match(/[㐀-鿿][^A-Za-z]*$/) || [''])[0].trim(), cons: cols[1], req: cols[2], scen: cols[3]});
    });
  }
  const out = path.join(__dirname, '..', 'private', 'source', 'uw', 'fug-table.json');
  fs.writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log(rows.length, 'rows ->', out);
})();
