// Rule-based result. This is the safety net: it always runs, even when an ML model is loaded,
// and every rule can be explained to SAS in one sentence.

export const PROFILE_LABELS = {
  none: "No clear profile",
  phonological: "Phonological",
  surface: "Surface",
  rapid_naming: "Rapid naming (slow but accurate)",
  double_deficit: "Double deficit",
  mixed: "Mixed (phonological + surface)",
};

export function evaluateRules(f, T) {
  const flags = {
    historyHigh: f.history >= T.history,
    soundWeak: f.alike_level < T.alikeLevel || f.lab_level < T.labLevel,
    spellingWeak: f.echo_level < T.echoLevel,
    irregularWorse: f.echo_regular_acc - f.echo_irregular_acc >= T.irregularGap,
    mostlySoundRight: f.echo_sound_right > 0.5,
    slow: (f.read_wpm > 0 && f.read_wpm < T.wpm) || Math.max(f.alike_rt, f.lab_rt) > T.soundRT,
    memoryWeak: f.span_bwd < T.spanBwd || f.span_fwd < T.spanFwd || f.follow_steps < T.follow,
    understood: f.read_comp >= T.readComp,
  };

  let profile = "none";
  if (flags.soundWeak && flags.slow) profile = "double_deficit";
  else if (flags.soundWeak && flags.irregularWorse) profile = "mixed";
  else if (flags.soundWeak) profile = "phonological";
  else if ((flags.spellingWeak && flags.mostlySoundRight) || flags.irregularWorse) profile = "surface";
  else if (flags.slow && flags.understood) profile = "rapid_naming";

  const currentWeak = flags.soundWeak || flags.spellingWeak || flags.slow;
  let decision = "none";
  if (flags.historyHigh && currentWeak) decision = "suggest";
  else if (flags.historyHigh) decision = "cope"; // difficulty as a child, coping well now
  else if (flags.soundWeak && (flags.spellingWeak || flags.slow)) decision = "suggest";

  return { flags, profile, decision };
}
