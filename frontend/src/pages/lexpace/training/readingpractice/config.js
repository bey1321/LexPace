// Named settings for Reading Fluency Practice (spec section 7). Fixed values come from the
// cited papers; everything else is the prototype's own pilot default, kept visible here so
// the team can change it without touching logic. MAX_RATE and the not-yet-built pieces
// (Fix B thresholds, support-offer thresholds, difficulty balance tolerance) are left as
// genuinely open - not invented.

export const START_DELAY_MS = 500;    // pilot default
export const MIN_BASELINE_VALID = 8;  // pilot default
export const INACTIVITY_MS = 20000;   // pilot default
// Pilot default was 250ms, tuned for a normal full-page browser tab. Loosened for embedded
// contexts (e.g. the Streamlit demo's iframe) where browsers throttle requestAnimationFrame
// well below 60fps regardless of actual on-screen visibility - a tighter threshold here was
// tripping the freeze guard almost immediately in that one context, cancelling every erase
// trial before any erasure became visible. Still tight enough to catch a genuinely
// backgrounded/frozen tab within ~2s.
export const FREEZE_MS = 2000;
export const STAIRCASE_STEP_MS = 2;   // fixed (Breznitz et al., 2013)
export const MIN_RATE = 20;           // pilot default
export const MAX_RATE = null;         // open (spec: "none" in the prototype - not a real decision)
export const SESSION_0_BASELINE_TARGET = 12; // fixed program structure (spec section 1)
export const TRAINING_TARGET_PER_SESSION = 50; // fixed program structure (spec section 1)
export const PRACTICE_PER_SESSION = 2; // fixed program structure (spec section 1)
