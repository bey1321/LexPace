// Number Sense Practice: pure logic (no DOM). Ported from the approved prototype
// (number-sense-practice.html) so the item factory, item rules and adaptation rule can be
// exercised and checked independently of the on-screen rendering (see validate.js).
//
// This file deliberately holds no state and touches no DOM: everything here is a pure
// function of its arguments, which is what lets validate.js call make() 100,000+ times and
// check the spec's "item rules" (section 1) without a browser.

// ---------------------------------------------------------------- small helpers

export function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
export function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
export function r6(x) { return Math.round(x * 1e6) / 1e6; }
export function minus(s) { return String(s).replace(/^-/, "−"); }
export function dec(v) { return minus(String(r6(v))); }
export function pct(v) { return minus(String(r6(v * 100))) + "%"; }
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = b; b = a % b; a = t; } return a; }
export function fracOf(v) {
  for (let d = 1; d <= 20; d++) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-9) { const g = gcd(n, d) || 1; return minus((n / g) + "/" + (d / g)); } }
  if (Math.abs(v * 100 - Math.round(v * 100)) < 1e-9) { const n2 = Math.round(v * 100), g2 = gcd(n2, 100); return minus((n2 / g2) + "/" + (100 / g2)); }
  return null;
}
export function comma(n) { return minus(Math.round(n).toLocaleString("en-US")); }
export function bigWords(v) { return v >= 1e9 ? r6(v / 1e9) + " billion" : r6(v / 1e6) + " million"; }
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export function words(n) { if (n < 20) return ONES[n]; if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : ""); return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + words(n % 100) : ""); }
export function sup(e) { const m = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" }; return String(e).split("").map((c) => m[c]).join(""); }

// ---------------------------------------------------------------- lines

function L(min, max, labels, fmt) { return { min, max, labels, fmt }; }
export const LINE = {
  whole: L(0, 1000, ["0", "500", "1000"], "whole"),
  unit: L(0, 1, ["0", "0.5", "1"], "unit"),
  pct: L(0, 1, ["0%", "50%", "100%"], "pct"),
  two: L(0, 2, ["0", "1", "2"], "unit"),
  neg: L(-1, 1, ["−1", "0", "1"], "unit"),
  big: L(0, 1e9, ["0", "500 million", "1 billion"], "big"),
  big10: L(0, 1e7, ["0", "5 million", "10 million"], "big"),
};
export function lineFor(min, max) { return L(min, max, [comma(min), comma((min + max) / 2), comma(max)], "whole"); }
export function frac(v, ln) { return Math.max(0, Math.min(1, (v - ln.min) / (ln.max - ln.min))); }
export function fmtFor(v, ln) { if (ln.fmt === "pct") return pct(v); if (ln.fmt === "big") return v >= 1e6 ? bigWords(v) : comma(v); if (ln.fmt === "whole") return comma(v); return dec(v); }

// ---------------------------------------------------------------- skill network (order = prerequisites)

export const SKILLS = [
  { id: "whole", name: "Whole numbers to 1,000" },
  { id: "dec", name: "Decimals 0–1" },
  { id: "pct", name: "Percentages" },
  { id: "frac1", name: "Fractions 0–1" },
  { id: "frac2", name: "Fractions 0–2" },
  { id: "neg", name: "Negative numbers" },
  { id: "big", name: "Large numbers" },
];

// Placeholder course profile/items (same shape flow 2a will produce) until the before-term
// preparation pipeline exists. Flagged here rather than hidden: see TRAINING_PLAN.md and the
// Number Sense Practice update prompt, section 0 ("replace with the output of flow 2a").
export const PLACEHOLDER_PROFILE = {
  pct: { n: 214, p: "High" }, dec: { n: 96, p: "High" }, frac1: { n: 31, p: "Medium" }, frac2: { n: 9, p: "Medium" },
  whole: { n: 58, p: "Low" }, big: { n: 12, p: "Low" }, neg: { n: 4, p: "Low" },
};
export const PLACEHOLDER_COURSE = {
  pct: { q: "Week 3 reading: “38% of the 1,250 survey respondents agreed.” Roughly how many people is that? Place it on the line.", target: 475, line: lineFor(0, 1250), show: "38% of 1,250" },
  dec: { q: "Week 5 reading: “The treatment group had a recovery proportion of 0.62.” Place 0.62 on the line.", target: 0.62, line: LINE.unit, show: "0.62" },
  whole: { q: "Week 2 reading: “640 of the 1,000 sampled students used the library weekly.” Place 640 on the line.", target: 640, line: LINE.whole, show: "640" },
};

// ---------------------------------------------------------------- item factory

function V(v, t) { return { v, t }; }
// Takes a correct answer's text and a list of candidate wrong-answer texts (in priority
// order), and returns up to 3 distinct from each other and from the correct text, tagged with
// the given error type. Several convert branches generate candidates that can coincidentally
// collide (see the comments where this is used); this is the generic guard against that.
function distinctWrongs(correctText, candidates, bug) {
  const seen = new Set([correctText]);
  const wrong = [];
  for (const c of candidates) { if (!seen.has(c) && wrong.length < 3) { seen.add(c); wrong.push(c); } }
  return wrong.map((t) => ({ t, bug }));
}
export const TASKS = ["line", "compare", "convert", "result"];
export const TASK_NAME = { line: "Number line", compare: "Comparison", convert: "Format conversion", result: "Size of a result" };

export function make(type, task) {
  const it = { type, task };
  if (type === "whole") {
    if (task === "line") { const w = rand(30, 970); return line(it, V(w, String(w)), LINE.whole); }
    if (task === "compare") {
      const h = rand(1, 9); let a = rand(0, 9), b = rand(1, 9); while (a === b) b = rand(1, 9);
      const x = h * 100 + a * 10 + b, y = h * 100 + b * 10 + a;
      return cmp(it, V(x, String(x)), V(y, String(y)), null, LINE.whole);
    }
    if (task === "convert") {
      const n = rand(1, 9) * 100 + rand(0, 9) * 1 + (Math.random() < 0.5 ? 0 : rand(1, 9) * 10), s = String(n);
      // Fixed from the prototype: a digit-reversal distractor collides with `s` itself for
      // palindromes (e.g. 929) and produces a leading zero for round numbers (e.g. 100), both
      // of which silently dropped the item below 4 options (validate.js caught this at scale).
      // ×10 / ÷10 / ×100 are always distinct from `s`, from each other, and never leading-zero
      // for any 3-digit n, so this always yields exactly 3 wrong options.
      const alts = [String(n * 10), String(Math.round(n / 10)), String(n * 100)];
      return conv(it, words(n), V(n, s), alts.map((z) => ({ t: z, bug: "place-value" })), LINE.whole);
    }
    const m = rand(2, 5), base = rand(2, 9) * 20; return place(it, m + " × " + base, m * base, LINE.whole, null);
  }
  if (type === "dec") {
    if (task === "line") { const v = pick([rand(1, 9) / 10, rand(5, 95) / 100, rand(50, 950) / 1000]); return line(it, V(v, dec(v)), LINE.unit); }
    if (task === "compare") { const k = rand(2, 9), A = k / 10, B = r6(((k - 1) * 100 + rand(5, 95)) / 1000); return cmp(it, V(A, dec(A)), V(B, dec(B)), { chose: B, bug: "longer-larger", pair: [V(A, dec(A)), V(B, dec(B))] }, LINE.unit); }
    if (task === "convert") { const c = pick([0.05, 0.5, 0.25, 0.4, 0.08, 0.125, 0.6, 0.02, 0.75]); return conv(it, dec(c), V(c, pct(c)), [{ t: pct(c * 10), bug: "decimal-shift" }, { t: pct(c / 10), bug: "decimal-shift" }, { t: pct(c * 100), bug: "decimal-shift" }], LINE.pct); }
    const a1 = rand(2, 9) * 50, p1 = rand(2, 8) / 10, op = pick(["×", "÷"]);
    return dir(it, "Is " + a1 + " " + op + " " + dec(p1) + " bigger or smaller than " + a1 + "?", op === "×" ? "Smaller" : "Bigger", { a: a1, p: p1, op });
  }
  if (type === "pct") {
    if (task === "line") { const pv = rand(3, 97) / 100; return line(it, V(pv, pct(pv)), LINE.pct); }
    if (task === "compare") { const d = rand(3, 8) / 10, e = r6(d - rand(2, 9) / 100); return cmp(it, V(d, dec(d)), V(e, pct(e)), { chose: e, bug: "format-mix", pair: [V(d, dec(d)), V(e, pct(e))] }, LINE.unit); }
    if (task === "convert") {
      const PV = [0.2, 0.25, 0.4, 0.75, 0.05, 0.6]; const q = pick(PV);
      // Fixed from the prototype: the classic "1/(percent number)" distractor (e.g. 1/5 for 5%)
      // can equal another PV value's *correct* fraction (1/5 is also fracOf(0.2)) - if that value
      // got sampled as a distractor source too, conv()'s dedup silently dropped the item to 3
      // options. Exclude any candidate that would collide before sampling, so it can't happen.
      const wrong1 = "1/" + r6(q * 100);
      const others = shuffle(PV.filter((z) => z !== q && fracOf(z) !== wrong1)).slice(0, 2);
      const opts = [{ t: wrong1, bug: "percent-fraction" }].concat(others.map((z) => ({ t: fracOf(z), bug: "percent-fraction" })));
      return conv(it, pct(q), V(q, fracOf(q)), opts, LINE.pct);
    }
    const whole = rand(2, 9) * 100, pp = rand(1, 19) * 5; return place(it, pp + "% of " + whole, (whole * pp) / 100, lineFor(0, whole), null);
  }
  if (type === "frac1") {
    if (task === "line") { const bb = rand(3, 12), aa = rand(1, bb - 1); return line(it, V(aa / bb, aa + "/" + bb), LINE.unit); }
    if (task === "compare") {
      if (Math.random() < 0.6) { const n1 = rand(1, 3), d1 = rand(n1 + 2, 8), d2 = d1 + rand(1, 4); return cmp(it, V(n1 / d1, n1 + "/" + d1), V(n1 / d2, n1 + "/" + d2), { chose: n1 / d2, bug: "bigger-denominator", pair: [V(n1 / d1, n1 + "/" + d1), V(n1 / d2, n1 + "/" + d2)] }, LINE.unit); }
      const f = pick([[3, 8, 0.4], [2, 3, 0.7], [5, 8, 0.6], [3, 4, 0.8], [2, 5, 0.35]]);
      return cmp(it, V(f[0] / f[1], f[0] + "/" + f[1]), V(f[2], dec(f[2])), { chose: null, bug: "format-mix", pair: [V(f[0] / f[1], f[0] + "/" + f[1]), V(f[2], dec(f[2]))] }, LINE.unit);
    }
    if (task === "convert") { const g = pick([[3, 8], [1, 4], [2, 5], [3, 4], [1, 8], [3, 5], [1, 20]]); const gv = g[0] / g[1]; return conv(it, g[0] + "/" + g[1], V(gv, dec(gv)), distinctWrongs(dec(gv), [g[0] + "." + g[1], "0." + g[0] + g[1], dec(r6(g[1] / g[0])), dec(r6(gv * 10)), dec(r6(gv / 10))], "fraction-as-decimal"), LINE.unit); }
    const den = pick([2, 3, 4, 5, 8]), num = rand(1, den - 1), tot = den * rand(3, 12) * 5;
    return place(it, num + "/" + den + " × " + tot, (tot * num) / den, lineFor(0, tot * 2), { a: tot, smaller: true });
  }
  if (type === "frac2") {
    if (task === "line") { const b2 = rand(3, 9), a2 = rand(b2 + 1, 2 * b2 - 1); return line(it, V(a2 / b2, a2 + "/" + b2), LINE.two); }
    if (task === "compare") { const fz = pick([[5, 4, 1.3], [7, 4, 1.7], [4, 3, 1.4], [9, 8, 1.1], [3, 2, 1.45]]); return cmp(it, V(fz[0] / fz[1], fz[0] + "/" + fz[1]), V(fz[2], dec(fz[2])), { chose: null, bug: "format-mix", pair: [V(fz[0] / fz[1], fz[0] + "/" + fz[1]), V(fz[2], dec(fz[2]))] }, LINE.two); }
    if (task === "convert") { const h2 = pick([[7, 4], [5, 4], [3, 2], [9, 8], [6, 5]]); const hv = h2[0] / h2[1]; return conv(it, h2[0] + "/" + h2[1], V(hv, dec(hv)), [{ t: h2[0] + "." + h2[1], bug: "fraction-as-decimal" }, { t: dec(r6(h2[1] / h2[0])), bug: "fraction-as-decimal" }, { t: dec(r6(hv / 10)), bug: "decimal-shift" }], LINE.two); }
    const a3 = rand(2, 9) * 30, fr = pick([[3, 4], [2, 3], [1, 2], [4, 5]]);
    return dir(it, "Is " + a3 + " ÷ " + fr[0] + "/" + fr[1] + " bigger or smaller than " + a3 + "?", "Bigger", { a: a3, p: fr[0] / fr[1], op: "÷", pt: fr[0] + "/" + fr[1] });
  }
  if (type === "neg") {
    if (task === "line") { const nv = (Math.random() < 0.5 ? -1 : 1) * rand(10, 95) / 100; return line(it, V(nv, dec(nv)), LINE.neg); }
    if (task === "compare") { const x = rand(2, 9) / 10, na = -x, nb = r6(-x / 10); return cmp(it, V(na, dec(na)), V(nb, dec(nb)), { chose: na, bug: "negative-size", pair: [V(na, dec(na)), V(nb, dec(nb))] }, LINE.neg); }
    if (task === "convert") { const ng = pick([[1, 4], [1, 2], [3, 4], [1, 5], [2, 5]]); const ngv = -ng[0] / ng[1]; return conv(it, dec(ngv), V(ngv, "−" + ng[0] + "/" + ng[1]), [{ t: ng[0] + "/" + ng[1], bug: "sign" }, { t: "−" + r6(ng[1] / ng[0]), bug: "fraction-as-decimal" }, { t: "−" + dec(r6(-ngv * 10)), bug: "decimal-shift" }], LINE.neg); }
    const b0 = rand(2, 8) * 10, s0 = rand(1, 9) * 5;
    return dir(it, "Is " + b0 + " − (−" + s0 + ") bigger or smaller than " + b0 + "?", "Bigger", { sign: true, a: b0, s: s0 });
  }
  // big
  if (task === "line") { const bv = rand(10, 95) * 1e7; return line(it, V(bv, Math.random() < 0.5 ? bigWords(bv) : r6(bv / 1e9) + " billion"), LINE.big); }
  if (task === "compare") { const xb = rand(5, 9) / 10, ym = xb * 1000 - rand(1, 9) * 10; return cmp(it, V(xb * 1e9, xb + " billion"), V(ym * 1e6, ym + " million"), { chose: ym * 1e6, bug: "million-billion", pair: [V(xb * 1e9, xb + " billion"), V(ym * 1e6, ym + " million")] }, LINE.big); }
  if (task === "convert") { const mm = rand(11, 99) / 10, ee = 6; const val = mm * Math.pow(10, ee); return conv(it, mm + " × 10" + sup(ee), V(val, comma(val)), [{ t: comma(val / 10), bug: "power-of-ten" }, { t: comma(val * 10), bug: "power-of-ten" }, { t: comma(mm * 1000), bug: "power-of-ten" }], LINE.big10); }
  const mult = pick([0.5, 1.5, 2]), basem = rand(2, 4) * 100;
  return place(it, mult + " × " + basem + " million", mult * basem * 1e6, LINE.big, mult < 1 ? { a: basem * 1e6, smaller: true } : { a: basem * 1e6, smaller: false });
}

function line(it, val, ln) { it.kind = "line"; it.prompt = "Place this number on the line"; it.show = val.t; it.target = val.v; it.line = ln; it.nums = [val]; return it; }
function place(it, expr, target, ln, rel) { it.kind = "line"; it.prompt = "Without calculating exactly, place the result on the line"; it.show = expr; it.target = target; it.line = ln; it.rel = rel; it.nums = [V(target, expr + " = " + fmtFor(target, ln))]; return it; }
function cmp(it, a, b, bug, ln) { it.kind = "compare"; it.prompt = "Which number is larger?"; const o = shuffle([a, b]); it.opts = o; it.correct = a.v > b.v ? a.v : b.v; it.bug = bug; it.line = ln; it.nums = [a, b]; return it; }
function conv(it, from, right, wrong, ln) {
  it.kind = "convert"; it.prompt = "Which one is equal to this?"; it.show = from; it.right = right;
  const seen = { [right.t]: 1 }; const ws = [];
  wrong.forEach((w) => { if (w.t && !seen[w.t] && ws.length < 3) { seen[w.t] = 1; ws.push({ t: w.t, ok: false, bug: w.bug }); } });
  it.opts = shuffle([{ t: right.t, ok: true }].concat(ws)); it.line = ln; it.nums = [V(right.v, from)]; return it;
}
function dir(it, q, ans, info) {
  it.kind = "dir"; it.prompt = q; it.ans = ans; it.info = info; it.opts = ["Bigger", "Smaller"];
  if (info.sign) { it.line = lineFor(0, 150); it.nums = [V(info.a, String(info.a)), V(info.a + info.s, info.a + " − (−" + info.s + ") = " + (info.a + info.s))]; }
  else {
    const res = info.op === "×" ? info.a * info.p : info.a / info.p;
    it.line = lineFor(0, info.a * 2.5 > res ? Math.ceil((info.a * 2.5) / 50) * 50 : Math.ceil((res * 1.2) / 50) * 50);
    it.nums = [V(info.a, String(info.a)), V(res, info.a + " " + info.op + " " + (info.pt || dec(info.p)) + " = " + r6(res))];
  }
  return it;
}

// ---------------------------------------------------------------- item rules (spec section 1)
// "These must hold for every item": exactly one correct option; no duplicate options;
// every value lies within its line; no NaN, undefined or empty text; comparison values differ.

function isFiniteNum(v) { return typeof v === "number" && Number.isFinite(v); }
function nonEmptyText(t) { return typeof t === "string" && t.trim().length > 0; }
function inLine(v, ln) { return isFiniteNum(v) && v >= ln.min - 1e-9 && v <= ln.max + 1e-9; }

export function validateItem(it) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };

  if (it.kind === "line") {
    req(isFiniteNum(it.target), "target is not a finite number");
    req(inLine(it.target, it.line), "target lies outside its line");
    req(nonEmptyText(it.show), "show text is empty");
  } else if (it.kind === "compare") {
    req(it.opts.length === 2, "compare must have exactly 2 options");
    req(it.opts.every((o) => isFiniteNum(o.v) && nonEmptyText(o.t)), "a compare option has a non-finite value or empty text");
    req(it.opts[0].v !== it.opts[1].v, "the two compared values are equal");
    const correctCount = it.opts.filter((o) => o.v === it.correct).length;
    req(correctCount === 1, "compare must have exactly one option matching the correct value");
  } else if (it.kind === "convert") {
    req(it.opts.length === 4, "convert must have exactly 4 options");
    req(it.opts.every((o) => nonEmptyText(o.t)), "a convert option has empty text");
    const texts = it.opts.map((o) => o.t);
    req(new Set(texts).size === texts.length, "convert has duplicate option text");
    req(it.opts.filter((o) => o.ok).length === 1, "convert must have exactly one correct option");
  } else if (it.kind === "dir") {
    req(it.opts.length === 2, "dir must have exactly 2 options (Bigger/Smaller)");
    req(it.ans === "Bigger" || it.ans === "Smaller", "dir answer must be Bigger or Smaller");
  }
  if (it.nums) it.nums.forEach((n) => { req(isFiniteNum(n.v), "a displayed number is not finite"); req(nonEmptyText(n.t), "a displayed number has empty text"); });
  return errors;
}

// ---------------------------------------------------------------- student model (replaceable)
// Pure state transition: given the current {status, streak, fails, current} and one answered
// trial from the *current Learning skill*, returns the next state plus what happened.
// Per spec: "only items from the current Learning skill change the counters" - callers must
// not call this for warm-up/review/course/repair trials.

export function initSkillState() {
  const status = {}, streak = {}, fails = {};
  SKILLS.forEach((s) => { status[s.id] = "Locked"; streak[s.id] = 0; fails[s.id] = 0; });
  status[SKILLS[0].id] = "Learning";
  return { status, streak, fails, current: 0 };
}

export function applyLearningAnswer(state, { correct, fast }, settings = {}) {
  const PASS = settings.PASS_STREAK ?? 10, BACK = settings.BACK_FAILS ?? 5;
  const status = { ...state.status }, streak = { ...state.streak }, fails = { ...state.fails };
  let current = state.current;
  const sk = SKILLS[current].id;
  let note = null;

  if (correct) { fails[sk] = 0; if (fast) streak[sk] += 1; else note = "correct but slow, streak unchanged"; }
  else { streak[sk] = 0; fails[sk] += 1; }

  let moved = null;
  if (streak[sk] >= PASS) {
    status[sk] = "Passed";
    if (current < SKILLS.length - 1) { current += 1; status[SKILLS[current].id] = "Learning"; streak[SKILLS[current].id] = 0; fails[SKILLS[current].id] = 0; }
    moved = { direction: "forward", skill: SKILLS[current].name };
  } else if (fails[sk] >= BACK && current > 0) {
    status[sk] = "Locked"; current -= 1; status[SKILLS[current].id] = "Learning"; streak[SKILLS[current].id] = 0; fails[SKILLS[current].id] = 0; fails[sk] = 0;
    moved = { direction: "back", skill: SKILLS[current].name };
  }
  return { state: { status, streak, fails, current }, note, moved };
}

export function passedTypes(state) { return SKILLS.filter((s) => /^Passed/.test(state.status[s.id])).map((s) => s.id); }

// ---------------------------------------------------------------- error library (preserve exactly)

export const BUG_TEXT = {
  "longer-larger": "A longer decimal is not always larger. Compare tenths first: 0.3 has 3 tenths, 0.125 has only 1 tenth.",
  "bigger-denominator": "With the same top number, a bigger bottom number means more, smaller pieces, so the fraction is smaller.",
  "format-mix": "Put both numbers in the same form before comparing, for example 34% = 0.34.",
  "negative-size": "On the number line, further left is smaller. A negative number with a bigger size is further left.",
  "million-billion": "1 billion = 1,000 million, so 0.9 billion = 900 million.",
  "decimal-shift": "Percent means hundredths: 0.05 = 5 hundredths = 5%.",
  "percent-fraction": "25% means 25 hundredths, which is 1/4, not 1/25.",
  "fraction-as-decimal": "3/8 means 3 divided by 8, which is 0.375, not 3.8.",
  "times-bigger": "Multiplying by a number less than 1 gives a smaller result. Dividing by it gives a bigger result.",
  sign: "Subtracting a negative number is the same as adding: 40 − (−15) = 40 + 15.",
  "power-of-ten": "10⁶ means 1,000,000 (six zeros), so 3.2 × 10⁶ = 3,200,000.",
  "place-value": "Each place is worth ten times the place to its right: 406 is 4 hundreds, 0 tens and 6 ones.",
};

// ---------------------------------------------------------------- feedback views (written out / as a part)

export function writtenForms(v, ln, label) {
  if (ln.fmt === "big") {
    const parts = [comma(v)];
    if (v >= 1e6) parts.push(bigWords(v));
    if (v >= 1e6) parts.push(r6(v / 1e9) + " billion");
    const e = Math.floor(Math.log10(v));
    parts.push(r6(v / Math.pow(10, e)) + " × 10" + sup(e));
    return label + ": " + parts.filter((x, i, a) => a.indexOf(x) === i).join(" = ");
  }
  if (ln.fmt === "whole" && Math.abs(v) >= 2) return label + (Number.isInteger(v) && v < 1000 && v >= 0 ? " (" + words(v) + ")" : "");
  const f = fracOf(v), parts2 = [dec(v), pct(v)];
  if (f) parts2.push(f);
  return label + ": " + parts2.filter((x, i, a) => a.indexOf(x) === i).join(" = ");
}

// Returns a 0-1 fill fraction and a short caption for the "as a part" proportion bar.
export function partOf(v, ln) {
  if (ln.min < 0) {
    const w = Math.abs(v) / Math.max(Math.abs(ln.min), ln.max);
    return { negative: true, fill: w, caption: dec(v) + (v < 0 ? " (left of 0)" : " (right of 0)") };
  }
  const whole = ln.max <= 1 ? 1 : ln.max === 2 ? 2 : ln.max;
  const p = Math.max(0, Math.min(1, v / whole));
  return { negative: false, fill: p, caption: Math.round(p * 1000) / 10 + "% of " + (whole === 1 ? "1 whole" : ln.labels[2]) };
}

export function repairFor(bug, it) {
  let nums = it.nums.slice(0, 2), ln = it.line;
  if (bug === "decimal-shift" || bug === "percent-fraction") { const rv = it.right ? it.right.v : it.target; ln = rv > 1 ? LINE.two : rv < 0 ? LINE.neg : LINE.pct; nums = [V(rv, it.show)]; }
  if (bug === "fraction-as-decimal") { nums = [V(it.right.v, it.show)]; ln = it.right.v < 0 ? LINE.neg : it.right.v > 1 ? LINE.two : LINE.unit; }
  if (bug === "power-of-ten") { nums = [V(it.right.v, it.show)]; ln = LINE.big10; }
  if (bug === "place-value") { nums = [V(it.right.v, it.right.t)]; ln = LINE.whole; }
  return { bug, nums, line: ln };
}
