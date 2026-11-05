import { Link, Navigate, Route, Routes } from "react-router-dom";
import Icon from "../../../components/Icon.jsx";
import NumberSense from "./numbersense/NumberSense.jsx";
import ReadingPractice from "./readingpractice/ReadingPractice.jsx";
import WritingHub from "./writing/WritingHub.jsx";

// Replaces the old Training tile's content (which opened the separate RAP reading app).
// This tile now opens the training modules from the Training Programs spec.

const MODULES = [
  { to: "numbersense", icon: "pulse", label: "Number Sense Practice", ready: true },
  { to: "reading", icon: "book", label: "Reading Fluency Practice", ready: true },
  { to: "writing", icon: "document", label: "Writing Practice", ready: true },
];

function ComingSoon({ label }) {
  return (
    <div className="lxh-body">
      <p className="lxh-muted">{label} is not built yet in this demo.</p>
    </div>
  );
}

function Hub() {
  return (
    <div className="lxh-body">
      <p className="lxh-intro-sm">Short, private practice sessions. Open to every student - using one does not require taking the LexPace check.</p>
      <div className="tools-grid">
        {MODULES.map((m) => m.ready ? (
          <Link key={m.to} className="tool-card is-link" to={m.to}>
            <span className="lexpace-mark"><Icon name={m.icon} size={26} /></span>
            <span>{m.label}</span>
          </Link>
        ) : (
          <div key={m.to} className="tool-card" aria-disabled="true">
            <span className="lexpace-mark"><Icon name={m.icon} size={26} /></span>
            <span>{m.label} (coming soon)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrainingHub() {
  return (
    <Routes>
      <Route index element={<Hub />} />
      <Route path="numbersense" element={<NumberSense />} />
      <Route path="reading" element={<ReadingPractice />} />
      <Route path="writing/*" element={<WritingHub />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
