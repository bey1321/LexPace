import { h } from "../core/dom.js";

// Reading Story: the 5 short-ARHQ questions, answered on a 0–4 scale.
export default {
  id: "story",
  name: "Reading Story",
  icon: "story",
  blurb: "5 quick questions about reading as a child. No right or wrong answers.",
  meta: ["1 min", "5 questions"],
  practice: false,
  initData: () => [],

  async run(ctx) {
    const items = ctx.content.items;
    let i = 0;
    while (i < items.length) {
      const it = items[i];
      ctx.head({ label: `Question ${i + 1} of ${items.length}`, i, n: items.length });
      const v = await new Promise((resolve) => {
        const labelFor = (v) => (v === 0 ? it.left : v === 2 ? it.mid : v === 4 ? it.right : "");
        const buttons = [0, 1, 2, 3, 4].map((v) =>
          h("button", {
            class: "lx-scale-btn", "aria-pressed": String(ctx.data[i]?.v === v),
            "aria-label": labelFor(v) || `${v} of 4`,
            onclick: () => { buttons.forEach((b, k) => b.setAttribute("aria-pressed", String(k === v))); setTimeout(() => resolve(v), 220); },
          }, h("span", { class: "lx-scale-dot" }), h("small", {}, labelFor(v)))
        );
        ctx.body(
          h("p", { class: "lx-question" }, it.q),
          ctx.listen("Hear the question", () => ctx.audio.play(`story-${it.id}`, it.q, 0.95)),
          h("div", { class: "lx-scale", role: "group", "aria-label": "Your answer" }, buttons),
          h("div", { class: "lx-row" }, h("button", { class: "lx-btn lx-btn-quiet lx-btn-sm", disabled: i === 0, onclick: () => resolve("back") }, "Back"))
        );
      });
      if (!ctx.alive()) return;
      if (v === "back") { i--; continue; }
      ctx.data[i] = { id: it.id, v };
      ctx.log(ctx.data[i]); ctx.save();
      i++;
    }
  },
};
