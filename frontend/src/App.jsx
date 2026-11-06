import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import HelpButton from "./components/HelpButton.jsx";
import Profile from "./pages/Profile.jsx";
import Courses from "./pages/Courses.jsx";
import Tools from "./pages/Tools.jsx";
import EmptyPage from "./pages/EmptyPage.jsx";
import CoursePage from "./pages/CoursePage.jsx";
import LexPace from "./pages/lexpace/LexPace.jsx";
import TrainingStandalone from "./pages/standalone/TrainingStandalone.jsx";
import SasPortal from "./pages/SasPortal.jsx";

function Shell() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="shell-main"><Outlet /></main>
      <HelpButton />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/courses" replace />} />
        <Route path="profile" element={<Profile />} />
        <Route path="activity" element={<EmptyPage title="Activity" icon="globe" text="You're all caught up. New activity in your courses will show up here." />} />
        <Route path="courses" element={<Courses />} />
        <Route path="calendar" element={<EmptyPage title="Calendar" icon="calendar" text="Nothing is scheduled. Due dates and course events will show up here." />} />
        <Route path="messages" element={<EmptyPage title="Messages" icon="mail" text="No messages yet." />} />
        <Route path="grades" element={<EmptyPage title="Grades" icon="grades" text="No grades have been posted yet." />} />
        <Route path="tools" element={<Tools />} />
        <Route path="lexpace-hub/*" element={<LexPace />} />
        <Route path="sas-portal" element={<SasPortal />} />
        {/* Old entry points now live in LexPace */}
        <Route path="tools/screening" element={<Navigate to="/lexpace-hub/check" replace />} />
        <Route path="tools/training" element={<Navigate to="/lexpace-hub/training" replace />} />
        <Route path="signout" element={<EmptyPage title="Signed out" icon="signout" text="This is a demo, so there is nothing to sign out of. Pick any item on the left to continue." />} />
      </Route>
      <Route path="courses/:courseId/*" element={<CoursePage />} />
      <Route path="training/*" element={<TrainingStandalone />} />
      <Route path="*" element={<Navigate to="/courses" replace />} />
    </Routes>
  );
}
