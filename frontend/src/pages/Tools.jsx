import Icon from "../components/Icon.jsx";

function StudiosityMark() {
  return (
    <svg width="40" height="48" viewBox="0 0 40 48" aria-hidden="true">
      <path d="M30 12c-2-4-6-6-11-6-6 0-10 3-10 8 0 11 21 7 21 19 0 5-4 9-11 9-5 0-9-2-11-6"
        fill="none" stroke="#e5e518" strokeWidth="7" strokeLinecap="round" />
      <circle cx="31" cy="7" r="3.2" fill="#111" /><circle cx="7" cy="41" r="3.2" fill="#111" />
    </svg>
  );
}

export default function Tools() {
  return (
    <>
      <header className="page-header"><h1 className="page-title">Tools</h1></header>
      <div className="tools-grid">
        <div className="tool-card"><Icon name="rocket" size={46} /><span>Application Authorization</span></div>
        <div className="tool-card"><StudiosityMark /><span>Studiosity - Fast feedback on your assignment</span></div>
      </div>
    </>
  );
}
