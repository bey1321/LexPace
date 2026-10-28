import { h, icon } from "../core/dom.js";
import { FEATURES, toCSV } from "../scoring/features.js";
import { SKILL_LABELS, VERSION_LABELS } from "../scoring/rules.js";

const MESSAGES = {
  suggest: ["A reading-support check with SAS could help you",
    "Your answers and games suggest reading may take you more effort than it does for many students. That’s common, and it has nothing to do with how smart you are. Student Accessibility Services can do a proper check and talk about support, like extra time or audio materials."],
  cope: ["You’ve built strong ways to manage reading",
    "Reading seems to have been harder for you growing up, and today’s games went well. If reading still takes you extra time or energy, SAS can talk to you about support like extra exam time."],
  none: ["No follow-up suggested",
    "Your results look like most students’. If reading ever feels hard, LexPace’s study tools are open to you anytime."],
};

// Which direction is "weak" for each feature, and the threshold that flags it.
const FLAG = {
  history: (v, T) => v >= T.history,
  alike_level: (v, T) => v < T.alikeLevel,
  lab_level: (v, T) => v < T.labLevel,
  echo_level: (v, T) => v < T.echoLevel,
  alike_rt: (v, T) => v > T.soundRT,
  lab_rt: (v, T) => v > T.soundRT,
  span_fwd: (v, T) => v < T.spanFwd,
  span_bwd: (v, T) => v < T.spanBwd,
  follow_steps: (v, T) => v < T.follow,
  read_wpm: (v, T) => v > 0 && v < T.wpm,
  read_comp: (v, T) => v < T.readComp,
};

const fmt = (f, v) => {
  if (v == null) return "–";
  if (f.unit === "0–1") return f.key === "history" ? v.toFixed(2) : Math.round(v * 100) + "%";
  if (f.unit === "s") return v.toFixed(1) + " s";
  if (f.unit.includes("–")) return v.toFixed(1);
  return String(v);
};

export function renderResults({ payload, thresholds: T, teamView = true, onShare }) {
  const { decision, skills, scores, version, rules, model } = payload.result;
  const [title, text] = MESSAGES[decision];

  const share = decision !== "none" && h("div", { class: "lx-row" },
    h("button", { class: "lx-btn", onclick: (e) => { e.currentTarget.disabled = true; e.currentTarget.textContent = "Request sent to SAS"; onShare?.(payload); } }, "Share with SAS and book a check"),
    h("button", { class: "lx-btn lx-btn-quiet" }, "Not now"));

  const student = h("section", { class: `lx-verdict lx-verdict-${decision}` },
    h("span", { class: "lx-eyebrow" }, "Your result"),
    h("h2", {}, title), h("p", {}, text), share,
    h("p", { class: "lx-fine" }, "This is a screening, not a diagnosis. Only you see this unless you choose to share it."));

  if (!teamView) return h("div", { class: "lx-results" }, student);

  const bars = h("div", { class: "lx-probs" }, Object.keys(SKILL_LABELS).map((k) =>
    h("div", { class: "lx-prob" + (skills[k] ? " is-top" : "") },
      h("span", {}, SKILL_LABELS[k]),
      h("span", { class: "lx-prob-track" }, h("i", { style: { width: (scores[k] * 100).toFixed(1) + "%" } })),
      h("b", {}, skills[k] ? "Flag" : "–"))));
  const skillList = (s) => Object.keys(SKILL_LABELS).filter((k) => s[k]).map((k) => SKILL_LABELS[k]).join(", ") || "none";

  const rows = FEATURES.map((f) => {
    const v = payload.features[f.key], test = FLAG[f.key];
    const flagged = test ? test(v, T) : null;
    return h("tr", {},
      h("td", {}, f.label, h("small", {}, f.source)),
      h("td", { class: "lx-num" }, fmt(f, v)),
      h("td", {}, flagged == null ? "" : h("span", { class: flagged ? "lx-chip lx-chip-warn" : "lx-chip lx-chip-good" }, flagged ? "Flag" : "OK")));
  });

  const copyBtn = (label, getText) => {
    const note = h("span", { class: "lx-muted lx-small" });
    const pre = h("pre", { class: "lx-pre", hidden: true });
    const btn = h("button", { class: "lx-btn lx-btn-soft lx-btn-sm", onclick: () => {
      const t = getText();
      const fallback = () => { pre.textContent = t; pre.hidden = false; const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); note.textContent = "Selected below. Press Ctrl/Cmd + C."; };
      try { navigator.clipboard.writeText(t).then(() => (note.textContent = "Copied."), fallback); } catch { fallback(); }
    } }, icon("copy"), label);
    return [btn, note, pre];
  };
  const [jsonBtn, jsonNote, jsonPre] = copyBtn("Copy full results (JSON)", () => JSON.stringify(payload, null, 2));
  const [csvBtn, csvNote, csvPre] = copyBtn("Copy features (CSV row)", () => toCSV(payload.features, { session_id: payload.sessionId }));

  const team = h("details", { class: "lx-team", open: true },
    h("summary", {}, h("span", { class: "lx-eyebrow" }, "Team view"), h("span", { class: "lx-muted lx-small" }, "Demo thresholds, not validated")),
    h("div", { class: "lx-team-grid" },
      h("div", { class: "lx-team-card" },
        h("span", { class: "lx-eyebrow" }, "Lesson version"),
        h("p", { class: "lx-profile" }, VERSION_LABELS[version]),
        h("p", { class: "lx-muted lx-small" }, "Skills flagged: ", skillList(skills), ". Writing and calculation have no screening task yet."),
        h("p", { class: "lx-small" }, h("b", {}, "Rules say: "), skillList(rules.skills), " · ", rules.decision)),
      h("div", { class: "lx-team-card" },
        h("span", { class: "lx-eyebrow" }, "Skill signals"),
        bars,
        h("p", { class: "lx-muted lx-small" }, model
          ? `Model reading signal ${Math.round(model.risk * 100)}%. Trained on ${model.trainedOn} data, so these numbers are not real accuracy.`
          : "No model loaded. Rules only."))),
    h("div", { class: "lx-table-wrap" }, h("table", { class: "lx-table" },
      h("thead", {}, h("tr", {}, h("th", {}, "Feature (ML input)"), h("th", {}, "Value"), h("th", {}, "Rule"))),
      h("tbody", {}, rows))),
    h("div", { class: "lx-row" }, jsonBtn, csvBtn, jsonNote, csvNote), jsonPre, csvPre);

  return h("div", { class: "lx-results" }, student, team);
}
