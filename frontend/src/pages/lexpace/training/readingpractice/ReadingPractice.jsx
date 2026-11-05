import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as CFG from "./config.js";
import * as E from "./engine.js";
import { BASELINE, BASELINE_EXTRA, PRACTICE, TRAINING, TRAINING_RESERVE } from "./bank.js";
import "./readingpractice.css";

// Reading Practice - a standalone fork of Reading Fluency Practice (same folder structure,
// copied on purpose rather than shared) so the original stays exactly as built to the research
// spec, while this copy can evolve with product/UX changes that the spec didn't call for:
//   - the "+" fixation point is replaced with an empty box + a start marker at its left edge,
//     so it's obvious where the sentence will appear while still pinning the eye to one exact
//     spot (see startbox/startmark in the CSS and ReadyScreen below);
//   - "Back to Training menu" (header) and "End session" (footer) are available at any time,
//     with a confirm step if something is actively in progress;
//   - Pause keeps its original meaning (stops the current sentence, which then doesn't count -
//     this is deliberate: it keeps the timing data clean rather than trying to freeze and
//     resume the erasure animation mid-flight, which is more complex for little real benefit).
// Everything else (timing engine, staircase, cancellation rules, two separate sessions) is
// identical to the original - see readingfluency/ReadingFluency.jsx for that version's own
// notes. Keep both in sync manually if the underlying protocol logic ever changes.

const GROUPS = {
  0: [{ key: "practice0", phase: "practice", bank: PRACTICE, extra: [], erase: false },
      { key: "baseline", phase: "baseline", bank: BASELINE, extra: BASELINE_EXTRA, erase: false }],
  1: [{ key: "practice1", phase: "practice", bank: PRACTICE, extra: [], erase: false },
      { key: "training", phase: "training", bank: TRAINING, extra: TRAINING_RESERVE, erase: true }],
};

function phaseName(p) { return p === "practice" ? "Practice" : p === "baseline" ? "Starting pace" : "Training"; }

function initial() {
  return {
    screen: "group-intro", session: 0, groupIdx: 0,
    queue: GROUPS[0][0].bank.slice(), extraQueue: GROUPS[0][0].extra.slice(),
    cur: null, trial: null,
    rate: null, streak: 0,
    baselineTrials: [], done: 0, paused: false,
    log: [], logN: { practice: 0, baseline: 0, training: 0 },
    lastResult: null,
    history: [], reviewIdx: null,
  };
}

export default function ReadingPractice() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const staffMode = params.get("staff") === "1";
  const [s, setS] = useState(initial);
  const group = GROUPS[s.session][s.groupIdx];
  const requestEndRef = useRef(null);
  const waitTimerRef = useRef(null);
  const idleTimerRef = useRef(null);

  function appendLog(entry) { setS((p) => ({ ...p, log: [...p.log, entry] })); }

  // ---------------------------------------------------------------- group transitions

  function startGroup(session, groupIdx) {
    const g = GROUPS[session][groupIdx];
    // Session 1's practice warm-up skips its own intro screen and goes straight into the first
    // practice sentence - the student already saw the full "how this works" explanation in
    // Session 0, so a second click-through screen saying the same thing again is just friction.
    // Session 0's practice intro and Session 1's training intro (new content: the text now
    // erases) both still show, since those aren't repeats.
    const skipIntro = session === 1 && groupIdx === 0;
    setS((p) => ({ ...p, session, groupIdx, screen: skipIntro ? "ready" : "group-intro", cur: null, queue: g.bank.slice(), extraQueue: g.extra.slice(), done: 0, streak: g.phase === "training" ? 0 : p.streak }));
  }

  function beginGroupTrials() { setS((p) => ({ ...p, screen: "ready" })); }

  function endGroup() {
    const g = GROUPS[s.session][s.groupIdx];
    if (g.phase === "baseline") {
      const pace = E.computeStartingPace(s.baselineTrials, CFG);
      if (!pace || pace.validCount < CFG.SESSION_0_BASELINE_TARGET - 4) {
        if (s.extraQueue.length) { setS((p) => ({ ...p, queue: [p.extraQueue[0]], extraQueue: p.extraQueue.slice(1), screen: "ready" })); return; }
        setS((p) => ({ ...p, screen: "not-enough" }));
        return;
      }
      setS((p) => ({ ...p, rate: pace.rate, screen: "session0-end" }));
      return;
    }
    if (g.phase === "training") { setS((p) => ({ ...p, screen: "session-end" })); return; }
    // practice group finished -> move straight into the next group in this session
    const nextIdx = s.groupIdx + 1;
    startGroup(s.session, nextIdx);
  }

  function goToSession1() { startGroup(1, 0); }
  function restart() { setS(initial()); }

  // ---------------------------------------------------------------- leaving: back to menu / end session
  // Available at any time, per the product decision to not trap a student in a timed exercise.
  // Both currently lead to the same place, since there's no saved progress yet to distinguish
  // "step away" from "stop for good" - once persistence exists, "back to menu" could preserve
  // where you were and "end session" could discard it.

  function midTrial() { return ["read", "wait", "q"].includes(s.screen); }
  function backToMenu() {
    if (midTrial() && !window.confirm("Leave now? This sentence won't be saved.")) return;
    navigate("..");
  }
  function endSessionNow() {
    const msg = midTrial() ? "Skip the rest of this session and go straight to the end screen? This sentence won't be saved." : "Skip the rest of this session and go straight to the end screen?";
    if (!window.confirm(msg)) return;
    if (s.session === 0) {
      const pace = E.computeStartingPace(s.baselineTrials, CFG);
      setS((p) => ({ ...p, rate: pace ? pace.rate : p.rate, screen: "session0-end", paused: false }));
      return;
    }
    setS((p) => ({ ...p, screen: "session-end", paused: false }));
  }

  // ---------------------------------------------------------------- one trial

  function nextTrial() {
    setS((p) => {
      if (p.paused) return p;
      if (!p.queue.length) return p; // caller checks queue.length before calling nextTrial
      const cur = p.queue[0];
      const trial = { it: cur, phase: group.phase, rate: p.rate, opts: E.shuffleOptions(cur), valid: true };
      return { ...p, cur, trial, queue: p.queue.slice(1), screen: "ready" };
    });
  }

  useEffect(() => {
    if (s.screen !== "ready" || s.paused) return;
    if (!s.cur && s.queue.length) nextTrial();
    else if (!s.cur && !s.queue.length) endGroup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.screen, s.cur, s.queue.length, s.paused]);

  function pressReady() {
    if (s.screen !== "ready" || s.paused) return;
    setS((p) => ({ ...p, screen: "wait" }));
    waitTimerRef.current = setTimeout(() => setS((p) => ({ ...p, screen: "read" })), CFG.START_DELAY_MS);
  }

  // Skip the sentence that's queued up but hasn't started yet - it's simply dropped (not counted
  // either way) and the next one is pulled in, same as not reading it at all.
  function skipTrial() {
    if (s.screen !== "ready" || s.paused) return;
    setS((p) => ({ ...p, cur: null, trial: null }));
  }

  function onReadComplete({ reason, rt, charsErased, totalChars }) {
    clearTimeout(idleTimerRef.current);
    const perChar = E.perCharMs(rt, totalChars);
    setS((p) => ({ ...p, trial: { ...p.trial, end: reason, rt, erased: charsErased, n: totalChars, perChar }, screen: "q" }));
  }

  function onFreeze() {
    clearTimeout(idleTimerRef.current);
    invalidate("The screen froze for a moment.");
  }

  useEffect(() => {
    if (s.screen !== "read" || group.erase) return; // inactivity guard: non-erase phases only
    idleTimerRef.current = setTimeout(() => invalidate("No key was pressed for 20 seconds."), CFG.INACTIVITY_MS);
    return () => clearTimeout(idleTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.screen, s.cur]);

  function invalidate(reason) {
    if (s.screen !== "read" && s.screen !== "wait") return;
    clearTimeout(waitTimerRef.current); clearTimeout(idleTimerRef.current);
    const trial = { ...s.trial, valid: false };
    setS((p) => {
      const baselineTrials = group.phase === "baseline" ? [...p.baselineTrials, trial] : p.baselineTrials;
      let extraQueue = p.extraQueue;
      let queue = p.queue;
      if (group.phase === "training" && extraQueue.length) { queue = [extraQueue[0], ...queue]; extraQueue = extraQueue.slice(1); }
      return { ...p, trial, baselineTrials, extraQueue, queue, screen: "cancelled", cur: null };
    });
    logTrial(trial, reason, false);
  }

  function resumeAfterCancel() { setS((p) => ({ ...p, screen: "ready" })); }

  // ---------------------------------------------------------------- answering

  function answer(index) {
    if (s.screen !== "q") return;
    const ok = s.trial.opts[index].ok;
    const trial = { ...s.trial, ok };
    let rate = s.rate, streak = s.streak, note = "", dotsFilled = 0, sped = false, slowed = false;

    if (group.phase === "practice") note = "Practice only. Nothing is recorded.";
    else if (group.phase === "baseline") note = ok ? "The text stays on screen in this part." : "This sentence will not be used for your starting pace.";
    else {
      const r = E.applyStaircase(rate, streak, ok, CFG);
      rate = r.rate; streak = r.streak; dotsFilled = r.dotsFilled; sped = r.sped; slowed = r.slowed;
      note = sped ? "3 correct in a row. The text now disappears 2 ms per letter faster." : slowed ? "The text now disappears 2 ms per letter slower." : (streak === 1 ? "Two more" : "One more") + " correct in a row and the text speeds up.";
    }

    const result = { ok, note, dotsFilled: group.phase === "training" ? dotsFilled : null };
    setS((p) => {
      const baselineTrials = group.phase === "baseline" ? [...p.baselineTrials, trial] : p.baselineTrials;
      return { ...p, trial, rate, streak, baselineTrials, done: p.done + 1, screen: "fb", cur: null,
        lastResult: result, history: [...p.history, result] };
    });
    logTrial(trial, trial.end, ok);
  }

  // Previous/Next move through already-answered sentences for review (read-only, and never
  // during a running trial - this only appears on the "ready" and "fb" screens, between trials,
  // so it can't interrupt the timed reading or comprehension-question stages).
  function goPrev() {
    setS((p) => {
      const at = p.reviewIdx ?? p.history.length;
      if (at <= 0) return p;
      return { ...p, reviewIdx: at - 1 };
    });
  }
  function goNext() {
    setS((p) => {
      if (p.reviewIdx == null) return p;
      if (p.reviewIdx + 1 < p.history.length) return { ...p, reviewIdx: p.reviewIdx + 1 };
      return { ...p, reviewIdx: null };
    });
  }

  function logTrial(trial, endReason, ok) {
    const p = trial.phase;
    setS((prev) => {
      const n = prev.logN[p] + 1;
      const id = (p === "practice" ? "P" : p === "baseline" ? "S" : "T") + n;
      const counts = p === "practice" ? "No, practice" : !trial.valid ? "No, cancelled" : p === "baseline" ? (ok ? "Yes" : "No, wrong") : "Yes";
      return { ...prev, logN: { ...prev.logN, [p]: n }, log: [...prev.log, { id, perChar: trial.perChar, ok: trial.valid ? ok : null, counts }] };
    });
  }

  function continueAfterFeedback() { setS((p) => ({ ...p, screen: "ready", trial: null, lastResult: null })); }

  // ---------------------------------------------------------------- pause (works only between trials)

  function togglePause() {
    if (s.screen === "read" || s.screen === "wait") { invalidate("You paused during a sentence."); return; }
    if (s.screen === "group-intro" || s.screen === "cancelled" || s.screen === "session0-end" || s.screen === "session-end" || s.screen === "not-enough") return;
    setS((p) => ({ ...p, paused: !p.paused }));
  }

  // ---------------------------------------------------------------- cancellation: focus/visibility/resize
  // Spec section 1: a trial is cancelled if the page loses visibility or focus, or the window
  // is resized. Re-registered every render (cheap) so `invalidate` always closes over current
  // state, same approach as the keyboard listener below.

  useEffect(() => {
    function onVisibility() { if (document.hidden) invalidate("You left the page during a sentence."); }
    function onBlur() { invalidate("You switched away from the page during a sentence."); }
    function onResize() { invalidate("The window changed size during a sentence."); }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
    };
  });

  // ---------------------------------------------------------------- keyboard

  useEffect(() => {
    function onKey(e) {
      if (e.repeat || s.reviewIdx != null) return;
      const space = e.code === "Space";
      if (space) e.preventDefault();
      if (s.screen === "read" && space) { requestEndRef.current?.(); return; }
      if (s.screen === "q") { const m = /^(Digit|Numpad)([1-4])$/.exec(e.code); if (m) { e.preventDefault(); answer(+m[2] - 1); } return; }
      if (space && !s.paused) {
        if (s.screen === "ready") pressReady();
        else if (s.screen === "fb") continueAfterFeedback();
        else if (s.screen === "cancelled") resumeAfterCancel();
        else if (s.screen === "session0-end") goToSession1();
        else if (s.screen === "group-intro") beginGroupTrials();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // ---------------------------------------------------------------- render

  const tot = group.bank.length;
  const counterLabel = group.phase === "practice" ? "Practice " : group.phase === "baseline" ? "Starting pace " : "Sentence ";
  const n = s.done + (["ready", "wait", "read", "q", "fb"].includes(s.screen) ? 1 : 0);

  return (
    <div className="rf">
      <div className="rf-panel">
        <div className="rf-shead">
          <button type="button" className="rf-btn rf-o rf-sm" onClick={backToMenu}>← Training menu</button>
          <b>Reading practice · Session {s.session === 0 ? "0" : "1"} of 24</b>
          <span className={"rf-tag" + (group.phase === "training" ? " is-f" : "")}>{phaseName(group.phase)}</span>
          <span className="rf-tag">{s.rate == null ? "Pace: not set yet" : `Pace: ${s.rate} ms per letter`}</span>
          <span className="rf-sp" />
          <span className="rf-count">{counterLabel}{n}{n > tot ? " (extra)" : ` of ${tot}`}</span>
        </div>
        <div className="rf-progress"><i style={{ width: Math.min(100, (s.done / tot) * 100) + "%" }} /></div>
        <div className="rf-stage">
          {s.reviewIdx != null && <Feedback result={s.history[s.reviewIdx]} readOnly />}
          {s.reviewIdx == null && s.screen === "group-intro" && <GroupIntro session={s.session} group={group} rate={s.rate} onStart={beginGroupTrials} />}
          {s.reviewIdx == null && (s.screen === "ready" || s.screen === "wait") && s.cur && <ReadyScreen screen={s.screen} cur={s.cur} group={group} onReady={pressReady} />}
          {s.reviewIdx == null && s.screen === "read" && s.cur && (
            <>
              <p className="rf-lab">{group.erase ? "Read silently. The text disappears from the left." : "Read silently at your normal pace. The text stays on screen."}</p>
              <Sentence text={s.cur.s} erase={group.erase} rate={s.rate} onComplete={onReadComplete} onFreeze={onFreeze} requestEndRef={requestEndRef} />
              <p className="rf-msg">Press <span className="rf-key">SPACE</span> as soon as you finish reading</p>
            </>
          )}
          {s.reviewIdx == null && s.screen === "q" && s.cur && <Question cur={s.cur} opts={s.trial.opts} onAnswer={answer} />}
          {s.reviewIdx == null && s.screen === "fb" && s.lastResult && <Feedback result={s.lastResult} />}
          {s.reviewIdx == null && s.screen === "cancelled" && <Cancelled reason={s.trial?.end} onContinue={resumeAfterCancel} />}
          {s.reviewIdx == null && s.screen === "not-enough" && <NotEnough valid={E.computeStartingPace(s.baselineTrials, CFG)?.validCount || 0} onRestart={restart} />}
          {s.reviewIdx == null && s.screen === "session0-end" && <Session0End rate={s.rate} onContinue={goToSession1} />}
          {s.reviewIdx == null && s.screen === "session-end" && <SessionEnd rate={s.rate} onRestart={restart} />}
        </div>
        {!s.paused && (s.screen === "ready" || s.screen === "fb") && (
          <div className="rf-nav1">
            <button type="button" className="rf-btn rf-o rf-sm" disabled={(s.reviewIdx ?? s.history.length) <= 0} onClick={goPrev}>◀ Previous</button>
            <span className="rf-stepper">Sentence {(s.reviewIdx ?? s.history.length) + 1}{s.reviewIdx != null && " (review)"}</span>
            <button type="button" className="rf-btn rf-sm"
              onClick={s.reviewIdx != null ? goNext : s.screen === "fb" ? continueAfterFeedback : skipTrial}>Next ▶</button>
          </div>
        )}
        <div className="rf-sfoot">
          <span>Sentences are placeholder course material until the before-term preparation flow is built.</span>
          {!(s.session === 0 && s.groupIdx === 0 && s.screen === "group-intro") && (
            <div className="rf-sfoot-actions">
              <span className="rf-sfoot-lab">Session</span>
              <button type="button" className="rf-btn rf-o rf-sm" onClick={togglePause}>{s.paused ? "Resume" : "Pause"}</button>
              <button type="button" className="rf-btn rf-o rf-sm" onClick={() => { if (!midTrial() || window.confirm("Restart from the beginning? This sentence won't be saved.")) restart(); }}>Restart</button>
              <button type="button" className="rf-btn rf-o rf-sm" onClick={endSessionNow}>Skip to end</button>
            </div>
          )}
        </div>
      </div>
      {staffMode && <StaffPanel s={s} group={group} />}
    </div>
  );
}

// ---------------------------------------------------------------- the timed sentence (imperative rAF loop)

function Sentence({ text, erase, rate, onComplete, onFreeze, requestEndRef }) {
  const containerRef = useRef(null);
  const chars = Array.from(text);
  const n = chars.length;

  useEffect(() => {
    let done = false, rafId = null, t0 = null, last = null, erased = 0;
    const el = containerRef.current;

    function finish(reason, rt) {
      if (done) return;
      done = true;
      cancelAnimationFrame(rafId);
      onComplete({ reason, rt, charsErased: erased, totalChars: n });
    }

    function frame(ts) {
      if (done) return;
      if (t0 === null) {
        t0 = ts; last = ts;
        if (el) el.style.visibility = "visible"; // first painted frame: reveal (never before t=0)
        rafId = requestAnimationFrame(frame);
        return;
      }
      if (ts - last > CFG.FREEZE_MS) { done = true; cancelAnimationFrame(rafId); onFreeze(); return; }
      last = ts;
      if (erase) {
        const elapsed = ts - t0;
        const target = Math.min(n, Math.floor(elapsed / rate));
        const kids = el?.children;
        while (erased < target) { if (kids && kids[erased]) kids[erased].className = "rf-e"; erased++; }
        if (erased >= n) { finish("Fully erased", elapsed); return; }
      }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    requestEndRef.current = () => { if (!done && t0 != null) finish("Space / Done", performance.now() - t0); };

    return () => { done = true; cancelAnimationFrame(rafId); requestEndRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, erase, rate]);

  return (
    <div className="rf-sentence rf-startbox" ref={containerRef} style={{ visibility: "hidden" }}>
      {chars.map((ch, i) => <span key={i}>{ch}</span>)}
    </div>
  );
}

// ---------------------------------------------------------------- screens

function GroupIntro({ session, group, rate, onStart }) {
  if (group.phase === "practice" && session === 0) {
    return (
      <div className="rf-intro">
        <p className="rf-lab">Session 0 · Before you start</p>
        <h1>Warm up with 2 practice sentences</h1>
        <ol>
          <li>Rest one hand on <span className="rf-key">SPACE</span>. You will not need the mouse.</li>
          <li>An empty box shows where the sentence will appear, with a <b>+</b> marking exactly where it starts. Look at it and press <span className="rf-key">SPACE</span> when you are ready.</li>
          <li>Half a second later the sentence appears. Read it silently and press <span className="rf-key">SPACE</span> as soon as you finish.</li>
          <li>Answer with keys <span className="rf-key">1</span> to <span className="rf-key">4</span>, then press <span className="rf-key">SPACE</span> to continue.</li>
        </ol>
        <p className="rf-msg">Practice sentences never count. Your results are visible only to you. This is timed visual reading training - it does not work with a screen reader; contact SAS if that affects you.</p>
        <div><button type="button" className="rf-btn" onClick={onStart}>Start practice</button></div>
      </div>
    );
  }
  if (group.phase === "practice" && session === 1) {
    return (
      <div className="rf-intro">
        <p className="rf-lab">Session 1 · Before you start</p>
        <h1>Warm up with 2 practice sentences</h1>
        <p>Same as before: look at the box, press <span className="rf-key">SPACE</span>, read, press <span className="rf-key">SPACE</span>.</p>
        <p className="rf-msg">Practice sentences never count.</p>
        <div><button type="button" className="rf-btn" onClick={onStart}>Start practice</button></div>
      </div>
    );
  }
  if (group.phase === "baseline") {
    return (
      <div className="rf-intro">
        <p className="rf-lab">Part 1 of 2</p>
        <h1>Find your starting pace</h1>
        <p>Read 12 sentences at your normal pace. Each one starts the same way: look at the box, press <span className="rf-key">SPACE</span>, read, press <span className="rf-key">SPACE</span>. The text stays on screen. There is no time limit and no score.</p>
        <p className="rf-msg">The tool measures your average time per letter on sentences you answer correctly. Training then starts from that pace.</p>
        <div><button type="button" className="rf-btn" onClick={onStart}>Start part 1</button></div>
      </div>
    );
  }
  return (
    <div className="rf-intro">
      <p className="rf-lab">Part 2 of 2</p>
      <h1>Training</h1>
      <p>From now on the sentence starts disappearing letter by letter, from the left, as soon as it appears. It begins at your own pace of <b>{rate} ms per letter</b>.</p>
      <p className="rf-msg">3 correct answers in a row make the text a little faster. A wrong answer makes it a little slower. Press SPACE as soon as you finish reading, even if the text has not fully disappeared.</p>
      <div><button type="button" className="rf-btn" onClick={onStart}>Start part 2</button></div>
    </div>
  );
}

function ReadyScreen({ screen, cur, group, onReady }) {
  return (
    <>
      <p className="rf-lab">{group.erase ? "Read silently. The text disappears from the left." : "Read silently at your normal pace. The text stays on screen."}</p>
      <div className="rf-sentence rf-startbox is-empty" aria-hidden="true"><span className="rf-startmark">+</span></div>
      {screen === "ready" ? (
        <>
          <p className="rf-msg">The sentence will appear in this box, starting where the <b>+</b> is. Press <span className="rf-key">SPACE</span> when you are ready.</p>
          <button type="button" className="rf-btn rf-o" onClick={onReady}>Ready</button>
        </>
      ) : <p className="rf-msg">&nbsp;</p>}
    </>
  );
}

function Question({ cur, opts, onAnswer }) {
  return (
    <div className="rf-q">
      <p className="rf-lab">Question about the sentence you just read · press 1 to 4</p>
      <h2>{cur.q}</h2>
      {opts.map((o, j) => (
        <button key={j} type="button" className="rf-opt" onClick={() => onAnswer(j)}>
          <span className="rf-k">{j + 1}</span>{o.t}
        </button>
      ))}
    </div>
  );
}

function Feedback({ result, readOnly }) {
  const { ok, note, dotsFilled } = result;
  const icon = ok ? "Correct" : "Not correct";
  return (
    <div className="rf-q">
      {readOnly && <p className="rf-lab">Reviewing a previous sentence (read-only)</p>}
      <div className="rf-fb">
        <span className="rf-res">{icon}</span>
        {dotsFilled != null && (
          <span className="rf-dots" aria-label="Correct in a row">
            {[0, 1, 2].map((k) => <i key={k} className={k < dotsFilled ? "is-d" : ""} />)}
          </span>
        )}
        <span className="rf-msg">{note}</span>
      </div>
      <p className="rf-msg">Press Next below (or Space) to continue.</p>
    </div>
  );
}

function Cancelled({ reason, onContinue }) {
  return (
    <div className="rf-intro">
      <p className="rf-lab">Sentence cancelled</p>
      <h1>This sentence was stopped</h1>
      <p className="rf-msg">{reason} It does not count, your pace has not changed, and this sentence will not be shown again.</p>
      <div><button type="button" className="rf-btn" onClick={onContinue}>Continue (Space)</button></div>
    </div>
  );
}

function NotEnough({ valid, onRestart }) {
  return (
    <div className="rf-intro">
      <p className="rf-lab">Part 1 of 2</p>
      <h1>A few more sentences are needed</h1>
      <p className="rf-msg">Only {valid} usable sentences so far, and this demo has no more spare sentences. The real tool keeps adding sentences until it has {CFG.MIN_BASELINE_VALID}. It never uses a default pace.</p>
      <div><button type="button" className="rf-btn" onClick={onRestart}>Restart demo</button></div>
    </div>
  );
}

function Session0End({ rate, onContinue }) {
  if (rate == null) {
    return (
      <div className="rf-intro">
        <p className="rf-lab">Session 0 ended early</p>
        <h1>No starting pace yet</h1>
        <p className="rf-msg">Not enough sentences were answered to calculate a starting pace, so Session 1 (which needs that pace) can't begin yet. Restart to try the full Session 0 again.</p>
      </div>
    );
  }
  return (
    <div className="rf-intro">
      <p className="rf-lab">Session 0 complete</p>
      <h1>Your starting pace</h1>
      <div className="rf-big">{rate} <span style={{ fontSize: 18 }}>ms per letter</span></div>
      <p className="rf-msg">Session 1 would normally happen on a different day (recommended: 1-3 days later). This demo lets you continue straight away.</p>
      <div><button type="button" className="rf-btn" onClick={onContinue}>Continue to Session 1 (demo)</button></div>
    </div>
  );
}

function SessionEnd({ rate, onRestart }) {
  return (
    <div className="rf-intro">
      <p className="rf-lab">Session 1 complete</p>
      <h1>Session finished</h1>
      <p>Your pace for session 2: <b>{rate} ms per letter</b>.</p>
      <p className="rf-msg">Recommended: next session in 1 to 3 days. Your results are visible only to you. (This phase-1 build does not yet save progress between visits.)</p>
      <div><button type="button" className="rf-btn" onClick={onRestart}>Run again</button></div>
    </div>
  );
}

// ---------------------------------------------------------------- staff-only presenter panel

function StaffPanel({ s, group }) {
  return (
    <aside className="rf-side" aria-label="Presenter panel (staff only)">
      <h3>Presenter panel · staff demo mode (?staff=1), never shown to students</h3>
      <p className="rf-msg">What the tool records behind the scenes. It never shows sentence text.</p>
      <dl>
        <dt>Part</dt><dd>{phaseName(group.phase)}</dd>
        <dt>Current pace</dt><dd>{s.rate == null ? "not set" : s.rate + " ms/char"}</dd>
        <dt>Correct in a row</dt><dd>{group.phase === "training" ? `${s.streak} of 3` : "–"}</dd>
        <dt>Usable starting-pace sentences</dt><dd>{E.computeStartingPace(s.baselineTrials, CFG)?.validCount || 0} of {CFG.SESSION_0_BASELINE_TARGET} needed</dd>
      </dl>
      <div style={{ maxHeight: 220, overflow: "auto" }}>
        <table><thead><tr><th>#</th><th>ms/char</th><th>Answer</th><th>Counts</th></tr></thead>
          <tbody>{s.log.slice(-30).map((r) => <tr key={r.id}><td>{r.id}</td><td>{r.perChar != null ? r.perChar.toFixed(0) : "–"}</td><td>{r.ok == null ? "–" : r.ok ? "Correct" : "Wrong"}</td><td>{r.counts}</td></tr>)}</tbody>
        </table>
      </div>
    </aside>
  );
}
