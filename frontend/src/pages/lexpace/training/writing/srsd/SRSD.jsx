import { Fragment, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as E from "./engine.js";
import { LABELS, MEM, MODEL, PARTS, PROMPTS5, QUIZ, SAMPLE, SHEETS, SHEET_NAME, STAGE4_SESSIONS_REQUIRED, STAGE5_STREAK, STAGE_NAME } from "./bank.js";
import "../writing.css";

// SRSD (Planning and Organising Essays) - phase 1. The part checker and coach are the
// prototype's own code-based stand-ins for the real AI pieces (see engine.js); the
// validation gate (spec 4c) and a real backend AI call are deferred, same as the rest of this
// build. No persistence yet, so stage 4's "twice, in separate sessions" requirement is done as
// two successful attempts within one sitting rather than across real separate days - flagged
// in the UI text rather than silently treated as equivalent.

function initial() {
  return { stageIdx: 0, chart: [], goal: "", supportLevel: 0, supportStreak: 0, stage4Passes: 0 };
}

export default function SRSD() {
  const [params] = useSearchParams();
  const staffMode = params.get("staff") === "1";
  const [s, setS] = useState(initial);

  function goToStage(idx, patch = {}) { setS((p) => ({ ...p, stageIdx: idx, ...patch })); }
  function pushChart(count) { setS((p) => ({ ...p, chart: [...p.chart, count] })); }
  function restart() { setS(initial()); }

  const stageProps = { chart: s.chart, goal: s.goal, pushChart, staffMode };

  return (
    <div className="wp">
      <div className="wp-panel">
        <div className="wp-shead">
          <b>Planning and organising essays (SRSD)</b>
          <span className="wp-tag">Stage {STAGE_NAME[s.stageIdx]}</span>
        </div>
        <div className="wp-progress"><i style={{ width: (s.stageIdx / 6) * 100 + "%" }} /></div>
        <div className="wp-stage">
          {s.stageIdx === 0 && <Stage1 onMastered={() => goToStage(1)} />}
          {s.stageIdx === 1 && <Stage2 {...stageProps} onMastered={(goal) => goToStage(2, { goal })} />}
          {s.stageIdx === 2 && <Stage3 onMastered={() => goToStage(3)} />}
          {s.stageIdx === 3 && <Stage4 stage4Passes={s.stage4Passes} onPass={() => setS((p) => {
            const passes = p.stage4Passes + 1;
            if (passes >= STAGE4_SESSIONS_REQUIRED) return { ...p, stageIdx: 4, stage4Passes: passes, supportLevel: 0, supportStreak: 0 };
            return { ...p, stage4Passes: passes };
          })} />}
          {s.stageIdx === 4 && <Stage5 {...stageProps} supportLevel={s.supportLevel} supportStreak={s.supportStreak}
            onResult={(allSix) => setS((p) => {
              const streak = allSix ? p.supportStreak + 1 : 0;
              if (streak >= STAGE5_STREAK) {
                if (p.supportLevel < 2) return { ...p, supportStreak: 0, supportLevel: p.supportLevel + 1 };
                return { ...p, stageIdx: 5, supportStreak: streak };
              }
              return { ...p, supportStreak: streak };
            })} />}
          {s.stageIdx === 5 && <Stage6 {...stageProps} onMastered={() => goToStage(6)} onBackToStage5={() => goToStage(4, { supportLevel: 1, supportStreak: 0 })} />}
          {s.stageIdx === 6 && <Complete chart={s.chart} onRestart={restart} />}
        </div>
      </div>
      {staffMode && <StaffPanel s={s} />}
    </div>
  );
}

// ---------------------------------------------------------------- shared bits

function ChartCard({ chart }) {
  if (!chart.length) return null;
  return (
    <div className="wp-card-box">
      <b>Your self-monitoring chart</b>
      <p className="wp-msg">Parts included in each essay (out of 6)</p>
      <div className="wp-chart">{chart.map((c, i) => <div key={i} style={{ height: (c / 6) * 100 + "%" }}><span>{c}</span><em>{i + 1}</em></div>)}</div>
    </div>
  );
}

function PartsChecklist({ r }) {
  return (
    <div className="wp-chk">
      {PARTS.map((p) => (
        <Fragment key={p.id}>
          <i className={r[p.id] ? "is-y" : ""}>{r[p.id] ? "✓" : ""}</i>
          <span>{p.name}{r[p.id] ? "" : " · I can't find this yet"}</span>
        </Fragment>
      ))}
    </div>
  );
}

function Coach() {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  function ask() {
    if (!q.trim()) { setA(""); return; }
    setA(E.coachAnswer(q));
  }
  return (
    <div className="wp-coach">
      <b>Ask the strategy coach</b>
      <p className="wp-msg">Ask about the steps of the strategy. The coach does not write any part of your essay.</p>
      <div className="wp-row">
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: What does the R in DARE mean?"
          aria-label="Question for the coach" style={{ flex: 1, minWidth: 200 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ask(); } }} />
        <button type="button" className="wp-btn wp-o wp-sm" onClick={ask}>Ask</button>
      </div>
      {a && <div className="wp-a">{a}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- stage 1: background knowledge

function Stage1({ onMastered }) {
  const [vals, setVals] = useState(Array(SAMPLE.length).fill(""));
  const [checked, setChecked] = useState(null);
  function check() {
    if (vals.some((v) => !v)) { setChecked("empty"); return; }
    const right = vals.filter((v, i) => v === SAMPLE[i][1]).length;
    setChecked(right);
  }
  return (
    <div className="wp-box">
      <p className="wp-lab">Stage 1 · Background knowledge</p>
      <h1>What a strong argument essay contains</h1>
      <p>An argument essay has 6 parts: a claim, reasons, evidence, the other side's argument, your answer to it, and a conclusion. Label each sentence of this short sample essay.</p>
      <p className="wp-msg">Sample essay (written for practice; the survey is invented).</p>
      {SAMPLE.map((sent, i) => (
        <div className="wp-sent" key={i}>
          <p>{i + 1}. {sent[0]}</p>
          <select aria-label={`Part for sentence ${i + 1}`} value={vals[i]} onChange={(e) => { const v = [...vals]; v[i] = e.target.value; setVals(v); }}
            style={checked != null && checked !== "empty" && vals[i] !== SAMPLE[i][1] ? { borderStyle: "dashed" } : {}}>
            <option value="">Choose…</option>
            {Object.keys(LABELS).map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}
          </select>
        </div>
      ))}
      {checked === "empty" && <p className="wp-err">Choose a label for every sentence first.</p>}
      <div><button type="button" className="wp-btn" onClick={check}>Check my labels</button></div>
      {typeof checked === "number" && (
        checked === 6 ? (
          <>
            <div className="wp-res">All 6 correct. Stage 1 mastered.</div>
            <div><button type="button" className="wp-btn" onClick={onMastered}>Go to stage 2</button></div>
          </>
        ) : (
          <>
            <div className="wp-res">{checked} of 6 correct</div>
            <p className="wp-msg">Sentences with a dashed border need another look. Change them and check again. You move on when all 6 are right.</p>
          </>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------- stage 2: discuss it

function Stage2({ chart, pushChart, onMastered }) {
  const [essay, setEssay] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // {r, c}
  const [goal, setGoal] = useState("");
  const [goalError, setGoalError] = useState("");

  function check() {
    if (essay.trim().split(/\s+/).length < 25) { setError("Write at least 25 words first."); return; }
    setError("");
    const r = E.findParts(essay);
    const c = E.countParts(r);
    pushChart(c);
    setResult({ r, c });
  }
  function saveGoal() {
    if (!goal) { setGoalError("Choose a goal first."); return; }
    onMastered(goal);
  }
  return (
    <div className="wp-box">
      <p className="wp-lab">Stage 2 · Discuss it</p>
      <h1>Write a short first argument</h1>
      <p><b>Question:</b> Should first-year students be required to take a writing course?</p>
      <p className="wp-msg">Write 5 to 8 sentences. There is no grade. This shows where you are starting from.</p>
      <textarea aria-label="Your first argument" spellCheck="false" value={essay} readOnly={!!result} onChange={(e) => setEssay(e.target.value)} />
      {error && <p className="wp-err">{error}</p>}
      {!result && <div><button type="button" className="wp-btn" onClick={check}>Compare with the checklist</button></div>}
      {result && (
        <>
          <div className="wp-card-box"><b>Checklist</b><PartsChecklist r={result.r} /></div>
          <ChartCard chart={chart} />
          <div className="wp-card-box">
            <b>Set your goal for the next essays</b>
            <select value={goal} onChange={(e) => { setGoal(e.target.value); setGoalError(""); }}>
              <option value="">Choose a goal…</option>
              <option>Include all 6 parts</option>
              <option>Include the other side and answer it</option>
              <option>Add evidence for every reason</option>
              <option>End with a clear conclusion</option>
            </select>
            {goalError && <p className="wp-err">{goalError}</p>}
          </div>
          <div><button type="button" className="wp-btn" onClick={saveGoal}>Save my goal and continue</button></div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- stage 3: model it

function Stage3({ onMastered }) {
  const [k, setK] = useState(0);
  const [quiz, setQuiz] = useState(false);
  const notes = MODEL.slice(0, k + 1).map((m) => m.n).filter(Boolean);
  const essay = MODEL.slice(0, k + 1).map((m) => m.w).filter(Boolean);

  if (!quiz) {
    const m = MODEL[k];
    return (
      <div className="wp-box">
        <p className="wp-lab">Stage 3 · Model it</p>
        <h1>Watch the strategy being used</h1>
        <p className="wp-msg">Step {k + 1} of {MODEL.length}. A worked example, thinking aloud.</p>
        <p className="wp-think">{m.t}</p>
        {notes.length > 0 && <div><b>Planning notes</b><div className="wp-notes">{notes.join("\n")}</div></div>}
        {essay.length > 0 && <div><b>Essay so far</b><div className="wp-notes">{essay.join(" ")}</div></div>}
        <div><button type="button" className="wp-btn" onClick={() => k < MODEL.length - 1 ? setK(k + 1) : setQuiz(true)}>{k < MODEL.length - 1 ? "Next step" : "Answer 3 questions"}</button></div>
      </div>
    );
  }
  return <Stage3Quiz onMastered={onMastered} onReplay={() => { setK(0); setQuiz(false); }} />;
}

function Stage3Quiz({ onMastered, onReplay }) {
  const [answers, setAnswers] = useState(Array(QUIZ.length).fill(null));
  const [checked, setChecked] = useState(false);
  const [right, setRight] = useState(0);
  function check() {
    if (answers.some((a) => a == null)) { setChecked("empty"); return; }
    const r = answers.filter((a, i) => a === QUIZ[i].c).length;
    setRight(r); setChecked(true);
  }
  return (
    <div className="wp-box">
      <p className="wp-lab">Stage 3 · Model it</p>
      <h1>3 short questions</h1>
      {QUIZ.map((q, i) => (
        <div className="wp-card-box" key={i}>
          <b>{i + 1}. {q.q}</b>
          {q.o.map((o, j) => (
            <label className="wp-row" style={{ gap: 8, justifyContent: "flex-start" }} key={j}>
              <input type="radio" name={`q${i}`} checked={answers[i] === j} onChange={() => { const a = [...answers]; a[i] = j; setAnswers(a); setChecked(false); }} /> {o}
            </label>
          ))}
        </div>
      ))}
      {checked === "empty" && <p className="wp-err">Answer all 3 questions first.</p>}
      {!checked && <div><button type="button" className="wp-btn" onClick={check}>Check</button></div>}
      {checked === true && right === 3 && (
        <>
          <div className="wp-res">3 of 3. Stage 3 mastered.</div>
          <div><button type="button" className="wp-btn" onClick={onMastered}>Go to stage 4</button></div>
        </>
      )}
      {checked === true && right < 3 && (
        <>
          <div className="wp-res">{right} of 3</div>
          <p className="wp-msg">Change your answers and check again, or replay the example.</p>
          <button type="button" className="wp-btn wp-o wp-sm" onClick={onReplay}>Replay the example</button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- stage 4: memorize it

function Stage4({ stage4Passes, onPass }) {
  const [vals, setVals] = useState(Array(MEM.length).fill(""));
  const [checked, setChecked] = useState(false);
  const [right, setRight] = useState(0);
  function check() {
    const r = vals.filter((v, i) => MEM[i][2].test(v.toLowerCase())).length;
    setRight(r); setChecked(true);
  }
  function tryAgain() { setVals(Array(MEM.length).fill("")); setChecked(false); setRight(0); }
  return (
    <div className="wp-box">
      <p className="wp-lab">Stage 4 · Memorize it {stage4Passes > 0 && `(pass ${stage4Passes} of ${STAGE4_SESSIONS_REQUIRED} done)`}</p>
      <h1>Write each step from memory</h1>
      <p className="wp-msg">STOP is for planning. DARE is what the essay contains. You need 8 of 8 twice, as two separate attempts, before moving on.</p>
      {MEM.map((m, i) => (
        <div className="wp-row" key={m[0]}>
          <b style={{ width: 26, fontFamily: "var(--wp-mono)", fontSize: 20 }}>{m[0]}</b>
          <input type="text" aria-label={`Step ${m[0]}`} style={{ flex: 1, borderStyle: checked && !MEM[i][2].test(vals[i].toLowerCase()) ? "dashed" : "" }}
            value={vals[i]} onChange={(e) => { const v = [...vals]; v[i] = e.target.value; setVals(v); }} autoComplete="off" spellCheck="false" />
        </div>
      ))}
      <div><button type="button" className="wp-btn" onClick={check}>Check</button></div>
      {checked && right === 8 && (
        <>
          <div className="wp-res">All 8 steps recalled.</div>
          {stage4Passes + 1 < STAGE4_SESSIONS_REQUIRED
            ? <><p className="wp-msg">That's one successful attempt. Do it once more, as a separate attempt, to finish stage 4.</p><button type="button" className="wp-btn" onClick={() => { onPass(); tryAgain(); }}>Try again</button></>
            : <div><button type="button" className="wp-btn" onClick={onPass}>Go to stage 5</button></div>}
        </>
      )}
      {checked && right < 8 && <div className="wp-res">{right} of 8</div>}
      {checked && right < 8 && <p className="wp-msg">Steps with a dashed border need another try. The coach can remind you of any step.</p>}
      <Coach />
    </div>
  );
}

// ---------------------------------------------------------------- stage 5: support it

function Stage5({ chart, pushChart, supportLevel, supportStreak, onResult }) {
  const prompt = PROMPTS5[chart.length % PROMPTS5.length];
  const sheet = SHEETS[supportLevel];
  const [essay, setEssay] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function check() {
    if (essay.trim().split(/\s+/).length < 40) { setError("Write at least 40 words first."); return; }
    setError("");
    const r = E.findParts(essay);
    const c = E.countParts(r);
    pushChart(c);
    setResult({ r, c, all: c === 6 });
  }
  function next() { onResult(result.all); setEssay(""); setResult(null); }

  return (
    <div className="wp-box">
      <p className="wp-lab">Stage 5 · Support it</p>
      <h1>Write with support</h1>
      <p><b>Your goal:</b> Include all 6 parts</p>
      <p><b>Question:</b> {prompt}</p>
      <p className="wp-msg">Support level: {SHEET_NAME[supportLevel]}. The support is reduced after {STAGE5_STREAK} essays in a row with all 6 parts.</p>
      {sheet.length ? (
        <div className="wp-card-box"><b>Plan</b>{sheet.map((line, i) => <label key={i} style={{ fontSize: 14 }}>{line}<input type="text" autoComplete="off" spellCheck="false" /></label>)}</div>
      ) : <p className="wp-msg">Plan on your own, in your head or on paper, using STOP.</p>}
      <label><b>Essay</b><textarea aria-label="Your essay" spellCheck="false" value={essay} readOnly={!!result} onChange={(e) => setEssay(e.target.value)} /></label>
      {error && <p className="wp-err">{error}</p>}
      {!result && <div><button type="button" className="wp-btn" onClick={check}>Check my parts</button></div>}
      {result && (
        <>
          <div className="wp-card-box"><b>Part check</b><PartsChecklist r={result.r} /><p className="wp-msg">The checker only looks for the parts. It does not grade your ideas or change your words.</p></div>
          <ChartCard chart={chart} />
          <div><button type="button" className="wp-btn" onClick={next}>Write another essay</button></div>
        </>
      )}
      <Coach />
    </div>
  );
}

// ---------------------------------------------------------------- stage 6: independent

function Stage6({ chart, pushChart, onMastered, onBackToStage5 }) {
  const [essay, setEssay] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function check() {
    if (essay.trim().split(/\s+/).length < 40) { setError("Write at least 40 words first."); return; }
    setError("");
    const r = E.findParts(essay);
    const c = E.countParts(r);
    pushChart(c);
    setResult({ r, c, all: c === 6 });
  }
  function again() { setEssay(""); setResult(null); setError(""); }

  return (
    <div className="wp-box">
      <p className="wp-lab">Stage 6 · Independent</p>
      <h1>Write on your own</h1>
      <p><b>Question:</b> Should universities give credit for volunteer work?</p>
      <p className="wp-msg">No planning sheet and no coach. Use STOP and DARE on your own. Feedback comes after you finish.</p>
      <textarea aria-label="Your essay" spellCheck="false" value={essay} readOnly={!!result} onChange={(e) => setEssay(e.target.value)} />
      {error && <p className="wp-err">{error}</p>}
      {!result && <div><button type="button" className="wp-btn" onClick={check}>I have finished</button></div>}
      {result && (
        <>
          <div className="wp-card-box"><b>Part check</b><PartsChecklist r={result.r} /></div>
          <ChartCard chart={chart} />
          {result.all ? (
            <>
              <p><b>All 6 parts on your own. Stage 6 mastered.</b></p>
              <p className="wp-msg">Next: you can choose to check the plan of a real course assignment against STOP and DARE. The checker looks only at the parts, never the content, and follows your course's rules on AI use. (That optional checker isn't built in this demo.)</p>
              <div><button type="button" className="wp-btn" onClick={onMastered}>Finish</button></div>
            </>
          ) : (
            <>
              <p className="wp-msg">Some parts are missing. Try another essay, or go back to stage 5 for more support.</p>
              <div className="wp-row">
                <button type="button" className="wp-btn" onClick={again}>Write another essay</button>
                <button type="button" className="wp-btn wp-o" onClick={onBackToStage5}>Back to stage 5</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Complete({ chart, onRestart }) {
  return (
    <div className="wp-intro">
      <p className="wp-lab">Planning and organising essays complete</p>
      <h1>You reached stage 6</h1>
      <ChartCard chart={chart} />
      <p className="wp-msg">Your progress stays private. This demo doesn't yet have the optional "share with SAS" step wired up.</p>
      <div><button type="button" className="wp-btn" onClick={onRestart}>Run again</button></div>
    </div>
  );
}

function StaffPanel({ s }) {
  return (
    <aside className="wp-side" aria-label="Presenter panel (staff only)">
      <h3>Presenter panel · staff demo mode (?staff=1), never shown to students</h3>
      <dl>
        <dt>Stage</dt><dd>{STAGE_NAME[s.stageIdx]}</dd>
        <dt>Goal</dt><dd>{s.goal || "–"}</dd>
        <dt>Support level</dt><dd>{SHEET_NAME[s.supportLevel]}</dd>
        <dt>Support streak</dt><dd>{s.supportStreak}</dd>
        <dt>Stage 4 passes</dt><dd>{s.stage4Passes} of {STAGE4_SESSIONS_REQUIRED}</dd>
      </dl>
    </aside>
  );
}
