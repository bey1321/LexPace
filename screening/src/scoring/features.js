import { median } from "../core/dom.js";
import { levelScore } from "../core/staircase.js";

// THE ML PARAMETERS.
// Every finished journey becomes this one flat row of numbers. The same names, in the same
// order, are used by ml/generate_synthetic.py and ml/train.py. Change them in all three places.
export const FEATURES = [
  { key: "history", label: "Reading history (5 questions)", unit: "0–1", source: "Reading Story" },
  { key: "alike_level", label: "Sound-Alike level", unit: "1–4", source: "Sound-Alike" },
  { key: "alike_acc", label: "Sound-Alike accuracy", unit: "0–1", source: "Sound-Alike" },
  { key: "alike_rt", label: "Sound-Alike median time", unit: "s", source: "Sound-Alike" },
  { key: "lab_level", label: "Sound Lab level", unit: "1–3", source: "Sound Lab" },
  { key: "lab_acc", label: "Sound Lab accuracy", unit: "0–1", source: "Sound Lab" },
  { key: "lab_rt", label: "Sound Lab median time", unit: "s", source: "Sound Lab" },
  { key: "echo_level", label: "Echo level", unit: "1–4", source: "Echo" },
  { key: "echo_regular_acc", label: "Echo regular words", unit: "0–1", source: "Echo" },
  { key: "echo_irregular_acc", label: "Echo irregular words", unit: "0–1", source: "Echo" },
  { key: "echo_sound_right", label: "Spelling errors that sound right", unit: "0–1", source: "Echo" },
  { key: "swaps", label: "Letter or digit swaps", unit: "count", source: "Echo + Number Recall" },
  { key: "span_fwd", label: "Number Recall forward", unit: "digits", source: "Number Recall" },
  { key: "span_bwd", label: "Number Recall reverse", unit: "digits", source: "Number Recall" },
  { key: "follow_steps", label: "Follow Me longest correct", unit: "steps", source: "Follow Me" },
  { key: "read_wpm", label: "Reading speed", unit: "wpm", source: "Short Read" },
  { key: "read_comp", label: "Reading questions right", unit: "of 3", source: "Short Read" },
];
export const FEATURE_KEYS = FEATURES.map((f) => f.key);

const acc = (a) => (a.length ? a.filter((x) => x.ok).length / a.length : null);
const round = (x, d = 3) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

export function extractFeatures(data, content) {
  const story = data.story || [], alike = data.alike || [], lab = data.lab || [], echo = data.echo || [];
  const nums = data.numbers || { fwd: [], bwd: [] }, follow = data.follow || [], read = data.read || {};
  const nStory = content?.story?.items?.length || 5;

  const regular = echo.filter((e) => !e.irregular), irregular = echo.filter((e) => e.irregular);
  const errors = echo.filter((e) => !e.ok);
  const echoAcc = acc(echo) ?? 0;
  const span = (arr) => arr.filter((x) => x.ok).reduce((m, x) => Math.max(m, x.len), 0);

  const f = {
    history: story.length ? story.reduce((s, x) => s + (x?.v ?? 0), 0) / (nStory * 4) : 0,
    alike_level: levelScore(alike),
    alike_acc: acc(alike) ?? 0,
    alike_rt: median(alike.map((x) => x.rt)) / 1000,
    lab_level: levelScore(lab),
    lab_acc: acc(lab) ?? 0,
    lab_rt: median(lab.map((x) => x.rt)) / 1000,
    echo_level: levelScore(echo),
    // Missing values are filled with the overall Echo accuracy so the model always gets a number.
    echo_regular_acc: acc(regular) ?? echoAcc,
    echo_irregular_acc: acc(irregular) ?? echoAcc,
    // No errors → 0.5 (no information either way).
    echo_sound_right: errors.length ? errors.filter((e) => e.type === "sounds_right").length / errors.length : 0.5,
    swaps: echo.filter((e) => e.type === "swap").length + [...nums.fwd, ...nums.bwd].filter((x) => x.swap).length,
    span_fwd: span(nums.fwd),
    span_bwd: span(nums.bwd),
    follow_steps: follow.filter((x) => x.ok).reduce((m, x) => Math.max(m, x.steps), 0),
    read_wpm: read.wpm || 0,
    read_comp: (read.answers || []).filter((x) => x.ok).length,
  };
  for (const k of Object.keys(f)) f[k] = round(f[k]);
  return f;
}

// One CSV row (with header) for pilot data collection.
export function toCSV(features, extra = {}) {
  const keys = [...Object.keys(extra), ...FEATURE_KEYS];
  const row = keys.map((k) => (k in extra ? extra[k] : features[k]));
  return keys.join(",") + "\n" + row.join(",");
}
