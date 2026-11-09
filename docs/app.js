/* No Need Ask IO — agents ask an ePartner question, get the steps with screenshots of where to tap.
   Guides + screenshots come from the team server (team code) and are kept on the phone (works offline).
   Questions the guides can't answer go to the AI on the team server, which only answers from the ePartner library. */
(function () {
  const CFG = window.NNA_CONFIG, M = window.NNMatch;
  const $ = (s, el) => (el || document).querySelector(s), $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const ICON = {
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    more: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
    cam: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    clip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5l-8.2 8.2a5 5 0 01-7.1-7.1l8.5-8.5a3.3 3.3 0 014.7 4.7l-8.4 8.4a1.7 1.7 0 01-2.4-2.4l7.7-7.7"/></svg>',
    spark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.3L20 10l-5.8 1.7L12 18l-2.2-6.3L4 10l5.8-1.7z"/></svg>'
  };
  const POPULAR = ['login', 'commission', 'dcms', 'forms', 'client-details', 'e-policy', 'icm', 'cs-status', 'hotline', 'tcf', 'mpos', 'inbox', 'underwriting', 'product', 'pdf-passcode', 'rop', 'cs-manual'];

  /* ---------- storage: the pack (about 2 MB) lives in IndexedDB ---------- */
  const DB = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((ok, no) => { const r = indexedDB.open('nnaio', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }));
    const tx = (mode, fn) => open().then(db => new Promise((ok, no) => { const t = db.transaction('kv', mode); const r = fn(t.objectStore('kv')); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }));
    return {get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)), del: k => tx('readwrite', s => s.delete(k))};
  })();

  let PACK = null, packState = null, syncing = null;
  const session = () => load('nnaio.session', null) || load('rff.session', null);

  async function post(body, who) {
    const s = who || session(); if (!s) throw {code: 'unauthorized'};
    let r;
    try { r = await fetch(CFG.api, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(Object.assign({code: s.code, name: s.name}, body))}); }
    catch (e) { throw {code: 'offline'}; }
    let j; try { j = await r.json(); } catch (e) { throw {code: 'upstream_error'}; }
    if (j.error) throw {code: j.error};
    return j;
  }
  const packOk = p => p && p.app === 'nnaio' && Array.isArray(p.guides) && p.shots;
  async function syncPack() {
    if (!session() || syncing) return syncing;
    syncing = (async () => {
      try {
        const r = await post({op: 'iopack', have: PACK ? PACK.ver : ''});
        packState = 'ok';
        if (r.same) return;
        let p = null; try { p = JSON.parse(r.text); } catch (e) {}
        if (!packOk(p)) { packState = 'bad_pack'; return; }
        const had = !!PACK; PACK = p; await DB.set('pack', p).catch(() => {});
        toast(had ? 'Guides updated' : 'Guides ready, also offline'); render();
      } catch (e) {
        packState = e.code || 'offline';
        if (e.code === 'unauthorized') save('nnaio.session', null);
        if (!PACK) render();
      } finally { syncing = null; }
    })();
    return syncing;
  }

  /* ---------- small UI helpers ---------- */
  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
  function sheet(html, after) {
    const el = $('#sheet'); el.innerHTML = `<div class="box" role="dialog" aria-modal="true">${html}</div>`; el.hidden = false;
    el.onclick = e => { if (e.target === el) closeSheet(); };
    if (after) after(el); return el;
  }
  function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; }
  const shotSrc = id => PACK && PACK.shots[id] ? 'data:image/jpeg;base64,' + PACK.shots[id] : '';
  function openViewer(id, caption) {
    const v = $('#viewer');
    v.innerHTML = `<div class="vt"><span>${esc(caption || 'Pinch or scroll to look around')}</span><button class="btn sm" data-fit>Fit</button><button class="btn sm primary" data-x>Close</button></div><div class="vs"><img alt="" src="${shotSrc(id)}"></div>`;
    v.hidden = false; v.classList.remove('fit');
    $('[data-x]', v).onclick = () => { v.hidden = true; v.innerHTML = ''; };
    $('[data-fit]', v).onclick = e => { v.classList.toggle('fit'); e.target.textContent = v.classList.contains('fit') ? 'Zoom' : 'Fit'; };
  }
  const pathHtml = p => p && p.length ? `<div class="path">${p.map(esc).map(x => `<span>${x}</span>`).join('<i>›</i>')}</div>` : '';

  /* ---------- routing: #/  #/g/<id>  #/ask  #/all ---------- */
  let current = {q: '', turns: []}; // this chat only lives in memory: refresh = fresh start
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  addEventListener('hashchange', () => { render(); scrollTo(0, 0); });

  function bar(title, sub, back) {
    return `<header class="bar">${back ? `<button class="ib" data-back aria-label="Back">${ICON.back}</button>` : ''}
      <div class="brand"><b>${esc(title)}</b><span>${esc(sub)}</span></div>
      ${back ? `<button class="ib" data-home aria-label="Home">${ICON.home}</button>` : `<button class="ib" data-menu aria-label="More">${ICON.more}</button>`}</header>`;
  }
  function wireBar(root) {
    const b = $('[data-back]', root); if (b) b.onclick = () => history.length > 1 ? history.back() : go('#/');
    const h = $('[data-home]', root); if (h) h.onclick = () => go('#/');
    const m = $('[data-menu]', root); if (m) m.onclick = menu;
  }

  function render() {
    const app = $('#app'), h = location.hash || '#/';
    const keep = {q: ($('#q') || {}).value, fq: ($('#fq') || {}).value}; // typed text survives a redraw (e.g. after adding a photo)
    if (h.startsWith('#/g/')) app.innerHTML = guideView(decodeURIComponent(h.slice(4)));
    else if (h === '#/ask' && (current.turns || []).length) app.innerHTML = askView();
    else if (h === '#/ask') { history.replaceState(null, '', '#/'); app.innerHTML = homeView(); } // chat is gone after a refresh: start fresh
    else if (h === '#/all') app.innerHTML = allView();
    else app.innerHTML = homeView();
    wireBar(app); wire(app);
    for (const k of ['q', 'fq']) { const el = $('#' + k); if (el && keep[k]) el.value = keep[k]; }
    if (h === '#/ask' && current.scrollTo != null) { const el = $('#t' + current.scrollTo); current.scrollTo = null; if (el) setTimeout(() => el.scrollIntoView({block: 'start'}), 0); }
  }

  /* ---------- home ---------- */
  function homeView() {
    const g = PACK ? PACK.guides : [];
    const pop = POPULAR.map(id => g.find(x => x.id === id)).filter(Boolean);
    let status = '';
    if (!session()) status = `<div class="card"><h2>Get started</h2><p style="margin-bottom:12px">Sign in once with your name and the REDEFINE team code to download the ePartner guides. After that the guides work even without internet.</p><button class="btn primary block" data-signin>Sign in</button></div>`;
    else if (!PACK) status = packState && packState !== 'ok'
      ? `<div class="notice">${esc(PACK_MSG[packState] || PACK_MSG.offline)}</div><button class="btn block" data-retry style="margin-bottom:12px">Try again</button>`
      : `<div class="loading"><div class="spin"></div>Downloading the ePartner guides (about 2 MB)…</div>`;
    return bar('No Need Ask IO', 'REDEFINE · ePartner helper') + `<main class="wrap">
      <section class="ask">
        <h1>What do you need in ePartner?</h1>
        <p>Ask in English, 中文 or BM. You get the steps and a picture of where to tap.</p>
        <label for="q" class="muted" style="color:#CFC8B8;display:block;margin-bottom:6px">Your question</label>
        <textarea id="q" placeholder="e.g. How to check my commission?  /  怎样下载电子保单？  /  Macam mana nak hantar ICM?" maxlength="500"></textarea>
        ${attachBar('home')}
        <div class="row"><button class="btn primary block" data-ask>${draft.length ? 'Ask AI about this' : 'Show me how'}</button></div>
        <div class="chips">${pop.slice(0, 8).map(x => `<button class="chip" data-g="${x.id}">${esc(x.title.split(' (')[0].split(' / ')[0])}</button>`).join('')}</div>
      </section>
      ${status}
      ${pop.length ? `<h2 class="sec">The 17 questions agents ask most</h2>${pop.map((x, i) => item(x, i + 1)).join('')}
        <button class="btn block" data-all style="margin-top:4px">See all ${g.length} guides</button>` : ''}
      <p class="foot">Guides from ePartner, checked ${PACK ? esc(fmtDate(PACK.built)) : '9 Nov 2026'}. ePartner changes, so if a screen looks different, tell Kah Jian.<br>
      ${session() ? `<button data-menu2>Settings</button>` : ''}</p>
    </main>`;
  }
  const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}); } catch (e) { return ''; } };
  const item = (g, n) => `<button class="item" data-g="${g.id}"><span class="n">${n}</span><div class="t"><b>${esc(g.title)}</b><span>${esc(g.zh || '')}${g.ms ? ' · ' + esc(g.ms) : ''}</span></div>${ICON.chev}</button>`;
  const PACK_MSG = {
    no_pack: 'The team server has no guides yet. Kah Jian needs to upload them once (Settings → Owner: upload guides).',
    invalid_request: 'The team server needs its update before it can share the guides. Tell Kah Jian.',
    bad_pack: 'The guides file on the team server could not be read. Tell Kah Jian.',
    unauthorized: 'Your team code was not accepted. Please sign in again.',
    offline: 'Could not reach the team server. Check your internet and try again.'
  };

  function allView() {
    const g = PACK ? PACK.guides : [];
    return bar('All guides', `${g.length} ePartner how-tos`, true) + `<main class="wrap">${g.map((x, i) => item(x, i + 1)).join('') || '<p class="empty">Sign in first to download the guides.</p>'}</main>`;
  }

  /* ---------- a guide with screenshots ---------- */
  function guideView(id, opts) {
    opts = opts || {};
    const g = PACK && PACK.guides.find(x => x.id === id);
    if (!g) return bar('Guide', '', true) + `<main class="wrap"><p class="empty">This guide is not on this phone yet. Go back and sign in to download the guides.</p></main>`;
    const asked = current.q && current.matched === id ? current.q : '';
    return (opts.inline ? '' : bar('No Need Ask IO', 'Step by step', true)) + `<main class="${opts.inline ? '' : 'wrap'}">
      ${asked ? `<div class="youasked">You asked: <b>${esc(asked)}</b></div>` : ''}
      <div class="head"><div class="kicker">${ICON.spark} ${opts.inline ? 'Screenshots for this' : 'How to do it yourself'}</div><h1>${esc(g.title)}</h1>${g.zh ? `<p class="sub">${esc(g.zh)} · ${esc(g.ms || '')}</p>` : ''}</div>
      ${g.steps.map((s, i) => `<article class="step"><div class="top"><span class="num">${i + 1}</span><div class="txt">${esc(s.t)}${pathHtml(s.path)}</div></div>
        ${s.shot && shotSrc(s.shot) ? `<button class="shot" data-shot="${s.shot}" data-cap="Step ${i + 1}" aria-label="Open screenshot for step ${i + 1}"><img loading="lazy" alt="ePartner screenshot for step ${i + 1}, red box shows where to tap" src="${shotSrc(s.shot)}"><span class="zoom">Tap to zoom</span></button>` : ''}</article>`).join('')}
      ${g.tips && g.tips.length ? `<div class="tips"><h3>Good to know</h3><ul>${g.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      ${opts.inline ? '' : `<p class="src">Source: ${esc(g.src || 'ePartner Study Pack')} · screenshots 9 Nov 2026. Red boxes show where to tap.</p>
      <div class="row" style="margin-bottom:10px"><a class="btn dark" href="${CFG.epartner}" target="_blank" rel="noopener">Open ePartner</a><button class="btn" data-copy="${g.id}">Copy steps</button></div>
      ${asked ? `<button class="btn block" data-ai>${ICON.spark} Not what I asked, ask AI</button><div data-from="${g.id}" style="margin-top:12px">${composer()}</div>` : `<button class="btn block" data-followup="${g.id}">${ICON.spark} Ask another question</button>`}
      ${helpBox()}`}
    </main>`;
  }
  const helpBox = () => `<div class="help"><b>Still stuck after trying?</b><p>Send a written query through <a href="#/g/icm">ICM</a> (reply in 3 working days) or call Agent Careline <a href="tel:0342598111">03-4259 8111</a>. Then tell your IO what you already tried.</p></div>`;
  function copyText(g) {
    return `*${g.title}*\n` + g.steps.map((s, i) => `${i + 1}. ${s.t}`).join('\n') + (g.tips && g.tips.length ? `\n\nTips:\n- ` + g.tips.join('\n- ') : '') + `\n\n(from No Need Ask IO)`;
  }

  /* ---------- ask flow ---------- */
  /* client details check before anything is sent; field = the textarea to put the question back in */
  function cleanFirst(q, field, then) {
    const pd = M.personalData(q);
    if (!pd.length) return then(q);
    sheet(`<h3>Remove client details first</h3><p>Your question has what looks like ${esc(pd.join(', '))}. Client details should never be typed into this app. The steps are the same for every client.</p>
      <div class="cmp">${esc(M.stripPersonal(q))}</div>
      <div class="row"><button class="btn" data-x>Edit my question</button><button class="btn primary" data-ok>Use this version</button></div>`, el => {
      $('[data-x]', el).onclick = () => { closeSheet(); const t = $(field); if (t) { t.value = q; t.focus(); } };
      $('[data-ok]', el).onclick = () => { closeSheet(); then(M.stripPersonal(q)); };
    });
  }
  function ask(q) {
    q = String(q || '').trim();
    if (q.length < 3 && draft.length) q = 'What does this show, and what should I do next?';
    if (q.length < 3) { toast('Type your question first'); return; }
    cleanFirst(q, '#q', q => {
      current = {q, turns: [], att: draft}; draft = [];
      // with photos or a PDF the AI has to read them, so skip the instant guides
      if (!PACK || current.att.length) { startAI(); return; }
      const b = M.best(q, PACK.guides, PACK.syn);
      current.match = b;
      if (b.confident) { current.matched = b.top.guide.id; go('#/g/' + b.top.guide.id); return; }
      startAI();
    });
  }
  /* the first question goes to the AI (no guide matched, or "not what I asked") */
  function startAI() { current.matched = null; current.turns = [{q: current.q}]; askAI(0); }

  /* chat: follow-up questions always go to the AI, with the last few turns so it knows what "that" means */
  const MAX_TURNS = 8;
  function followUp(q2, fromGuide) {
    q2 = String(q2 || '').trim();
    if (q2.length < 2 && (current.att || []).length) q2 = 'Please look at what I attached.';
    if (q2.length < 2) { toast('Type your follow-up first'); return; }
    if (current.turns.some(t => t.busy)) return;
    cleanFirst(q2, '#fq', q2 => {
      if (fromGuide) current.turns = [{q: current.q, guide: fromGuide}];
      current.turns.push({q: q2});
      askAI(current.turns.length - 1);
    });
  }
  function turnSummary(t) {
    if (t.guide) { const g = PACK && PACK.guides.find(x => x.id === t.guide); return g ? `Showed the step-by-step guide "${g.title}": ` + g.steps.map((s, i) => `${i + 1}. ${s.t}`).join(' ') : ''; }
    const a = t.ai; if (!a) return '';
    return [a.title, a.answer].concat((a.steps || []).map((s, i) => `${i + 1}. ${s.t || s.text || ''}`)).filter(Boolean).join(' ');
  }
  async function askAI(i) {
    const cur = current, t = cur.turns[i]; if (!t || t.busy) return;
    t.ai = null; t.err = null;
    if (!session()) { t.err = 'unauthorized'; if (location.hash !== '#/ask') go('#/ask'); else render(); return; }
    t.busy = true; cur.scrollTo = i;
    if (location.hash !== '#/ask') go('#/ask'); else render();
    // earlier questions that failed still count as context ("how about SRM?" needs the question before it)
    const history = cur.turns.slice(0, i).slice(-4).map(x => ({q: x.q, a: (turnSummary(x) || '(no answer was shown)').slice(0, 1500)}));
    const body = Object.assign({op: 'ioask', question: t.q}, history.length ? {history} : {}, attPayload(cur.att || []));
    t.att = (cur.att || []).length;
    try {
      let r;
      try { r = await post(body); }
      catch (e) { if (e.code !== 'upstream_error') throw e; r = await post(body); } // one quiet retry for a server hiccup
      let a; try { a = parseJSON(r.text); } catch (e) { throw {code: 'invalid_json'}; }
      a.srcList = r.sources || [];
      t.ai = a;
    } catch (e) { t.err = e.code || 'upstream_error'; }
    finally { t.busy = false; if (current === cur && location.hash === '#/ask') { cur.scrollTo = i; render(); } }
  }
  function parseJSON(text) {
    const fence = String(text).match(/```(?:json)?\s*([\s\S]*?)```/), a = text.indexOf('{'), b = text.lastIndexOf('}');
    for (const t of [text, fence && fence[1], a >= 0 && b > a && text.slice(a, b + 1)]) { if (!t) continue; try { return JSON.parse(t); } catch (e) {} }
    throw new Error('bad json');
  }
  const AI_ERR = {
    offline: 'No internet right now, so the AI can\'t answer. The guides below still work offline.',
    unauthorized: 'Sign in with the team code to ask the AI.',
    daily_limit: 'The team has used today\'s AI limit. Try the guides below, or ask again tomorrow.',
    no_credit: 'The AI account is out of credit. Tell Kah Jian.', bad_api_key: 'The AI key on the team server is not working. Tell Kah Jian.',
    no_pack: 'The ePartner library is not on the team server yet. Tell Kah Jian.',
    invalid_request: 'The team server needs its update before it can answer questions. Tell Kah Jian.',
    rate_limited: 'The AI is busy. Wait a minute and try again.', invalid_json: 'The AI answer came back garbled. Try asking again.'
  };
  function askView() {
    const turns = current.turns || [];
    if (!turns.length) return bar('No Need Ask IO', '', true) + `<main class="wrap"><p class="empty">Ask a question on the home screen.</p></main>`;
    const busy = turns.some(t => t.busy), last = turns[turns.length - 1];
    const html = turns.map((t, i) => {
      let body = '';
      if (t.guide) { const g = PACK && PACK.guides.find(x => x.id === t.guide); body = g ? `<button class="item" data-g="${g.id}"><span class="n">${ICON.spark}</span><div class="t"><b>${esc(g.title)}</b><span>Step-by-step guide with screenshots</span></div>${ICON.chev}</button>` : ''; }
      else if (t.busy) body = t.att
        ? `<div class="loading"><div class="spin"></div><b style="color:var(--text)">Reading what you attached…</b>And checking GE's guides and manuals. Usually 20 to 60 seconds.</div>`
        : `<div class="loading"><div class="spin"></div><b style="color:var(--text)">Searching the ePartner library…</b>Checking GE's guides and manuals. Usually 10 to 30 seconds.</div>`;
      else if (t.err) body = `<div class="notice">${esc(t.err === 'invalid_request' && t.att ? 'The photos or PDF were too big for one question. Remove some pages and try again.' : AI_ERR[t.err] || 'Something went wrong on the team server. Try again in a moment.')}</div>
        ${t.err === 'unauthorized' ? '<button class="btn primary block" data-signin style="margin-bottom:12px">Sign in</button>' : `<button class="btn block" data-ai="${i}" style="margin-bottom:12px">Try again</button>`}`;
      else if (t.ai) body = answerHtml(t.ai, i);
      return `<section class="turn" id="t${i}"><div class="youasked${i ? ' fu' : ''}">${i ? 'Follow-up' : 'You asked'}: <b>${esc(t.q)}</b>${t.att ? `<span class="attn">${ICON.clip} with ${attLabel(t.att)}</span>` : ''}</div>${body}</section>`;
    }).join('');
    const b = current.match, first = turns[0];
    const others = turns.length === 1 && b && b.others ? b.others.filter(r => !(first.ai && r.guide.id === first.ai.guide)) : [];
    const sugg = !busy && others.length ? `<h2 class="sec">Other guides that may help</h2>${others.map((r, i) => item(r.guide, i + 1)).join('')}` : '';
    const box = busy || last.err === 'unauthorized' ? '' : turns.length >= MAX_TURNS
      ? `<div class="notice">This chat is getting long. Start a new question so the AI stays accurate.</div><button class="btn primary block" data-new style="margin-bottom:12px">New question</button>`
      : composer();
    return bar('No Need Ask IO', turns.length > 1 ? `Chat · ${turns.length} questions` : 'Answer', true) + `<main class="wrap">${html}${box}${sugg}${busy ? '' : helpBox()}</main>`;
  }
  const composer = () => `<div class="follow"><label for="fq">Ask a follow-up</label>
    <textarea id="fq" maxlength="500" placeholder="e.g. How about for SRM?  /  那个表格在哪里？  /  Kalau client bawah 16 tahun?"></textarea>
    ${attachBar('chat')}
    <div class="row"><button class="btn" data-new>New question</button><button class="btn primary" data-send>Send</button></div>
    <p class="muted">The AI remembers this chat${(current.att || []).length ? ' and what you attached' : ''}. Nothing is saved.</p></div>`;

  /* ---------- photos and PDFs (password PDFs open on the phone; only page images / text are sent, for this chat only) ---------- */
  const MAX_IMAGES = 8, MAX_DOC = 40000, PDF_PAGES_TEXT = 30;
  let draft = [], attachTo = 'home', attSeq = 0;
  const attList = where => where === 'chat' ? (current.att = current.att || []) : draft;
  const imgCount = list => list.reduce((n, x) => n + x.imgs.length, 0);
  const attLabel = n => `${n} attachment${n === 1 ? '' : 's'}`;
  function attachBar(where) {
    const list = attList(where), dark = where === 'home';
    return `<div class="attach${dark ? ' dark' : ''}">
      <div class="row"><button class="btn sm" data-cam="${where}">${ICON.cam} Take photo</button><button class="btn sm" data-up="${where}">${ICON.clip} Photo / PDF</button></div>
      ${list.length ? `<div class="tray">${list.map(x => `<div class="att">${x.thumb ? `<img alt="" src="${x.thumb}">` : `<span class="pdf">PDF</span>`}
        <span class="an">${esc(x.label)}</span><button class="rm" data-rm="${where}:${x.id}" aria-label="Remove ${esc(x.label)}">✕</button></div>`).join('')}</div>
        <p class="anote">Sent to the team AI for this chat only, never saved. Cover the client's name and IC if you can.</p>` : ''}
    </div>`;
  }
  function attPayload(list) {
    if (!list.length) return {};
    const images = list.flatMap(x => x.imgs).slice(0, MAX_IMAGES);
    const doc = list.filter(x => x.text).map(x => `[${x.name}]\n${x.text}`).join('\n\n').slice(0, MAX_DOC);
    return Object.assign({images}, doc ? {doc} : {});
  }
  function pickFiles(where, camera) { attachTo = where; const inp = $(camera ? '#fCam' : '#fUp'); inp.value = ''; inp.click(); }
  async function toJpeg(src, maxSide, q) { // src: Blob or canvas
    let cv = src;
    if (!(src instanceof HTMLCanvasElement)) {
      const bmp = await createImageBitmap(src), k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
    } else if (Math.max(cv.width, cv.height) > maxSide) {
      const k = maxSide / Math.max(cv.width, cv.height), c2 = document.createElement('canvas'); c2.width = Math.round(cv.width * k); c2.height = Math.round(cv.height * k);
      c2.getContext('2d').drawImage(cv, 0, 0, c2.width, c2.height); cv = c2;
    }
    return cv.toDataURL('image/jpeg', q || 0.85);
  }
  const loadScript = src => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error(src)); document.head.appendChild(s); });
  async function pdfLib() { if (!window.pdfjsLib) { await loadScript('vendor/pdf.min.js'); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; } return window.pdfjsLib; }
  function openPdf(file, buf) {
    return pdfLib().then(lib => new Promise((ok, bad) => {
      const task = lib.getDocument({data: buf});
      task.onPassword = (update, reason) => {
        sheet(`<h3>${reason === 2 ? 'Wrong password, try again' : 'This PDF has a password'}</h3><p>${esc(file.name)}</p>
          <div class="f"><label for="pw">PDF password</label><input id="pw" type="password" autocomplete="off" inputmode="text"></div>
          <p class="muted" style="margin-bottom:10px">Used once on this phone to open the file. Not saved, not sent.</p>
          <div class="row"><button class="btn" data-x>Skip this PDF</button><button class="btn primary" data-ok>Open</button></div>`, s => {
          const pw = $('#pw', s); setTimeout(() => pw.focus(), 50);
          $('[data-x]', s).onclick = () => { closeSheet(); task.destroy(); bad({code: 'cancelled'}); };
          const go = () => { const v = pw.value; busySheet('Opening the PDF…'); update(v); };
          $('[data-ok]', s).onclick = go; pw.onkeydown = e => { if (e.key === 'Enter') go(); };
          s.onclick = null; // only the buttons close this one
        });
      };
      task.promise.then(ok, e => bad({code: e && e.code === 'cancelled' ? 'cancelled' : 'bad_pdf'}));
    }));
  }
  const busySheet = msg => { sheet(`<h3>${esc(msg)}</h3><div class="loading" style="padding:16px"><div class="spin"></div></div>`); $('#sheet').onclick = null; };
  /* real words, not the scrambled glyph codes some GE PDFs (e.g. MPOS) contain */
  function readable(text) {
    const t = text.replace(/\s+/g, ' ').trim(); if (t.length < 80) return false;
    const printable = (t.match(/[\x20-\x7e -ɏ一-鿿]/g) || []).length / t.length;
    const words = (t.toLowerCase().match(/\b(the|and|of|to|policy|premium|date|name|sum|plan|dan|yang|untuk|polisi)\b/g) || []).length;
    return printable > 0.95 && words >= 3;
  }
  async function readPdf(file, free) {
    const doc = await openPdf(file, new Uint8Array(await file.arrayBuffer()));
    try {
      busySheet('Reading the PDF on this phone…');
      const n = doc.numPages, pages = [];
      for (let i = 1; i <= Math.min(n, PDF_PAGES_TEXT); i++) {
        const c = await (await doc.getPage(i)).getTextContent();
        pages.push(c.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim());
      }
      const all = pages.map((p, i) => `--- page ${i + 1} ---\n${p}`).join('\n');
      const textOk = readable(all);
      // readable text is cheap and exact; scans and scrambled PDFs are sent as page pictures instead
      const want = textOk ? Math.min(1, free) : Math.min(n, free, 6), imgs = [];
      let thumb = '';
      for (let i = 1; i <= Math.max(want, 1); i++) {
        const page = await doc.getPage(i), v1 = page.getViewport({scale: 1}), v = page.getViewport({scale: Math.min(3, 1600 / Math.max(v1.width, v1.height))});
        const cv = document.createElement('canvas'); cv.width = Math.round(v.width); cv.height = Math.round(v.height);
        const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
        await page.render({canvasContext: g, viewport: v}).promise;
        if (i === 1) thumb = await toJpeg(cv, 160, 0.7);
        if (i <= want) imgs.push((await toJpeg(cv, 1600)).split(',')[1]);
      }
      const used = textOk ? `text of ${Math.min(n, PDF_PAGES_TEXT)} page${n === 1 ? '' : 's'}` : `${imgs.length} of ${n} page${n === 1 ? '' : 's'} as pictures`;
      return {kind: 'pdf', name: file.name, thumb, imgs, text: textOk ? all.slice(0, MAX_DOC) : '', label: `${file.name.replace(/\.pdf$/i, '')} · ${used}`, pages: n};
    } finally { doc.destroy(); }
  }
  async function intake(files) {
    const list = attList(attachTo), skipped = [];
    for (const f of files) {
      const free = MAX_IMAGES - imgCount(list), isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
      try {
        if (isPdf) {
          busySheet('Opening the PDF…');
          const it = await readPdf(f, free);
          if (!it.imgs.length && !it.text) { skipped.push(f.name + ' (no room left)'); continue; }
          list.push(Object.assign(it, {id: ++attSeq}));
        } else if (/^image\//.test(f.type) || /\.(jpe?g|png|heic|webp)$/i.test(f.name || '')) {
          if (free <= 0) { skipped.push(f.name || 'photo'); continue; }
          busySheet('Preparing the photo…');
          const full = await toJpeg(f, 1600);
          list.push({id: ++attSeq, kind: 'img', name: f.name || 'photo', thumb: await toJpeg(f, 160, 0.7), imgs: [full.split(',')[1]], text: '', label: f.name && !/^image\.\w+$/.test(f.name) ? f.name : 'Photo'});
        } else skipped.push(f.name + ' (not a photo or PDF)');
      } catch (e) {
        if (e && e.code === 'cancelled') continue;
        skipped.push(f.name + (e && e.code === 'bad_pdf' ? ' (could not open)' : ' (could not read)'));
      }
    }
    closeSheet(); render();
    if (skipped.length) sheet(`<h3>Some files were not added</h3><p>${skipped.map(esc).join('<br>')}</p><p class="muted" style="margin:8px 0 12px">Up to ${MAX_IMAGES} photos or PDF pages per chat.</p><button class="btn block" data-x>OK</button>`, s => { $('[data-x]', s).onclick = closeSheet; });
  }
  ['#fCam', '#fUp'].forEach(id => { const el = $(id); if (el) el.addEventListener('change', e => { const f = [...(e.target.files || [])]; e.target.value = ''; if (f.length) intake(f); }); });
  function answerHtml(a, i) {
    const nc = a.kind === 'not_covered';
    const conf = a.confidence === 'high' ? '<span class="pill ok">Found in ePartner documents</span>' : a.confidence === 'low' || nc ? '<span class="pill err">Not sure, please double-check</span>' : '<span class="pill warn">Check the source to be safe</span>';
    const g = a.guide && PACK && PACK.guides.find(x => x.id === a.guide);
    const steps = Array.isArray(a.steps) ? a.steps.filter(s => s && (s.t || s.text)) : [];
    const used = (a.sources || []).map(n => a.srcList[n - 1]).filter(Boolean);
    return `<div class="head"><div class="kicker">${ICON.spark} AI answer from the ePartner library</div><h1>${esc(a.title || 'Answer')}</h1><p class="sub">${conf}</p></div>
      <div class="answer ${nc ? 'nc' : ''}">${esc(a.answer || '')}</div>
      ${steps.map((s, i) => `<article class="step"><div class="top"><span class="num">${i + 1}</span><div class="txt">${esc(s.t || s.text)}${pathHtml(s.path)}</div></div></article>`).join('')}
      ${a.notes && a.notes.length ? `<div class="tips"><h3>Good to know</h3><ul>${a.notes.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      ${g ? `<div style="margin-top:6px">${guideView(g.id, {inline: true})}</div><button class="btn block" data-g="${g.id}" style="margin-bottom:12px">Open the full "${esc(g.title)}" guide</button>` : ''}
      ${used.length ? `<details class="sources"><summary>Where this comes from (${used.length})</summary><ul>${used.map(s => `<li>${esc(s.s)}: ${esc(s.h)}</li>`).join('')}</ul></details>` : ''}
      <p class="src">AI can make mistakes. For product rules and numbers, open the latest PDF on ePartner before telling a client.</p>
      <div class="row" style="margin-bottom:10px"><a class="btn dark" href="${CFG.epartner}" target="_blank" rel="noopener">Open ePartner</a><button class="btn" data-copyai="${i}">Copy answer</button></div>`;
  }

  /* ---------- events ---------- */
  function wire(root) {
    $$('[data-g]', root).forEach(b => b.onclick = () => { current.matched = null; go('#/g/' + b.dataset.g); });
    $$('[data-cam]', root).forEach(b => b.onclick = () => pickFiles(b.dataset.cam, true));
    $$('[data-up]', root).forEach(b => b.onclick = () => pickFiles(b.dataset.up, false));
    $$('[data-rm]', root).forEach(b => b.onclick = () => {
      const [where, id] = b.dataset.rm.split(':'), list = attList(where), k = list.findIndex(x => String(x.id) === id);
      if (k >= 0) list.splice(k, 1); render();
    });
    const askBtn = $('[data-ask]', root), q = $('#q', root);
    if (askBtn) askBtn.onclick = () => ask(q.value);
    if (q) q.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(q.value); } };
    $$('[data-ai]', root).forEach(b => b.onclick = () => { if (b.dataset.ai === '') startAI(); else askAI(+b.dataset.ai); });
    $$('[data-followup]', root).forEach(b => b.onclick = () => go('#/'));
    $$('[data-new]', root).forEach(b => b.onclick = () => { current = {q: '', turns: []}; go('#/'); setTimeout(() => { const t = $('#q'); if (t) t.focus(); }, 50); });
    const fq = $('#fq', root), send = $('[data-send]', root);
    if (fq && send) {
      const from = root.querySelector('[data-from]'), fire = () => followUp(fq.value, from ? from.dataset.from : null);
      send.onclick = fire;
      fq.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fire(); } };
    }
    $$('[data-shot]', root).forEach(b => b.onclick = () => openViewer(b.dataset.shot, b.dataset.cap));
    $$('[data-signin]', root).forEach(b => b.onclick = () => signIn().then(ok => {
      if (!ok) return; render(); syncPack();
      const i = (current.turns || []).findIndex(t => t.err === 'unauthorized'); if (i >= 0) askAI(i);
    }));
    $$('[data-retry]', root).forEach(b => b.onclick = () => { packState = null; render(); syncPack(); });
    const all = $('[data-all]', root); if (all) all.onclick = () => go('#/all');
    const m2 = $('[data-menu2]', root); if (m2) m2.onclick = menu;
    $$('[data-copy]', root).forEach(b => b.onclick = () => copy(copyText(PACK.guides.find(x => x.id === b.dataset.copy))));
    $$('[data-copyai]', root).forEach(ca => ca.onclick = () => {
      const a = current.turns[+ca.dataset.copyai].ai; copy(`*${a.title}*\n${a.answer}\n` + (a.steps || []).map((s, i) => `${i + 1}. ${s.t || s.text}`).join('\n') + '\n\n(from No Need Ask IO, AI answer: please double-check)');
    });
  }
  async function copy(t) { try { await navigator.clipboard.writeText(t); toast('Copied. Paste it in WhatsApp.'); } catch (e) { sheet(`<h3>Copy this</h3><textarea style="width:100%;min-height:200px">${esc(t)}</textarea><button class="btn block" data-x>Close</button>`, el => { $('[data-x]', el).onclick = closeSheet; }); } }

  function signIn() {
    return new Promise(done => {
      const el = sheet(`<h3>Sign in to the team server</h3><p>Enter your name and the REDEFINE team code (the same one as Form Filler). The ePartner guides then download to this phone.</p>
        <div class="f"><label for="gName">Your name</label><input id="gName" autocomplete="name"></div>
        <div class="f"><label for="gCode">Team code</label><input id="gCode" type="password" autocomplete="current-password"></div>
        <p class="muted" id="gMsg" role="alert" style="color:var(--err);min-height:18px"></p>
        <div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Sign in</button></div>`);
      $('[data-x]', el).onclick = () => { closeSheet(); done(false); };
      $('[data-ok]', el).onclick = async () => {
        const who = {name: $('#gName', el).value.trim(), code: $('#gCode', el).value.trim()};
        if (!who.name || !who.code) { $('#gMsg', el).textContent = 'Enter both.'; return; }
        $('[data-ok]', el).disabled = true; $('[data-ok]', el).textContent = 'Checking…';
        try { await post({op: 'login'}, who); save('nnaio.session', who); packState = null; closeSheet(); done(true); }
        catch (e) {
          $('#gMsg', el).textContent = e.code === 'unauthorized' ? 'That team code is not right.' : e.code === 'locked' ? 'Too many wrong tries. Wait 15 minutes.' : 'Could not reach the team server. Check your connection.';
          $('[data-ok]', el).disabled = false; $('[data-ok]', el).textContent = 'Sign in';
        }
      };
    });
  }

  function menu() {
    const s = session();
    sheet(`<h3>Settings</h3>
      <p>${s ? `Signed in as <b>${esc(s.name)}</b>.` : 'Not signed in.'} Guides on this phone: ${PACK ? `${PACK.guides.length} guides, version ${esc(PACK.ver)}` : 'none yet'}.</p>
      <button class="btn block" data-sync style="margin-bottom:8px">Check for new guides</button>
      <button class="btn block" data-own style="margin-bottom:8px">Owner: upload guides and library</button>
      ${s ? '<button class="btn ghost block" data-out>Sign out</button>' : '<button class="btn primary block" data-in>Sign in</button>'}
      <button class="btn block" data-x style="margin-top:8px">Close</button>`, el => {
      $('[data-x]', el).onclick = closeSheet;
      $('[data-sync]', el).onclick = async () => { closeSheet(); if (!session()) return toast('Sign in first'); toast('Checking…'); await syncPack(); if (packState === 'ok') toast('You have the latest guides'); else toast(PACK_MSG[packState] || PACK_MSG.offline); };
      $('[data-own]', el).onclick = () => { closeSheet(); ownerUpload(); };
      const o = $('[data-out]', el); if (o) o.onclick = () => sheet(`<h3>Sign out?</h3><p>The guides stay on this phone. You need the team code again to ask the AI.</p><div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Sign out</button></div>`, e2 => {
        $('[data-x]', e2).onclick = closeSheet; $('[data-ok]', e2).onclick = () => { save('nnaio.session', null); if (load('rff.session', null)) toast('Note: your Form Filler sign-in on this phone is still active'); closeSheet(); render(); };
      });
      const i = $('[data-in]', el); if (i) i.onclick = () => { closeSheet(); signIn().then(ok => { if (ok) { render(); syncPack(); } }); };
    });
  }

  /* owner: pick nnaio_pack.json + nnaio_lib_*.json from tools/build-pack.js and send them to the team server */
  function ownerUpload() {
    const inp = $('#fPack'); inp.value = '';
    inp.onchange = async () => {
      const files = [...inp.files], items = [];
      for (const f of files) {
        const m = f.name.match(/nnaio_(pack|lib_(\d))\.json$/);
        if (!m) continue;
        items.push({name: m[2] ? 'lib' + m[2] : 'pack', file: f});
      }
      if (!items.length) return toast('Pick nnaio_pack.json and the nnaio_lib_ files');
      items.sort((a, b) => a.name.localeCompare(b.name));
      sheet(`<h3>Replace the team's guides?</h3><p>This replaces what every agent downloads and what the AI searches:</p>
        <div class="cmp">${items.map(i => `${esc(i.file.name)} (${Math.round(i.file.size / 1024)} KB)`).join('<br>')}</div>
        <div class="f"><label for="oCode">Owner code (not saved)</label><input id="oCode" type="password" autocomplete="off"></div>
        <p class="muted" id="oMsg" role="alert" style="min-height:18px"></p>
        <div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Upload</button></div>`, el => {
        $('[data-x]', el).onclick = closeSheet;
        $('[data-ok]', el).onclick = async () => {
          const code = $('#oCode', el).value.trim(), msg = $('#oMsg', el), btn = $('[data-ok]', el);
          if (!code) { msg.textContent = 'Enter the owner code.'; return; }
          btn.disabled = true;
          const who = {name: (session() || {}).name || 'owner', code};
          try {
            for (let i = 0; i < items.length; i++) {
              msg.textContent = `Uploading ${i + 1} of ${items.length}: ${items[i].file.name}…`;
              await post({op: 'ioput', name: items[i].name, text: await items[i].file.text()}, who);
            }
            closeSheet(); toast('Uploaded. Agents get the new guides next time they open the app.'); await syncPack();
          } catch (e) {
            msg.textContent = e.code === 'not_allowed' || e.code === 'unauthorized' ? 'That is not the owner code.' : e.code === 'invalid_request' ? 'The team server rejected a file (wrong file, or the server needs its update).' : 'Upload failed: ' + (e.code || 'error') + '. Nothing after this file was sent.';
            btn.disabled = false;
          }
        };
      });
    };
    inp.click();
  }

  /* ---------- start ---------- */
  save('nnaio.recent', null); // questions are never kept on the phone (older versions saved the last few)
  render();
  DB.get('pack').then(p => { if (packOk(p)) { PACK = p; render(); } }).catch(() => {}).finally(() => syncPack());
  window.__nna = {ask, state: () => ({PACK: !!PACK, packState, current})}; // for tests
})();
