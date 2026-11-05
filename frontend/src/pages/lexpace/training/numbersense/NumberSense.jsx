import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as E from "./engine.js";
import * as CFG from "./config.js";
import "./numbersense.css";

// Number Sense Practice - phase 1: the training itself (items, marking, adaptation, repair,
// placement, session flow), reachable from the app, built to the spec's design exactly.
//
// Deliberately NOT yet wired up in this pass (left for a later, explicitly agreed step):
//   - real student identity / cross-session persistence - session state lives in memory only
//     and resets on reload, same as the prototype;
//   - the maths-anxiety check (needs permission to use the AMAS instrument first);
//   - the before-term AI preparation pipeline (flow 2a) - course profile/items below are the
//     prototype's own placeholder data, clearly flagged, not real course content;
//   - the real ~15-minute adaptive placement algorithm - kept as the prototype's 6-item demo
//     version, since the real algorithm is an open decision (spec section 8), not something
//     this module should invent on its own.
// Everything else (item generation, the four tasks, the adaptation/staircase rule, the error
// library and repair, the three-views feedback, time-based sessions) is built to spec.

const PLACE_TYPES = ["dec", "pct", "frac1", "frac2", "neg", "big"];
const PLACE_TASKS = ["line", "convert", "compare", "line", "compare", "compare"];

function weightedPick(ids) {
  const pool = [];
  ids.forEach((id) => { const p = E.PLACEHOLDER_PROFILE[id]?.p || "Low"; for (let k = 0; k < CFG.PRIORITY_WEIGHTS[p]; k++) pool.push(id); });
  return E.pick(pool);
}

function courseEligible(passed) {
  const order = ["pct", "dec", "whole"];
  return order.find((id) => passed.includes(id)) || null;
}
function courseItem(id) {
  const c = E.PLACEHOLDER_COURSE[id];
  return { type: id, task: "line", kind: "line", prompt: c.q, show: c.show, target: c.target, line: c.line, nums: [{ v: c.target, t: c.show + (id === "pct" ? " = " + c.target : "") }], course: true };
}

function initial() {
  return {
    phase: "intro",
    skill: E.initSkillState(),
    item: null, mode: null, stageView: "present",
    sessionStart: null, warmupsLeft: CFG.WARMUP_ITEMS, trialN: 0,
    courseShown: false, recentBugs: [], repairedAt: {}, pendingRepair: null,
    repairStep: 0,
    placementIndex: 0, placementFailAt: -1,
    log: [], lastResult: null, paused: false,
    history: [], reviewIdx: null,
  };
}

export default function NumberSense() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const staffMode = params.get("staff") === "1";
  const [s, setS] = useState(initial);
  const shownAtRef = useRef(0);
  const logNRef = useRef(0);

  function midItem() { return (s.stageView === "present" && s.item) || s.stageView === "repair" || s.stageView === "repair-feedback"; }
  function backToMenu() {
    if (midItem() && !window.confirm("Leave now? This item won't be saved.")) return;
    navigate("..");
  }
  function togglePause() {
    if (s.paused) { shownAtRef.current = performance.now(); setS((p) => ({ ...p, paused: false })); return; }
    setS((p) => ({ ...p, paused: true }));
  }
  function restartNow() {
    if (midItem() && !window.confirm("Restart from the beginning? This item won't be saved.")) return;
    restart();
  }
  function endSessionNow() {
    if (midItem() && !window.confirm("Skip the rest of this session and go straight to the end screen? This item won't be saved.")) return;
    if (s.phase === "session") { setS((p) => ({ ...p, phase: "session-end", paused: false })); return; }
    navigate("..");
  }

  function log(skillName, taskLabel, ok, rt, note) {
    logNRef.current += 1;
    setS((p) => ({ ...p, log: [...p.log, { n: logNRef.current, skillName, taskLabel, ok, rt, note }] }));
    return logNRef.current;
  }

  // ---------------------------------------------------------------- placement

  function startPlacement() {
    setS((p) => ({ ...p, phase: "placement", skill: E.initSkillState(), placementIndex: 0, placementFailAt: -1 }));
  }
  useEffect(() => {
    if (s.phase === "placement" && s.stageView === "present" && !s.item) {
      if (s.placementIndex >= PLACE_TYPES.length || s.placementFailAt >= 0) { endPlacement(); return; }
      const it = E.make(PLACE_TYPES[s.placementIndex], PLACE_TASKS[s.placementIndex]);
      shownAtRef.current = performance.now();
      setS((p) => ({ ...p, item: it, mode: "placement" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.stageView, s.item, s.placementIndex, s.placementFailAt]);

  function answerPlacement(ok) {
    const rt = performance.now() - shownAtRef.current;
    log(E.SKILLS.find((sk) => sk.id === s.item.type).name, "Placement · " + E.TASK_NAME[s.item.task], ok, rt, "");
    setS((p) => ({ ...p, item: null, placementIndex: p.placementIndex + 1, placementFailAt: !ok && p.placementFailAt < 0 ? p.placementIndex : p.placementFailAt }));
  }

  function endPlacement() {
    setS((p) => {
      const startIdx = p.placementFailAt >= 0 ? E.SKILLS.findIndex((sk) => sk.id === PLACE_TYPES[p.placementFailAt]) : E.SKILLS.length - 1;
      const status = {}, streak = {}, fails = {};
      E.SKILLS.forEach((sk, i) => { status[sk.id] = i < startIdx ? "Passed (placement)" : i === startIdx ? "Learning" : "Locked"; streak[sk.id] = 0; fails[sk.id] = 0; });
      return { ...p, phase: "placement-end", skill: { status, streak, fails, current: startIdx } };
    });
  }

  function startSession() {
    setS((p) => ({ ...p, phase: "session", sessionStart: performance.now(), warmupsLeft: CFG.WARMUP_ITEMS, trialN: 0, courseShown: false, recentBugs: [], repairedAt: {}, item: null, stageView: "present" }));
  }

  // ---------------------------------------------------------------- session loop

  useEffect(() => {
    if (s.phase === "session" && s.stageView === "present" && !s.item) presentNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.stageView, s.item]);

  function presentNext() {
    setS((p) => {
      const elapsedMin = (performance.now() - p.sessionStart) / 60000;
      if (elapsedMin >= CFG.SESSION_MINUTES) return { ...p, phase: "session-end" };

      const passed = E.passedTypes(p.skill);
      const cur = E.SKILLS[p.skill.current].id;
      let it, mode;
      if (p.warmupsLeft > 0) {
        const wt = passed.length ? weightedPick(passed) : "whole";
        it = E.make(wt, E.pick(E.TASKS)); mode = "warmup";
        shownAtRef.current = performance.now();
        return { ...p, item: it, mode, warmupsLeft: p.warmupsLeft - 1 };
      }
      if (!p.courseShown && elapsedMin >= CFG.SESSION_MINUTES / 2) {
        const cid = courseEligible(passed);
        if (cid) { it = courseItem(cid); mode = "course"; shownAtRef.current = performance.now(); return { ...p, item: it, mode, courseShown: true }; }
      }
      if (passed.length && Math.random() < CFG.REVIEW_SHARE) {
        it = E.make(weightedPick(passed), E.pick(E.TASKS)); mode = "review";
        shownAtRef.current = performance.now();
        return { ...p, item: it, mode };
      }
      const task = E.TASKS[p.trialN % 4];
      it = E.make(cur, task); mode = "skill";
      shownAtRef.current = performance.now();
      return { ...p, item: it, mode, trialN: p.trialN + 1 };
    });
  }

  // ---------------------------------------------------------------- marking + adaptation

  function finishAnswer(ok, bug, youPos) {
    const rt = performance.now() - shownAtRef.current;
    const fast = rt <= CFG.FAST_MS;
    const it = s.item, mode = s.mode;
    const sk = E.SKILLS[s.skill.current].id;
    let note = "", moved = null, nextSkillState = s.skill;

    if (mode === "skill" && it.type === sk) {
      const r = E.applyLearningAnswer(s.skill, { correct: ok, fast }, { PASS_STREAK: CFG.PASS_STREAK, BACK_FAILS: CFG.BACK_FAILS });
      nextSkillState = r.state; note = r.note; moved = r.moved;
    }

    const n = log(E.SKILLS.find((skl) => skl.id === it.type).name, it.course ? "Course item" : (mode === "placement" ? "Placement · " : "") + E.TASK_NAME[it.task], ok, rt, note);

    let recentBugs = s.recentBugs;
    if (bug) recentBugs = [...recentBugs, { bug, n }];
    recentBugs = recentBugs.filter((r) => r.n > n - CFG.REPEAT_WINDOW);

    let pendingRepair = null, repairedAt = s.repairedAt;
    if (bug && mode !== "placement") {
      const same = recentBugs.filter((r) => r.bug === bug);
      if (same.length >= CFG.REPEAT_COUNT && !(repairedAt[bug] > n - CFG.REPEAT_WINDOW)) { pendingRepair = E.repairFor(bug, it); repairedAt = { ...repairedAt, [bug]: n }; }
    }

    const result = { ok, bug, rt, youPos, moved, repairQueued: !!pendingRepair, item: it, mode };
    setS((p) => ({ ...p, skill: nextSkillState, stageView: "feedback", recentBugs, repairedAt, pendingRepair, repairStep: 0,
      lastResult: result, history: [...p.history, result] }));
  }

  // Previous/Next move through already-answered items for review (read-only - the item was
  // already marked by the adaptive engine, so revisiting it can't change your skill level);
  // Next past the last reviewed item returns to wherever the live item/feedback screen is.
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
  // Skip the current, not-yet-answered item without scoring it - it's simply discarded and a new
  // one is generated, same as not answering at all. This never touches skill/streak state, since
  // nothing was actually answered.
  function skipItem() { setS((p) => ({ ...p, item: null })); }

  function answerLine(pos) {
    if (s.stageView !== "present") return;
    const it = s.item, ln = it.line, tp = E.frac(it.target, ln);
    const ok = Math.abs(pos - tp) <= 0.05;
    let bug = null;
    if (!ok && it.rel) { const ap = E.frac(it.rel.a, ln); if (it.rel.smaller && pos > ap) bug = "times-bigger"; if (!it.rel.smaller && pos < ap) bug = "times-bigger"; }
    if (s.mode === "placement") return answerPlacement(ok);
    finishAnswer(ok, bug, pos);
  }

  function answerChoice(index) {
    if (s.stageView !== "present") return;
    const it = s.item;
    let ok, bug = null;
    if (it.kind === "compare") {
      ok = it.opts[index].v === it.correct;
      bug = it.bug && it.bug.chose != null ? (Math.abs(it.opts[index].v - it.bug.chose) < 1e-12 ? it.bug.bug : null) : it.bug && it.opts[index].v !== it.correct ? it.bug.bug : null;
    } else if (it.kind === "convert") {
      const o = it.opts[index]; ok = !!o.ok; bug = o.ok ? null : o.bug;
    } else { // dir
      ok = it.opts[index] === it.ans; bug = ok ? null : (it.info.sign ? "sign" : "times-bigger");
    }
    if (s.mode === "placement") return answerPlacement(ok);
    finishAnswer(ok, bug, null);
  }

  function continueAfterFeedback() {
    if (s.lastResult?.repairQueued) { setS((p) => ({ ...p, stageView: "repair", item: null, repairStep: 0 })); return; }
    setS((p) => ({ ...p, item: null, stageView: "present", lastResult: null }));
  }

  // ---------------------------------------------------------------- repair

  function repairAnswer(pos) {
    const rep = s.pendingRepair, n = rep.nums[s.repairStep];
    const ok = Math.abs(pos - E.frac(n.v, rep.line)) <= 0.05;
    log("Repair", rep.bug, ok, null, "");
    setS((p) => ({ ...p, stageView: "repair-feedback", lastResult: { ...p.lastResult, repairOk: ok, repairYouPos: pos, repairN: n } }));
  }
  function repairContinue() {
    setS((p) => {
      const nextStep = p.repairStep + 1;
      if (nextStep >= p.pendingRepair.nums.length) return { ...p, item: null, stageView: "present", pendingRepair: null, lastResult: null };
      return { ...p, repairStep: nextStep, stageView: "repair", lastResult: null };
    });
  }

  function restart() { logNRef.current = 0; setS(initial()); }

  // ---------------------------------------------------------------- keyboard

  useEffect(() => {
    function onKey(e) {
      if (e.repeat || s.paused || s.reviewIdx != null) return;
      if (e.code === "Space" && s.stageView === "feedback") { e.preventDefault(); continueAfterFeedback(); return; }
      if (e.code === "Space" && s.stageView === "repair-feedback") { e.preventDefault(); repairContinue(); return; }
      if (/^[1-4]$/.test(e.key) && s.stageView === "present" && s.item && s.item.kind !== "line") {
        const i = +e.key - 1; if (s.item.opts && i < s.item.opts.length) { e.preventDefault(); answerChoice(i); }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // ---------------------------------------------------------------- render

  return (
    <div className="ns">
      <div className="ns-panel">
        <Header s={s} onBack={backToMenu} />
        <div className="ns-stage">
          {s.paused ? (
            <div className="ns-intro">
              <p className="ns-lab">Paused</p>
              <h1>Session paused</h1>
              <p className="ns-msg">Nothing is running while paused. Press Resume to continue where you left off.</p>
              <div><button type="button" className="ns-btn" onClick={togglePause}>Resume</button></div>
            </div>
          ) : <>
          {s.phase === "intro" && <Intro onStart={startPlacement} />}
          {s.phase === "placement" && s.item && s.stageView === "present" && (
            <ItemView item={s.item} mode="placement" onLine={answerLine} onChoice={answerChoice} />
          )}
          {s.phase === "placement-end" && <PlacementEnd skill={s.skill} onStart={startSession} />}
          {s.phase === "session" && s.reviewIdx != null && (
            <Feedback result={s.history[s.reviewIdx]} readOnly />
          )}
          {s.phase === "session" && s.reviewIdx == null && s.item && s.stageView === "present" && (
            <ItemView item={s.item} mode={s.mode} onLine={answerLine} onChoice={answerChoice} />
          )}
          {s.phase === "session" && s.reviewIdx == null && s.stageView === "feedback" && s.lastResult && (
            <Feedback result={s.lastResult} />
          )}
          {s.phase === "session" && (s.stageView === "repair" || s.stageView === "repair-feedback") && s.pendingRepair && (
            <Repair rep={s.pendingRepair} step={s.repairStep} stageView={s.stageView} lastResult={s.lastResult}
              onAnswer={repairAnswer} onContinue={repairContinue} />
          )}
          {s.phase === "session-end" && <SessionEnd skill={s.skill} onRestart={restart} />}
          </>}
        </div>
        {!s.paused && s.phase === "session" && (s.stageView === "present" || s.stageView === "feedback") && (
          <div className="ns-nav1">
            <button type="button" className="ns-btn ns-o ns-sm" disabled={(s.reviewIdx ?? s.history.length) <= 0} onClick={goPrev}>◀ Previous</button>
            <span className="ns-stepper">Item {(s.reviewIdx ?? s.history.length) + 1}{s.reviewIdx != null && " (review)"}</span>
            <button type="button" className="ns-btn ns-sm"
              onClick={s.reviewIdx != null ? goNext : s.stageView === "feedback" ? continueAfterFeedback : skipItem}>Next ▶</button>
          </div>
        )}
        <div className="ns-sfoot">
          <span>No timer is shown. Answers are private.</span>
          {s.phase !== "intro" && (
            <div className="ns-sfoot-actions">
              <span className="ns-sfoot-lab">Session</span>
              <button type="button" className="ns-btn ns-o ns-sm" onClick={togglePause}>{s.paused ? "Resume" : "Pause"}</button>
              <button type="button" className="ns-btn ns-o ns-sm" onClick={restartNow}>Restart</button>
              <button type="button" className="ns-btn ns-o ns-sm" onClick={endSessionNow}>Skip to end</button>
            </div>
          )}
        </div>
      </div>
      {staffMode && <StaffPanel s={s} />}
    </div>
  );
}

// ---------------------------------------------------------------- header / progress

function Header({ s, onBack }) {
  const skillName = s.skill.status[E.SKILLS[s.skill.current].id] === "Learning" ? E.SKILLS[s.skill.current].name : "not set";
  const partLabel = { intro: "Start", placement: "Placement", "placement-end": "Placement complete", session: "Session", "session-end": "Session complete" }[s.phase];
  return (
    <div className="ns-shead">
      <button type="button" className="ns-btn ns-o" onClick={onBack}>← Training menu</button>
      <b>Number sense practice · Session 1 of {CFG.MIN_SESSIONS}+</b>
      <span className="ns-tag">{partLabel}</span>
      <span className="ns-tag">Skill: {skillName}</span>
    </div>
  );
}

// ---------------------------------------------------------------- intro / placement end / session end

function Intro({ onStart }) {
  return (
    <div className="ns-intro">
      <p className="ns-lab">Session 1 · Number sense practice</p>
      <h1>Getting a feel for how big numbers are</h1>
      <p className="ns-msg"><b>This is a trial/demo page.</b> The course numbers and priorities you'll see are placeholder examples, not real course content, and nothing you do here is saved between visits yet.</p>
      <p>You will place numbers on a line, compare them, switch between forms such as 0.25, 25% and 1/4, and judge the size of results. You do not need to calculate exactly.</p>
      <p className="ns-msg">There is no timer on screen and nobody else sees your answers. Sessions last {CFG.SESSION_MINUTES} minutes, 3 to 4 times a week.</p>
      <div><button type="button" className="ns-btn" onClick={onStart}>Start</button></div>
    </div>
  );
}

function PlacementEnd({ skill, onStart }) {
  const name = E.SKILLS[skill.current].name;
  return (
    <div className="ns-intro">
      <p className="ns-lab">Placement complete</p>
      <h1>Your starting point: {name}</h1>
      <p className="ns-msg">Priorities shown here are placeholder course data until the before-term preparation flow is built.</p>
      <div><button type="button" className="ns-btn" onClick={onStart}>Start the session</button></div>
    </div>
  );
}

function SessionEnd({ skill, onRestart }) {
  const sk = E.SKILLS[skill.current].id;
  return (
    <div className="ns-intro">
      <p className="ns-lab">Session complete</p>
      <h1>Session finished</h1>
      <p>Current skill: <b>{E.SKILLS[skill.current].name}</b>, {skill.streak[sk]} of {CFG.PASS_STREAK} correct and fast in a row.</p>
      <p className="ns-msg">Recommended: 3 to 4 sessions a week, at least {CFG.MIN_SESSIONS} sessions in total. Results are visible only to you. (This phase-1 build does not yet save progress between visits.)</p>
      <div><button type="button" className="ns-btn" onClick={onRestart}>Run again</button></div>
    </div>
  );
}

// ---------------------------------------------------------------- one item (line / compare / convert / dir)

const MODE_LABEL = { placement: "Placement", warmup: "Warm-up review", review: "Review", skill: null, course: "From your course" };

function ItemView({ item, mode, onLine, onChoice }) {
  const label = MODE_LABEL[mode] || E.TASK_NAME[item.task];
  return (
    <>
      <p className="ns-lab">{label}{item.course ? " · from your course" : ""}</p>
      {item.kind === "line" && <LineTask item={item} onLine={onLine} />}
      {item.kind === "compare" && <ChoiceTask item={item} options={item.opts.map((o) => o.t)} onChoice={onChoice} />}
      {item.kind === "convert" && <ConvertTask item={item} onChoice={onChoice} />}
      {item.kind === "dir" && <ChoiceTask item={item} options={item.opts} onChoice={onChoice} />}
    </>
  );
}

function LineTask({ item, onLine }) {
  return (
    <>
      <p className="ns-q">{item.prompt}</p>
      {!item.course && <div className="ns-num">{item.show}</div>}
      <NumberLine line={item.line} interactive onConfirm={onLine} />
      <p className="ns-msg">Click or drag on the line, or use the arrow keys. Then press <span className="ns-key">ENTER</span>.</p>
    </>
  );
}

function ChoiceTask({ item, options, onChoice }) {
  return (
    <>
      <p className="ns-q">{item.prompt}</p>
      <div className="ns-row">
        {options.map((t, i) => (
          <button key={i} type="button" className="ns-choice" onClick={() => onChoice(i)}>
            <span className="ns-k">{i + 1}</span>{t}
          </button>
        ))}
      </div>
      <p className="ns-msg">Press 1{options.length > 2 ? ` to ${options.length}` : " or 2"}.</p>
    </>
  );
}

function ConvertTask({ item, onChoice }) {
  return (
    <>
      <p className="ns-q">{item.prompt}</p>
      <div className="ns-num">{item.show}</div>
      <div className="ns-row">
        {item.opts.map((o, i) => (
          <button key={i} type="button" className="ns-choice" onClick={() => onChoice(i)}>
            <span className="ns-k">{i + 1}</span>{o.t}
          </button>
        ))}
      </div>
      <p className="ns-msg">Press 1 to {item.opts.length}.</p>
    </>
  );
}

// ---------------------------------------------------------------- number line widget

function NumberLine({ line, marks = [], interactive = false, onConfirm }) {
  const trackRef = useRef(null);
  const [pos, setPos] = useState(null);
  const dragging = useRef(false);

  function setFromFraction(f) { setPos(Math.max(0, Math.min(1, f))); }
  function fromEvent(e) { const r = trackRef.current.getBoundingClientRect(); setFromFraction((e.clientX - r.left) / r.width); }

  return (
    <div className="ns-nl">
      <div
        ref={trackRef}
        className="ns-track"
        tabIndex={interactive ? 0 : -1}
        role={interactive ? "slider" : undefined}
        aria-label={interactive ? `Number line from ${line.labels[0]} to ${line.labels[2]}. Use left and right arrow keys, then Enter.` : undefined}
        style={{ position: "relative", height: 44, cursor: interactive ? "crosshair" : "default" }}
        onPointerDown={interactive ? (e) => { dragging.current = true; trackRef.current.setPointerCapture(e.pointerId); fromEvent(e); } : undefined}
        onPointerMove={interactive ? (e) => { if (dragging.current) fromEvent(e); } : undefined}
        onPointerUp={interactive ? () => { dragging.current = false; } : undefined}
        onKeyDown={interactive ? (e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setFromFraction((pos == null ? 0.5 : pos) + (e.key === "ArrowRight" ? 0.005 : -0.005)); }
          else if (e.key === "Enter" && pos != null) { e.preventDefault(); onConfirm(pos); }
        } : undefined}
      >
        <div className="ns-axis" />
        {[0, 0.5, 1].map((p, i) => (
          <Fragment key={i}>
            <div className="ns-tick" style={{ left: p * 100 + "%" }} />
            <div className="ns-tl" style={{ left: p * 100 + "%" }}>{line.labels[i]}</div>
          </Fragment>
        ))}
        {marks.map((m, i) => (
          <Fragment key={i}>
            <div className={"ns-mk" + (m.you ? " is-you" : "")} style={{ left: m.p * 100 + "%" }} />
            {m.cap && <div className="ns-cap" style={{ left: m.p * 100 + "%" }}>{m.cap}</div>}
          </Fragment>
        ))}
        {interactive && pos != null && <div className="ns-mk is-you" style={{ left: pos * 100 + "%" }} />}
      </div>
      {interactive && (
        <button type="button" className="ns-btn" style={{ marginTop: 22 }} disabled={pos == null} onClick={() => onConfirm(pos)}>Confirm</button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- feedback (three views)

function ThreeViews({ nums, line, youPos }) {
  const marks = nums.map((n) => ({ p: E.frac(n.v, line), cap: n.t.length < 18 ? n.t : null }));
  if (youPos != null) marks.push({ p: youPos, you: true });
  return (
    <>
      <div className="ns-views">
        <div className="ns-vw"><h4>Written out</h4><div className="ns-f">{nums.map((n) => E.writtenForms(n.v, line, n.t)).join(" · ")}</div></div>
        <div className="ns-vw"><h4>As a part</h4>
          {nums.map((n, i) => { const b = E.partOf(n.v, line); return (
            <div key={i}>
              <div className={"ns-pbar" + (b.negative ? " is-neg" : "")}><i style={b.negative ? { [n.v < 0 ? "right" : "left"]: "50%", width: b.fill * 50 + "%" } : { left: 0, width: b.fill * 100 + "%" }} /></div>
              <div className="ns-msg" style={{ fontSize: 12 }}>{b.caption}</div>
            </div>
          ); })}
        </div>
        <div className="ns-vw"><h4>On the number line</h4><div className="ns-msg" style={{ fontSize: 12 }}>Black = correct{youPos != null ? ", grey = yours" : ""}</div></div>
      </div>
      <NumberLine line={line} marks={marks} />
    </>
  );
}

function Feedback({ result, readOnly }) {
  const { ok, moved, item, mode, youPos } = result;
  return (
    <div>
      {readOnly && <p className="ns-lab">Reviewing a previous item (read-only)</p>}
      <div className="ns-res">{ok ? "Correct" : "Not correct"}</div>
      {mode !== "placement" && <ThreeViews nums={item.nums} line={item.line} youPos={youPos} />}
      {moved && <p className="ns-msg"><b>{moved.direction === "forward" ? "Skill passed. Next skill: " + moved.skill + "." : "Several wrong in a row. Moving back to " + moved.skill + " for now."}</b></p>}
      {result.repairQueued && <p className="ns-msg">This kind of error came up more than once, so a short repair task comes next.</p>}
      <p className="ns-msg">Press Next below (or Space) to continue.</p>
    </div>
  );
}

// ---------------------------------------------------------------- error repair

function Repair({ rep, step, stageView, lastResult, onAnswer, onContinue }) {
  const n = rep.nums[step];
  if (stageView === "repair-feedback") {
    return (
      <div>
        <div className="ns-res">{lastResult.repairOk ? "Correct" : "Not quite"}</div>
        <NumberLine line={rep.line} marks={[{ p: E.frac(n.v, rep.line), cap: n.t.split(" = ")[0] }, { p: lastResult.repairYouPos, you: true }]} />
        <button type="button" className="ns-btn" onClick={onContinue}>Continue (Space)</button>
      </div>
    );
  }
  return (
    <div>
      <p className="ns-lab">Error repair</p>
      <div className="ns-repair">{E.BUG_TEXT[rep.bug]}</div>
      <p className="ns-q">Place this number on the line</p>
      <div className="ns-num">{n.t.split(" = ")[0]}</div>
      <NumberLine line={rep.line} interactive onConfirm={onAnswer} />
      <p className="ns-msg">Click or use the arrow keys, then press <span className="ns-key">ENTER</span>.</p>
    </div>
  );
}

// ---------------------------------------------------------------- staff-only presenter panel

function StaffPanel({ s }) {
  return (
    <aside className="ns-side" aria-label="Presenter panel (staff only)">
      <h3>Presenter panel · staff demo mode (?staff=1), never shown to students</h3>
      <div>
        <p>Course number profile (placeholder - pending the before-term preparation flow)</p>
        <table><thead><tr><th>Number type</th><th>Found</th><th>Priority</th></tr></thead>
          <tbody>{E.SKILLS.map((sk) => { const p = E.PLACEHOLDER_PROFILE[sk.id]; return <tr key={sk.id}><td>{sk.name}</td><td>{p.n}</td><td>{p.p}</td></tr>; })}</tbody>
        </table>
      </div>
      <div>
        <p>Skill network</p>
        <table><thead><tr><th>Skill</th><th>Status</th><th>In a row</th></tr></thead>
          <tbody>{E.SKILLS.map((sk, i) => <tr key={sk.id}><td>{sk.name}</td><td>{s.skill.status[sk.id]}</td><td>{s.skill.status[sk.id] === "Learning" ? `${s.skill.streak[sk.id]} of ${CFG.PASS_STREAK}` : "–"}</td></tr>)}</tbody>
        </table>
      </div>
      <div style={{ maxHeight: 220, overflow: "auto" }}>
        <table><thead><tr><th>#</th><th>Skill</th><th>Task</th><th>Result</th><th>Time</th></tr></thead>
          <tbody>{s.log.slice(-30).map((r) => <tr key={r.n}><td>{r.n}</td><td>{r.skillName}</td><td>{r.taskLabel}</td><td>{r.ok ? "Correct" : "Wrong"}{r.note ? " · " + r.note : ""}</td><td>{r.rt != null ? (r.rt / 1000).toFixed(1) + " s" : "–"}</td></tr>)}</tbody>
        </table>
      </div>
    </aside>
  );
}
