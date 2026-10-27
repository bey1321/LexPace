import { h, shuffle, now } from "../core/dom.js";

// Sound Lab: hear a made-up word, pick it with one sound taken away (phoneme deletion).
// Measures sound awareness. Adaptive: first sound → first sound of a cluster → second sound.
export default {
  id: "lab",
  name: "Sound Lab",
  icon: "lab",
  blurb: "Hear a word. Pick it with one sound taken away.",
  meta: ["2 min", "8 rounds", "audio"],
  initData: () => [],

  async run(ctx) {
    const ask = ([word, right, wrong], which) => new Promise((resolve) => {
      const opts = shuffle([{ t: right, ok: true }, { t: wrong, ok: false }, { t: word, ok: false }]);
      const target = which === "second" ? 1 : 0;
      const blocks = h("div", { class: "lx-blocks", "aria-hidden": "true" },
        Array.from({ length: Math.min(Math.max(word.length, 3), 5) }, (_, k) => h("span", { class: k === target ? "is-target" : "" })));
      let picked = -1, t0 = 0;
      const choose = h("button", { class: "lx-btn", disabled: true, onclick: () => { choose.disabled = true; resolve({ ok: opts[picked].ok, rt: now() - (t0 || now()), opts, buttons }); } }, "Choose this one");
      const buttons = opts.map((o, k) => h("button", {
        class: "lx-option", "aria-pressed": "false", "aria-label": `Option ${"ABC"[k]}, plays a sound`,
        onclick: () => {
          picked = k; ctx.audio.play(`lab-${o.t}`, o.t, 0.75);
          buttons.forEach((b, j) => b.setAttribute("aria-pressed", String(j === k)));
          choose.disabled = false;
        },
      }, ctx.icon("speaker"), h("b", {}, "ABC"[k])));
      const hear = async () => { blocks.classList.remove("is-pop"); await ctx.audio.play(`lab-${word}`, word, 0.75); blocks.classList.add("is-pop"); };

      ctx.body(
        h("p", { class: "lx-prompt lx-center" }, "Take away the ", h("b", {}, which), " sound"),
        blocks,
        h("div", { class: "lx-row lx-center" }, ctx.listen("Hear the word again", hear)),
        h("div", { class: "lx-options" }, buttons),
        h("div", { class: "lx-row lx-center" }, choose)
      );
      hear().then(() => { t0 = now(); });
    });

    ctx.head({ label: "Practice", practice: true });
    const p = await ask(ctx.content.practice.item, ctx.content.practice.ask);
    p.buttons[p.opts.findIndex((o) => o.ok)].classList.add("is-right");
    await ctx.practiceDone(p.ok, p.ok ? "Yes. “smab” without its first sound is “mab”." : "Not quite. “smab” without its first sound is “mab” (in green).");

    await ctx.staircase(ctx.content.levels, async (item, level) => {
      const which = ctx.content.ask[level];
      const r = await ask(item, which);
      return { ok: r.ok, rt: r.rt, item: item[0], ask: which };
    });
  },
};
