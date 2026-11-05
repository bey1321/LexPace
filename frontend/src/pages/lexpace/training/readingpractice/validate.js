// Acceptance test 5 (Reading Fluency Practice spec, section 8): scripted sequences give
// exactly the expected rate changes, including clamping. Run with:
//   node frontend/src/pages/lexpace/training/readingfluency/validate.js
import * as CFG from "./config.js";
import { applyStaircase, computeStartingPace } from "./engine.js";

let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed++; console.error(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
  else console.log(`ok   ${name}`);
}

// 3 correct in a row -> faster by STAIRCASE_STEP_MS, streak resets
let r = applyStaircase(100, 0, true, CFG); check("1st correct: streak=1, rate unchanged", [r.rate, r.streak], [100, 1]);
r = applyStaircase(r.rate, r.streak, true, CFG); check("2nd correct: streak=2, rate unchanged", [r.rate, r.streak], [100, 2]);
r = applyStaircase(r.rate, r.streak, true, CFG); check("3rd correct: faster, streak resets", [r.rate, r.streak], [98, 0]);

// any wrong -> slower by STAIRCASE_STEP_MS, streak resets
r = applyStaircase(98, 2, false, CFG); check("wrong after streak=2: slower, streak resets", [r.rate, r.streak], [100, 0]);

// clamping at MIN_RATE
r = applyStaircase(21, 2, true, CFG); check("speeding up clamps at MIN_RATE", [r.rate, r.streak], [20, 0]);
r = applyStaircase(20, 2, true, CFG); check("already at MIN_RATE stays at MIN_RATE", [r.rate, r.streak], [20, 0]);

// no MAX_RATE clamp while it is unset (open setting)
r = applyStaircase(500, 0, false, CFG); check("no upper clamp while MAX_RATE is unset", r.rate, 502);

// starting pace: average of valid+correct trials only
const trials = [
  { valid: true, ok: true, perChar: 60 },
  { valid: true, ok: true, perChar: 80 },
  { valid: true, ok: false, perChar: 10 },   // wrong -> excluded
  { valid: false, ok: true, perChar: 10 },   // cancelled -> excluded
];
const pace = computeStartingPace(trials, CFG);
check("starting pace averages only valid+correct trials", pace, { rate: 70, validCount: 2 });

console.log(failed === 0 ? "\nAll staircase checks passed." : `\n${failed} check(s) failed.`);
if (failed > 0) process.exit(1);
