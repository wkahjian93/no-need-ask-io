// One-time: find each panel clinic on the map with OpenStreetMap's Nominatim (1 request per second, as its usage
// policy asks). Results go to private/geo/clinic-geo.json (resumable cache). A hit only counts if it lands near the
// clinic's postcode; otherwise the clinic falls back to its postcode centre (GeoNames) in build-pack.js.
// Run: node tools/geocode-clinics.js        (only clinic addresses, which are public business addresses, are sent)
const fs = require('fs'), path = require('path'), https = require('https');
const {parseClinics, postcodes} = require('./clinics.js');
const CACHE = path.join(__dirname, '..', 'private', 'geo', 'clinic-geo.json');
const UA = 'REDEFINE-NoNeedAskIO/1.0 (one-time panel clinic list build)';
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const save = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const km = (a, b) => { const R = 6371, d = x => x * Math.PI / 180, dl = d(b[0] - a[0]), dn = d(b[1] - a[1]); const h = Math.sin(dl / 2) ** 2 + Math.cos(d(a[0])) * Math.cos(d(b[0])) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

function get(q) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=my&limit=3&addressdetails=0&q=' + encodeURIComponent(q);
  return new Promise((ok, bad) => https.get(url, {headers: {'User-Agent': UA, 'Accept-Language': 'en'}}, res => {
    let b = ''; res.on('data', c => b += c); res.on('end', () => { if (res.statusCode !== 200) return bad(new Error('HTTP ' + res.statusCode)); try { ok(JSON.parse(b)); } catch (e) { bad(e); } });
  }).on('error', bad));
}
/* drop unit / floor / lot parts: "NO 21G, JALAN CEMPAKA SD 12/2, BANDAR SRI DAMANSARA, 52200 KUALA LUMPUR" -> "JALAN CEMPAKA SD 12/2, BANDAR SRI DAMANSARA, 52200 KUALA LUMPUR" */
const JUNK = /^(NO\.?|NOMBOR|LOT|PT|LEVEL|UNIT|SUITE|BLOK|BLOCK|TINGKAT|TKT|GROUND|GRD|FIRST|SECOND|\d+(ST|ND|RD|TH)|[A-Z]?\d+[A-Z]?(-\d+[A-Z]?)*$|[A-Z]\d*-[\dA-Z-]+$|G\b|GF\b)|FLOOR|ARAS|SHOP ?OFFICE|KOMPLEKS|WISMA|MENARA|PLAZA|MALL|HOSPITAL/i;
const parts = a => a.split(',').map(s => s.trim()).filter(Boolean);
const road = a => parts(a).find(s => /\b(JALAN|JLN|LORONG|LRG|PERSIARAN|LEBUH|LEBUHRAYA|LINGKARAN|LENGKOK)\b/i.test(s));
const town = a => (a.match(/\b\d{5}\s+([A-Z .'-]+)$/i) || [])[1] || '';
function queries(c) {
  const p = parts(c.address), clean = p.filter((s, i) => i === p.length - 1 || !JUNK.test(s)).join(', ');
  const r = road(c.address), t = town(c.address).trim();
  // [query, how far from the postcode centre a hit may be (km), how it was found]
  const qs = [[`${c.name.replace(/\b(SDN\.? ?BHD\.?)\b/i, '').trim()}, ${t}`, 2.5, 'name'], [clean, 4, 'address']];
  if (r) qs.push([`${r}, ${c.pc} ${t}`.trim(), 3, 'road'], [`${r}, ${t}`.trim(), 3, 'road']);
  const seen = new Set(); return qs.filter(q => q[0].length > 6 && !seen.has(q[0]) && seen.add(q[0]));
}

(async () => {
  const clinics = parseClinics(), G = postcodes();
  const todo = clinics.filter(c => !cache[c.code + '|' + c.name]);
  console.log(`clinics ${clinics.length}, already done ${clinics.length - todo.length}, to look up ${todo.length}`);
  let n = 0, hits = 0;
  for (const c of todo) {
    const key = c.code + '|' + c.name, centre = G.pc[c.pc] || null;
    let found = null;
    for (const [q, maxKm, how] of queries(c)) {
      let res = [];
      try { res = await get(q); } catch (e) { console.log('  error', e.message, '- waiting 30 s'); await sleep(30000); try { res = await get(q); } catch (e2) { res = []; } }
      await sleep(1100);
      for (const r of res) {
        const pt = [+(+r.lat).toFixed(5), +(+r.lon).toFixed(5)];
        const off = centre ? km(centre, pt) : null;
        if (off === null ? /malaysia/i.test(r.display_name) && how !== 'road' : off <= maxKm) { found = {pt, how, q, off: off === null ? null : Math.round(off * 10) / 10, type: r.type}; break; }
      }
      if (found) break;
    }
    cache[key] = found || {pt: null};
    if (found) hits++;
    if (++n % 10 === 0) { save(); console.log(`  ${n}/${todo.length} looked up, ${hits} found on the map`); }
  }
  save();
  const all = clinics.map(c => cache[c.code + '|' + c.name]);
  console.log(`done: ${all.filter(x => x && x.pt).length} of ${clinics.length} clinics placed by street/name; the rest use their postcode centre`);
})();
