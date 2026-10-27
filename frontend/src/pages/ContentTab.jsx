import { useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";
import { useApi } from "../api.js";

function useToast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg, setMsg];
}

function ItemRow({ item, nested, onDemo }) {
  return (
    <div className={"content-item" + (nested ? " is-nested" : " is-card")}>
      <button type="button" className="content-main" onClick={() => onDemo(item.title)}>
        <Icon name={item.type} size={nested ? 30 : 28} className="content-icon" />
        <span className="content-text">
          <span className="content-title">{item.title}</span>
          {item.due && <span className="content-due">{item.due}</span>}
        </span>
      </button>
      {item.menu && <button type="button" className="icon-btn more-btn" aria-label={`More options for ${item.title}`} onClick={() => onDemo(item.title)}><Icon name="more" size={24} /></button>}
    </div>
  );
}

function Folder({ item, onDemo }) {
  const [open, setOpen] = useState(item.open);
  return (
    <div className={"content-folder" + (open ? " is-open" : "")}>
      <button type="button" className="folder-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name={open ? "folderOpen" : "folder"} size={28} className="content-icon" />
        <span className="content-title">{item.title}</span>
        <Icon name={open ? "chevronUp" : "chevronDown"} size={24} className="folder-chevron" />
      </button>
      {open && <div className="folder-body">{item.children.map((c) => <ItemRow key={c.id} item={c} nested onDemo={onDemo} />)}</div>}
    </div>
  );
}

export default function ContentTab({ courseId, instructor }) {
  const [items] = useApi(`/api/courses/${courseId}/content`);
  const [toast, setToast] = useToast();
  const demo = (title) => setToast(`Demo item: “${title}” is not part of this demo.`);

  return (
    <div className="course-body">
      <section className="course-content">
        <div className="section-head">
          <h2>Course Content</h2>
          <button type="button" className="icon-btn" aria-label="Search course content"><Icon name="search" size={24} /></button>
        </div>
        {(items || []).map((it) => it.type === "folder"
          ? <Folder key={it.id} item={it} onDemo={demo} />
          : <ItemRow key={it.id} item={it} onDemo={demo} />)}
      </section>
      <aside className="course-side">
        <div className="side-block">
          <h2>Course Faculty</h2>
          <div className="faculty">
            <span className="faculty-avatar"><Icon name="user" size={30} /></span>
            <span className="faculty-text"><span className="faculty-name">{instructor}</span><span className="role-chip">INSTRUCTOR</span></span>
            <button type="button" className="icon-btn" aria-label={`Message ${instructor}`}><Icon name="envelope" size={22} /></button>
          </div>
        </div>
        <div className="side-block">
          <h2>Details &amp; Actions</h2>
          <ul className="details">
            <li><Icon name="roster" size={20} /><span><b>Roster</b><a href="#demo" onClick={(e) => { e.preventDefault(); demo("Roster"); }}>View everyone in your course</a></span></li>
            <li><Icon name="collaborate" size={20} /><span><b>Class Collaborate</b><a href="#demo" onClick={(e) => { e.preventDefault(); demo("Class Collaborate"); }}>Join session</a></span></li>
            <li><Icon name="attendance" size={20} /><span><b>Attendance</b><a href="#demo" onClick={(e) => { e.preventDefault(); demo("Attendance"); }}>View your attendance</a></span></li>
            <li><Icon name="wrench" size={20} /><span><b>Books &amp; Tools</b><a href="#demo" onClick={(e) => { e.preventDefault(); demo("Books & Tools"); }}>View course &amp; institution tools</a></span></li>
          </ul>
        </div>
      </aside>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
