import { h, now } from "../core/dom.js";

// Echo: hear a word in a sentence, type it (spelling to dictation).
// Adaptive over regular (levels 1–2) and irregular (3–4) words, then 2 fixed irregular probes.
// Each answer is typed as: correct · sounds_right · swap · sounds_wrong.

// Rough "sounds the same" key for misspellings not in the item's list.
export function soundKey(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, "");
  const rules = [[/^kn/, "n"], [/^wr/, "r"], [/^ps/, "s"], [/^gn/, "n"], [/mb$/, "m"], [/ph/g, "f"], [/ck/g, "k"], [/dge/g, "j"], [/tch/g, "ch"], [/gh/g, ""], [/wh/g, "w"], [/c(?=[eiy])/g, "s"], [/c/g, "k"], [/q/g, "k"], [/x/g, "ks"], [/z/g, "s"], [/([a-z])\1+/g, "$1"]];
  for (const [r, s] of rules) w = w.replace(r, s);
  return w.replace(/e$/, "").replace(/[aeiouy]+/g, "a");
}

export function classifySpelling(item, typed) {
  const t = typed.trim().toLowerCase(), w = item.w;
  if (t === w) return "correct";
  for (let k = 0; k < w.length - 1; k++) if (w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2) === t) return "swap";
  if ((item.p || []).includes(t) || soundKey(t) === soundKey(w)) return "sounds_right";
  return "sounds_wrong";
}

export default {
  id: "echo",
  name: "Echo",
  icon: "echo",
  blurb: "Hear a word. Type it.",
  meta: ["2 min", "8 words", "audio", "typing"],
  initData: () => [],

  async run(ctx) {
    const maxReplays = ctx.cfg.replays ?? 1;
    const ask = (item) => new Promise((resolve) => {
      let replays = 0, t0 = 0;
      const field = h("input", { class: "lx-field", id: "lx-echo-field", autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: "false", "aria-label": "Type the word you heard" });
      const say = () => ctx.audio.play(`echo-${item.w}`, `${item.w}. ${item.s} ${item.w}.`, 0.85);
      const replay = ctx.listen(`Replay (${maxReplays} left)`, () => {
        if (replays >= maxReplays) return;
        replays++; say();
        replay.disabled = replays >= maxReplays;
        replay.querySelector("span:last-child").textContent = replays >= maxReplays ? "No replays left" : `Replay (${maxReplays - replays} left)`;
      });
      const submit = () => {
        if (!field.value.trim()) return field.focus();
        go.disabled = true;
        resolve({ typed: field.value.trim(), rt: now() - (t0 || now()), replays });
      };
      const go = h("button", { class: "lx-btn", onclick: submit }, "Next");
      field.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
      ctx.body(replay, h("label", { class: "lx-label", for: "lx-echo-field" }, "Type the word you heard"), field, h("div", { class: "lx-row" }, go));
      say().then(() => { t0 = now(); field.focus(); });
    });

    ctx.head({ label: "Practice", practice: true });
    const p = await ask(ctx.content.practice);
    const ok = p.typed.toLowerCase() === ctx.content.practice.w;
    await ctx.practiceDone(ok, ok ? "That’s it." : `The word was “${ctx.content.practice.w}”.`);

    const judge = (item, r, irregular, probe = false) => {
      const type = classifySpelling(item, r.typed);
      return { ok: type === "correct", rt: r.rt, word: item.w, typed: r.typed, type, irregular, replays: r.replays, ...(probe ? { probe } : {}) };
    };

    await ctx.staircase(ctx.content.levels, async (item, level) => judge(item, await ask(item), level >= 3));

    const probes = ctx.content.probes || [];
    const total = ctx.cfg.items + probes.length;
    for (let k = 0; k < probes.length; k++) {
      if (!ctx.alive()) return;
      ctx.head({ label: `Word ${ctx.cfg.items + k + 1} of ${total}`, i: ctx.cfg.items + k, n: total });
      const r = await ask(probes[k]);
      const entry = { n: ctx.cfg.items + k + 1, level: 3, ...judge(probes[k], r, true, true) };
      entry.rt = Math.round(entry.rt);
      ctx.data.push(entry); ctx.log(entry); ctx.save();
    }
  },
};
