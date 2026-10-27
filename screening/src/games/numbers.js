import { h, now } from "../core/dom.js";

// Number Recall: digit span forward, then backward. Lists grow by one after each correct answer
// and stop after cfg.maxFails misses in a row. Covers ARHQ question 7 (remembering numbers).
export default {
  id: "numbers",
  name: "Number Recall",
  icon: "numbers",
  blurb: "Hear numbers. Type them back.",
  meta: ["2 min", "audio"],
  initData: () => ({ fwd: [], bwd: [] }),

  async run(ctx) {
    const digits = (n) => { const a = []; while (a.length < n) { const d = 1 + Math.floor(Math.random() * 9); if (a[a.length - 1] !== d) a.push(d); } return a; };

    const ask = (seq, backward) => new Promise((resolve) => {
      let t0 = 0;
      const status = h("p", { class: "lx-muted" }, "Listen…");
      const field = h("input", { class: "lx-field lx-field-num", id: "lx-num-field", inputmode: "numeric", autocomplete: "off", disabled: true, "aria-label": "Numbers" });
      const submit = () => { const v = field.value.replace(/\D/g, ""); if (!v) return field.focus(); go.disabled = true; resolve({ typed: v, rt: now() - t0 }); };
      const go = h("button", { class: "lx-btn", disabled: true, onclick: submit }, "Next");
      field.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
      ctx.body(
        h("p", { class: "lx-prompt" }, backward ? h("span", {}, "Type them in ", h("b", {}, "reverse"), " order.") : "Type them in the same order."),
        status, field, h("div", { class: "lx-row" }, go)
      );
      ctx.audio.play(null, seq.join(". ") + ".", 0.75).then(() => {
        t0 = now(); status.textContent = "Now type them."; field.disabled = false; go.disabled = false; field.focus();
      });
    });

    const check = (seq, typed, backward) => {
      const target = (backward ? seq.slice().reverse() : seq).join("");
      let swap = false;
      for (let k = 0; k < target.length - 1; k++) if (target.slice(0, k) + target[k + 1] + target[k] + target.slice(k + 2) === typed) swap = true;
      return { ok: typed === target, swap };
    };

    ctx.head({ label: "Practice", practice: true });
    const p = await ask([4, 7], false);
    await ctx.practiceDone(p.typed === "47", p.typed === "47" ? "That’s right." : "The numbers were 4, 7.");

    const phase = async (backward) => {
      let len = backward ? ctx.cfg.bwdStart : ctx.cfg.fwdStart, fails = 0;
      while (fails < ctx.cfg.maxFails && len <= ctx.cfg.maxLen) {
        if (!ctx.alive()) return;
        ctx.head({ label: `${backward ? "Reverse" : "Same"} order · ${len} numbers` });
        const seq = digits(len);
        const r = await ask(seq, backward);
        const c = check(seq, r.typed, backward);
        const entry = { len, seq: seq.join(""), typed: r.typed, ok: c.ok, swap: c.swap, rt: Math.round(r.rt) };
        ctx.data[backward ? "bwd" : "fwd"].push(entry); ctx.log({ backward, ...entry }); ctx.save();
        if (c.ok) { len++; fails = 0; } else fails++;
      }
    };

    await phase(false);
    if (!ctx.alive()) return;
    await ctx.interlude("Part 1 done", h("p", {}, "Now type the numbers in ", h("b", {}, "reverse"), " order. If you hear 3, 8, type 83."), "Start reverse order");
    await phase(true);
  },
};
