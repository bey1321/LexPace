// LexPace Reading Journey: public entry point.
//
//   import { createJourney } from "./src/lexpace-games.js";
//   const journey = createJourney(document.getElementById("app"), {
//     model: "model/lexpace_model.json",       // or the parsed JSON object, or null for rules only
//     onComplete: (payload) => saveToBackend(payload),
//   });
//
// See README.md for every option and the ctx API that games use.

import { DEFAULT_CONFIG, mergeConfig } from "./config.js";
import { DEFAULT_CONTENT } from "./content.js";
import { GAMES } from "./games/index.js";
import { h, icon } from "./core/dom.js";
import { createAudio } from "./core/audio.js";
import { runStaircase } from "./core/staircase.js";
import { localStore } from "./core/storage.js";
import { extractFeatures } from "./scoring/features.js";
import { decide } from "./scoring/decide.js";
import { renderResults } from "./views/results.js";

export { DEFAULT_CONFIG, DEFAULT_CONTENT, GAMES, extractFeatures, decide };

const SCHEMA = "lexpace.journey/v3";
const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : "s-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
const CHEERS = ["Nice start.", "Two down.", "Halfway there.", "Good going.", "Almost there.", "One more to go.", "All done."];

export function createJourney(root, options = {}) {
  const config = mergeConfig(DEFAULT_CONFIG, options.config);
  const content = mergeConfig(DEFAULT_CONTENT, options.content);
  const games = options.games || GAMES;
  const audio = createAudio({ lang: config.lang, ...(options.audio || {}) });
  const storage = options.storage || localStore(options.storageKey || "lexpace-journey-v3");
  const emit = (type, data = {}) => { try { options.onEvent?.({ type, at: new Date().toISOString(), ...data }); } catch {} };

  let state = null;
  let runToken = 0; // bumps on restart so old, half-finished games stop writing

  // ---------- Shell ----------
  const trail = h("ol", { class: "lx-trail", "aria-label": "Journey progress" });
  const stageHead = h("div", { class: "lx-stage-head" });
  const stageBody = h("div", { class: "lx-stage-body", "aria-live": "polite" });
  const stage = h("section", { class: "lx-stage" }, stageHead, stageBody);
  const restartBtn = h("button", { class: "lx-btn lx-btn-ghost lx-btn-sm", onclick: () => restart() }, icon("restart"), "Start over");

  root.classList.add("lx-root");
  root.replaceChildren(
    h("header", { class: "lx-band" }, h("div", { class: "lx-band-inner" },
      h("div", { class: "lx-band-top" },
        h("div", {}, h("span", { class: "lx-eyebrow lx-eyebrow-band" }, options.brand || "LexPace"), h("h1", { class: "lx-title" }, options.title || "Reading Journey")),
        restartBtn),
      trail)),
    h("main", { class: "lx-main" }, stage));

  function drawTrail() {
    trail.replaceChildren(...games.map((g, i) => {
      const status = state && i < state.at ? "done" : state && i === state.at ? "now" : "todo";
      return h("li", { class: `lx-node is-${status}`, style: { "--hue": `var(--lx-c-${g.id}, var(--lx-accent))` }, "aria-current": status === "now" ? "step" : null },
        h("span", { class: "lx-node-dot" }, icon(status === "done" ? "check" : g.icon)),
        h("span", { class: "lx-node-label" }, g.name));
    }));
  }

  // ---------- Stage helpers ----------
  function head({ label = "", i, n, level, levels, practice } = {}) {
    const g = games[state.at];
    stageHead.replaceChildren(...[
      h("div", { class: "lx-stage-meta" },
        h("span", { class: "lx-stage-name", style: { "--hue": `var(--lx-c-${g.id}, var(--lx-accent))` } }, icon(g.icon), g.name),
        h("span", { class: "lx-counter" + (practice ? " is-practice" : "") }, label)),
      level ? h("span", { class: "lx-level", "aria-label": `Level ${level} of ${levels}` },
        h("small", {}, "Level"), h("span", { class: "lx-level-bars" }, Array.from({ length: levels }, (_, k) => h("i", { class: k < level ? "is-on" : "", style: { height: `${8 + k * 5}px` } })))) : null,
      n ? h("div", { class: "lx-progress", "aria-hidden": "true" }, h("i", { style: { width: `${Math.round((100 * i) / n)}%` } })) : null,
    ].filter(Boolean));
  }
  const body = (...nodes) => stageBody.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false));
  const clearHead = () => stageHead.replaceChildren();
  const waitButton = (btn) => new Promise((res) => btn.addEventListener("click", res, { once: true }));
  const persist = () => storage.save(state);

  function listen(label, fn) {
    return h("button", { class: "lx-listen", type: "button", onclick: fn }, icon("speaker"), h("span", {}, label));
  }

  function makeCtx(game, token) {
    const alive = () => token === runToken;
    const cfg = config.games[game.id] || {};
    state.data[game.id] = game.initData ? game.initData() : [];
    const data = state.data[game.id];
    const ctx = {
      id: game.id, cfg, content: content[game.id] || {}, audio, thresholds: config.thresholds, data, h, icon,
      alive,
      head: (o) => alive() && head(o),
      body: (...n) => alive() && body(...n),
      listen,
      save: () => alive() && persist(),
      log: (entry) => alive() && emit("item", { game: game.id, entry }),
      async practiceDone(ok, text) {
        if (!alive()) return;
        const go = h("button", { class: "lx-btn" }, "Start for real", icon("arrow"));
        stageBody.append(h("div", { class: "lx-feedback" },
          h("p", { class: ok ? "lx-callout lx-callout-good" : "lx-callout lx-callout-warn" }, text, " In the real rounds you won’t see if you’re right."),
          h("div", { class: "lx-row" }, go)));
        go.focus();
        await waitButton(go);
      },
      async interlude(title, node, btnLabel) {
        if (!alive()) return;
        clearHead();
        const go = h("button", { class: "lx-btn" }, btnLabel, icon("arrow"));
        body(h("span", { class: "lx-badge" }, icon("check"), title), node, h("div", { class: "lx-row" }, go));
        go.focus();
        await waitButton(go);
      },
      staircase: (bank, ask) => runStaircase({
        bank, levels: cfg.levels, start: cfg.start, items: cfg.items, fastMs: cfg.fastMs, ask, isAlive: alive,
        onStep: ({ i, n, level }) => alive() && head({ label: `Round ${i + 1} of ${n}`, i, n, level, levels: cfg.levels }),
        record: (entry) => { if (!alive()) return; data.push(entry); emit("item", { game: game.id, entry }); persist(); },
      }),
    };
    return ctx;
  }

  // ---------- Screens ----------
  async function stationIntro(game, i) {
    clearHead();
    const go = h("button", { class: "lx-btn" }, game.practice === false ? "Start" : "Try a practice one", icon("arrow"));
    body(h("div", { class: "lx-intro", style: { "--hue": `var(--lx-c-${game.id}, var(--lx-accent))` } },
      h("span", { class: "lx-intro-icon" }, icon(game.icon)),
      h("span", { class: "lx-eyebrow" }, `Station ${i + 1} of ${games.length}`),
      h("h2", { class: "lx-h2" }, game.name),
      h("p", { class: "lx-lead" }, game.blurb),
      game.meta ? h("ul", { class: "lx-chips" }, game.meta.map((m) => h("li", {}, m))) : null,
      h("div", { class: "lx-row" }, go)));
    go.focus();
    await waitButton(go);
  }

  async function stationDone(i) {
    clearHead();
    const r = 26, c = 2 * Math.PI * r, frac = (i + 1) / games.length;
    const last = i === games.length - 1;
    const go = h("button", { class: "lx-btn" }, last ? "See my results" : "Next station", icon("arrow"));
    body(h("div", { class: "lx-done" },
      h("span", { class: "lx-ring", html: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="lx-ring-track"/><circle cx="32" cy="32" r="${r}" class="lx-ring-fill" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}" transform="rotate(-90 32 32)"/></svg><b>${i + 1}/${games.length}</b>` }),
      h("span", { class: "lx-badge" }, icon("check"), `${games[i].name} complete`),
      h("h2", { class: "lx-h2" }, CHEERS[Math.min(i, CHEERS.length - 1)]),
      h("p", { class: "lx-muted" }, last ? "Let’s look at your results." : "Take a breath if you like. The next station starts when you’re ready."),
      h("div", { class: "lx-row" }, go)));
    go.focus();
    await waitButton(go);
  }

  async function loadModel() {
    const m = options.model;
    if (!m) return null;
    if (typeof m === "object") return m;
    try { const res = await fetch(m); return res.ok ? await res.json() : null; } catch { return null; }
  }

  async function showResults(token) {
    clearHead();
    body(h("p", { class: "lx-muted" }, "Working out your results…"));
    const model = await loadModel();
    if (token !== runToken) return;
    const features = extractFeatures(state.data, content);
    const result = decide(features, config.thresholds, model);
    const payload = {
      schema: SCHEMA, sessionId: state.sessionId, startedAt: state.startedAt, finishedAt: new Date().toISOString(),
      features, result, raw: state.data, config: { games: config.games, thresholds: config.thresholds },
      model: model ? { version: model.meta?.version, trained_on: model.meta?.trained_on } : null,
    };
    state.finished = true; state.payload = payload; persist();
    emit("complete", { payload });
    try { options.onComplete?.(payload); } catch {}
    body(renderResults({ payload, thresholds: config.thresholds, teamView: options.teamView !== false, onShare: options.onShare }));
  }

  async function runFrom(index) {
    const token = ++runToken;
    for (let i = index; i < games.length; i++) {
      if (token !== runToken) return;
      state.at = i; persist(); drawTrail();
      await stationIntro(games[i], i);
      if (token !== runToken) return;
      emit("station_start", { game: games[i].id });
      await games[i].run(makeCtx(games[i], token));
      if (token !== runToken) return;
      audio.stop();
      emit("station_done", { game: games[i].id });
      state.at = i + 1; persist(); drawTrail();
      await stationDone(i);
    }
    if (token === runToken) showResults(token);
  }

  function welcome() {
    const saved = storage.load();
    const canResume = saved && saved.schema === SCHEMA && !saved.finished && saved.at >= 0 && saved.at < games.length;
    state = { schema: SCHEMA, sessionId: uuid(), startedAt: new Date().toISOString(), at: -1, data: {}, finished: false };
    drawTrail(); clearHead();
    const heard = h("span", { class: "lx-muted lx-small" });
    const begin = h("button", { class: canResume ? "lx-btn lx-btn-quiet" : "lx-btn" }, canResume ? "Start again" : "Start the journey", canResume ? null : icon("arrow"));
    const resume = canResume && h("button", { class: "lx-btn" }, "Continue", icon("arrow"));
    begin.onclick = () => { storage.clear(); state.at = 0; emit("journey_start", { sessionId: state.sessionId }); runFrom(0); };
    if (resume) resume.onclick = () => { state = saved; drawTrail(); runFrom(saved.at); };
    body(h("div", { class: "lx-welcome" },
      h("span", { class: "lx-eyebrow" }, "Private reading check"),
      h("h2", { class: "lx-h2 lx-h2-big" }, "7 short games, about 10 minutes"),
      h("p", { class: "lx-lead" }, "Only you see your results. This is not a diagnosis."),
      h("ul", { class: "lx-station-list" }, games.map((g) => h("li", { style: { "--hue": `var(--lx-c-${g.id}, var(--lx-accent))` } }, icon(g.icon), g.name))),
      h("div", { class: "lx-callout lx-callout-info" }, "Use headphones if you can. Check you can hear clearly first."),
      h("div", { class: "lx-row" }, listen("Sound check", async () => {
        heard.textContent = audio.hasVoice ? "Playing…" : "This browser has no voice. Try Chrome or Edge.";
        await audio.play("soundcheck", "If you can hear this clearly, you are ready to start.", 0.95);
        if (audio.hasVoice) heard.textContent = "Heard it? You’re ready.";
      }), heard),
      canResume ? h("p", { class: "lx-callout lx-callout-good" }, "You stopped at ", h("b", {}, games[saved.at].name), ". You can continue from there.") : null,
      h("div", { class: "lx-row" }, resume, begin,
        h("button", { class: "lx-btn lx-btn-quiet", onclick: () => { emit("declined"); body(h("h2", { class: "lx-h2" }, "No problem"), h("p", { class: "lx-muted" }, "You can take the check anytime from LexPace."), h("div", { class: "lx-row" }, h("button", { class: "lx-btn", onclick: welcome }, "Back"))); } }, "Not now"))));
  }

  function restart() { runToken++; audio.stop(); storage.clear(); welcome(); }

  audio.preload();
  welcome();

  return {
    restart,
    getState: () => structuredClone(state),
    destroy: () => { runToken++; audio.stop(); root.replaceChildren(); root.classList.remove("lx-root"); },
  };
}
