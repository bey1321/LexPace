// Named settings for Number Sense Practice (spec section 8). Nothing here is invented:
// fixed values come from the cited papers, everything else is the prototype's own pilot
// default, kept visible and in one place so the team can change it without touching logic.
// Two settings stay genuinely open (not given a value here) because they need a decision
// this module cannot make on its own: the real adaptive placement algorithm (see placement.js)
// and ANXIETY_OFFER_THRESHOLD (the anxiety check itself is not built yet).

export const LINE_TOLERANCE = 0.05;        // fixed (Käser et al., 2013)
export const SESSION_MINUTES = 20;         // fixed (Kohn et al., 2020)
export const MIN_SESSIONS = 42;            // fixed (Kohn et al., 2020)

export const PASS_STREAK = 10;             // approximate in Käser et al.; confirm
export const BACK_FAILS = 5;               // approximate in Käser et al.; confirm

export const FAST_MS = 8000;               // pilot default
export const REPEAT_COUNT = 2;             // pilot default
export const REPEAT_WINDOW = 6;            // pilot default
export const REVIEW_SHARE = 0.2;           // pilot default
export const WARMUP_ITEMS = 2;             // pilot default
export const COURSE_ITEMS_PER_SESSION = 1; // team default (range 1-2)
export const PRIORITY_WEIGHTS = { High: 3, Medium: 2, Low: 1 };
