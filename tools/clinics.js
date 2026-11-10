// Panel clinics: read GE's New Business Panel Clinic Listing (private/source/GE_Panel_Clinics_Nov2026.csv, with State
// and Area; the older markdown export is the fallback) into structured records, and turn GeoNames' Malaysia postcode
// file (private/geo/dl/MY.txt, CC BY 4.0) into a postcode / town -> map position table.
// Used by tools/geocode-clinics.js and tools/build-pack.js.
const fs = require('fs'), path = require('path');
const PRIV = path.join(__dirname, '..', 'private');
const CSV_FILE = path.join(PRIV, 'source', 'GE_Panel_Clinics_Nov2026.csv');

/* plain CSV reader: quoted fields, "" escapes, line breaks inside quotes */
function csvRows(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const titleCase = s => clean(s).toLowerCase().replace(/(^|[\s\/(-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const postcodeOf = a => (a.match(/\b\d{5}\b/g) || []).pop() || ''; // the last one: earlier 5-digit numbers can be lot numbers

function parseClinicsCsv(file) {
  const rows = csvRows(fs.readFileSync(file || CSV_FILE, 'utf8').replace(/^﻿/, '')), head = rows.shift().map(clean);
  const col = name => head.indexOf(name), out = [], seen = new Set();
  for (const r of rows) {
    if (r.length < head.length) continue;
    const code = clean(r[col('Clinic Code')]), name = clean(r[col('Clinic Name')]), address = clean(r[col('Address')]).replace(/\s+,/g, ',');
    if (!/^P\d+$/.test(code) || /^REIMBURSEMENT/i.test(name) || !/\d/.test(address)) continue;
    if (seen.has(code + '|' + name)) continue; seen.add(code + '|' + name);
    const fac = clean(r[col('Medical Facilities')]), hours = clean(r[col('Operating Hours')]), doctors = clean(r[col('Doctors Attached')]);
    out.push({
      code, name, tel: clean(r[col('Tel No')]), address, state: titleCase(r[col('State')]), area: titleCase(r[col('Area')]),
      pc: postcodeOf(address), country: 'MY',
      full: /Full Facility/i.test(fac), fac: fac.replace(/\(Full Facility\)/i, '').replace(/\s+/g, '').split(',').filter(Boolean),
      hours: /\d/.test(hours) ? hours.replace(/ - /, '–') : '',
      doctors: doctors ? doctors.split(',').map(d => d.trim()).filter(Boolean).length : 0
    });
  }
  return out;
}
/* the CSV when it is there, else the older markdown export */
function parseClinics() { return fs.existsSync(CSV_FILE) ? parseClinicsCsv() : parseClinicsMd(); }

/* facility code -> plain words, from the legend in GE's listing (used to make the AI library searchable) */
function facilityLegend() {
  const md = path.join(PRIV, 'source', 'ePartner_NB_Panel_Clinics.md'), out = {};
  if (!fs.existsSync(md)) return out;
  const text = fs.readFileSync(md, 'utf8').replace(/\\n/g, '\n');
  for (const m of text.matchAll(/^- ([A-Z0-9]+): (.+)$/gm)) if (!out[m[1]]) out[m[1]] = m[2].trim();
  return out;
}

function parseClinicsMd(md) {
  md = md || fs.readFileSync(path.join(PRIV, 'source', 'ePartner_NB_Panel_Clinics.md'), 'utf8');
  const out = [], seen = new Set();
  for (const block of md.split(/\n## /).slice(1)) {
    const key = block.split('\n')[0].trim();
    if (/legend/i.test(key)) continue;
    const label = (block.match(/\n\| ([^\n|]+)\n/) || [])[1];
    const area = label && !/CLINIC MAIN/i.test(label) ? label.trim() : key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
    const tok = block.replace(/\r/g, '').replace(/,\s*\n\s*/g, ',').replace(/\n/g, ' ').split('|').map(s => s.trim());
    for (let i = 0; i < tok.length - 6; i++) {
      if (!/^P\d+$/.test(tok[i]) || !tok[i + 1] || /^REIMBURSEMENT/i.test(tok[i + 1])) continue;
      const [name, tel, address, fac, hours, doctors] = tok.slice(i + 1, i + 7);
      if (!/\d/.test(address)) continue;
      const id = tok[i] + '|' + name;
      if (seen.has(id)) continue; seen.add(id);
      const sg = /SINGAPORE/i.test(address) || /^singapore$/i.test(key);
      const pc = (address.match(sg ? /\b\d{6}\b/g : /\b\d{5}\b/g) || []).pop() || ''; // the last one: earlier 5-digit numbers can be lot numbers
      out.push({
        code: tok[i], name: name.replace(/\s+/g, ' '), tel: tel.replace(/\s+/g, ' '), address: address.replace(/\s+/g, ' ').replace(/\s+,/g, ','),
        area, pc, country: sg ? 'SG' : 'MY',
        full: /Full Facility/i.test(fac), fac: fac.replace(/\(Full Facility\)/i, '').replace(/\s+/g, '').split(',').filter(Boolean),
        hours: /\d/.test(hours) ? hours.replace(/\s+/g, ' ').replace(/ - /, '–') : '',
        doctors: doctors ? doctors.split(',').map(d => d.trim()).filter(Boolean).length : 0
      });
      i += 6;
    }
  }
  return out;
}

/* GeoNames: one row per postcode + place; several places can share a postcode */
function postcodes() {
  const rows = fs.readFileSync(path.join(PRIV, 'geo', 'dl', 'MY.txt'), 'utf8').trim().split('\n').map(l => l.split('\t'));
  const pc = {}, place = {};
  const r4 = x => Math.round(x * 1e4) / 1e4;
  for (const r of rows) {
    const code = r[1], name = r[2], state = r[3], lat = +r[9], lng = +r[10];
    if (!code || !isFinite(lat)) continue;
    (pc[code] = pc[code] || []).push([lat, lng]);
    const k = name.toLowerCase();
    (place[k] = place[k] || {n: name, s: state, pts: []}).pts.push([lat, lng]);
  }
  const avg = pts => [r4(pts.reduce((a, p) => a + p[0], 0) / pts.length), r4(pts.reduce((a, p) => a + p[1], 0) / pts.length)];
  const P = {}, T = {};
  for (const k in pc) P[k] = avg(pc[k]);
  for (const k in place) T[k] = avg(place[k].pts);
  return {pc: P, town: T};
}

/* what phones get: every clinic with a map position + how exact it is, and the postcode / town table for typed places.
   Position: OpenStreetMap hit (tools/geocode-clinics.js) > postcode centre > average of postcodes sharing the first 3 digits */
function forPack() {
  const C = parseClinics(), G = postcodes();
  const cacheF = path.join(PRIV, 'geo', 'clinic-geo.json'), cache = fs.existsSync(cacheF) ? JSON.parse(fs.readFileSync(cacheF, 'utf8')) : {};
  const near3 = pc => { // average of postcodes sharing the first 3 digits, else the first 2
    const keys = Object.keys(G.pc), k3 = keys.filter(k => k.slice(0, 3) === pc.slice(0, 3)), pts = (k3.length ? k3 : keys.filter(k => k.slice(0, 2) === pc.slice(0, 2))).map(k => G.pc[k]);
    return pts.length ? [+(pts.reduce((a, p) => a + p[0], 0) / pts.length).toFixed(4), +(pts.reduce((a, p) => a + p[1], 0) / pts.length).toFixed(4)] : null;
  };
  const out = [], unplaced = [];
  for (const c of C) {
    const hit = cache[c.code + '|' + c.name];
    let pt = null, how = '';
    if (hit && hit.pt) { pt = hit.pt; how = hit.how === 'name' ? 'name' : 'street'; }
    else if (G.pc[c.pc]) { pt = G.pc[c.pc]; how = 'postcode'; }
    else if ((pt = near3(c.pc))) how = 'area';
    if (!pt) { unplaced.push(c.name); continue; }
    out.push({id: c.code, n: c.name, t: c.tel, a: c.address, ar: c.area, st: c.state || '', pc: c.pc, full: c.full ? 1 : 0, fac: c.fac, h: c.hours, d: c.doctors, lat: pt[0], lng: pt[1], how});
  }
  return {clinics: out, geo: G, unplaced, counts: out.reduce((m, c) => (m[c.how] = (m[c.how] || 0) + 1, m), {})};
}

/* AI library text: one line per clinic, grouped by state and area, with tests in plain words */
function libraryText() {
  const L = facilityLegend(), groups = {};
  for (const c of parseClinics()) (groups[`${c.state} — ${c.area}`] = groups[`${c.state} — ${c.area}`] || []).push(c);
  return Object.keys(groups).map(g => ({head: g, body: groups[g].map(c =>
    `${c.name} (${c.code}) | Tel ${c.tel || '-'} | ${c.address} | ${c.area}, ${c.state} | Hours ${c.hours || 'not listed'} | ${c.full ? 'Full facility. ' : ''}Tests: ${c.fac.map(f => L[f] ? `${L[f]} (${f})` : f).join('; ')}`).join('\n')}));
}

module.exports = {parseClinics, postcodes, forPack, libraryText, facilityLegend};

if (require.main === module) {
  const c = parseClinics(), g = postcodes();
  const noPc = c.filter(x => x.country === 'MY' && !g.pc[x.pc]);
  console.log('clinics', c.length, '| Malaysia', c.filter(x => x.country === 'MY').length, '| Singapore', c.filter(x => x.country === 'SG').length);
  console.log('postcodes', Object.keys(g.pc).length, '| towns', Object.keys(g.town).length);
  console.log('Malaysian clinics whose postcode is not in GeoNames:', noPc.length, noPc.slice(0, 8).map(x => x.pc + ' ' + x.name).join('; '));
  console.log('sample', JSON.stringify(c[2]));
}
