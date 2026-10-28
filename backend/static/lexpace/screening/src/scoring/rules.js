// Rule-based result. This is the safety net: it always runs, even when an ML model is loaded,
// and every rule can be explained to SAS in one sentence.
//
// Output is three skill flags, never a condition label:
//   skills = { reading, writing, math }   (true = this skill could use support)
//   scores = { reading, writing, math }   (0–1, how strong the signal is; used to pick one version)

export const SKILL_LABELS = { reading: "Reading", writing: "Writing", math: "Calculation" };

export const VERSION_LABELS = {
  base: "Base lesson",
  read: "Reading support",
  write: "Writing support",
  calc: "Calculation support",
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

  // Reading: any of the reading signals from the seven games.
  const readingSignals = [flags.soundWeak, flags.spellingWeak, flags.irregularWorse, flags.slow];
  const reading = readingSignals.some(Boolean);

  // TODO(writing): the screening has no writing task yet (Echo checks spelling, which counts as a
  // reading signal above). Add a writing task, then set writing + scores.writing from it.
  // TODO(math): the screening has no calculation task yet (Number Recall is memory, not maths).
  // Add a maths task, then set math + scores.math from it.
  const skills = { reading, writing: false, math: false };
  const scores = { reading: readingSignals.filter(Boolean).length / readingSignals.length, writing: 0, math: 0 };

  const currentWeak = skills.reading || skills.writing || skills.math;
  let decision = "none";
  if (flags.historyHigh && currentWeak) decision = "suggest";
  else if (flags.historyHigh) decision = "cope"; // difficulty as a child, coping well now
  else if (flags.soundWeak && (flags.spellingWeak || flags.slow)) decision = "suggest";

  return { flags, skills, scores, decision };
}
