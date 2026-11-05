import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Spelling from "./spelling/Spelling.jsx";
import SentenceCombining from "./sentencecombining/SentenceCombining.jsx";
import SRSD from "./srsd/SRSD.jsx";
import "./writing.css";

// Writing Practice home: three open trainings, no recommendation, no lock, no routing quiz.
// Spec section 0 explicitly excludes the prototype's "Areas to practise" screen, plan-building
// and routing, the 5-item skip check, and any SRSD lock behind sentence combining - all of
// that is intentionally not built. The student just picks a card.
// No "Continue" vs "Start" distinction yet, since there is no saved progress in this build
// (same scope decision as Number Sense and Reading Fluency) - every card always says Start.

const CARDS = [
  { to: "spelling", label: "Spelling", desc: "Build spelling accuracy with quick recognition games and dictation." },
  { to: "sentences", label: "Sentence Combining", desc: "Practise grammar and punctuation by joining short sentences into one." },
  { to: "srsd", label: "Planning and Organising Essays", desc: "A step-by-step strategy for planning, writing and revising argument essays." },
];

function Home() {
  const navigate = useNavigate();
  return (
    <div className="lxh-body">
      <button type="button" className="wp-btn wp-o wp-sm" onClick={() => navigate("..")} style={{ marginBottom: 16 }}>← Training menu</button>
      <p className="lxh-intro-sm">Three trainings, open from the start. Open any of them, in any order, and switch whenever you like. Nothing is recommended or locked, and your results are private.</p>
      <div className="wp-cards">
        {CARDS.map((c) => (
          <Link key={c.to} to={c.to} className="wp-card">
            <h3>{c.label}</h3>
            <p>{c.desc}</p>
            <span className="wp-card-cta">Start</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function WritingHub() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="spelling/*" element={<Spelling />} />
      <Route path="sentences/*" element={<SentenceCombining />} />
      <Route path="srsd/*" element={<SRSD />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
