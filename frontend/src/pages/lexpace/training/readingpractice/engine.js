// Reading Fluency Practice: pure logic (no DOM, no timers). Ported from the approved
// prototype so the staircase rule and starting-pace calculation can be checked independently
// of the on-screen rAF loop (see validate.js).

export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// Builds the shuffled 4-option set for one sentence, tracking which index is correct.
export function shuffleOptions(sentence) {
  return shuffle(sentence.o.map((t, j) => ({ t, ok: j === sentence.c })));
}

// ---------------------------------------------------------------- staircase (spec section 1)
// "3 correct in a row -> rate -2ms/char (faster), streak resets."
// "Any wrong answer -> rate +2ms/char (slower), streak resets."
// "The rate stays between MIN_RATE and MAX_RATE." "The rate carries over between sessions.
// The streak does not."

export function applyStaircase(rate, streak, correct, settings) {
  const { STAIRCASE_STEP_MS: step, MIN_RATE: min, MAX_RATE: max } = settings;
  const clamp = (r) => { let v = Math.max(min, r); if (max != null) v = Math.min(max, v); return v; };
  if (correct) {
    const nextStreak = streak + 1;
    if (nextStreak >= 3) return { rate: clamp(rate - step), streak: 0, sped: true, dotsFilled: 3 };
    return { rate, streak: nextStreak, sped: false, dotsFilled: nextStreak };
  }
  return { rate: clamp(rate + step), streak: 0, sped: false, dotsFilled: 0, slowed: true };
}

// ---------------------------------------------------------------- starting pace (spec section 1)
// "Per trial: reading time / number of characters." "Starting pace: the average over trials
// that are valid, answered correctly, and tagged 'not seen'." Fix B tagging is deferred in
// this build (see bank.js), so "not seen" filtering is not applied yet - flagged, not invented.

export function perCharMs(readingTimeMs, charCount) { return readingTimeMs / charCount; }

export function computeStartingPace(baselineTrials, settings) {
  const valid = baselineTrials.filter((t) => t.valid && t.ok);
  if (valid.length < settings.SESSION_0_BASELINE_TARGET - 4 && valid.length === 0) return null; // guard: never divide by zero
  const sum = valid.reduce((s, t) => s + t.perChar, 0);
  return { rate: Math.max(settings.MIN_RATE, Math.round(sum / valid.length)), validCount: valid.length };
}
