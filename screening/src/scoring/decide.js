import { evaluateRules } from "./rules.js";
import { predict } from "./model.js";

const VERSION_FOR_SKILL = { reading: "read", writing: "write", math: "calc" };

// Picks one lesson version from the skill flags.
// None on → "base". Exactly one on → its version. Several on → the one with the strongest score.
// TODO(stacking): when the lecture page can combine supports, return every flagged version instead.
export function chooseVersion(skills, scores) {
  const on = Object.keys(VERSION_FOR_SKILL).filter((k) => skills[k]);
  if (!on.length) return "base";
  const best = on.reduce((a, b) => ((scores[b] ?? 0) > (scores[a] ?? 0) ? b : a));
  return VERSION_FOR_SKILL[best];
}

// Combines the rule-based result with the ML model (if one is loaded).
// - The rules always count. The model can add a signal, never remove one.
// - The model only knows reading patterns, so its risk can only turn on the reading flag.
// - Only the overall risk is kept from the model, never its per-class labels.
export function decide(features, T, model) {
  const rules = evaluateRules(features, T);
  let ml = null;
  try { ml = model ? predict(model, features) : null; } catch { ml = null; }

  const skills = { ...rules.skills };
  const scores = { ...rules.scores };
  let decision = rules.decision;
  if (ml) {
    scores.reading = Math.max(scores.reading, ml.risk);
    if (ml.risk >= T.modelRisk) {
      skills.reading = true;
      if (decision === "none") decision = "suggest";
    }
  }

  const version = chooseVersion(skills, scores);
  return {
    decision, skills, scores, version,
    rules: { flags: rules.flags, skills: rules.skills, decision: rules.decision },
    model: ml ? { risk: ml.risk, trainedOn: ml.trainedOn } : null,
  };
}
