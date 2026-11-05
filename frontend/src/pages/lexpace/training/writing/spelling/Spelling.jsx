import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as CFG from "./config.js";
import * as E from "./engine.js";
import { BANK, CTX_HELD, NONWORDS, PAIRS, RR_ITEMS, buildStartingTest } from "./bank.js";
import "../writing.css";

// Spelling - phase 1, same scope decisions as the other two training modules already built:
//   - in-memory only; cross-session word mastery (3 correct review dictations, spaced over
//     days) needs real persistence that doesn't exist yet, so this build tracks same-session
//     performance only and clearly says so at session end, rather than faking a schedule;
//   - word bank is the prototype's placeholder data (bank.js), pending flow 2a;
//   - marking is code only - no AI anywhere in this module, matching the spec exactly;
//   - presenter panel hidden unless ?staff=1.

const STEPS = ["parts", "listen", "pick", "tricky", "dict"];
const STEP_LABEL = { parts: "Word parts", listen: "Listen and choose", pick: "Pick the correct word", tricky: "Tricky part", dict: "Dictation" };
const TEST = buildStartingTest();

function hasAudio() { return "speechSynthesis" in window; }
function say(word, ctx) {
  if (!hasAudio()) return;
  try {
    window.speechSynthesis.cancel();
    const parts = ctx ? [word, ctx, word] : [word];
    parts.forEach((s) => { const u = new SpeechSynthesisUtterance(s); u.lang = "en-GB"; u.rate = 0.85; window.speechSynthesis.speak(u); });
  } catch { /* speech synthesis unavailable */ }
}

function initial() {
  return {
    screen: "intro", testIndex: 0, testAnswers: Array(TEST.length).fill(null), profile: { sound: 0, pattern: 0, part: 0, other: 0 },
    mixWords: [], wi: 0, mixPos: 0, mixAnswers: [], requeue: [], requeueIdx: 0,
    flash: CFG.START_FLASH_MS, rrIndex: 0, rrCorrect: 0,
    timeRR: 0, timeMix: 0, timingKind: null, timingStart: 0,
    log: [], lastResult: null, lastSpoken: null, paused: false,
  };
}

const MID_ITEM_SCREENS = ["test", "rr-ready", "rr-fb", "parts", "listen", "pick", "tricky", "dict", "requeue", "requeue-fb"];

export default function Spelling() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const staffMode = params.get("staff") === "1";
  const [s, setS] = useState(initial);
  const logNRef = useRef(0);

  function midItem() { return MID_ITEM_SCREENS.includes(s.screen); }
  function backToMenu() {
    if (midItem() && !window.confirm("Leave now? This item won't be saved.")) return;
    try { window.speechSynthesis?.cancel(); } catch { /* no speech API */ }
    navigate("../..");
  }
  function backToWriting() {
    if (midItem() && !window.confirm("Leave now? This item won't be saved.")) return;
    try { window.speechSynthesis?.cancel(); } catch { /* no speech API */ }
    navigate("..");
  }
  function togglePause() { setS((p) => ({ ...p, paused: !p.paused })); }
  function restartNow() {
    if (midItem() && !window.confirm("Restart from the beginning? This item won't be saved.")) return;
    try { window.speechSynthesis?.cancel(); } catch { /* no speech API */ }
    restart();
  }
  function endSessionNow() {
    if (midItem() && !window.confirm("Skip the rest of this session and go straight to the end screen? Anything not yet finished won't be saved.")) return;
    try { window.speechSynthesis?.cancel(); } catch { /* no speech API */ }
    if (s.screen === "intro") { navigate(".."); return; }
    setS((p) => ({ ...p, screen: "session-end", paused: false }));
  }

  function appendLog(task, target, typed, ok) {
    logNRef.current += 1;
    setS((p) => ({ ...p, log: [...p.log, { n: logNRef.current, task, target, typed: typed === "" ? "(blank)" : typed, ok }] }));
  }

  function startTiming(kind) { setS((p) => ({ ...p, timingKind: kind, timingStart: performance.now() })); }
  function stopTiming() {
    setS((p) => {
      if (!p.timingKind) return p;
      const elapsed = performance.now() - p.timingStart;
      return { ...p, timeRR: p.timingKind === "rr" ? p.timeRR + elapsed : p.timeRR, timeMix: p.timingKind === "mix" ? p.timeMix + elapsed : p.timeMix, timingKind: null };
    });
  }

  // ---------------------------------------------------------------- intro -> starting test

  function startTest() { setS((p) => ({ ...p, screen: "test", testIndex: 0 })); }

  useEffect(() => {
    if (s.screen === "test" && s.testIndex < TEST.length) {
      const w = TEST[s.testIndex];
      say(w, (BANK[w] && BANK[w].ctx) || CTX_HELD[w]);
      setS((p) => ({ ...p, lastSpoken: w }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.screen, s.testIndex]);

  function submitTestAnswer(typed) {
    const w = TEST[s.testIndex];
    const t = E.norm(typed);
    const ok = t === w;
    const type = ok ? null : E.classify(w, t);
    appendLog("Test", w, t, ok);
    setS((p) => {
      // Freely editable, in any order - Previous/Next move around the list regardless of what's
      // answered yet, since there's no feedback shown during this test either way. Re-submitting
      // an already-answered word overwrites that entry and its contribution to the error
      // profile, rather than appending a duplicate.
      const prev = p.testAnswers[p.testIndex];
      let profile = p.profile;
      if (prev && prev.type) profile = { ...profile, [prev.type]: profile[prev.type] - 1 };
      if (type) profile = { ...profile, [type]: (profile[type] || 0) + 1 };
      const testAnswers = p.testAnswers.map((a, i) => (i === p.testIndex ? { w, typed: t, ok, type } : a));
      if (testAnswers.every(Boolean)) return { ...p, testAnswers, profile, screen: "profile" };
      const testIndex = Math.min(p.testIndex + 1, TEST.length - 1);
      return { ...p, testAnswers, profile, testIndex, screen: "test" };
    });
  }
  function testGoPrev() { setS((p) => (p.testIndex > 0 ? { ...p, testIndex: p.testIndex - 1 } : p)); }
  function testGoNext() { setS((p) => (p.testIndex < TEST.length - 1 ? { ...p, testIndex: p.testIndex + 1 } : p)); }

  // ---------------------------------------------------------------- profile -> session plan

  function profileData() {
    const trained = PAIRS.map((p) => p[0]);
    const wrongTrained = s.testAnswers.filter((a) => !a.ok && trained.includes(a.w)).map((a) => a.w);
    const words = wrongTrained.slice(0, 2);
    trained.forEach((w) => { if (words.length < 2 && !words.includes(w)) words.push(w); });
    const order = ["part", "pattern", "sound"].sort((a, b) => s.profile[b] - s.profile[a]);
    const focus = s.profile[order[0]] > 0 ? E.TYPE_NAME[order[0]] : "No clear error type yet";
    return { words, focus, totalCorrect: s.testAnswers.filter((a) => a.ok).length };
  }

  function beginSession() {
    const { words } = profileData();
    setS((p) => ({ ...p, mixWords: words, screen: "rr-intro" }));
  }

  // ---------------------------------------------------------------- Rapid Reading

  function startRR() { startTiming("rr"); setS((p) => ({ ...p, rrIndex: 0, rrCorrect: 0, screen: "rr-ready" })); }

  function rrAnswer(typed) {
    const w = RR_ITEMS[s.rrIndex];
    const t = E.norm(typed);
    const ok = t === w;
    appendLog("Rapid Reading", w + (NONWORDS[w] ? " (non-word)" : ""), t, ok);
    setS((p) => ({ ...p, rrCorrect: p.rrCorrect + (ok ? 1 : 0), screen: "rr-fb", lastResult: { ok, word: w, typed: t } }));
  }

  function rrNext() {
    if (s.rrIndex + 1 >= RR_ITEMS.length) { stopTiming(); return setS((p) => ({ ...p, screen: "rr-end" })); }
    setS((p) => ({ ...p, rrIndex: p.rrIndex + 1, screen: "rr-ready" }));
  }

  function rrEndContinue() {
    const acc = s.rrCorrect / RR_ITEMS.length;
    const { flash, leveledUp } = E.nextFlash(s.flash, acc, CFG);
    setS((p) => ({ ...p, flash, lastResult: { leveledUp }, screen: "mix-intro" }));
  }

  // ---------------------------------------------------------------- mixed activities
  //
  // Position-indexed over a fixed array (mixWords.length * STEPS.length slots), same model as
  // the spelling test and sentence combining: Previous/Next move freely between any step of any
  // word regardless of whether it's answered yet, and `wi`/`screen` are kept in sync with
  // `mixPos` by every function that changes it, so the rest of the render code (which still
  // switches on s.screen per step, and reads s.mixWords[s.wi]) doesn't need to change.

  function mixTotal(p) { return p.mixWords.length * STEPS.length; }

  function startMix() {
    setS((p) => ({ ...p, wi: 0, mixPos: 0, mixAnswers: Array(mixTotal(p)).fill(null), requeue: [], screen: STEPS[0] }));
    startTiming("mix");
  }

  function mixGoPrev() {
    setS((p) => {
      if (p.mixPos <= 0) return p;
      const pos = p.mixPos - 1;
      return { ...p, mixPos: pos, wi: Math.floor(pos / STEPS.length), screen: STEPS[pos % STEPS.length] };
    });
  }
  function mixGoNext() {
    setS((p) => {
      if (p.mixPos >= mixTotal(p) - 1) return p;
      const pos = p.mixPos + 1;
      return { ...p, mixPos: pos, wi: Math.floor(pos / STEPS.length), screen: STEPS[pos % STEPS.length] };
    });
  }
  function finishMix() { setS((p) => ({ ...p, screen: "requeue-intro" })); }

  // First attempt at a step: records the result in place and, if wrong, queues the word for the
  // end-of-session requeue round (kept there even if a retype below succeeds - the requeue
  // dictation is the unprompted check, a prompted retype right after seeing the answer isn't).
  function recordMixAnswer(result) {
    setS((p) => ({
      ...p,
      mixAnswers: p.mixAnswers.map((a, i) => (i === p.mixPos ? result : a)),
      requeue: !result.ok && !p.requeue.includes(result.word) ? [...p.requeue, result.word] : p.requeue,
    }));
  }
  function retryMixAnswer(typed) {
    const word = s.mixWords[s.wi];
    const task = STEP_LABEL[STEPS[s.mixPos % STEPS.length]];
    const t = E.norm(typed);
    const ok = t === word;
    appendLog(task + " (retype)", word, t, ok);
    setS((p) => ({ ...p, mixAnswers: p.mixAnswers.map((a, i) => (i === p.mixPos ? { ok, word, task, typed: t, retried: true } : a)) }));
  }

  function requeueAnswer(typed) {
    const w = s.requeue[s.requeueIdx];
    const t = E.norm(typed);
    const ok = t === w;
    appendLog("Dictation, end of session", w, t, ok);
    setS((p) => ({ ...p, screen: "requeue-fb", lastResult: { ok, word: w } }));
  }

  function requeueNext() {
    if (s.requeueIdx + 1 >= s.requeue.length) { stopTiming(); return setS((p) => ({ ...p, screen: "session-end" })); }
    setS((p) => ({ ...p, requeueIdx: p.requeueIdx + 1, screen: "requeue" }));
  }

  function restart() { logNRef.current = 0; setS(initial()); }

  // ---------------------------------------------------------------- render

  const label = { intro: "Starting test", test: "Starting test", profile: "Your error profile",
    "rr-intro": "Rapid Reading", "rr-ready": "Rapid Reading", "rr-fb": "Rapid Reading", "rr-end": "Rapid Reading",
    "mix-intro": "Mixed activities",
    parts: "Word parts", listen: "Listen and choose", pick: "Pick the correct word", tricky: "Tricky part", dict: "Dictation",
    "requeue-intro": "One more time", requeue: "Dictation", "requeue-fb": "Dictation", "session-end": "Session complete" }[s.screen] || "";
  const mixAnswer = s.mixAnswers[s.mixPos];

  return (
    <div className="wp">
      <div className="wp-panel">
        <div className="wp-shead">
          <button type="button" className="wp-btn wp-o wp-sm" onClick={backToMenu}>← Training menu</button>
          <button type="button" className="wp-btn wp-o wp-sm" onClick={backToWriting}>Other writing trainings</button>
          <b>Spelling practice · Session 1 of {CFG.SESSION_COUNT}</b>
          <span className="wp-tag">{label}</span>
          {["rr-ready", "rr-fb", "rr-end"].includes(s.screen) && <span className="wp-tag">Flash: {s.flash} ms</span>}
        </div>
        <div className="wp-stage">
          {s.paused ? (
            <div className="wp-intro">
              <p className="wp-lab">Paused</p>
              <h1>Session paused</h1>
              <p className="wp-msg">Nothing is running while paused. Press Resume to continue where you left off.</p>
              <div><button type="button" className="wp-btn" onClick={togglePause}>Resume</button></div>
            </div>
          ) : <>
          {s.screen === "intro" && <Intro onStart={startTest} />}
          {s.screen === "test" && <TestItem index={s.testIndex} total={TEST.length} initialValue={s.testAnswers[s.testIndex]?.typed} onSubmit={submitTestAnswer} onReplay={() => say(s.lastSpoken, (BANK[s.lastSpoken] && BANK[s.lastSpoken].ctx) || CTX_HELD[s.lastSpoken])} />}
          {s.screen === "profile" && <ProfileScreen data={profileData()} totalTest={TEST.length} onStart={beginSession} />}
          {s.screen === "rr-intro" && <RRIntro flash={s.flash} onStart={startRR} />}
          {s.screen === "rr-ready" && <RRReady index={s.rrIndex} total={RR_ITEMS.length} word={RR_ITEMS[s.rrIndex]} flash={s.flash} onDone={rrAnswer} />}
          {s.screen === "rr-fb" && <RRFeedback result={s.lastResult} onNext={rrNext} />}
          {s.screen === "rr-end" && <RREndScreen correct={s.rrCorrect} total={RR_ITEMS.length} flash={s.flash} onContinue={rrEndContinue} leveledUp={s.lastResult?.leveledUp} />}
          {s.screen === "mix-intro" && <MixIntro leveledUp={s.lastResult?.leveledUp} onStart={startMix} />}
          {STEPS.includes(s.screen) && mixAnswer == null && s.screen === "parts" && (
            <PartsStep word={s.mixWords[s.wi]} index={s.wi} total={s.mixWords.length}
              onDone={() => { appendLog("Word parts", s.mixWords[s.wi], BANK[s.mixWords[s.wi]].parts.join("+"), true); recordMixAnswer({ ok: true, word: s.mixWords[s.wi], task: "Word parts" }); }} />
          )}
          {s.screen === "listen" && mixAnswer == null && (
            <ChoiceStep word={s.mixWords[s.wi]} withAudio label="Listen and choose" instr="Listen, then choose the correct spelling. Press 1 or 2." task="Listen and choose"
              onPick={(ok, text) => { appendLog("Listen and choose", s.mixWords[s.wi], text, ok); recordMixAnswer({ ok, word: s.mixWords[s.wi], task: "Listen and choose", typed: text, choiceOnly: true }); }} />
          )}
          {s.screen === "pick" && mixAnswer == null && (
            <ChoiceStep word={s.mixWords[s.wi]} withAudio={false} label="Pick the correct word" instr="Which spelling is correct? Press 1 or 2." task="Pick the correct word"
              onPick={(ok, text) => { appendLog("Pick the correct word", s.mixWords[s.wi], text, ok); recordMixAnswer({ ok, word: s.mixWords[s.wi], task: "Pick the correct word", typed: text, choiceOnly: true }); }} />
          )}
          {s.screen === "tricky" && mixAnswer == null && (
            <TrickyStep word={s.mixWords[s.wi]} onSubmit={(typed) => { const word = s.mixWords[s.wi]; const t = E.norm(typed); const ok = t === word; appendLog("Tricky part", word, t, ok); recordMixAnswer({ ok, word, task: "Tricky part", typed: t }); }} />
          )}
          {s.screen === "dict" && mixAnswer == null && (
            <DictStep word={s.mixWords[s.wi]} onSubmit={(typed) => { const word = s.mixWords[s.wi]; const t = E.norm(typed); const ok = t === word; appendLog("Dictation", word, t, ok); recordMixAnswer({ ok, word, task: "Dictation", typed: t }); }} />
          )}
          {STEPS.includes(s.screen) && mixAnswer != null && (
            <MixFeedback result={mixAnswer} onRetype={retryMixAnswer}
              onRedo={() => setS((p) => ({ ...p, mixAnswers: p.mixAnswers.map((a, i) => (i === p.mixPos ? null : a)) }))} />
          )}
          {STEPS.includes(s.screen) && (
            <div className="wp-row"><button type="button" className="wp-btn wp-o wp-sm" onClick={finishMix}>Finish practice and move on</button></div>
          )}
          {s.screen === "requeue-intro" && <RequeueIntro words={s.requeue} onStart={() => setS((p) => ({ ...p, requeueIdx: 0, screen: p.requeue.length ? "requeue" : "session-end" }))} />}
          {s.screen === "requeue" && <DictStep word={s.requeue[s.requeueIdx]} retry onSubmit={requeueAnswer} />}
          {s.screen === "requeue-fb" && <RequeueFeedback result={s.lastResult} onNext={requeueNext} />}
          {s.screen === "session-end" && <SessionEnd timeRR={s.timeRR} timeMix={s.timeMix} flash={s.flash} words={s.mixWords} onRestart={restart} />}
          </>}
        </div>
        {!s.paused && s.screen === "test" && (
          <div className="wp-nav1">
            <button type="button" className="wp-btn wp-o wp-sm" disabled={s.testIndex <= 0} onClick={testGoPrev}>◀ Previous</button>
            <span className="wp-stepper">
              {TEST.map((_, i) => (
                <span key={i} className={"wp-dot" + (i === s.testIndex ? " is-now" : s.testAnswers[i] ? " is-done" : "")} />
              ))}
              &nbsp;Word {s.testIndex + 1} of {TEST.length}
            </span>
            <button type="button" className="wp-btn wp-sm" disabled={s.testIndex >= TEST.length - 1} onClick={testGoNext}>Next ▶</button>
          </div>
        )}
        {!s.paused && STEPS.includes(s.screen) && (
          <div className="wp-nav1">
            <button type="button" className="wp-btn wp-o wp-sm" disabled={s.mixPos <= 0} onClick={mixGoPrev}>◀ Previous</button>
            <span className="wp-stepper">
              {s.mixAnswers.map((a, i) => (
                <span key={i} className={"wp-dot" + (i === s.mixPos ? " is-now" : a ? " is-done" : "")} />
              ))}
              &nbsp;Step {s.mixPos + 1} of {s.mixAnswers.length}
            </span>
            <button type="button" className="wp-btn wp-sm" disabled={s.mixPos >= s.mixAnswers.length - 1} onClick={mixGoNext}>Next ▶</button>
          </div>
        )}
        <div className="wp-sfoot">
          <span>Spell-check, autocorrect and suggestions are switched off in every answer box. {s.screen === "test" && "You can revisit and change any earlier word with Previous - there's no feedback in this test either way."} {STEPS.includes(s.screen) && "You can revisit any earlier step with Previous and redo it."}</span>
          {s.screen !== "intro" && (
            <div className="wp-sfoot-actions">
              <span className="wp-sfoot-lab">Session</span>
              <button type="button" className="wp-btn wp-o wp-sm" onClick={togglePause}>{s.paused ? "Resume" : "Pause"}</button>
              <button type="button" className="wp-btn wp-o wp-sm" onClick={restartNow}>Restart</button>
              <button type="button" className="wp-btn wp-o wp-sm" onClick={endSessionNow}>Skip to end</button>
            </div>
          )}
        </div>
      </div>
      {staffMode && <StaffPanel s={s} />}
    </div>
  );
}

// ---------------------------------------------------------------- screens

function Intro({ onStart }) {
  return (
    <div className="wp-intro">
      <p className="wp-lab">Session 1 · Spelling practice</p>
      <h1>First, a short spelling test</h1>
      <p className="wp-msg"><b>This is a trial/demo page.</b> The words you'll see are placeholder examples, not real course vocabulary, and nothing you do here is saved between visits yet.</p>
      <p>You will hear a word, a sentence that uses it, and the word again. Type the word and press <span className="wp-key">ENTER</span>. There is no feedback in this test and no score is shown to anyone else.</p>
      <p className="wp-msg">The test finds which kinds of spelling errors you make, so your sessions can focus on them. Half of the words will be trained. The other half are kept back to check, at the end, whether you learned the rule and not only the words.</p>
      {!hasAudio() && <div className="wp-warn">Audio is not available in this browser, so dictation cannot run here. Try Chrome or Edge.</div>}
      <div><button type="button" className="wp-btn" onClick={onStart}>Start the test</button></div>
    </div>
  );
}

function AnswerBox({ onSubmit, autoFocusKey, initialValue }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, [autoFocusKey]);
  function submit() { onSubmit(ref.current.value); }
  return (
    <>
      {/* key={autoFocusKey} forces a fresh input per item - without it React reuses the same
          uncontrolled DOM node across words, so whatever was typed for the last word stayed
          visible instead of clearing for the next one. */}
      <input key={autoFocusKey} ref={ref} className="wp-ans" type="text" spellCheck="false" autoComplete="off" autoCorrect="off" autoCapitalize="off"
        defaultValue={initialValue || ""} aria-label="Type the word" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
      <p className="wp-msg">Press <span className="wp-key">ENTER</span></p>
    </>
  );
}

function TestItem({ index, total, initialValue, onSubmit, onReplay }) {
  return (
    <>
      <p className="wp-lab">Listen, then type the word · word {index + 1} of {total} (demo; real test has 60)</p>
      <div className="wp-fix" aria-hidden="true">♪</div>
      <AnswerBox onSubmit={onSubmit} autoFocusKey={index} initialValue={initialValue} />
      <div><button type="button" className="wp-btn wp-o wp-sm" onClick={onReplay}>Play again</button></div>
    </>
  );
}

function ProfileScreen({ data, totalTest, onStart }) {
  return (
    <div className="wp-box">
      <p className="wp-lab">Starting test complete</p>
      <h1>Your error profile</h1>
      <p>{data.totalCorrect} of {totalTest} words correct.</p>
      <p><b>Session plan.</b> About 60% Rapid Reading, about 40% mixed activities. Focus of the mixed activities: {data.focus}. Words for today: {data.words.join(", ")}.</p>
      <p className="wp-msg">Kept back for the end test, never trained: {PAIRS.map((p) => p[1]).join(", ")}.</p>
      <div><button type="button" className="wp-btn" onClick={onStart}>Start Rapid Reading</button></div>
    </div>
  );
}

function RRIntro({ flash, onStart }) {
  return (
    <div className="wp-intro">
      <p className="wp-lab">Part 1 · about 60% of the session</p>
      <h1>Rapid Reading</h1>
      <ol>
        <li>Look at the <b>+</b> and press <span className="wp-key">SPACE</span> when ready.</li>
        <li>A word flashes for {flash} ms where the + was.</li>
        <li>Type exactly what you saw and press <span className="wp-key">ENTER</span>. Some items are made-up words: type them as shown.</li>
      </ol>
      <p className="wp-msg">Above 80% correct, the next block flashes faster. Below 80%, it flashes slower.</p>
      <div><button type="button" className="wp-btn" onClick={onStart}>Start</button></div>
    </div>
  );
}

function RRReady({ index, total, word, flash, onDone }) {
  const [phase, setPhase] = useState("ready"); // ready | flashing | type
  useEffect(() => { setPhase("ready"); }, [index]);

  function pressSpace() {
    setPhase("flashing");
    const box = { current: null };
    // short pause then flash, matching the prototype's 300ms pre-delay + rAF flash window
    setTimeout(() => {
      let shown = null;
      function reveal(ts) { shown = ts; requestAnimationFrame(hide); }
      function hide(ts) { if (ts - shown >= flash) setPhase("type"); else requestAnimationFrame(hide); }
      requestAnimationFrame(reveal);
    }, 300);
  }

  if (phase === "ready") {
    return (
      <>
        <p className="wp-lab">Look at the + · item {index + 1} of {total} (demo)</p>
        <div className="wp-word">+</div>
        <p className="wp-msg">Press <span className="wp-key">SPACE</span> when you are ready</p>
        <div><button type="button" className="wp-btn wp-o" onClick={pressSpace}>Ready</button></div>
      </>
    );
  }
  if (phase === "flashing") {
    return (
      <>
        <p className="wp-lab">Look at the +</p>
        <div className="wp-word">{word}</div>
      </>
    );
  }
  return (
    <>
      <p className="wp-lab">Type what you saw</p>
      <div className="wp-word" aria-hidden="true">&nbsp;</div>
      <AnswerBox onSubmit={onDone} autoFocusKey={index} />
    </>
  );
}

function RRFeedback({ result, onNext }) {
  return (
    <>
      <div className="wp-res">{result.ok ? "Correct" : "Not correct"}</div>
      {!result.ok && <p className="wp-msg">It was: <b>{result.word}</b></p>}
      <button type="button" className="wp-btn" onClick={onNext}>Next (Space)</button>
    </>
  );
}

function RREndScreen({ correct, total, flash, onContinue, leveledUp }) {
  const acc = Math.round((correct / total) * 100);
  return (
    <div className="wp-box">
      <p className="wp-lab">Rapid Reading block complete</p>
      <h1>{correct} of {total} correct ({acc}%)</h1>
      <p>{acc > 80 ? `Above 80% correct, so the next block flashes faster, and you move up a level. New flash time: ${flash} ms.` : `80% or below, so the next block flashes slower, at the same level. New flash time: ${flash} ms.`}</p>
      <div><button type="button" className="wp-btn" onClick={onContinue}>Continue to mixed activities</button></div>
    </div>
  );
}

function MixIntro({ onStart }) {
  return (
    <div className="wp-intro">
      <p className="wp-lab">Part 2 · about 40% of the session</p>
      <h1>Practise today's words</h1>
      <p>Each word goes through 5 short steps, from recognising it to writing it from memory:</p>
      <ol>{Object.values(STEP_LABEL).map((l) => <li key={l}>{l}</li>)}</ol>
      <p className="wp-msg">If you make a mistake, you see the correct spelling, then type it from memory, and the word comes back once more at the end.</p>
      <div><button type="button" className="wp-btn" onClick={onStart}>Start</button></div>
    </div>
  );
}

function PartsStep({ word, index, total, onDone }) {
  const b = BANK[word];
  const [order] = useState(() => b.parts.map((p, i) => ({ p, i })).sort(() => Math.random() - 0.5));
  const [built, setBuilt] = useState([]);
  const [msg, setMsg] = useState("");
  const done = built.length === b.parts.length;

  function click(i) {
    if (i !== built.length) { setMsg("Not that one yet. Which part comes next?"); return; }
    setMsg(""); setBuilt((prev) => [...prev, i]);
  }

  return (
    <div className="wp-box">
      <p className="wp-lab">Word parts · build the word · word {index + 1} of {total}</p>
      <p className="wp-msg">Click the parts in the right order.</p>
      <div className="wp-slot">{built.map((k) => b.parts[k]).join(" + ")}</div>
      <div className="wp-row">{order.map((o) => <button key={o.i} type="button" className="wp-part" disabled={built.includes(o.i)} onClick={() => click(o.i)}>{o.p}</button>)}</div>
      {msg && <p className="wp-msg">{msg}</p>}
      {done && (
        <>
          <div className="wp-word">{word}</div>
          <p className="wp-msg">Same family:</p>
          <div className="wp-fam">{b.family.map((f) => <span key={f}>{f}</span>)}</div>
          <div><button type="button" className="wp-btn" onClick={onDone}>Next (Space)</button></div>
        </>
      )}
    </div>
  );
}

function ChoiceStep({ word, withAudio, label, instr, onPick }) {
  const b = BANK[word];
  const [opts] = useState(() => [{ t: word, ok: true }, { t: b.miss, ok: false }].sort(() => Math.random() - 0.5));
  const [picked, setPicked] = useState(false);
  useEffect(() => { if (withAudio) say(word, b.ctx); }, [word, withAudio, b.ctx]);
  function pick(o) { if (picked) return; setPicked(true); onPick(o.ok, o.t); }
  return (
    <>
      <p className="wp-lab">{label}</p>
      <p className="wp-msg">{instr}</p>
      {withAudio && <div className="wp-fix" aria-hidden="true">♪</div>}
      <div className="wp-row">{opts.map((o, i) => <button key={i} type="button" className="wp-choice" disabled={picked} onClick={() => pick(o)}><span className="wp-k">{i + 1}</span>{o.t}</button>)}</div>
    </>
  );
}

function TrickyStep({ word, onSubmit }) {
  const [sel, setSel] = useState({});
  const [hidden, setHidden] = useState(false);
  function toggle(i) { setSel((p) => ({ ...p, [i]: !p[i] })); }
  if (!hidden) {
    return (
      <div className="wp-box">
        <p className="wp-lab">Tricky part</p>
        <p className="wp-msg">Click the letters you find hardest to remember. Then the word will be hidden and you type it from memory.</p>
        <div className="wp-letters">{Array.from(word).map((c, i) => <button key={i} type="button" className={"wp-lt" + (sel[i] ? " is-on" : "")} aria-pressed={!!sel[i]} onClick={() => toggle(i)}>{c}</button>)}</div>
        <div><button type="button" className="wp-btn" onClick={() => setHidden(true)}>Hide the word and type it</button></div>
      </div>
    );
  }
  return (
    <>
      <p className="wp-lab">Type the word from memory</p>
      <div className="wp-word" aria-hidden="true">&nbsp;</div>
      <AnswerBox onSubmit={onSubmit} autoFocusKey="tricky" />
    </>
  );
}

function DictStep({ word, onSubmit, retry }) {
  useEffect(() => { say(word, BANK[word].ctx); }, [word]);
  return (
    <>
      <p className="wp-lab">Dictation{retry ? " · try again" : ""}</p>
      <p className="wp-msg">Listen, then type the word.</p>
      <div className="wp-fix" aria-hidden="true">♪</div>
      <AnswerBox onSubmit={onSubmit} autoFocusKey={word} />
      <div><button type="button" className="wp-btn wp-o wp-sm" onClick={() => say(word, BANK[word].ctx)}>Play again</button></div>
    </>
  );
}

function MixFeedback({ result, onRetype, onRedo }) {
  if (result.choiceOnly) {
    return (
      <>
        <div className="wp-res">{result.ok ? "Correct" : "Not correct"}</div>
        <p className="wp-msg">The correct spelling is</p>
        <div className="wp-word">{result.word}</div>
        <div><button type="button" className="wp-btn wp-o wp-sm" onClick={onRedo}>Redo this step</button></div>
      </>
    );
  }
  if (!result.ok && !result.retried) {
    const bad = E.diffPositions(result.word, result.typed || "");
    return (
      <>
        <div className="wp-res">Not correct</div>
        <p className="wp-msg">Correct spelling, with the letters you missed underlined. Study it, then it will be hidden.</p>
        <div className="wp-diff">{Array.from(result.word).map((c, i) => bad.has(i) ? <span key={i} className="wp-x">{c}</span> : c)}</div>
        <RetypePrompt onSubmit={onRetype} />
      </>
    );
  }
  return (
    <>
      <div className="wp-res">{result.ok ? "Correct" : "Not correct"}{result.retried ? " (after retyping)" : ""}</div>
      <div className="wp-word">{result.word}</div>
      <div><button type="button" className="wp-btn wp-o wp-sm" onClick={onRedo}>Redo this step</button></div>
    </>
  );
}

function RetypePrompt({ onSubmit }) {
  const [revealed, setRevealed] = useState(true);
  if (revealed) return <button type="button" className="wp-btn" onClick={() => setRevealed(false)}>Hide it and type from memory (Space)</button>;
  return (
    <>
      <div className="wp-word" aria-hidden="true">&nbsp;</div>
      <AnswerBox onSubmit={onSubmit} autoFocusKey="retype" />
    </>
  );
}

function RequeueIntro({ words, onStart }) {
  if (!words.length) return <div className="wp-intro"><h1>No words to try again</h1><div><button type="button" className="wp-btn" onClick={onStart}>Continue</button></div></div>;
  return (
    <div className="wp-intro">
      <p className="wp-lab">One more time</p>
      <h1>Words to try again</h1>
      <p>{words.length} word(s) you found difficult today come back once more as dictation.</p>
      <div><button type="button" className="wp-btn" onClick={onStart}>Start</button></div>
    </div>
  );
}

function RequeueFeedback({ result, onNext }) {
  return (
    <>
      <div className="wp-res">{result.ok ? "Correct" : "Not correct"}</div>
      {!result.ok && <p className="wp-msg">It was: <b>{result.word}</b></p>}
      <button type="button" className="wp-btn" onClick={onNext}>Continue (Space)</button>
    </>
  );
}

function fmtTime(ms) { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }

function SessionEnd({ timeRR, timeMix, flash, words, onRestart }) {
  const tot = timeRR + timeMix;
  const pct = tot ? Math.round((timeRR / tot) * 100) : 0;
  return (
    <div className="wp-box">
      <p className="wp-lab">Session 1 complete</p>
      <h1>Session finished</h1>
      <p>Time split: <b>{pct}% Rapid Reading</b>, {100 - pct}% mixed activities (target about 60/40). Next Rapid Reading flash: <b>{flash} ms</b>.</p>
      <table><thead><tr><th>Word</th><th>Today</th><th>Next review</th></tr></thead>
        <tbody>{words.map((w) => <tr key={w}><td>{w}</td><td>Taught today - 0 of {CFG.MASTERY_REVIEWS}</td><td>Next session, as a dictation before any practice</td></tr>)}</tbody>
      </table>
      <p className="wp-msg">Dictations in the session where a word is taught do not count, because you have just seen it. A word counts as learned after {CFG.MASTERY_REVIEWS} correct review dictations, each at the start of a later session before you see the word, with growing gaps of about 1, 3 and 7 days. That spaced scheduling needs saved progress between sessions, which this build does not have yet - so this demo cannot show it happening, only report the rule. Your results are visible only to you.</p>
      <div><button type="button" className="wp-btn" onClick={onRestart}>Run again</button></div>
    </div>
  );
}

// ---------------------------------------------------------------- staff-only presenter panel

function StaffPanel({ s }) {
  return (
    <aside className="wp-side" aria-label="Presenter panel (staff only)">
      <h3>Presenter panel · staff demo mode (?staff=1), never shown to students</h3>
      <dl>
        <dt>Rapid Reading flash</dt><dd>{s.flash} ms</dd>
        <dt>Time in Rapid Reading</dt><dd>{fmtTime(s.timeRR)}</dd>
        <dt>Time in mixed activities</dt><dd>{fmtTime(s.timeMix)}</dd>
        <dt>Marked by</dt><dd>Code, exact letter match</dd>
      </dl>
      <div style={{ maxHeight: 220, overflow: "auto" }}>
        <table><thead><tr><th>#</th><th>Task</th><th>Target</th><th>Typed</th><th>Result</th></tr></thead>
          <tbody>{s.log.slice(-30).map((r) => <tr key={r.n}><td>{r.n}</td><td>{r.task}</td><td>{r.target}</td><td>{r.typed}</td><td>{r.ok ? "Correct" : "Wrong"}</td></tr>)}</tbody>
        </table>
      </div>
    </aside>
  );
}
