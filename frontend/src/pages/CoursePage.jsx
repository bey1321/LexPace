import { Link, Navigate, NavLink, Route, Routes, useParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { useApi } from "../api.js";
import HelpButton from "../components/HelpButton.jsx";
import ContentTab from "./ContentTab.jsx";

const TABS = [
  ["content", "Content"],
  ["calendar", "Calendar"],
  ["announcements", "Announcements"],
  ["discussions", "Discussions"],
  ["gradebook", "Gradebook"],
  ["messages", "Messages"],
  ["groups", "Groups"],
  ["achievements", "Achievements"],
];

function TabEmpty({ label }) {
  return (
    <div className="course-empty">
      <h2>{label}</h2>
      <p>Nothing here yet. Your instructor hasn't added anything to {label} for this course.</p>
    </div>
  );
}

export default function CoursePage() {
  const { courseId } = useParams();
  const [courses] = useApi("/api/courses");
  const course = courses?.find((c) => c.id === courseId);
  if (courses && !course) return <Navigate to="/courses" replace />;
  const title = course?.title || "";

  return (
    <div className="course-page">
      <div className="course-topbar">
        <Link to="/courses" className="home-btn" aria-label="Back to Courses"><Icon name="home" size={22} /></Link>
        <Link to="/courses" className="crumb-courses">Courses <Icon name="caretDown" size={14} /></Link>
        <span className="crumb-sep" />
        <span className="crumb-title">{title}</span>
        <span className="open-badge">{course?.status?.toUpperCase()}</span>
      </div>
      <nav className="course-tabs" aria-label="Course navigation">
        {TABS.map(([id, label]) => (
          <NavLink key={id} to={`/courses/${courseId}/${id}`} className={({ isActive }) => "course-tab" + (isActive ? " is-active" : "")}>
            {label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Navigate to="content" replace />} />
        {/* LexPace moved to its own place in the sidebar */}
        <Route path="lexpace/screening" element={<Navigate to="/lexpace-hub/check" replace />} />
        <Route path="lexpace/*" element={<Navigate to={`/lexpace-hub/courses/${courseId}`} replace />} />
        <Route path="*" element={
          <>
            <div className="course-banner"><h1>{title}</h1></div>
            <Routes>
              <Route path="content" element={<ContentTab courseId={courseId} instructor={course?.instructor} />} />
              {TABS.filter(([id]) => id !== "content").map(([id, label]) => (
                <Route key={id} path={id} element={<TabEmpty label={label} />} />
              ))}
              <Route path="*" element={<Navigate to="content" replace />} />
            </Routes>
          </>
        } />
      </Routes>
      <HelpButton />
    </div>
  );
}
