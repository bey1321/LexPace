// SRSD: pure logic (no DOM). Ported from the approved prototype.
//
// `findParts` is the prototype's own stand-in for the real "part checker" AI (spec 4b: "AI
// part checker... quotes each part found"). The spec says the real checker must pass a
// validation gate against trained human markers before release (section 4c) - that gate, and
// a real AI call, are both deferred in this build, same as the AI pieces in the other two
// trainings. This keyword-based checker is what the prototype itself uses as its demo
// stand-in, so porting it as-is is "preserve the prototype's design," not a new shortcut.
import { PARTS } from "./bank.js";

export function findParts(text) {
  const r = {};
  PARTS.forEach((p) => { if (p.re) r[p.id] = p.re.test(text); });
  const otherPart = PARTS[3];
  const m = text.match(otherPart.re);
  r.answer = false;
  if (m) {
    const after = text.slice(text.search(otherPart.re) + m[0].length);
    r.answer = /\b(however|but|although|yet|nevertheless|this is not|this ignores)\b/i.test(after);
  }
  return r;
}

export function countParts(r) { return PARTS.filter((p) => r[p.id]).length; }

// ---------------------------------------------------------------- strategy coach
// Spec 4b: "answers only from the approved strategy explanations... refuses any request to
// write, rewrite or fix essay text." Ported from the prototype's scripted answers - this is
// the "restricted coach" by construction (a fixed lookup table, not a free-form model), so the
// refusal/output-check requirements in the spec are satisfied by the script itself having no
// way to produce essay text at all.

export const STEP_TEXT = {
  s: "S means Suspend judgment: before deciding, list ideas for both sides.",
  t: "T means Take a side: decide which position your ideas support best.",
  o: "O means Organize ideas: choose your strongest reasons and one argument from the other side you can answer.",
  p: "P means Plan more as you write: keep adding to your plan while you write.",
  d: "D means Develop a topic sentence: one sentence that states your position clearly.",
  a: "A means Add supporting ideas: your reasons, each with evidence or an example.",
  r: "R means Reject an argument for the other side: state one reason someone might disagree, then explain why your position still holds.",
  e: "E means End with a conclusion: restate your position and why it matters, without adding new arguments.",
};
const REFUSAL = "I can't write any part of your essay for you, because the practice only works if the words are yours. I can help with the step you are on: tell me which letter of STOP or DARE you are working on.";

export function coachAnswer(question) {
  const t = question.toLowerCase();
  if (!t.trim()) return null;
  if (/\b(write|rewrite|fix|give me|make|do)\b.*\b(essay|conclusion|paragraph|sentence|introduction|it|my)\b/.test(t)) return REFUSAL;
  const lm = t.match(/\b([stopdare])\b\s+(in|stand|stands|mean|means|of)\b/) || t.match(/\b(?:letter|the)\s+([stopdare])\b/);
  if (lm) return STEP_TEXT[lm[1]];
  if (/reject|other side|counter|disagree/.test(t)) return STEP_TEXT.r;
  if (/topic sentence|develop/.test(t)) return STEP_TEXT.d;
  if (/support|evidence|example/.test(t)) return STEP_TEXT.a;
  if (/conclu|ending|end my/.test(t)) return STEP_TEXT.e;
  if (/suspend|both sides/.test(t)) return STEP_TEXT.s;
  if (/organi[sz]e/.test(t)) return STEP_TEXT.o;
  if (/\bstop\b/.test(t)) return "STOP is for planning. Suspend judgment: list ideas for both sides. Take a side. Organize your ideas. Plan more as you write.";
  if (/\bdare\b/.test(t)) return "DARE is what the essay must contain. Develop a topic sentence. Add supporting ideas. Reject an argument for the other side. End with a conclusion.";
  if (/goal/.test(t)) return "Pick one goal you can check after writing, for example: include the other side and answer it.";
  return "That question is outside the strategy. I can explain any step of STOP or DARE, or help you set a goal.";
}
