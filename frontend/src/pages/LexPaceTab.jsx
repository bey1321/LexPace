import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { VERSION_OPTIONS, getJSON, saveVersion, useApi, writeLectureVersion } from "../api.js";

const SOURCE_NOTE = {
  screening: " (from your check)",
  screening_pending: " (check done, results pending)",
  skipped: " (check skipped)",
};

const SCREENING_LANGS = [
  { label: "English", lang: "en", src: "/lexpace/journey/en.html" },
  { label: "العربية", lang: "ar", src: "/lexpace/journey/ar.html" },
];

// Leaving the check (finished or not) without any saved version means the student skipped it.
async function skipCheck() {
  const current = await getJSON("/api/lexpace/profile");
  if (!current.version) await saveVersion("base", "skipped");
}

function SupportBar({ support, onChange, courseId }) {
  const [saving, setSaving] = useState(false);
  const change = async (e) => {
    setSaving(true);
    try { onChange(await saveVersion(e.target.value || null)); } finally { setSaving(false); }
  };
  return (
    <div className="lx-profile-bar">
      <div>
        <span className="lx-profile-label">Your lesson version: </span>
        <b className="lx-profile-name">{support.label}</b>
        {SOURCE_NOTE[support.source] && <span className="lx-profile-src">{SOURCE_NOTE[support.source]}</span>}
        <Link to={`/courses/${courseId}/lexpace/screening`} className="lx-link">
          {support.source === "screening" ? "Retake the LexPace check" : "Take the LexPace check"}
        </Link>
      </div>
      <label className="lx-picker">
        <span>Change version</span>
        <select value={support.version} onChange={change} disabled={saving}>
          {VERSION_OPTIONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
    </div>
  );
}

// First visit (no lesson version yet): take the check, or skip straight to the materials.
function Welcome({ courseId, onSkip }) {
  const [busy, setBusy] = useState(false);
  const skip = async () => {
    setBusy(true);
    try { await skipCheck(); onSkip(await getJSON("/api/lexpace/profile")); } finally { setBusy(false); }
  };
  return (
    <div className="lx-welcome">
      <h2>Welcome to LexPace</h2>
      <p>LexPace can adapt this course's lecture materials to the way you read, write and work with numbers.</p>
      <div className="lx-welcome-options">
        <div className="lx-option-card">
          <Icon name="pulse" size={28} />
          <h3>Take the LexPace check</h3>
          <p>Seven short activities, about 10 minutes, in English or Arabic. It is a screening, not a diagnosis, and it helps choose the version of the materials that suits you.</p>
          <Link to={`/courses/${courseId}/lexpace/screening`} className="bb-btn">Start the check</Link>
        </div>
        <div className="lx-option-card">
          <Icon name="book" size={28} />
          <h3>Skip for now</h3>
          <p>Go straight to the adapted materials. They open on the base lesson, and you can switch versions inside the lecture or take the check later from this tab.</p>
          <button type="button" className="bb-btn bb-btn-secondary" onClick={skip} disabled={busy}>Skip and go to my materials</button>
        </div>
      </div>
    </div>
  );
}

export default function LexPaceTab({ courseId }) {
  const [materials] = useApi("/api/lexpace/materials");
  const [support, setSupport] = useApi("/api/lexpace/profile");
  const navigate = useNavigate();

  const open = (m) => {
    writeLectureVersion(support?.version);
    navigate(`/courses/${courseId}/lexpace/${m.id}`);
  };

  if (!support) return null;
  if (!support.version) {
    return <div className="course-body course-body-single"><Welcome courseId={courseId} onSkip={setSupport} /></div>;
  }

  return (
    <div className="course-body course-body-single">
      <section className="course-content">
        <div className="section-head"><h2>My adapted materials</h2></div>
        <SupportBar support={support} onChange={setSupport} courseId={courseId} />
        {(materials || []).map((m) => m.available ? (
          <div className="content-item is-card" key={m.id}>
            <button type="button" className="content-main" onClick={() => open(m)}>
              <Icon name="book" size={28} className="content-icon" />
              <span className="content-text">
                <span className="content-title">{m.title}</span>
                <span className="content-due">Adapted lecture · opens on your lesson version</span>
              </span>
            </button>
          </div>
        ) : (
          <div className="content-item is-card is-disabled" key={m.id} aria-disabled="true">
            <div className="content-main">
              <Icon name="lock" size={28} className="content-icon" />
              <span className="content-text">
                <span className="content-title">{m.title}</span>
                <span className="content-due">Adaptation coming soon</span>
              </span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

// The LexPace check (EN/AR games) inside the course, with a way out at any time.
export function ScreeningView({ courseId }) {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const leave = async () => {
    await skipCheck();
    navigate(`/courses/${courseId}/lexpace`);
  };
  const v = SCREENING_LANGS[active];
  return (
    <div className="lecture-view">
      <div className="lecture-bar">
        <span className="lecture-title">LexPace check</span>
        <div className="lang-switch" role="group" aria-label="Language">
          {SCREENING_LANGS.map((l, i) => (
            <button key={l.src} type="button" lang={l.lang} aria-pressed={i === active}
              className={i === active ? "is-on" : ""} onClick={() => setActive(i)}>{l.label}</button>
          ))}
        </div>
        <button type="button" className="bb-btn bb-btn-secondary lecture-bar-end" onClick={leave}>
          Go to my materials <Icon name="back" size={16} className="icon-flip" />
        </button>
      </div>
      <iframe key={v.src} className="lexpace-frame" src={v.src} title="LexPace check" />
    </div>
  );
}

export function LectureViewer({ courseId }) {
  const { materialId } = useParams();
  const [state, setState] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([getJSON("/api/lexpace/materials"), getJSON("/api/lexpace/profile")]).then(([materials, support]) => {
      if (!live) return;
      // Write the saved version before the iframe loads, so the lecture opens on it.
      writeLectureVersion(support.version);
      setState({ material: materials.find((m) => m.id === materialId && m.available) || null });
    });
    return () => { live = false; };
  }, [materialId]);

  if (!state) return null;
  if (!state.material) return <Navigate to={`/courses/${courseId}/lexpace`} replace />;
  return (
    <div className="lecture-view">
      <div className="lecture-bar">
        <Link to={`/courses/${courseId}/lexpace`} className="back-link"><Icon name="back" size={18} />My adapted materials</Link>
        <span className="lecture-title">{state.material.title}</span>
      </div>
      <iframe className="lexpace-frame" src={state.material.url} title={state.material.title} />
    </div>
  );
}
