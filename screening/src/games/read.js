import { h, shuffle, now } from "../core/dom.js";

// Short Read: silent reading speed (words per minute) + 3 comprehension questions. Not adaptive.
export default {
  id: "read",
  name: "Short Read",
  icon: "read",
  blurb: "Read a short story, then answer 3 questions.",
  meta: ["2 min", "3 questions"],
  practice: false,
  initData: () => ({}),

  async run(ctx) {
    const { passage, questions } = ctx.content;
    const words = passage.join(" ").split(/\s+/).length;

    ctx.head({ label: "Reading" });
    await new Promise((resolve) => ctx.body(
      h("p", {}, "Press ", h("b", {}, "Start reading"), " to show the story. Read it once at your normal pace, then press ", h("b", {}, "I’m done"), "."),
      h("div", { class: "lx-row" }, h("button", { class: "lx-btn", onclick: resolve }, "Start reading"))
    ));
    if (!ctx.alive()) return;

    const t0 = now();
    await new Promise((resolve) => ctx.body(
      h("div", { class: "lx-passage" }, passage.map((p) => h("p", {}, p))),
      h("div", { class: "lx-row" }, h("button", { class: "lx-btn", onclick: resolve }, "I’m done"))
    ));
    const ms = now() - t0;
    Object.assign(ctx.data, { words, ms: Math.round(ms), wpm: Math.round(words / (ms / 60000)), answers: [] });
    ctx.save();

    for (let i = 0; i < questions.length; i++) {
      if (!ctx.alive()) return;
      const q = questions[i];
      ctx.head({ label: `Question ${i + 1} of ${questions.length}`, i, n: questions.length });
      const opts = shuffle(q.o.map((o, k) => ({ o, ok: k === q.a })));
      const t1 = now();
      const pick = await new Promise((resolve) => ctx.body(
        h("p", { class: "lx-question" }, q.q),
        h("div", { class: "lx-choices" }, opts.map((o) => h("button", { class: "lx-choice", onclick: () => resolve(o) }, o.o)))
      ));
      const entry = { ok: pick.ok, rt: Math.round(now() - t1) };
      ctx.data.answers.push(entry); ctx.log(entry); ctx.save();
    }
  },
};
