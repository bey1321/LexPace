import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  return { screen: "intro", lv: 0, ii: 0, correctCount: 0, log: [], lastResult: null };
}

export default function SentenceCombining() {
  const [params] = useSearchParams();
  const staffMode = params.get("staff") === "1";
  const [s, setS] = useState(initial);
  const logNRef = useRef(0);

  function appendLog(level, item, result) {
    logNRef.current += 1;
    setS((p) => ({ ...p, log: [...p.log, { n: logNRef.current, level, item: item.slice(0, 26) + "…", result }] }));
  }

  function startLevel(lv) { setS((p) => ({ ...p, screen: "item", lv, ii: 0, correctCount: 0 })); }

  function submitAnswer(value) {
    const item = LEVELS[s.lv].items[s.ii];
    const ok = E.markAnswer(item, value);
    appendLog(LEVELS[s.lv].name, item.k[0], ok ? "Correct" : "Not yet");
    setS((p) => ({ ...p, correctCount: p.correctCount + (ok ? 1 : 0), screen: "feedback", lastResult: { ok, item } }));
  }

  function nextItem() {
    setS((p) => {
      const ii = p.ii + 1;
      if (ii >= CFG.BLOCK_SIZE) return { ...p, screen: "level-end" };
      return { ...p, ii, screen: "item" };
    });
  }

  function levelPassed() { return s.correctCount >= CFG.PASS_MARK; }

  function proceedAfterLevel() {
    if (levelPassed() && s.lv < LEVELS.length - 1) return startLevel(s.lv + 1);
    if (levelPassed() && s.lv === LEVELS.length - 1) return setS((p) => ({ ...p, screen: "complete" }));
    startLevel(s.lv); // repeat the same level (same items - see file header)
  }

  function restart() { logNRef.current = 0; setS(initial()); }

  return (
    <div className="wp">
      <div className="wp-panel">
        <div className="wp-shead">
          <b>Sentence combining</b>
          {s.screen !== "intro" && <span className="wp-tag">{LEVELS[s.lv].name}</span>}
        </div>
        <div className="wp-progress"><i style={{ width: (s.screen === "intro" ? 0 : ((s.lv * CFG.BLOCK_SIZE + s.ii) / (LEVELS.length * CFG.BLOCK_SIZE)) * 100) + "%" }} /></div>
        <div className="wp-stage">
          {s.screen === "intro" && <Intro onStart={() => startLevel(0)} />}
          {s.screen === "item" && <ItemScreen level={LEVELS[s.lv]} index={s.ii} onSubmit={submitAnswer} />}
          {s.screen === "feedback" && <Feedback result={s.lastResult} onNext={nextItem} />}
          {s.screen === "level-end" && <LevelEnd level={LEVELS[s.lv]} lv={s.lv} correct={s.correctCount} passed={levelPassed()} isLast={s.lv === LEVELS.length - 1} onContinue={proceedAfterLevel} />}
          {s.screen === "complete" && <Complete onRestart={restart} />}
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

function Feedback({ result, onNext }) {
  const { ok, item } = result;
  return (
    <div className="wp-box">
      <div className="wp-res">{ok ? "Correct" : "Not quite"}</div>
      {!ok && (
        <>
          <p className="wp-msg">One correct version:</p>
          <div className="wp-model">{item.acc[0]}</div>
        </>
      )}
      <div className="wp-rule">{item.rule}</div>
      <div><button type="button" className="wp-btn" onClick={onNext}>Next</button></div>
    </div>
  );
}

function LevelEnd({ level, lv, correct, passed, isLast, onContinue }) {
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
          <p>You need {CFG.PASS_MARK} of {CFG.BLOCK_SIZE} to move up. You will practise this level again.</p>
          <p className="wp-msg">This demo repeats the same 5 sentences. The real tool uses new sentences, generated before term and checked, so nothing repeats.</p>
        </>
      )}
      <div><button type="button" className="wp-btn" onClick={onContinue}>{passed ? (isLast ? "Finish" : "Start the next level") : "Practise this level again"}</button></div>
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
