import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as CFG from "./config.js";
import * as E from "./engine.js";
import { LEVELS } from "./bank.js";
import "../writing.css";

// Sentence Combining - phase 1. Code-first matching against the accepted-answer list (spec
// 3b); the AI-checker fallback for unmatched answers is deferred, same as every other AI
// piece in this build - an unmatched answer is marked "not yet correct", nothing is invented
// to paper over the missing checker. Item generation (flow 3a) is also deferred, so repeating
// a level reuses the same 5 items rather than generating new ones - flagged in the UI, since
// the spec says items should never repeat once a real bank exists.

function initial() {
  return { screen: "intro", lv: 0, ii: 0, answers: Array(CFG.BLOCK_SIZE).fill(null), log: [], paused: false };
}

export default function SentenceCombining() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const staffMode = params.get("staff") === "1";
  const [s, setS] = useState(initial);
  const logNRef = useRef(0);

  function appendLog(level, item, result) {
    logNRef.current += 1;
    setS((p) => ({ ...p, log: [...p.log, { n: logNRef.current, level, item: item.slice(0, 26) + "…", result }] }));
  }

  function midItem() { return s.screen === "item" && !s.answers[s.ii]; }
  function backToMenu() {
    if (midItem() && !window.confirm("Leave now? This item won't be saved.")) return;
    navigate("../..");
  }
  function backToWriting() {
    if (midItem() && !window.confirm("Leave now? This item won't be saved.")) return;
    navigate("..");
  }
  function togglePause() { setS((p) => ({ ...p, paused: !p.paused })); }
  function restartNow() {
    if (midItem() && !window.confirm("Restart from the beginning? This item won't be saved.")) return;
    restart();
  }
  function skipToEnd() {
    if (!window.confirm("Skip the rest of this session and go straight to the end screen? " + (midItem() ? "This item won't be saved." : "Anything not yet finished won't be saved."))) return;
    setS((p) => ({ ...p, screen: "complete", paused: false }));
  }

  function startLevel(lv) { setS((p) => ({ ...p, screen: "item", lv, ii: 0, answers: Array(CFG.BLOCK_SIZE).fill(null) })); }

  function submitAnswer(value) {
    const item = LEVELS[s.lv].items[s.ii];
    const ok = E.markAnswer(item, value);
    appendLog(LEVELS[s.lv].name, item.k[0], ok ? "Correct" : "Not yet");
    setS((p) => {
      const answers = p.answers.map((a, i) => (i === p.ii ? { value, ok, item } : a));
      if (answers.every(Boolean)) return { ...p, answers, screen: "level-end" };
      return { ...p, answers, ii: Math.min(p.ii + 1, CFG.BLOCK_SIZE - 1) };
    });
  }

  function editAnswer() { setS((p) => ({ ...p, answers: p.answers.map((a, i) => (i === p.ii ? null : a)) })); }

  // Previous/Next always move freely between the 5 items in this level, whether or not they're
  // answered yet - same reasoning as the spelling test: nothing here is scored until you check
  // it, so there's no reason to block moving around first.
  function goPrev() { setS((p) => (p.ii > 0 ? { ...p, ii: p.ii - 1 } : p)); }
  function goNext() { setS((p) => (p.ii < CFG.BLOCK_SIZE - 1 ? { ...p, ii: p.ii + 1 } : p)); }

  function levelPassed() { return s.answers.filter((a) => a && a.ok).length >= CFG.PASS_MARK; }

  function proceedAfterLevel() {
    if (levelPassed() && s.lv < LEVELS.length - 1) return startLevel(s.lv + 1);
    if (levelPassed() && s.lv === LEVELS.length - 1) return setS((p) => ({ ...p, screen: "complete" }));
    startLevel(s.lv); // repeat the same level (same items - see file header)
  }

  // Lets you move on past a level you didn't pass, matching the no-mastery-gate pattern used
  // throughout SRSD - the pass mark stays as feedback, not a hard block.
  function skipLevel() {
    if (s.lv < LEVELS.length - 1) return startLevel(s.lv + 1);
    setS((p) => ({ ...p, screen: "complete" }));
  }

  function restart() { logNRef.current = 0; setS(initial()); }

  return (
    <div className="wp">
      <div className="wp-panel">
        <div className="wp-shead">
          <button type="button" className="wp-btn wp-o wp-sm" onClick={backToMenu}>← Training menu</button>
          <button type="button" className="wp-btn wp-o wp-sm" onClick={backToWriting}>Other writing trainings</button>
          <b>Sentence combining</b>
          {s.screen !== "intro" && <span className="wp-tag">{LEVELS[s.lv].name}</span>}
        </div>
        <div className="wp-progress"><i style={{ width: (s.screen === "intro" ? 0 : ((s.lv * CFG.BLOCK_SIZE + s.ii) / (LEVELS.length * CFG.BLOCK_SIZE)) * 100) + "%" }} /></div>
        <div className="wp-stage">
          {s.paused ? (
            <div className="wp-intro">
              <p className="wp-lab">Paused</p>
              <h1>Session paused</h1>
              <p className="wp-msg">Nothing is running while paused. Press Resume to continue where you left off.</p>
              <div><button type="button" className="wp-btn" onClick={togglePause}>Resume</button></div>
            </div>
          ) : <>
          {s.screen === "intro" && <Intro onStart={() => startLevel(0)} />}
          {s.screen === "item" && s.answers[s.ii] && <AnswerResult entry={s.answers[s.ii]} onEdit={editAnswer} />}
          {s.screen === "item" && !s.answers[s.ii] && <ItemScreen level={LEVELS[s.lv]} index={s.ii} onSubmit={submitAnswer} />}
          {s.screen === "level-end" && <LevelEnd level={LEVELS[s.lv]} lv={s.lv} correct={s.answers.filter((a) => a && a.ok).length} passed={levelPassed()} isLast={s.lv === LEVELS.length - 1} onContinue={proceedAfterLevel} onSkip={skipLevel} />}
          {s.screen === "complete" && <Complete onRestart={restart} />}
          </>}
        </div>
        {!s.paused && s.screen === "item" && (
          <div className="wp-nav1">
            <button type="button" className="wp-btn wp-o wp-sm" disabled={s.ii <= 0} onClick={goPrev}>◀ Previous</button>
            <span className="wp-stepper">
              {s.answers.map((a, i) => (
                <span key={i} className={"wp-dot" + (i === s.ii ? " is-now" : a ? " is-done" : "")} />
              ))}
              &nbsp;Item {s.ii + 1} of {CFG.BLOCK_SIZE}
            </span>
            <button type="button" className="wp-btn wp-sm" disabled={s.ii >= CFG.BLOCK_SIZE - 1} onClick={goNext}>Next ▶</button>
          </div>
        )}
        <div className="wp-sfoot">
          <span>This is a trial/demo page. Sentences are placeholder examples, and nothing is saved between visits yet.</span>
          {s.screen !== "intro" && (
            <div className="wp-sfoot-actions">
              <span className="wp-sfoot-lab">Session</span>
              <button type="button" className="wp-btn wp-o wp-sm" onClick={togglePause}>{s.paused ? "Resume" : "Pause"}</button>
              <button type="button" className="wp-btn wp-o wp-sm" onClick={restartNow}>Restart</button>
              <button type="button" className="wp-btn wp-o wp-sm" onClick={skipToEnd}>Skip to end</button>
            </div>
          )}
        </div>
      </div>
      {staffMode && <StaffPanel log={s.log} />}
    </div>
  );
}

function Intro({ onStart }) {
  return (
    <div className="wp-intro">
      <p className="wp-lab">Sentence combining</p>
      <h1>Sentence combining</h1>
      <p>You will join short sentences into one clear sentence. You practise grammar and punctuation by building sentences, not by learning rules on their own.</p>
      <ul>
        <li>4 levels, from simple joins to academic phrases.</li>
        <li>Levels 1 to 3 give you a joining word. Level 4 gives no hint.</li>
        <li>Reach 4 of 5 correct (80%) in a level to move up.</li>
      </ul>
      <div><button type="button" className="wp-btn" onClick={onStart}>Start level 1</button></div>
    </div>
  );
}

function ItemScreen({ level, index, onSubmit }) {
  const item = level.items[index];
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const ref = useRef(null);
  useEffect(() => { setValue(""); setError(""); ref.current?.focus(); }, [level, index]);

  function check() {
    const err = E.validateAnswer(value);
    if (err) { setError(err); return; }
    setError("");
    onSubmit(value);
  }

  return (
    <div className="wp-box">
      <p className="wp-lab">{level.name} · item {index + 1} of {CFG.BLOCK_SIZE}</p>
      <h2>Combine these into one sentence</h2>
      <div className="wp-kern">{item.k.map((l) => <div key={l}>{l}</div>)}</div>
      {item.cue ? <p>Use: <span className="wp-cue">{item.cue}</span></p> : <p className="wp-msg">No hint at this level. Choose how to join them.</p>}
      <input ref={ref} type="text" autoComplete="off" spellCheck="false" aria-label="Your combined sentence" value={value}
        onChange={(e) => { setValue(e.target.value); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); check(); } }} />
      {error && <p className="wp-err">{error}</p>}
      <div className="wp-row"><button type="button" className="wp-btn" onClick={check}>Check</button></div>
    </div>
  );
}

// The result for whichever item is currently selected (live or via Previous/Next) - the same
// view either way, since checking an answer doesn't depend on being on the "newest" item.
function AnswerResult({ entry, onEdit }) {
  const { value, ok, item } = entry;
  return (
    <div className="wp-box">
      <div className="wp-kern">{item.k.map((l) => <div key={l}>{l}</div>)}</div>
      <p className="wp-msg">Your answer:</p>
      <div className="wp-model">{value || "(left blank)"}</div>
      <div className="wp-res">{ok ? "Correct" : "Not quite"}</div>
      {!ok && (
        <>
          <p className="wp-msg">One correct version:</p>
          <div className="wp-model">{item.acc[0]}</div>
        </>
      )}
      <div className="wp-rule">{item.rule}</div>
      <div><button type="button" className="wp-btn wp-o wp-sm" onClick={onEdit}>Change my answer</button></div>
    </div>
  );
}

function LevelEnd({ level, lv, correct, passed, isLast, onContinue, onSkip }) {
  return (
    <div className="wp-box">
      <p className="wp-lab">{level.name}</p>
      {passed ? (
        <>
          <h1>{correct} of {CFG.BLOCK_SIZE} correct. Level passed.</h1>
          <p>{isLast ? "You reached the 80% threshold at level 4. Sentence combining is complete." : `Next: ${LEVELS[lv + 1].name}.`}</p>
        </>
      ) : (
        <>
          <h1>{correct} of {CFG.BLOCK_SIZE} correct</h1>
          <p>You need {CFG.PASS_MARK} of {CFG.BLOCK_SIZE} to move up - try again, or move on anyway.</p>
          <p className="wp-msg">This demo repeats the same 5 sentences. The real tool uses new sentences, generated before term and checked, so nothing repeats.</p>
        </>
      )}
      <div className="wp-row">
        <button type="button" className="wp-btn" onClick={onContinue}>{passed ? (isLast ? "Finish" : "Start the next level") : "Practise this level again"}</button>
        {!passed && <button type="button" className="wp-btn wp-o" onClick={onSkip}>{isLast ? "Finish anyway" : "Go to the next level anyway"}</button>}
      </div>
    </div>
  );
}

function Complete({ onRestart }) {
  return (
    <div className="wp-intro">
      <p className="wp-lab">Sentence combining complete</p>
      <h1>You reached level 4 at 80% or above</h1>
      <p>This doesn't unlock anything else - Planning and Organising Essays (SRSD) has been open the whole time, from the Writing Practice home page.</p>
      <div><button type="button" className="wp-btn" onClick={onRestart}>Run again</button></div>
    </div>
  );
}

function StaffPanel({ log }) {
  return (
    <aside className="wp-side" aria-label="Presenter panel (staff only)">
      <h3>Presenter panel · staff demo mode (?staff=1), never shown to students</h3>
      <div style={{ maxHeight: 260, overflow: "auto" }}>
        <table><thead><tr><th>#</th><th>Level</th><th>Item</th><th>Result</th></tr></thead>
          <tbody>{log.slice(-30).map((r) => <tr key={r.n}><td>{r.n}</td><td>{r.level}</td><td>{r.item}</td><td>{r.result}</td></tr>)}</tbody>
        </table>
      </div>
    </aside>
  );
}
