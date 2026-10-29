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
        try { if (window.parent !== window) window.parent.postMessage({ type: 'lexpace:check-complete' }, location.origin); } catch (e) {}
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
