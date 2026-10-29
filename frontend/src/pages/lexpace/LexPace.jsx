import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/Icon.jsx";
import { VERSION_OPTIONS, getJSON, saveVersion, useApi, writeLectureVersion } from "../../api.js";
import TrainingHub from "./training/TrainingHub.jsx";
import "./lexpace.css";

// LexPace as one place in Blackboard: the optional check, training, and My courses
// (each course's chapters, opened in the student's lesson version).

// The village check asks first whether Arabic is the student's mother tongue, then opens the
// Arabic or English version. The classic pages (journey/en.html, ar.html) are still served.
const SCREENING_SRC = "/lexpace/journey/village.html";
// The village keeps the last summary in this browser (see journey-api.js).
const SUMMARY_KEY = "lexpace:last-summary";
function lastSummaryLang() {
  try { return JSON.parse(localStorage.getItem(SUMMARY_KEY) || "null")?.lang || null; } catch { return null; }
}

const SOURCE_NOTE = {
  screening: "from your check",
  screening_pending: "check done, results pending",
  skipped: "check skipped",
  manual: "chosen by you",
};

// Leaving the check without a saved version means the student skipped it.
async function skipCheck() {
  const current = await getJSON("/api/lexpace/profile");
  if (!current.version) await saveVersion("base", "skipped");
}

const TITLES = { check: "LexPace check", training: "Training", courses: "My courses", requests: "My SAS requests",
  results: "Your results and next steps" };

// Same look as the Tools page: a big header, then tiles. Sub-pages get a back link to LexPace.
function Layout() {
  const { pathname } = useLocation();
  const section = pathname.split("/")[2];
  if (section === "check") return <div className="lxh"><Outlet /></div>; // the check draws its own green header
  return (
    <div className="lxh">
      <header className={"page-header" + (section ? " frame-header" : "")}>
        {section === "results" && lastSummaryLang()
          ? <Link to="/lexpace-hub/check" className="back-link"><Icon name="back" size={18} />LexPace check</Link>
          : section && <Link to="/lexpace-hub" className="back-link"><Icon name="back" size={18} />LexPace</Link>}
        {section !== "check" && <h1 className="page-title">{TITLES[section] || "LexPace"}</h1>}
      </header>
      <Outlet />
    </div>
  );
}

function VersionBar({ support, onChange }) {
  const [saving, setSaving] = useState(false);
  const change = async (e) => {
    setSaving(true);
    try { onChange(await saveVersion(e.target.value || null)); } finally { setSaving(false); }
  };
  return (
    <div className="lx-profile-bar">
      <div>
        <span className="lx-profile-label">Your format: </span>
        <b className="lx-profile-name">{support.label}</b>
        {SOURCE_NOTE[support.source] && <span className="lx-profile-src"> ({SOURCE_NOTE[support.source]})</span>}
      </div>
      <label className="lx-picker">
        <span>Change format</span>
        <select value={support.version} onChange={change} disabled={saving}>
          {VERSION_OPTIONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
    </div>
  );
}

function Tile({ to, icon, label }) {
  return (
    <Link className="tool-card is-link" to={to}>
      <span className="lexpace-mark"><Icon name={icon} size={26} /></span>
      <span>{label}</span>
    </Link>
  );
}

// First visit (no format yet): offer the check first, with a clear way to skip.
function Welcome({ onSkip }) {
  const [busy, setBusy] = useState(false);
  const skip = async () => {
    setBusy(true);
    try { await skipCheck(); onSkip(); } finally { setBusy(false); }
  };
  return (
    <div className="lxh-body">
      <div className="lx-welcome">
        <h2>Welcome to LexPace</h2>
        <AboutLexPace />
        <p>Start with a short check so we can match your course materials to the way you read. It takes about
          10 minutes, in English or Arabic. It is a screening, not a diagnosis, and you can take it again anytime.</p>
        <div className="lxh-welcome-btns">
          <Link to="/lexpace-hub/check" className="bb-btn">Start the check</Link>
          <button type="button" className="bb-btn bb-btn-secondary" onClick={skip} disabled={busy}>Skip for now</button>
        </div>
      </div>
    </div>
  );
}

function Home() {
  const [support, setSupport] = useApi("/api/lexpace/profile");
  if (!support) return null;
  if (!support.version) {
    return <Welcome onSkip={() => getJSON("/api/lexpace/profile").then(setSupport)} />;
  }
  return (
    <div className="tools-grid">
      <Tile to="/lexpace-hub/check" icon="pulse" label="LexPace check" />
      <Tile to="/lexpace-hub/courses" icon="courses" label="My courses" />
      <Tile to="/lexpace-hub/training" icon="book" label="Training" />
      <Tile to="/lexpace-hub/requests" icon="mail" label="My SAS requests" />
    </div>
  );
}

// ---------------------------------------------------------------- My SAS requests
// Requests the student sent to Student Accessibility Services, read through /api/sas/student/...
// (LexPace's backend forwards these to the SAS Portal).

const REQUEST_STATUS = {
  new: "Sent to SAS",
  assigned: "Assigned",
  waiting: "Waiting for your reply",
  progress: "In progress",
  closed: "Closed",
};

async function sasPost(path, body) {
  const res = await fetch(`/api/sas/student${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "Something went wrong. Please try again.");
  return data;
}

function MyRequests() {
  const [items, setItems] = useState();
  const [error, setError] = useState("");
  const load = () => getJSON("/api/sas/student/requests")
    .then((d) => { setItems(d); setError(""); })
    .catch(() => setError("SAS is not reachable right now. Please try again later."));
  useEffect(() => { load(); }, []);

  return (
    <div className="lxh-body">
      <p className="lxh-intro-sm">Requests you sent to Student Accessibility Services. Only you and SAS can see them.</p>
      {error && <p className="lxh-hint" role="alert">{error}</p>}
      {items && items.length === 0 && (
        <div className="lxh-empty">
          <p>No requests yet. You can ask Student Accessibility Services for support anytime.</p>
          <Link to="/lexpace-hub/results#sas" className="bb-btn">Ask SAS for support</Link>
        </div>
      )}
      {items?.map((r) => <RequestCard key={r.id} r={r} onChange={load} />)}
    </div>
  );
}

function RequestCard({ r, onChange }) {
  const [mode, setMode] = useState(null); // "withdraw" | "concern"
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const waiting = r.status === "waiting" && r.message && !r.response;

  const act = async (fn, done) => {
    setBusy(true);
    try {
      await fn();
      setMode(null);
      setText("");
      setStatus(done);
      onChange();
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  };
  const respond = (response) => act(() => sasPost(`/requests/${r.id}/respond`, { response }),
    response === "Accepted" ? "Thank you. SAS will be in touch." : "Noted. You can contact SAS anytime.");

  return (
    <section className="lxh-req" aria-labelledby={`req-${r.id}`}>
      <div className="lxh-req-head">
        <h2 id={`req-${r.id}`}>{r.id} · {r.type}</h2>
        <span className={`lxh-chip is-${r.status}`}>{REQUEST_STATUS[r.status]}</span>
      </div>
      <p className="lxh-req-meta">Sent {r.received} · Your contact: {r.ownerName || "being assigned"}</p>

      {r.message && (
        <div className="lxh-msg">
          <span className="lxh-msg-from">Message from {r.ownerName || "SAS"}</span>
          <p>{r.message}</p>
          {waiting ? (
            <div className="lxh-btns">
              <button type="button" className="bb-btn" disabled={busy} onClick={() => respond("Accepted")}>Accept</button>
              <button type="button" className="bb-btn bb-btn-secondary" disabled={busy} onClick={() => respond("Not now")}>Not now</button>
            </div>
          ) : r.response && <p className="lxh-replied">You replied: {r.response}</p>}
        </div>
      )}
      {r.closed && <p className="lxh-req-meta">Closed: {r.closed}</p>}

      <div className="lxh-links">
        {r.status !== "closed" && (
          <button type="button" className="lxh-linkbtn" onClick={() => setMode(mode === "withdraw" ? null : "withdraw")}>Withdraw</button>
        )}
        <button type="button" className="lxh-linkbtn" onClick={() => setMode(mode === "concern" ? null : "concern")}>Raise a concern</button>
      </div>

      {mode === "withdraw" && (
        <div className="lxh-confirm">
          <p>Withdraw this request? SAS will stop working on it and your note will be cleared. You can send a new one anytime.</p>
          <div className="lxh-btns">
            <button type="button" className="bb-btn" disabled={busy}
              onClick={() => act(() => sasPost(`/requests/${r.id}/withdraw`), "Your request was withdrawn.")}>Yes, withdraw</button>
            <button type="button" className="bb-btn bb-btn-secondary" onClick={() => setMode(null)}>Cancel</button>
          </div>
        </div>
      )}
      {mode === "concern" && (
        <form className="lxh-confirm" onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) act(() => sasPost("/concerns", { requestId: r.id, text }), "Thank you. The SAS manager will look at your concern.");
        }}>
          <label htmlFor={`concern-${r.id}`}>What would you like SAS to know?</label>
          <textarea id={`concern-${r.id}`} rows={3} value={text} onChange={(e) => setText(e.target.value)} required />
          <div className="lxh-btns">
            <button type="submit" className="bb-btn" disabled={busy}>Send</button>
            <button type="button" className="bb-btn bb-btn-secondary" onClick={() => setMode(null)}>Cancel</button>
          </div>
        </form>
      )}
      <p className="lxh-status" role="status">{status}</p>
    </section>
  );
}

// ---------------------------------------------------------------- About, results and the SAS referral

function AboutLexPace() {
  return (
    <div className="lxh-about">
      <h3>What is LexPace?</h3>
      <ul>
        <li>A reading and study tool inside Blackboard. It shows your course materials in a format that suits how you read, and offers short reading training.</li>
        <li>The LexPace check is a screening, not a diagnosis. It suggests a study format; it never labels you.</li>
        <li>You stay in control. You can change your format anytime, and nothing is shared with anyone unless you choose to send it.</li>
      </ul>
    </div>
  );
}

const FORMAT_INFO = {
  base: "The lecture with its narrated slides, with no extra supports.",
  read: "Cuts reading effort without cutting content: key words first, new terms easier to sound out and hear, and the whole lesson can be read aloud.",
  write: "Breaks written answers into guided steps, with sentence starters, a word bank, voice typing and a spelling check for technical words.",
  calc: "Every calculation starts with what you know, shows a picture, goes one step at a time and ends with a sanity check. A formula card and calculator are always close.",
};
const RESULT_NAMES = [["reading", "Reading support"], ["writing", "Writing support"], ["math", "Calculation support"]];
// The skills the screening model looks at, as shown with its result.
const SKILL_NAMES = [["reading", "Reading"], ["writing", "Writing"], ["math", "Mathematics"]];

function Results() {
  const [check] = useApi("/api/lexpace/check");
  const [support, setSupport] = useApi("/api/lexpace/profile");
  const [me] = useApi("/api/me");
  useEffect(() => {
    if (window.location.hash === "#sas") setTimeout(() => document.getElementById("sas")?.scrollIntoView(), 300);
  }, []);
  if (!check || !support) return null;

  const ok = check.status === "ok";
  const anySuggested = ok && RESULT_NAMES.some(([k]) => check[k]);
  const label = (id) => VERSION_OPTIONS.find(([v]) => v === id)?.[1] || "Base lesson";
  const pickBase = async () => setSupport(await saveVersion("base"));
  const pickRecommended = async (id) => setSupport(await saveVersion(id, "screening"));
  const recommended = ok ? (RESULT_NAMES.map(([k]) => k).find((k) => check[k]) || null) : null;
  const recommendedId = recommended ? { reading: "read", writing: "write", math: "calc" }[recommended] : "base";

  return (
    <div className="lxh-body">
      <AboutLexPace />

      <section className="lxh-card" aria-labelledby="res-h">
        <h2 id="res-h">Your check results</h2>
        {check.status === null && (
          <p>You haven't taken the check yet. <Link to="/lexpace-hub/check">Take the LexPace check</Link> to get a recommended format.</p>
        )}
        {check.status === "pending" && (
          <p>Your answers were saved. Your results will appear here once the screening model is connected.
            Until then, your materials use the base lesson, and you can pick any format yourself in My courses.</p>
        )}
        {ok && (
          <>
            {anySuggested ? (
              <p>Your gameplay shows <b>indicators of learning disabilities</b> in:{" "}
                <b>{SKILL_NAMES.filter(([k]) => check[k]).map(([, n]) => n).join(", ")}</b>.</p>
            ) : (
              <p>Your gameplay did not show indicators of learning disabilities in reading, writing or mathematics.</p>
            )}
            <ul className="lxh-results">
              {SKILL_NAMES.map(([k, name]) => (
                <li key={k}><b>{name}:</b> {check[k] ? "indicators found" : "no indicators"}</li>
              ))}
            </ul>
            <p className="lxh-req-meta">This is a screening by a trained model, not a diagnosis.</p>
          </>
        )}
      </section>

      {ok && (
        <section className="lxh-card" aria-labelledby="fmt-h">
          <h2 id="fmt-h">Recommended study format</h2>
          <p>We recommend <b>{label(recommendedId)}</b> for you. {FORMAT_INFO[recommendedId]}</p>
          <p>Your materials now open in: <b>{support.label || "Base lesson"}</b>.</p>
          <div className="lxh-btns">
            {support.version !== recommendedId && (
              <button type="button" className="bb-btn" onClick={() => pickRecommended(recommendedId)}>Use {label(recommendedId)}</button>
            )}
            {support.version !== "base" && (
              <button type="button" className="bb-btn bb-btn-secondary" onClick={pickBase}>Use the base lesson instead</button>
            )}
            <Link to="/lexpace-hub/courses" className="bb-btn bb-btn-secondary">Open my courses</Link>
          </div>
        </section>
      )}

      <SasReferral me={me} suggested={anySuggested} />
    </div>
  );
}

const SHARED = [
  ["Your name and email", "so a specialist can contact you"],
  ["Your check results (reading, writing and calculation support: suggested or not)", "so you don't have to repeat the check"],
  ["Whether reading, writing or maths was hard at school", "helps tell a long-standing difficulty from a new one"],
  ["Your language background", "helps tell a reading difficulty apart from studying in a new language"],
  ["How you'd like to be contacted, and any needs for a meeting", "so the first meeting suits you"],
  ["Your own words (optional)", "so SAS hears it from you"],
];

function SasReferral({ me, suggested }) {
  const [step, setStep] = useState("intro"); // intro | form | sent | declined
  const [form, setForm] = useState({
    type: "Informal talk", contact: "Email", format: "Online", needs: "",
    first: "Arabic", years: "9+", history: "Prefer not to say", note: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sasPost("/requests", {
        type: form.type, contact: form.contact, format: form.format, needs: form.needs.trim(),
        language: { first: form.first, years: form.years }, history: form.history, note: form.note.trim(),
      });
      setStep("sent");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="lxh-card lxh-sas" id="sas" aria-labelledby="sas-h">
      <h2 id="sas-h">Would you like support from SAS?</h2>
      <p>{suggested
        ? "Your check suggests some extra support could help. Student Accessibility Services can talk it through with you."
        : "Support from Student Accessibility Services is open to every student, whatever your results."}</p>

      {step === "intro" && (
        <>
          <h3>Who is SAS?</h3>
          <p>Student Accessibility Services (SAS) is the university office whose learning specialists help students with
            reading, writing and study needs. Talking to SAS is free and confidential. It does not appear on your
            transcript and does not affect your grades.</p>
          <h3>What happens if you say yes</h3>
          <p>You fill in a short form and see exactly what will be sent. A specialist contacts you within 2 working days.
            You decide every next step, and you can withdraw anytime.</p>
          <div className="lxh-btns">
            <button type="button" className="bb-btn" onClick={() => setStep("form")}>Yes, refer me to SAS</button>
            <button type="button" className="bb-btn bb-btn-secondary" onClick={() => setStep("declined")}>No thanks</button>
          </div>
        </>
      )}

      {step === "declined" && (
        <p className="lxh-replied">That's fine. Nothing was shared. You can ask SAS anytime from My SAS requests.</p>
      )}

      {step === "sent" && (
        <div className="lxh-msg">
          <span className="lxh-msg-from">Sent to SAS</span>
          <p>A specialist will contact you within 2 working days. You can follow your request, reply or withdraw it in
            {" "}<Link to="/lexpace-hub/requests">My SAS requests</Link>.</p>
        </div>
      )}

      {step === "form" && (
        <form onSubmit={send} className="lxh-form">
          <div className="lxh-grid">
            <Field label="What would you like?" id="f-type" value={form.type} onChange={set("type")}
              options={["Informal talk", "Full check"]} />
            <Field label="How should SAS contact you?" id="f-contact" value={form.contact} onChange={set("contact")}
              options={["Email", "Phone"]} />
            <Field label="Meeting" id="f-format" value={form.format} onChange={set("format")}
              options={["Online", "In person"]} />
            <Field label="Your first language" id="f-first" value={form.first} onChange={set("first")}
              options={["English", "Arabic", "Other"]} />
            <Field label="Years studying in English" id="f-years" value={form.years} onChange={set("years")}
              options={["0-3", "4-8", "9+"]} />
            <Field label="Was reading, writing or maths hard for you at school?" id="f-history" value={form.history}
              onChange={set("history")} options={["Hard since school", "Some difficulty", "No difficulty", "Prefer not to say"]} />
          </div>
          <label htmlFor="f-needs">Anything that would help in a meeting? (optional)</label>
          <input id="f-needs" value={form.needs} onChange={set("needs")} maxLength={200} placeholder="For example: extra time, a quiet room" />
          <label htmlFor="f-note">What's hard for you right now? (optional)</label>
          <textarea id="f-note" rows={2} value={form.note} onChange={set("note")} maxLength={500} />

          <div className="lxh-preview" aria-label="What SAS will see">
            <h3>SAS will see</h3>
            <ul>
              {SHARED.map(([what, why]) => <li key={what}><b>{what}</b> <span>({why})</span></li>)}
            </ul>
            <p className="lxh-preview-who">Sent as {me?.name || "you"} · {me?.email || ""}</p>
            <p><b>Never shared:</b> your game answers, timings, scores, grades, or anything else from Blackboard.</p>
          </div>
          <p className="lxh-req-meta">Pressing Send means you agree to share the information above with SAS. You can withdraw anytime.</p>
          {error && <p className="lxh-hint" role="alert">{error}</p>}
          <div className="lxh-btns">
            <button type="submit" className="bb-btn" disabled={busy}>Send to SAS</button>
            <button type="button" className="bb-btn bb-btn-secondary" onClick={() => setStep("intro")}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({ label, id, value, onChange, options }) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={onChange}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Check() {
  const navigate = useNavigate();
  const { search } = useLocation();
  // Two tabs: Check (the village, always fresh) and Results (the last check's summary, ?summary=1).
  const [hasSummary, setHasSummary] = useState(() => !!lastSummaryLang());
  const lang = new URLSearchParams(search).has("summary") && lastSummaryLang();
  const src = lang ? `/lexpace/journey/village-${lang}.html?summary=1` : SCREENING_SRC;
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      const type = e.data?.type;
      if (type === "lexpace:check-complete") { // classic pages: straight to the results
        setTimeout(() => navigate("/lexpace-hub/results"), 1500); // the saved format is updated by then
      } else if (type === "lexpace:summary-saved") {
        setHasSummary(true);
        navigate("/lexpace-hub/check?summary=1", { replace: true }); // the Results tab shows what is on screen
      } else if (type === "lexpace:open-results") { // summary -> what the results mean; Back: a fresh check
        navigate("/lexpace-hub/check", { replace: true });
        navigate("/lexpace-hub/results");
      } else if (type === "lexpace:summary-closed") { // X: a fresh screening
        navigate("/lexpace-hub/check");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);
  const leave = async () => {
    await skipCheck();
    navigate("/lexpace-hub/courses");
  };
  return (
    <div className="lxh-frame">
      <header className="lxh-check-bar">
        <Link to="/lexpace-hub" className="back-link"><Icon name="back" size={18} />LexPace</Link>
        <div className="lxh-tabs" role="tablist" aria-label="LexPace check">
          <Link role="tab" aria-selected={!lang} className={"lxh-tab" + (!lang ? " is-on" : "")} to="/lexpace-hub/check">Check</Link>
          {hasSummary
            ? <Link role="tab" aria-selected={!!lang} className={"lxh-tab" + (lang ? " is-on" : "")} to="/lexpace-hub/check?summary=1">Results</Link>
            : <span role="tab" aria-disabled="true" className="lxh-tab is-off" title="Finish the check to see your results">Results</span>}
        </div>
        <button type="button" className="bb-btn bb-btn-secondary lecture-bar-end" onClick={leave}>
          Go to my courses <Icon name="back" size={16} className="icon-flip" />
        </button>
      </header>
      <iframe key={src} className="lexpace-frame" src={src} title="LexPace check" />
    </div>
  );
}

function MyCourses() {
  const [support, setSupport] = useApi("/api/lexpace/profile");
  const [courses] = useApi("/api/courses");
  const [materials] = useApi("/api/lexpace/materials");
  return (
    <div className="lxh-body">
      {support?.version && <VersionBar support={support} onChange={setSupport} />}
      {support?.source === "skipped" && (
        <p className="lxh-hint">Want materials matched to you? <Link to="/lexpace-hub/check">Take the 10-minute LexPace check</Link>.</p>
      )}
      {(courses || []).map((c) => {
        const chapters = (materials || []).filter((m) => m.courseId === c.id);
        const ready = chapters.filter((m) => m.available).length;
        return (
          <div className="content-item is-card" key={c.id}>
            <Link to={`/lexpace-hub/courses/${c.id}`} className="content-main lxh-link">
              <Icon name="courses" size={28} className="content-icon" />
              <span className="content-text">
                <span className="content-title">{c.title}</span>
                <span className="content-due">{c.code} · {ready} of {chapters.length} chapters ready in your format</span>
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function CourseChapters() {
  const { courseId } = useParams();
  const [courses] = useApi("/api/courses");
  const [materials] = useApi("/api/lexpace/materials");
  const course = courses?.find((c) => c.id === courseId);
  if (courses && !course) return <Navigate to="/lexpace-hub/courses" replace />;
  const chapters = (materials || []).filter((m) => m.courseId === courseId);
  return (
    <div className="lxh-body">
      <Link to="/lexpace-hub/courses" className="back-link"><Icon name="back" size={18} />My courses</Link>
      <h2 className="lxh-h2">{course?.title}</h2>
      <p className="lxh-muted">Chapters uploaded by {course?.instructor || "your teacher"}.</p>
      {chapters.map((m) => (
        <div className="content-item is-card" key={m.id}>
          <Link to={`/lexpace-hub/courses/${courseId}/${m.id}`} className="content-main lxh-link">
            <Icon name={m.available ? "book" : "document"} size={28} className="content-icon" />
            <span className="content-text">
              <span className="content-title">{m.title}</span>
              <span className="content-due">
                {m.available
                  ? <span className="lxh-status is-ready">Ready in your format</span>
                  : <span className="lxh-status">Not in your format yet</span>}
              </span>
            </span>
          </Link>
        </div>
      ))}
    </div>
  );
}

function Chapter() {
  const { courseId, materialId } = useParams();
  const [state, setState] = useState(null);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([getJSON("/api/lexpace/materials"), getJSON("/api/lexpace/profile")]).then(([materials, support]) => {
      if (!live) return;
      // Write the saved version before the iframe loads, so the lecture opens on it.
      writeLectureVersion(support.version || "base");
      setState({ material: materials.find((m) => m.id === materialId && m.courseId === courseId) || null, support });
    });
    return () => { live = false; };
  }, [courseId, materialId]);

  if (!state) return null;
  const m = state.material;
  if (!m) return <Navigate to={`/lexpace-hub/courses/${courseId}`} replace />;
  const back = <Link to={`/lexpace-hub/courses/${courseId}`} className="back-link"><Icon name="back" size={18} />Chapters</Link>;

  if (m.available) {
    return (
      <div className="lxh-frame">
        <div className="lecture-bar">{back}<span className="lecture-title">{m.title}</span></div>
        <iframe className="lexpace-frame" src={m.url} title={m.title} />
      </div>
    );
  }
  return (
    <div className="lxh-body">
      {back}
      <div className="lx-welcome lxh-generate">
        <h2>{m.title}</h2>
        <p>This chapter hasn't been turned into your format ({state.support.label || "Base lesson"}) yet.</p>
        <button type="button" className="bb-btn" onClick={() => setAsked(true)} disabled={asked}>Generate this format</button>
        <p className="lxh-note" role="status">
          {asked && "Coming soon. In this demo, only Week 6–7: Pipelining can be opened in your format."}
        </p>
      </div>
    </div>
  );
}

// DEMO ONLY (remove before pushing): every page refresh starts as a first-time visitor.
// Clears the saved format and the last results summary once per page load, so the Welcome screen shows again.
let demoResetDone = false;

export default function LexPace() {
  const [ready, setReady] = useState(demoResetDone);
  useEffect(() => {
    if (demoResetDone) return;
    demoResetDone = true;
    try { localStorage.removeItem(SUMMARY_KEY); } catch { /* storage blocked: nothing saved */ }
    saveVersion(null).finally(() => setReady(true));
  }, []);
  if (!ready) return null;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="check" element={<Check />} />
        <Route path="training/*" element={<TrainingHub />} />
        <Route path="requests" element={<MyRequests />} />
        <Route path="results" element={<Results />} />
        <Route path="courses" element={<MyCourses />} />
        <Route path="courses/:courseId" element={<CourseChapters />} />
        <Route path="courses/:courseId/:materialId" element={<Chapter />} />
        <Route path="*" element={<Navigate to="/lexpace-hub" replace />} />
      </Route>
    </Routes>
  );
}
