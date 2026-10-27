import { h, shuffle, now } from "../core/dom.js";

// Sound-Alike: pick the made-up word that sounds like a real word (pseudohomophone choice).
// Measures sound-to-spelling decoding. Adaptive.
export default {
  id: "alike",
  name: "Sound-Alike",
  icon: "alike",
  blurb: "Tap the made-up word that sounds like a real word.",
  meta: ["1 min", "8 rounds"],
  initData: () => [],

  async run(ctx) {
    // pair[0] is the real-sounding one.
    const ask = (pair) => new Promise((resolve) => {
      const order = shuffle([0, 1]);
      const t0 = now();
      const tiles = order.map((k) => h("button", {
        class: "lx-word",
        onclick: (e) => { tiles.forEach((t) => (t.disabled = true)); resolve({ ok: k === 0, rt: now() - t0, el: e.currentTarget }); },
      }, pair[k]));
      ctx.body(h("p", { class: "lx-prompt" }, "Which one sounds like a real word?"), h("div", { class: "lx-pair" }, tiles));
    });

    ctx.head({ label: "Practice", practice: true });
    const p = await ask(ctx.content.practice);
    p.el.classList.add(p.ok ? "is-right" : "is-wrong");
    await ctx.practiceDone(p.ok, p.ok ? "Yes. “kar” sounds like “car”." : "Not quite. “kar” sounds like “car”.");

    await ctx.staircase(ctx.content.levels, async (pair) => {
      const r = await ask(pair);
      return { ok: r.ok, rt: r.rt, item: pair[0], foil: pair[1] };
    });
  },
};
