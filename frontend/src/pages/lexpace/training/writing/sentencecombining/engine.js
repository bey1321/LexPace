// Sentence Combining: pure logic (no DOM). Ported from the approved prototype.

export function norm(s) {
  return s.replace(/[‘’]/g, "'").replace(/["]/g, '"')
    .replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim().toLowerCase()
    .replace(/analyzed/g, "analysed");
}

// Validation per spec 3b: "rejects an empty answer or one without a full stop."
export function validateAnswer(v) {
  if (!v.trim()) return "Write your combined sentence first.";
  if (!/[.!?]$/.test(v.trim())) return "End your sentence with a full stop.";
  return null;
}

// Code-first matching against the accepted list (spec 3b: "Matches a known answer: marked by
// code, no AI. No match: AI checker" - the AI-checker fallback is deferred in this build, same
// as the other trainings' AI pieces; an unmatched answer is marked not-yet-correct rather than
// silently accepted, so nothing is invented to fill that gap).
export function markAnswer(item, value) {
  return item.acc.some((a) => norm(a) === norm(value));
}
