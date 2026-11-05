import { Link, Navigate, Route, Routes } from "react-router-dom";
import Icon from "../../components/Icon.jsx";
import NumberSense from "../lexpace/training/numbersense/NumberSense.jsx";
import ReadingPractice from "../lexpace/training/readingpractice/ReadingPractice.jsx";
import WritingHub from "../lexpace/training/writing/WritingHub.jsx";
import "./standalone.css";

// A standalone entry point for the training modules, separate from the Blackboard/LexPace
// simulation entirely - no sidebar, no course chrome, nothing nested three levels deep. This
// exists for cloning out into its own deployable package later (the plan is a Python/Streamlit
// rebuild down the line); for now it's the same React components, just reached directly.
//
// It reuses the exact same training components LexPace's own Training tile uses (not copies -
// one set of files, two entry points), so nothing here duplicates logic.
//
// The main, Blackboard-integrated version (reachable via LexPace -> Training) is untouched and
// keeps working exactly as before - this is purely an additional, separate way in.

const MODULES = [
  { to: "numbersense", icon: "pulse", label: "Number Sense Practice", desc: "Number-line, comparison and conversion practice across 7 number types." },
  { to: "reading", icon: "book", label: "Reading Fluency Practice", desc: "Breznitz et al. reading-acceleration practice, with easier navigation (back to menu, pause, restart, end, anytime)." },
  { to: "writing", icon: "document", label: "Writing Practice", desc: "Spelling, Sentence Combining, and Planning & Organising Essays (SRSD)." },
];

function Home() {
  return (
    <>
      <div className="st-head">
        <h1>Training</h1>
        <p>A standalone area for trying the training modules on their own, outside the Blackboard simulation.</p>
      </div>
      <div className="tools-grid">
        {MODULES.map((m) => (
          <Link key={m.to} className="tool-card is-link" to={m.to}>
            <span className="lexpace-mark"><Icon name={m.icon} size={26} /></span>
            <span>{m.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function TrainingStandalone() {
  return (
    <div className="st-shell">
      <div className="st-body">
        <Routes>
          <Route index element={<Home />} />
          <Route path="numbersense" element={<NumberSense />} />
          <Route path="reading" element={<ReadingPractice />} />
          <Route path="writing/*" element={<WritingHub />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </div>
    </div>
  );
}
