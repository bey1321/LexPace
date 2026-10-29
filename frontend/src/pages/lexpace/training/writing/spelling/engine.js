// Spelling: pure logic (no DOM). Ported from the approved prototype so the edit-distance
// alignment, error classification and flash-time staircase can be checked independently
// (see validate.js).
import { BANK } from "./bank.js";

export function norm(s) { return (s || "").trim().toLowerCase(); }

// Edit-distance alignment: returns the sorted list of target-letter positions that differ
// from what was typed (same algorithm as the prototype).
export function align(target, typed) {
  const n = target.length, m = typed.length;
  const d = [];
  for (let i = 0; i <= n; i++) d[i] = [i];
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (target[i - 1] === typed[j - 1] ? 0 : 1));
  const bad = {};
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (target[i - 1] === typed[j - 1] ? 0 : 1)) { if (target[i - 1] !== typed[j - 1]) bad[i - 1] = 1; i--; j--; }
    else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { bad[i - 1] = 1; i--; }
    else { bad[Math.max(0, Math.min(n - 1, i))] = 1; if (i > 0) bad[i - 1] = 1; j--; }
  }
  return Object.keys(bad).map(Number).sort((a, b) => a - b);
}

// Tags an error by the word's trap annotations, falling back to "other".
export function classify(word, typed) {
  const bad = align(word, typed);
  const traps = (BANK[word] && BANK[word].traps) || [];
  for (let pass = 0; pass < 2; pass++) {
    for (const trap of traps) {
      const s = trap[0] - pass, e = trap[0] + trap[1] - 1 + pass;
      if (bad.some((b) => b >= s && b <= e)) return trap[2];
    }
  }
  return "other";
}

// Positions to underline when showing the correct spelling after a wrong answer.
export function diffPositions(word, typed) {
  return new Set(align(word, typed));
}

export const TYPE_NAME = { sound: "Sound (letter not heard)", pattern: "Spelling pattern", part: "Word part (suffix or root)", other: "Other" };

// ---------------------------------------------------------------- Rapid Reading flash staircase
// "Above 80% correct -> flash time decreases by FLASH_STEP (next level); otherwise increases
// (same level)." "The flash time stays between FLASH_MIN and FLASH_MAX."

export function nextFlash(flashMs, accuracy, settings) {
  const { FLASH_STEP_MS: step, FLASH_MIN_MS: min, FLASH_MAX_MS: max } = settings;
  if (accuracy > 0.8) return { flash: Math.max(min, flashMs - step), leveledUp: true };
  return { flash: Math.min(max, flashMs + step), leveledUp: false };
}
