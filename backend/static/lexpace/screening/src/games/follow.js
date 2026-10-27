import { h, shuffle, now } from "../core/dom.js";

// Follow Me: hear a multi-step instruction, tap the shapes in order.
// Two tries per length; stops when both tries at a length fail. Covers ARHQ question 8.
const SHAPES = {
  circle: '<circle cx="20" cy="20" r="16"/>',
  square: '<rect x="5" y="5" width="30" height="30" rx="4"/>',
  triangle: '<path d="M20 4 L37 35 L3 35 Z"/>',
  star: '<path d="M20 3 L25 15 L38 15 L27.5 23 L31.5 36 L20 28 L8.5 36 L12.5 23 L2 15 L15 15 Z"/>',
};

export default {
  id: "follow",
  name: "Follow Me",
  icon: "follow",
  blurb: "Hear an instruction. Tap the shapes in order.",
  meta: ["1 min", "audio"],
  initData: () => [],

  async run(ctx) {
    const tokens = ctx.content.tokens;
    const ask = (steps) => new Promise((resolve) => {
      const target = shuffle(tokens.map((_, k) => k)).slice(0, steps);
      const sentence = "Tap the " + target.map((k) => `${tokens[k].c} ${tokens[k].s}`).join(", then the ") + ".";
      let taps = [], t0 = 0, ready = false;
      const status = h("p", { class: "lx-muted" }, "Listen to the instruction…");
      const dots = h("div", { class: "lx-dots", "aria-hidden": "true" }, Array.from({ length: steps }, () => h("i")));
      const paint = () => {
        [...dots.children].forEach((d, k) => d.classList.toggle("is-on", k < taps.length));
        btns.forEach((b) => b.classList.toggle("is-tapped", taps.includes(+b.dataset.k)));
      };
      const btns = shuffle(tokens.map((_, k) => k)).map((k) => h("button", {
        class: "lx-token", "data-k": k, "aria-label": `${tokens[k].c} ${tokens[k].s}`,
        onclick: () => {
          if (!ready || taps.length >= steps) return;
          taps.push(k); paint();
          if (taps.length === steps) setTimeout(() => resolve({ ok: taps.join() === target.join(), rt: now() - t0 }), 250);
        },
      }, h("span", { html: `<svg viewBox="0 0 40 40" style="fill:var(--lx-${tokens[k].c})">${SHAPES[tokens[k].s]}</svg>` })));
      ctx.body(status, h("div", { class: "lx-tokens" }, btns),
        h("div", { class: "lx-row lx-between" }, dots, h("button", { class: "lx-btn lx-btn-quiet lx-btn-sm", onclick: () => { taps.pop(); paint(); } }, "Undo")));
      ctx.audio.play(null, sentence, 0.85).then(() => { ready = true; t0 = now(); status.textContent = "Now tap the shapes in order."; });
    });

    ctx.head({ label: "Practice", practice: true });
    const p = await ask(1);
    await ctx.practiceDone(p.ok, p.ok ? "That’s it." : "Not quite, but that’s fine for practice.");

    const rounds = ctx.cfg.rounds;
    let failsAtLength = 0;
    for (let i = 0; i < rounds.length; i++) {
      if (!ctx.alive()) return;
      const steps = rounds[i];
      if (i > 0 && rounds[i - 1] !== steps) failsAtLength = 0;
      ctx.head({ label: `Round ${i + 1} of ${rounds.length} · ${steps} steps`, i, n: rounds.length });
      const r = await ask(steps);
      const entry = { steps, ok: r.ok, rt: Math.round(r.rt) };
      ctx.data.push(entry); ctx.log(entry); ctx.save();
      if (!r.ok && ++failsAtLength >= 2) return;
    }
  },
};
