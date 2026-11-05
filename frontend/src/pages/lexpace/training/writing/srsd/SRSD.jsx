import { Fragment, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as E from "./engine.js";
import { LABELS, MEM, MODEL, PARTS, PROMPTS5, QUIZ, SAMPLE, SHEETS, SHEET_NAME, STAGE4_SESSIONS_REQUIRED, STAGE5_STREAK, STAGE_NAME } from "./bank.js";
import "../writing.css";

// SRSD (Planning and Organising Essays) - phase 1. The part checker and coach are the
// prototype's own code-based stand-ins for the real AI pieces (see engine.js); the
// validation gate (spec 4c) and a real backend AI call are deferred, same as the rest of this
// build. No persistence yet, so stage 4's "twice, in separate sessions" requirement is done as
// two successful attempts within one sitting rather than across real separate days - flagged
// in the UI text rather than silently treated as equivalent.
//
// Strategy content and the six-stage structure (STAGE_NAME) follow the published Self-
// Regulated Strategy Development model (Harris & Graham, 1996, Making the Writing Process
// Work; Graham & Harris, 2005, Writing Better) and the STOP and DARE persuasive-writing
// strategy (De La Paz, S., 2001, "STOP and DARE: A persuasive writing strategy," Intervention
// in School and Clinic, 36(4), 234-243, doi:10.1177/105345120103600409) - not invented wording.
// See SRSDIntro below for the same citations shown to the student/presenter.

function initial() {
  return {
    started: false, stageIdx: 0, chart: [], goal: "", supportLevel: 0, supportStreak: 0, stage4Passes: 0, paused: false,
    // Lifted up from stage 1/3/4 so the Previous/Next bar for each can be rendered once, at the
    // top level, exactly like every other training module - instead of each stage drawing its
    // own nav bar nested inside its own content card (see SRSD below for where this is used).
    s1Idx: 0, s1Vals: Array(SAMPLE.length).fill(""), s3Step: 0, s3Quiz: false, s4Taught: 0,
  };
}

export default function SRSD() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const staffMode = params.get("staff") === "1";
  const [s, setS] = useState(initial);

  function goToStage(idx, patch = {}) { setS((p) => ({ ...p, stageIdx: idx, ...patch })); }
  function pushChart(count) { setS((p) => ({ ...p, chart: [...p.chart, count] })); }
  function restart() { setS(initial()); }

  // Each stage manages its own in-progress essay/answer text internally, so there's no single
  // flag here for "is something unsaved right now" - always confirming is the simple, safe
  // choice rather than threading that state up from every stage component.
  function backToMenu() { if (window.confirm("Leave now? Anything you're writing won't be saved.")) navigate("../.."); }
  function backToWriting() { if (window.confirm("Leave now? Anything you're writing won't be saved.")) navigate(".."); }
  function togglePause() { setS((p) => ({ ...p, paused: !p.paused })); }
  function restartNow() { if (window.confirm("Restart from the beginning? Anything you're writing won't be saved.")) restart(); }
  function endSessionNow() { if (window.confirm("Skip the rest of this session and go straight to the end screen?")) setS((p) => ({ ...p, stageIdx: 6, paused: false })); }

  const stageProps = { chart: s.chart, goal: s.goal, pushChart, staffMode };

  return (
    <div className="wp">
      <div className="wp-panel">
        <div className="wp-shead">
          <button type="button" className="wp-btn wp-o wp-sm" onClick={backToMenu}>← Training menu</button>
          <button type="button" className="wp-btn wp-o wp-sm" onClick={backToWriting}>Other writing trainings</button>
          <b>Planning and organising essays (SRSD)</b>
          {s.started && <span className="wp-tag">Stage {STAGE_NAME[s.stageIdx]}</span>}
        </div>
        <div className="wp-progress"><i style={{ width: (s.started ? (s.stageIdx / 6) * 100 : 0) + "%" }} /></div>
        <div className="wp-stage">
          {!s.started ? (
            <SRSDIntro onStart={() => setS((p) => ({ ...p, started: true }))} />
          ) : s.paused ? (
            <div className="wp-intro">
              <p className="wp-lab">Paused</p>
              <h1>Session paused</h1>
              <p className="wp-msg">Nothing is running while paused. Press Resume to continue where you left off.</p>
              <div><button type="button" className="wp-btn" onClick={togglePause}>Resume</button></div>
            </div>
          ) : <>
          {s.stageIdx === 0 && <Stage1 idx={s.s1Idx} vals={s.s1Vals} setVals={(vals) => setS((p) => ({ ...p, s1Vals: vals }))} onMastered={() => goToStage(1)} />}
          {s.stageIdx === 1 && <Stage2 {...stageProps} onMastered={(goal) => goToStage(2, { goal })} />}
          {s.stageIdx === 2 && <Stage3 step={s.s3Step} quiz={s.s3Quiz} onMastered={() => goToStage(3)}
            onReplay={() => setS((p) => ({ ...p, s3Step: 0, s3Quiz: false }))} />}
          {s.stageIdx === 3 && <Stage4 taught={s.s4Taught} stage4Passes={s.stage4Passes} onPass={() => setS((p) => {
            const passes = p.stage4Passes + 1;
            if (passes >= STAGE4_SESSIONS_REQUIRED) return { ...p, stageIdx: 4, stage4Passes: passes, supportLevel: 0, supportStreak: 0 };
            return { ...p, stage4Passes: passes };
          })}
            onRetry={() => setS((p) => ({ ...p, s4Taught: 0 }))}
            onSkip={() => setS((p) => ({ ...p, stageIdx: 4, supportLevel: 0, supportStreak: 0 }))} />}
          {s.stageIdx === 4 && <Stage5 {...stageProps} supportLevel={s.supportLevel} supportStreak={s.supportStreak}
            onResult={(allSix) => setS((p) => {
              const streak = allSix ? p.supportStreak + 1 : 0;
              if (streak >= STAGE5_STREAK) {
                if (p.supportLevel < 2) return { ...p, supportStreak: 0, supportLevel: p.supportLevel + 1 };
                return { ...p, stageIdx: 5, supportStreak: streak };
              }
              return { ...p, supportStreak: streak };
            })}
            onSkip={() => setS((p) => ({ ...p, stageIdx: 5 }))} />}
          {s.stageIdx === 5 && <Stage6 {...stageProps} onMastered={() => goToStage(6)} onBackToStage5={() => goToStage(4, { supportLevel: 1, supportStreak: 0 })} />}
          {s.stageIdx === 6 && <Complete chart={s.chart} onRestart={restart} />}
          </>}
        </div>
        {s.started && !s.paused && s.stageIdx === 0 && (
          <div className="wp-nav1">
            <button type="button" className="wp-btn wp-o wp-sm" disabled={s.s1Idx <= 0} onClick={() => setS((p) => ({ ...p, s1Idx: p.s1Idx - 1 }))}>◀ Previous</button>
            <span className="wp-stepper">
              {SAMPLE.map((_, i) => <span key={i} className={"wp-dot" + (i === s.s1Idx ? " is-now" : s.s1Vals[i] ? " is-done" : "")} />)}
              &nbsp;Sentence {s.s1Idx + 1} of {SAMPLE.length}
            </span>
            <button type="button" className="wp-btn wp-o wp-sm" disabled={s.s1Idx >= SAMPLE.length - 1} onClick={() => setS((p) => ({ ...p, s1Idx: p.s1Idx + 1 }))}>Next ▶</button>
          </div>
        )}
        {s.started && !s.paused && s.stageIdx === 2 && !s.s3Quiz && (
          <div className="wp-nav1">
            <button type="button" className="wp-btn wp-o wp-sm" disabled={s.s3Step <= 0} onClick={() => setS((p) => ({ ...p, s3Step: p.s3Step - 1 }))}>◀ Previous</button>
            <span className="wp-stepper">
              {MODEL.map((_, i) => <span key={i} className={"wp-dot" + (i === s.s3Step ? " is-now" : i < s.s3Step ? " is-done" : "")} />)}
              &nbsp;Step {s.s3Step + 1} of {MODEL.length}
            </span>
            <button type="button" className="wp-btn wp-o wp-sm"
              onClick={() => s.s3Step < MODEL.length - 1 ? setS((p) => ({ ...p, s3Step: p.s3Step + 1 })) : setS((p) => ({ ...p, s3Quiz: true }))}>Next ▶</button>
          </div>
        )}
        {s.started && !s.paused && s.stageIdx === 3 && s.s4Taught < MEM.length && (
          <div className="wp-nav1">
            <button type="button" className="wp-btn wp-o wp-sm" disabled={s.s4Taught <= 0} onClick={() => setS((p) => ({ ...p, s4Taught: p.s4Taught - 1 }))}>◀ Previous</button>
            <span className="wp-stepper">
              {MEM.map((_, i) => <span key={i} className={"wp-dot" + (i === s.s4Taught ? " is-now" : i < s.s4Taught ? " is-done" : "")} />)}
              &nbsp;Step {s.s4Taught + 1} of {MEM.length}
            </span>
            <button type="button" className="wp-btn wp-o wp-sm" onClick={() => setS((p) => ({ ...p, s4Taught: p.s4Taught + 1 }))}>Next ▶</button>
          </div>
        )}
        <div className="wp-sfoot">
          <span>This is a trial/demo page. Essay questions and sample material are placeholder examples, and nothing is saved between visits yet.</span>
          {s.started && (
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

function SRSDIntro({ onStart }) {
  return (
    <div className="wp-intro">
      <p className="wp-lab">Planning and organising essays</p>
      <h1>STOP and DARE</h1>
      <p>You will learn a planning strategy for persuasive essays, STOP and DARE, in the same six stages research-backed strategy instruction uses: see the parts, discuss it, watch it modelled, memorize it, practise it with support, then write on your own.</p>
      <ul>
        <li><b>STOP</b> is for planning before you write: Suspend judgment, Take a side, Organize your ideas, Plan more as you write.</li>
        <li><b>DARE</b> is what the essay must contain: Develop a topic sentence, Add supporting ideas, Reject an argument for the other side, End with a conclusion.</li>
      </ul>
      <div><button type="button" className="wp-btn" onClick={onStart}>Start stage 1</button></div>
      <p className="wp-msg" style={{ marginTop: 18 }}>
        Based on the Self-Regulated Strategy Development (SRSD) model and its six instructional stages (Harris &amp; Graham, 1996, <i>Making the Writing Process Work</i>; Graham &amp; Harris, 2005, <i>Writing Better</i>), and the STOP and DARE persuasive-writing strategy (De La Paz, S., 2001, "STOP and DARE: A persuasive writing strategy," <i>Intervention in School and Clinic</i>, 36(4), 234–243). Meta-analyses of SRSD writing interventions report large effects on writing quality for students with learning disabilities (Graham &amp; Harris, 2003).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- stage 1: background knowledge

function Stage1({ idx, vals, setVals, onMastered }) {
  const [checked, setChecked] = useState(null);
  function check() {
    if (vals.some((v) => !v)) { setChecked("empty"); return; }
    const right = vals.filter((v, i) => v === SAMPLE[i][1]).length;
    setChecked(right);
  }
  const mastered = typeof checked === "number" && checked === 6;
  const sent = SAMPLE[idx];
  const showResult = checked != null && checked !== "empty";
  const isRight = showResult && vals[idx] === sent[1];
  return (
    <div className="wp-box">
      <p className="wp-lab">Stage 1 · Background knowledge · sentence {idx + 1} of {SAMPLE.length}</p>
      <h1>What a strong argument essay contains</h1>
      {idx === 0 && (
        <>
          <p>An argument essay has 6 parts: a claim, reasons, evidence, the other side's argument, your answer to it, and a conclusion. Label each sentence of this short sample essay.</p>
          <p className="wp-msg">Sample essay: a real student essay from a published STOP &amp; DARE lesson (adapted from Graham &amp; De La Paz), scored 4 out of 4 by a teacher.</p>
        </>
      )}
      <div className="wp-sent">
        <p>{idx + 1}. {sent[0]}</p>
        <select aria-label={`Part for sentence ${idx + 1}`} value={vals[idx]} onChange={(e) => { const v = [...vals]; v[idx] = e.target.value; setVals(v); }}
          style={showResult && !isRight ? { borderStyle: "dashed" } : {}}>
          <option value="">Choose…</option>
          {Object.keys(LABELS).map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}
        </select>
        {showResult && (
          <span className={isRight ? "wp-ok-text" : "wp-bad-text"}>{isRight ? "Correct" : "Not yet"}</span>
        )}
      </div>
      {checked === "empty" && <p className="wp-err">Choose a label for every sentence first.</p>}
      <div className="wp-row">
        <button type="button" className="wp-btn" onClick={check}>Check my labels</button>
        <button type="button" className="wp-btn wp-o" onClick={onMastered}>Go to stage 2</button>
      </div>
      {typeof checked === "number" && (
        mastered ? (
          <div className="wp-res">All 6 correct. Stage 1 mastered.</div>
        ) : (
          <>
            <div className="wp-res">{checked} of 6 correct</div>
            <p className="wp-msg">Sentences marked "Not yet" need another look. Use Previous/Next below to find them, change them, then check again - or go to stage 2 whenever you're ready.</p>
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

  function check() {
    if (essay.trim().split(/\s+/).length < 25) { setError("Write at least 25 words first."); return; }
    setError("");
    const r = E.findParts(essay);
    const c = E.countParts(r);
    pushChart(c);
    setResult({ r, c });
  }
  return (
    <div className="wp-box">
      <p className="wp-lab">Stage 2 · Discuss it</p>
      <h1>Write a short first argument</h1>
      <p><b>Question:</b> Should first-year students be required to take a writing course?</p>
      <p className="wp-msg">Write 5 to 8 sentences. There is no grade. This shows where you are starting from.</p>
      <textarea aria-label="Your first argument" spellCheck="false" value={essay} readOnly={!!result} onChange={(e) => setEssay(e.target.value)} />
      {error && <p className="wp-err">{error}</p>}
      <div className="wp-row">
        <button type="button" className="wp-btn" onClick={check}>Compare with the checklist</button>
        <button type="button" className="wp-btn wp-o" onClick={() => onMastered(goal)}>Go to stage 3</button>
      </div>
      {result && (
        <>
          <div className="wp-card-box"><b>Checklist</b><PartsChecklist r={result.r} /></div>
          <ChartCard chart={chart} />
          <div className="wp-card-box">
            <b>Set your goal for the next essays</b>
            <select value={goal} onChange={(e) => setGoal(e.target.value)}>
              <option value="">Choose a goal…</option>
              <option>Include all 6 parts</option>
              <option>Include the other side and answer it</option>
              <option>Add evidence for every reason</option>
              <option>End with a clear conclusion</option>
            </select>
            <p className="wp-msg">Optional - a reminder shown again on stage 5. Go to stage 3 above whenever you're ready.</p>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- stage 3: model it

function Stage3({ step, quiz, onMastered, onReplay }) {
  const notes = MODEL.slice(0, step + 1).map((m) => m.n).filter(Boolean);
  const essay = MODEL.slice(0, step + 1).map((m) => m.w).filter(Boolean);

  if (!quiz) {
    const m = MODEL[step];
    return (
      <div className="wp-box">
        <p className="wp-lab">Stage 3 · Model it</p>
        <h1>Watch the strategy being used</h1>
        <p className="wp-msg">Step {step + 1} of {MODEL.length}. A worked example, thinking aloud. Use Previous/Next below to move through it.</p>
        <p className="wp-think">{m.t}</p>
        {notes.length > 0 && <div><b>Planning notes</b><div className="wp-notes">{notes.join("\n")}</div></div>}
        {essay.length > 0 && <div><b>Essay so far</b><div className="wp-notes">{essay.join(" ")}</div></div>}
        <div className="wp-row">
          <button type="button" className="wp-btn wp-o wp-sm" onClick={onMastered}>Skip to stage 4</button>
        </div>
      </div>
    );
  }
  return <Stage3Quiz onMastered={onMastered} onReplay={onReplay} />;
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
      <div className="wp-row">
        <button type="button" className="wp-btn" onClick={check}>Check</button>
        <button type="button" className="wp-btn wp-o" onClick={onMastered}>Go to stage 4</button>
      </div>
      {checked === true && right === 3 && <div className="wp-res">3 of 3. Stage 3 mastered.</div>}
      {checked === true && right < 3 && (
        <>
          <div className="wp-res">{right} of 3</div>
          <p className="wp-msg">Change your answers and check again, or replay the example - or go to stage 4 whenever you're ready.</p>
          <button type="button" className="wp-btn wp-o wp-sm" onClick={onReplay}>Replay the example</button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- stage 4: memorize it

// Stage 4 teaches before it tests, matching the real STOP & DARE lesson plan (mrhousch.com):
// reveal one letter at a time with its explanation, then cover the chart and test recall -
// rather than dropping the student straight into a blind-recall test with no teaching step.
function Stage4({ taught, stage4Passes, onPass, onRetry, onSkip }) {
  const [vals, setVals] = useState(Array(MEM.length).fill(""));
  const [checked, setChecked] = useState(false);
  const [right, setRight] = useState(0);
  function check() {
    const r = vals.filter((v, i) => MEM[i][2].test(v.toLowerCase())).length;
    setRight(r); setChecked(true);
  }
  function tryAgain() { setVals(Array(MEM.length).fill("")); setChecked(false); setRight(0); onRetry(); }

  if (taught < MEM.length) {
    const m = MEM[taught];
    return (
      <div className="wp-box">
        <p className="wp-lab">Stage 4 · Memorize it</p>
        <h1>{taught === 0 ? "Pull out your STOP and DARE chart" : `Uncover ${m[0]} · ${m[1]}`}</h1>
        <p className="wp-msg">Expert writers plan before they start to compose. Learn each step, then you'll cover the chart and see if you can recall it. Use Previous/Next below to move through it.</p>
        <div className="wp-rule">{E.STEP_TEXT[m[0].toLowerCase()]}</div>
        <div className="wp-row">
          <button type="button" className="wp-btn wp-o wp-sm" onClick={onSkip}>Skip to stage 5</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wp-box">
      <p className="wp-lab">Stage 4 · Memorize it {stage4Passes > 0 && `(pass ${stage4Passes} of ${STAGE4_SESSIONS_REQUIRED} done)`}</p>
      <h1>Write each step from memory</h1>
      <p className="wp-msg">STOP is for planning. DARE is what the essay contains. You need 8 of 8 twice, as two separate attempts, before moving on.</p>
      {MEM.map((m, i) => {
        const isRight = checked && MEM[i][2].test(vals[i].toLowerCase());
        return (
          <div className="wp-row" key={m[0]}>
            <b style={{ width: 26, fontFamily: "var(--wp-mono)", fontSize: 20 }}>{m[0]}</b>
            <input type="text" aria-label={`Step ${m[0]}`} style={{ flex: 1, borderStyle: checked && !isRight ? "dashed" : "" }}
              value={vals[i]} onChange={(e) => { const v = [...vals]; v[i] = e.target.value; setVals(v); }} autoComplete="off" spellCheck="false" />
            {checked && <span className={isRight ? "wp-ok-text" : "wp-bad-text"}>{isRight ? "Correct" : "Not yet"}</span>}
          </div>
        );
      })}
      <div className="wp-row">
        <button type="button" className="wp-btn" onClick={check}>Check</button>
        <button type="button" className="wp-btn wp-o" onClick={onSkip}>Go to stage 5</button>
      </div>
      {checked && right === 8 && (
        <>
          <div className="wp-res">All 8 steps recalled.</div>
          {stage4Passes + 1 < STAGE4_SESSIONS_REQUIRED && (
            <>
              <p className="wp-msg">That's one successful attempt. Do it once more, as a separate attempt, for the full two passes - or go to stage 5 whenever you're ready.</p>
              <button type="button" className="wp-btn wp-o wp-sm" onClick={() => { onPass(); tryAgain(); }}>Do it once more</button>
            </>
          )}
        </>
      )}
      {checked && right < 8 && <div className="wp-res">{right} of 8</div>}
      {checked && right < 8 && <p className="wp-msg">Steps with a dashed border need another try. Edit them above and check again, or go to stage 5 whenever you're ready. The coach can remind you of any step.</p>}
      <Coach />
    </div>
  );
}

// ---------------------------------------------------------------- stage 5: support it

function Stage5({ chart, pushChart, supportLevel, supportStreak, onResult, onSkip }) {
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
      <div className="wp-row">
        {!result && <button type="button" className="wp-btn" onClick={check}>Check my parts</button>}
        {result && <button type="button" className="wp-btn" onClick={next}>Write another essay</button>}
        <button type="button" className="wp-btn wp-o" onClick={onSkip}>Go to stage 6</button>
      </div>
      {result && (
        <div className="wp-card-box"><b>Part check</b><PartsChecklist r={result.r} /><p className="wp-msg">The checker only looks for the parts. It does not grade your ideas or change your words.</p></div>
      )}
      {result && <ChartCard chart={chart} />}
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
      <div className="wp-row">
        {!result && <button type="button" className="wp-btn" onClick={check}>I have finished</button>}
        <button type="button" className="wp-btn wp-o" onClick={onMastered}>Finish</button>
      </div>
      {result && (
        <>
          <div className="wp-card-box"><b>Part check</b><PartsChecklist r={result.r} /></div>
          <ChartCard chart={chart} />
          {result.all ? (
            <p><b>All 6 parts on your own. Stage 6 mastered.</b></p>
          ) : (
            <>
              <p className="wp-msg">Some parts are missing. Try another essay, go back to stage 5 for more support, or press Finish above whenever you're ready.</p>
              <div className="wp-row">
                <button type="button" className="wp-btn" onClick={again}>Write another essay</button>
                <button type="button" className="wp-btn wp-o" onClick={onBackToStage5}>Back to stage 5</button>
              </div>
            </>
          )}
          <p className="wp-msg">Next: you can choose to check the plan of a real course assignment against STOP and DARE. The checker looks only at the parts, never the content, and follows your course's rules on AI use. (That optional checker isn't built in this demo.)</p>
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
