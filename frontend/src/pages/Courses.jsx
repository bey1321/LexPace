import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { useApi } from "../api.js";

function TodoSection({ title, empty }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="todo-section">
      <button className="todo-head" type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span><Icon name={open ? "chevronUp" : "chevronDown"} size={22} />
      </button>
      {open && <div className="todo-empty">{empty}</div>}
    </section>
  );
}

export default function Courses() {
  const [courses] = useApi("/api/courses");
  const [q, setQ] = useState("");
  const shown = (courses || []).filter((c) => (c.title + " " + c.code).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="courses-page">
      <div className="courses-main">
        <header className="page-header page-header-white"><h1 className="page-title">Courses</h1></header>
        <div className="courses-body">
          <div className="courses-toolbar">
            <div className="view-toggle">
              <button type="button" aria-label="List view"><Icon name="list" size={22} /></button>
              <button type="button" className="is-on" aria-label="Grid view"><Icon name="grid" size={22} /></button>
            </div>
            <label className="search-box">
              <Icon name="search" size={22} />
              <input placeholder="Search your courses" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          <div className="courses-filters">
            <label className="select-box"><span className="select-legend">Terms</span>
              <select><option>All Terms</option><option>Fall 2026</option></select></label>
            <label className="select-box"><span className="select-legend">Filters</span>
              <select><option>All courses</option><option>Favorites</option></select></label>
            <label className="select-box select-small"><select defaultValue="25"><option>10</option><option>25</option><option>50</option></select></label>
            <span className="per-page">items per page</span>
          </div>
          <p className="results-count">{shown.length} result{shown.length === 1 ? "" : "s"}</p>
          <h2 className="term-heading">Fall 2026</h2>
          <div className="course-grid">
            {shown.map((c) => (
              <article className="course-card" key={c.id}>
                <Link to={`/courses/${c.id}/content`} className="course-card-link">
                  <div className="course-card-img" />
                  <div className="course-card-text">
                    <p className="course-code">{c.code}</p>
                    <h3 className="course-name">{c.title}</h3>
                    <p className="course-status">{c.status}</p>
                  </div>
                </Link>
                <div className="course-card-foot">
                  <span>{c.instructor}</span>
                  <button type="button" className="icon-btn" aria-label="Add to favorites"><Icon name="star" size={22} /></button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
      <aside className="todo-panel" aria-label="To Do">
        <h2 className="todo-title">To Do</h2>
        <TodoSection title="Overdue" empty="No overdue items in past 7 days" />
        <TodoSection title="Due Today" empty="No items due today" />
        <TodoSection title="Due Soon" empty="No items due in next 7 days" />
      </aside>
    </div>
  );
}
