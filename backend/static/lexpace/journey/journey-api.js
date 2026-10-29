// LexPace integration: connects the EN/AR journey pages to the screening backend.
// Items come from /api/screening (LLM-generated and validated, or starter items); answers are
// evaluated on the server, which also keeps the answer keys. Pages call LP.step / LP.answer / LP.finish.
const LP = {
  sid: null, plan: {}, cache: {}, pending: {}, busy: false, final: null, text: {},
  async post(path, body) {
    const res = await fetch('/api/screening' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    if (!res.ok) throw new Error(path + ': ' + res.status);
    return res.json();
  },
  async start(language, context) {
    const s = await this.post('/sessions', { language, context });
    Object.assign(this, { sid: s.session_id, plan: s.plan, cache: {}, pending: {}, final: null, busy: false });
    return s;
  },
  total(activity) { return this.plan[activity] || 0; },
  // Returns the item for (activity, trial), or null after showing a loading screen / moving on.
  step(activity, trialNo, nextStage) {
    if (trialNo >= this.total(activity)) { go(nextStage); return null; }
    const k = activity + ':' + trialNo;
    if (this.cache[k]) return this.cache[k];
    if (!this.pending[k]) {
      this.pending[k] = this.post('/sessions/' + this.sid + '/items', { activity })
        .then((it) => { this.cache[k] = it; delete this.pending[k]; render(); })
        .catch((e) => { delete this.pending[k]; this.fail(e); });
    }
    show(this.loading());
    return null;
  },
  async answer(item, body) {
    if (this.busy) return null;
    this.busy = true;
    try { return await this.post('/sessions/' + this.sid + '/answers', { item_id: item.item_id, ...body }); }
    catch (e) { this.fail(e); return null; }
    finally { this.busy = false; }
  },
  finish(history, extra) {
    if (this.final || this.pending.final) return this.final;
    this.pending.final = this.post('/sessions/' + this.sid + '/complete', { history, ...extra })
      .then((r) => {
        this.final = r; delete this.pending.final; render();
        // LexPace integration: tell the LexPace page the check is done, so it can show next steps.
        // The village pages show a full-page summary first; the student moves on with Continue (see LP_SUMMARY).
        if (!document.getElementById('panel')) {
          try { if (window.parent !== window) window.parent.postMessage({ type: 'lexpace:check-complete' }, location.origin); } catch (e) {}
        }
      })
      .catch((e) => { delete this.pending.final; this.fail(e); });
    show(this.loading());
    return null;
  },
  loading() { return `<div class="info" style="margin-top:40px">${this.text.loading}</div>`; },
  fail(e) {
    console.error('[lexpace]', e);
    show(`<div class="info" style="margin-top:40px">${this.text.error}</div><div class="actions"><button class="btn" onclick="render()">${this.text.retry}</button></div>`);
  },
};

// Village pages: the finished check's summary ("Results") fills the page with the activity scores.
//   X         -> LexPace opens a fresh screening (Check tab)
//   Continue  -> LexPace's Results page (what the results mean, format, SAS referral); Back returns here
// The last summary is kept in this browser, so LexPace's Results tab can reopen it (?summary=1).
const LP_SUMMARY = {
  KEY: 'lexpace:last-summary',
  text: {
    en: { close: 'Close', cont: 'See what my results mean →' },
    ar: { close: 'إغلاق', cont: 'اعرف ماذا تعني نتائجي ←' },
  },
  lang() { return document.documentElement.lang === 'ar' ? 'ar' : 'en'; },
  tell(type) {
    try { if (window.parent !== window) window.parent.postMessage({ type }, location.origin); } catch (e) {}
  },
  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify({ lang: this.lang(), at: new Date().toISOString(),
        results, historyAnswers, final: LP.final }));
    } catch (e) {}
    this.tell('lexpace:summary-saved');
  },
  load() {
    try { const s = JSON.parse(localStorage.getItem(this.KEY) || 'null'); return s && s.final ? s : null; } catch (e) { return null; }
  },
  // Shows the saved summary again (the village opens with every house done).
  reopen() {
    const s = this.load();
    if (!s) return false;
    results = s.results || []; historyAnswers = s.historyAnswers || {}; LP.final = s.final; passageDone = true;
    go(stages.length - 1);
    return true;
  },
  results() { this.tell('lexpace:open-results'); },
  close() {
    const panel = document.getElementById('panel');
    if (panel) panel.classList.remove('lp-summary');
    closePanel();
    this.tell('lexpace:summary-closed');
  },
  decorate() {
    const panel = document.getElementById('panel'), app = document.getElementById('app');
    if (!panel || !app || app.querySelector('.lp-summary-close')) return;
    const t = this.text[this.lang()];
    panel.classList.add('lp-summary');
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'lp-summary-close'; close.setAttribute('aria-label', t.close); close.textContent = '✕';
    close.onclick = () => this.close();
    app.prepend(close);
    // The screening results are explained on LexPace's Results page, not here: only the activity scores stay.
    const infos = app.querySelectorAll('.info');
    if (infos.length) infos[infos.length - 1].remove();
    const actions = app.querySelector('.actions');
    if (actions) {
      const cont = document.createElement('button');
      cont.type = 'button'; cont.className = 'btn'; cont.textContent = t.cont;
      cont.onclick = () => this.results();
      actions.prepend(cont);
    }
  },
};
window.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('panel') || typeof show !== 'function') return;
  const css = document.createElement('style');
  css.textContent = '#panel.lp-summary{align-items:flex-start;padding:0}'
    + '#panel.lp-summary .panel-card{width:100%;max-width:none;min-height:100%;max-height:none;border-radius:0;box-shadow:none;position:relative}'
    + '#panel.lp-summary .panel-head{display:none}'
    + '#panel.lp-summary #app{max-width:900px;margin:0 auto;padding:32px 24px 40px}'
    + '.lp-summary-close{position:absolute;top:14px;inset-inline-end:16px;width:40px;height:40px;border-radius:50%;border:1px solid #c9d6d2;background:#fff;font-size:18px;cursor:pointer;color:#26394a}'
    + '.lp-summary-close:hover{background:#eef4f2}';
  document.head.appendChild(css);
  const pageShow = show;
  let saved = null; // the LP.final last saved ('reopen': the summary shown again, nothing new to save)
  window.show = function (html) {
    pageShow(html);
    const panel = document.getElementById('panel');
    if (stage === stages.length - 1 && LP.final) {
      if (saved === 'reopen') saved = LP.final;
      else if (saved !== LP.final) { saved = LP.final; LP_SUMMARY.save(); }
      LP_SUMMARY.decorate();
    } else if (panel) panel.classList.remove('lp-summary');
  };
  // Opened from LexPace's "My results" (or back from the interpretation page): show the last summary.
  if (new URLSearchParams(location.search).has('summary')) { saved = 'reopen'; if (!LP_SUMMARY.reopen()) saved = null; }
});

// DEMO ONLY (remove before merging): "Skip to end" answers every activity with a demo answer through the
// real API, marks every step done and opens the summary. Finishing there sends the student to Results.
const LP_DEMO = {
  labels: {
    en: { lexical: 'Real or Not?', sound: 'Sound Lab', spelling: 'Echo', writing: 'Express Your Idea', comprehension: 'Read & Listen', number: 'Number Challenge', reasoning: 'Math Reasoning' },
    ar: { lexical: 'كلمة أم لا؟', sound: 'مختبر الأصوات', spelling: 'اسمع واكتب', writing: 'التعبير الكتابي', comprehension: 'اقرأ واستمع', number: 'تحدي الأعداد', reasoning: 'التفكير الرياضي' },
  },
  writing: {
    en: 'A good study space is quiet and tidy. I like to work at a desk near a window, with my notes and a glass of water close by.',
    ar: 'مكان الدراسة الجيد هادئ ومرتب. أحب أن أدرس على مكتب قرب النافذة، وأضع ملاحظاتي وكوب ماء بجانبي.',
  },
  running: false,
  async run(btn) {
    if (this.running) return;
    this.running = true;
    const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    const names = this.labels[lang];
    btn.disabled = true;
    try {
      // Always a fresh session marked as a demo, so the backend returns sample results.
      context = { ...(context || {}), demo: true };
      await LP.start(lang, context);
      results = [];
      let done = 0;
      const total = Object.values(LP.plan).reduce((a, b) => a + b, 0);
      for (const activity of Object.keys(LP.plan)) {
        for (let i = 0; i < LP.plan[activity]; i++) {
          btn.textContent = `Filling demo answers… ${++done}/${total}`;
          const key = activity + ':' + i;
          const item = LP.cache[key] || await LP.post('/sessions/' + LP.sid + '/items', { activity }).catch(() => null);
          if (!item) continue; // already served earlier in this session
          LP.cache[key] = item;
          if (activity === 'comprehension') {
            for (let q = 0; q < item.questions.length; q++) {
              const r = await LP.post('/sessions/' + LP.sid + '/answers', { item_id: item.item_id, response: 0, question_index: q, latency_ms: 4000, lookbacks: 0 }).catch(() => null);
              if (r) record(names[activity], item.questions[q].question, item.questions[q].options[0], r.correct, { demo: true });
            }
            continue;
          }
          const response = activity === 'writing' ? this.writing[lang] : activity === 'spelling' ? (item.spoken || 'demo') : 0;
          const r = await LP.post('/sessions/' + LP.sid + '/answers', { item_id: item.item_id, response, latency_ms: 2500, audio_plays: 1 }).catch(() => null);
          if (r) record(names[activity], item.stimulus || item.word || item.spoken || item.question || item.prompt || '', String(response), activity === 'writing' ? null : r.correct, { demo: true });
        }
      }
      historyCodes = { reading: 1, spelling: 1, math: 0, support: 1, persistent: 1 };
      historyAnswers = { reading: 'demo', spelling: 'demo', math: 'demo', support: 'demo', persistent: 'demo' };
      passageDone = true;
      btn.remove();
      go(stages.length - 1); // summary: finishes the session, then LexPace opens Results
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Skip to end (demo)'; LP.fail(e);
    } finally {
      this.running = false;
    }
  },
};
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn ghost';
  btn.textContent = 'Skip to end (demo)';
  btn.onclick = () => LP_DEMO.run(btn);
  const hud = document.getElementById('guide'); // village pages: under the quest journal's "next stop" box
  if (hud) {
    btn.style.cssText = 'display:block;width:100%;margin:10px 0';
    hud.after(btn);
  } else {
    btn.style.cssText = 'position:fixed;top:12px;inset-inline-end:16px;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,.12)';
    document.body.appendChild(btn);
  }
});
