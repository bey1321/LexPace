// All the numbers the team tunes. Override any of them with createJourney(el, { config: {...} }).

export const DEFAULT_CONFIG = {
  lang: "en-GB",

  games: {
    // Adaptive games use one rule: right + fast → harder, right + slow → same, wrong → easier.
    // fastMs = the "fast" cut-off for that game, measured from when the audio ends.
    alike: { levels: 4, start: 2, items: 8, fastMs: 2500 },
    lab: { levels: 3, start: 1, items: 8, fastMs: 3000 },
    echo: { levels: 4, start: 2, items: 6, fastMs: 6000, replays: 1 }, // + 2 fixed irregular "probe" words
    numbers: { fwdStart: 4, bwdStart: 3, maxLen: 8, maxFails: 2 },
    follow: { rounds: [2, 3, 3, 4, 4, 5] },
  },

  // Starting thresholds. NOT validated. After the pilot, replace them with
  // the numbers printed by ml/calibrate_thresholds.py.
  thresholds: {
    history: 0.47,     // 5-question score (0–1). At or above → difficulty as a child. Borrowed from the full 23-item ARHQ.
    alikeLevel: 2.5,   // Sound-Alike level (1–4). Below → weak sound-to-spelling decoding.
    labLevel: 2.0,     // Sound Lab level (1–3). Below → weak sound awareness.
    echoLevel: 2.5,    // Echo level (1–4). Below → weak spelling.
    irregularGap: 0.3, // regular accuracy − irregular accuracy. At or above → whole-word memory weaker.
    soundRT: 3.5,      // median seconds per answer in Sound-Alike + Sound Lab. Above → slow.
    wpm: 170,          // Short Read words per minute. Below → slow reading.
    spanFwd: 5,        // Number Recall forward. Below → weak short-term memory.
    spanBwd: 4,        // Number Recall reverse. Below → weak working memory.
    follow: 3,         // Follow Me longest correct. Below → weak.
    readComp: 2,       // Short Read questions right (of 3). At or above → understood.
    modelRisk: 0.5,    // ML: reading signal (1 − P(no flag)). At or above → reading flag on, suggest a check.
    modelProfile: 0.5, // ML: no longer used (the model's per-class output is not shown or stored).
  },
};

export function mergeConfig(base, extra) {
  if (!extra) return structuredClone(base);
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(extra)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" ? mergeConfig(out[k], v) : v;
  }
  return out;
}
