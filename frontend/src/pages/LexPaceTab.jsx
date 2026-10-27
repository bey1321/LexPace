import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { PROFILE_OPTIONS, getJSON, saveProfile, useApi, writeLectureProfile } from "../api.js";

function ProfileBar({ profile, onChange }) {
  const [saving, setSaving] = useState(false);
  const change = async (e) => {
    setSaving(true);
    try { onChange(await saveProfile(e.target.value || null)); } finally { setSaving(false); }
  };
  return (
    <div className="lx-profile-bar">
      <div>
        <span className="lx-profile-label">Your support profile: </span>
        {profile.profile
          ? <b className="lx-profile-name">{profile.label}</b>
          : <><b className="lx-profile-name">Not screened yet</b> <Link to="/tools/screening" className="lx-link">Take LexPace Screening</Link></>}
        {profile.source === "screening" && <span className="lx-profile-src"> (from your screening)</span>}
      </div>
      <label className="lx-picker">
        <span>{profile.profile ? "Change profile" : "Or choose a profile"}</span>
        <select value={profile.profile || ""} onChange={change} disabled={saving}>
          <option value="">Not screened yet</option>
          {PROFILE_OPTIONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
    </div>
  );
}

export default function LexPaceTab({ courseId }) {
  const [materials] = useApi("/api/lexpace/materials");
  const [profile, setProfile] = useApi("/api/lexpace/profile");
  const navigate = useNavigate();

  const open = (m) => {
    writeLectureProfile(profile?.profile);
    navigate(`/courses/${courseId}/lexpace/${m.id}`);
  };

  return (
    <div className="course-body course-body-single">
      <section className="course-content">
        <div className="section-head"><h2>My adapted materials</h2></div>
        {profile && <ProfileBar profile={profile} onChange={setProfile} />}
        {(materials || []).map((m) => m.available ? (
          <div className="content-item is-card" key={m.id}>
            <button type="button" className="content-main" onClick={() => open(m)}>
              <Icon name="book" size={28} className="content-icon" />
              <span className="content-text">
                <span className="content-title">{m.title}</span>
                <span className="content-due">Adapted lecture · opens on your support profile</span>
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

export function LectureViewer({ courseId }) {
  const { materialId } = useParams();
  const [state, setState] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([getJSON("/api/lexpace/materials"), getJSON("/api/lexpace/profile")]).then(([materials, profile]) => {
      if (!live) return;
      // Write the saved profile before the iframe loads, so the lecture opens on it.
      writeLectureProfile(profile.profile);
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
