// Acceptance test 6 (Writing Practice spec, section 10): "the coach refuses planted requests
// to write essay text." Run with:
//   node frontend/src/pages/lexpace/training/writing/srsd/validate.js
import { coachAnswer, countParts, findParts } from "./engine.js";

let failed = 0;
function check(name, cond) { if (!cond) { failed++; console.error(`FAIL ${name}`); } else console.log(`ok   ${name}`); }

const REFUSAL_TRIGGERS = [
  "write my conclusion for me", "can you write my essay", "rewrite this paragraph",
  "fix my introduction", "give me a sentence for my essay", "make my conclusion better",
  "do my essay for me", "write the essay", "can you fix my paragraph please",
  "please write my introduction now",
];
REFUSAL_TRIGGERS.forEach((q) => check(`refuses: "${q}"`, coachAnswer(q).startsWith("I can't write")));

const LEGITIMATE = ["what does the R in DARE mean?", "what is stop for?", "how do I set a goal?"];
LEGITIMATE.forEach((q) => check(`answers (no refusal): "${q}"`, !coachAnswer(q).startsWith("I can't write")));

const r = findParts("Universities should record all lectures. This is because recordings help. For example, 70% of students agreed. Some people argue attendance drops. However, most still attend. In conclusion, recording helps.");
check("findParts detects claim", r.claim === true);
check("findParts detects reason", r.reason === true);
check("findParts detects evidence", r.evidence === true);
check("findParts detects other side", r.other === true);
check("findParts detects answer to other side", r.answer === true);
check("findParts detects conclusion", r.concl === true);
check("countParts counts all 6", countParts(r) === 6);

console.log(failed === 0 ? "\nAll SRSD checks passed." : `\n${failed} check(s) failed.`);
if (failed > 0) process.exit(1);
