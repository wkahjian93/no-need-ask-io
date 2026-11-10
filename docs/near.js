/* Nearest panel clinics, worked out on the phone: the customer's location is never sent anywhere.
   Also used by test/test.js in Node. */
(function (root) {
  const R = 6371, rad = x => x * Math.PI / 180;
  function km(a, b) {
    const dl = rad(b[0] - a[0]), dn = rad(b[1] - a[1]);
    const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dn / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  /* what the medical check-up needs -> facility codes in GE's listing */
  const NEEDS = [
    {id: '', label: 'Any check-up'},
    {id: 'BC', label: 'Blood / urine test'},
    {id: 'ECG3', label: 'ECG'},
    {id: 'CXR2', label: 'Chest X-ray'},
    {id: 'TMX2', label: 'Treadmill ECG'},
    {id: 'ULT2', label: 'Breast ultrasound'},
    {id: 'MM2', label: 'Mammogram'},
    {id: 'GE1', label: 'GE blood profiles (lab)'},
    {id: 'full', label: 'Full facility'}
  ];
  const has = (c, need) => !need || (need === 'full' ? !!c.full : (c.fac || []).includes(need));

  function nearest(clinics, at, opts) {
    opts = opts || {};
    return clinics.filter(c => has(c, opts.need)).map(c => ({c, km: km(at, [c.lat, c.lng])}))
      .sort((a, b) => a.km - b.km).slice(0, opts.n || 5);
  }

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(taman|tmn|bandar|bdr|kampung|kg|jalan|jln)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const avg = pts => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
  const title = s => s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
  /* typed postcode or town -> {at:[lat,lng], label} or null */
  function place(text, geo, clinics) {
    const raw = String(text || '').trim(); if (!raw) return null;
    const pc = (raw.match(/\b(\d{5})\b/) || [])[1];
    if (pc) {
      if (geo.pc[pc]) return {at: geo.pc[pc], label: 'postcode ' + pc};
      const near = Object.keys(geo.pc).filter(k => k.slice(0, 3) === pc.slice(0, 3)).map(k => geo.pc[k]);
      return near.length ? {at: avg(near), label: 'around postcode ' + pc, rough: true} : null;
    }
    const q = norm(raw); if (q.length < 3) return null;
    if (geo.town[q]) return {at: geo.town[q], label: title(q)};
    const keys = Object.keys(geo.town).filter(k => norm(k) === q || norm(k).includes(q) || (q.includes(norm(k)) && norm(k).length >= 4));
    if (keys.length) { keys.sort((a, b) => (norm(a) === q ? -1 : 0) - (norm(b) === q ? -1 : 0) || Math.abs(norm(a).length - q.length) - Math.abs(norm(b).length - q.length)); return {at: geo.town[keys[0]], label: title(keys[0])}; }
    // a place GeoNames doesn't list (e.g. a taman): use the clinics whose address mentions it
    const words = q.split(' ').filter(w => w.length > 2);
    const hits = (clinics || []).filter(c => { const a = norm(c.a); return words.length && words.every(w => a.includes(w)); });
    return hits.length ? {at: avg(hits.map(c => [c.lat, c.lng])), label: title(raw), rough: true} : null;
  }

  const api = {km, nearest, place, NEEDS, has};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NNNear = api;
})(this);
