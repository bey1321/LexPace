import { evaluateRules } from "./rules.js";
import { predict } from "./model.js";

// Combines the rule-based result with the ML model (if one is loaded).
// - Decision: the rules always count. The model can add a suggestion, never remove one.
// - Profile: the model's top profile when it is confident enough, otherwise the rule profile.
export function decide(features, T, model) {
  const rules = evaluateRules(features, T);
  let ml = null;
  try { ml = model ? predict(model, features) : null; } catch { ml = null; }

  let decision = rules.decision;
  if (ml && ml.risk >= T.modelRisk && decision === "none") decision = "suggest";

  let profile = rules.profile, profileSource = "rules";
  if (ml && ml.top !== "none" && ml.probs[ml.top] >= T.modelProfile) { profile = ml.top; profileSource = "model"; }

  return { decision, profile, profileSource, rules, model: ml };
}
