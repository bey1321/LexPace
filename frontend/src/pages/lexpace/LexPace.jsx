import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/Icon.jsx";
import { VERSION_OPTIONS, getJSON, saveVersion, useApi, writeLectureVersion } from "../../api.js";
import "./lexpace.css";

// LexPace as one place in Blackboard: the optional check, training, and My courses
// (each course's chapters, opened in the student's lesson version).

const TRAINING_SRC = "/lexpace/training/dev/login?userId=2023006229&course=ca";

const SCREENING_LANGS = [
  { label: "English", lang: "en", src: "/lexpace/journey/en.html" },
  { label: "العربية", lang: "ar", src: "/lexpace/journey/ar.html" },
];

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

const TITLES = { check: "LexPace check", training: "Training", courses: "My courses" };

// Same look as the Tools page: a big header, then tiles. Sub-pages get a back link to LexPace.
function Layout() {
  const { pathname } = useLocation();
  const section = pathname.split("/")[2];
  return (
    <div className="lxh">
      <header className={"page-header" + (section ? " frame-header" : "")}>
        {section && <Link to="/lexpace-hub" className="back-link"><Icon name="back" size={18} />LexPace</Link>}
        <h1 className="page-title">{TITLES[section] || "LexPace"}</h1>
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
    </div>
  );
}

function Check() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const leave = async () => {
    await skipCheck();
    navigate("/lexpace-hub/courses");
  };
  const v = SCREENING_LANGS[active];
  return (
    <div className="lxh-frame">
      <div className="lecture-bar">
        <span className="lecture-title">LexPace check</span>
        <div className="lang-switch" role="group" aria-label="Language">
          {SCREENING_LANGS.map((l, i) => (
            <button key={l.src} type="button" lang={l.lang} aria-pressed={i === active}
              className={i === active ? "is-on" : ""} onClick={() => setActive(i)}>{l.label}</button>
          ))}
        </div>
        <button type="button" className="bb-btn bb-btn-secondary lecture-bar-end" onClick={leave}>
          Go to my courses <Icon name="back" size={16} className="icon-flip" />
        </button>
      </div>
      <iframe key={v.src} className="lexpace-frame" src={v.src} title="LexPace check" />
    </div>
  );
}

function Training() {
  return (
    <div className="lxh-frame">
      <iframe className="lexpace-frame" src={TRAINING_SRC} title="LexPace Training" />
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
// Clears the saved format once per page load, so the Welcome screen shows again.
let demoResetDone = false;

export default function LexPace() {
  const [ready, setReady] = useState(demoResetDone);
  useEffect(() => {
    if (demoResetDone) return;
    demoResetDone = true;
    saveVersion(null).finally(() => setReady(true));
  }, []);
  if (!ready) return null;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="check" element={<Check />} />
        <Route path="training" element={<Training />} />
        <Route path="courses" element={<MyCourses />} />
        <Route path="courses/:courseId" element={<CourseChapters />} />
        <Route path="courses/:courseId/:materialId" element={<Chapter />} />
        <Route path="*" element={<Navigate to="/lexpace-hub" replace />} />
      </Route>
    </Routes>
  );
}
