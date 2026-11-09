/* Instant guide matching on the phone (no internet, no AI cost). Also used by test/test.js in Node.
   Also: spotting client details in a question before it is sent anywhere. */
(function (root) {
  const STOP = new Set('a an the to of in on for and or is are do does how what where when can i my me we you it this that with from be at by as please check find get need want ask nak saya macam mana boleh epartner e-partner ge'.split(' '));
  const norm = s => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

  /* Chinese keys match anywhere; English/Malay keys only as whole words ("sig" must not match "signature") */
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const has = (q, k) => /[^\x00-\x7f]/.test(k) ? q.includes(k) : new RegExp('(^|[^a-z0-9])' + reEsc(k) + '($|[^a-z0-9])').test(q);

  function terms(q, syn) {
    q = norm(q); const extra = [];
    for (const k in syn || {}) if (syn[k] && has(q, k.toLowerCase())) extra.push(syn[k]);
    const seen = new Set();
    return (q + ' ' + extra.join(' ')).replace(/[^a-z0-9&\-\/\s]/g, ' ').split(/\s+/)
      .map(w => w.replace(/^[-\/]+|[-\/]+$/g, '')).filter(w => w.length > 1 && !STOP.has(w) && !seen.has(w) && seen.add(w));
  }

  /* score every guide; returns [{guide, score}] best first */
  function rank(question, guides, syn) {
    const q = norm(question), ts = terms(question, syn);
    const expanded = q + ' ' + ts.join(' ');
    return guides.map(g => {
      let s = 0;
      for (const k of g.kw || []) {
        const kk = norm(k);
        if (!kk) continue;
        const cjk = /[^\x00-\x7f]/.test(kk);
        const hit = cjk ? q.includes(kk) : new RegExp('(^|[^a-z0-9])' + kk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])').test(expanded);
        if (hit) s += 1.5 + kk.split(' ').length * 1.2 + (cjk ? 1.5 : 0);
      }
      const title = norm(g.title + ' ' + (g.zh || '') + ' ' + (g.ms || ''));
      const body = norm((g.steps || []).map(x => x.t).join(' '));
      for (const t of ts) { if (title.includes(t)) s += 1.2; else if (body.includes(t)) s += 0.3; }
      return {guide: g, score: Math.round(s * 10) / 10};
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
  }

  /* a question about a fact or rule ("how many days", "what is the entry age") needs the AI, not a where-to-click guide */
  const FACT = /(^|\b)(how many|how much|how long|what is|what's|what are|which|why|can (i|we|my|the|a|client)|is it|are there|berapa|boleh ke|kenapa|apa itu|entry age|minimum|maximum|max |min |limit|difference|compare|eligible|covered|cover\b|what (document|doc|docs|do i need|does .* need|need)|requirement|apa dokumen|dokumen apa|perlu apa)|多少|几天|几岁|可以吗|是不是|为什么|有没有|区别|什么文件|哪些文件|要准备|需要什么|什么资料/;
  const HOWTO = /(^|\b)(how to|how do i|how can i|where|which menu|steps|cara|macam mana|mcm mana|kat mana|di mana)|怎样|怎么|哪里|在哪/;
  const isFactual = q => FACT.test(norm(q)) && !HOWTO.test(norm(q));

  /* confident = show this guide straight away */
  function best(question, guides, syn) {
    const r = rank(question, guides, syn);
    const top = r[0], second = r[1];
    const factual = isFactual(question);
    const confident = !factual && !!top && top.score >= 3.5 && (!second || top.score >= second.score * 1.35);
    return {confident, factual, top: top || null, others: r.filter(x => !confident || x !== top).filter(x => x.score >= 1.5).slice(0, 3)};
  }

  /* client details that must not be sent to the server */
  function personalData(text) {
    const s = String(text || ''), found = [];
    if (/\b\d{6}[-\s]?\d{2}[-\s]?\d{4}\b/.test(s)) found.push('an IC number');
    if (/(\+?6?01\d[-\s]?\d{3,4}[-\s]?\d{4})\b/.test(s)) found.push('a phone number');
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(s)) found.push('an email address');
    if (/\b\d{8,}\b/.test(s.replace(/\b\d{6}[-\s]?\d{2}[-\s]?\d{4}\b/g, ''))) found.push('a policy / account number');
    return found;
  }
  function stripPersonal(text) {
    return String(text || '')
      .replace(/\b\d{6}[-\s]?\d{2}[-\s]?\d{4}\b/g, '[IC]')
      .replace(/(\+?6?01\d[-\s]?\d{3,4}[-\s]?\d{4})\b/g, '[phone]')
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
      .replace(/\b\d{8,}\b/g, '[number]');
  }

  const api = {terms, rank, best, isFactual, personalData, stripPersonal};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NNMatch = api;
})(this);
