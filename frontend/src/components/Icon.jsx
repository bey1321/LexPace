// Simple outline icons drawn to match Blackboard Ultra's line icons.
const PATHS = {
  user: <><circle cx="12" cy="8" r="4.2" fill="currentColor" stroke="none" /><path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z" fill="currentColor" stroke="none" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" /></>,
  courses: <><rect x="4" y="3" width="16" height="18" /><path d="M8 3v18M11 8h6M11 12h6" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" /><path d="M3 5.5l9 7 9-7M3 18.5l6.5-6M21 18.5l-6.5-6" /></>,
  grades: <><path d="M5 3h9l5 5v13H5z" /><path d="M14 3v5h5M9 12l2 2 4-4" /></>,
  tools: <><path d="M14 4H4v16h16V10" /><path d="M10 14l1-4 8-8 3 3-8 8z" /></>,
  signout: <><path d="M15 12H5M8.5 8.5L5 12l3.5 3.5" /><path d="M10 4.5a8 8 0 1 1 0 15" /></>,
  home: <><path d="M4 11l8-7 8 7M6 9.5V20h4.5v-6h3v6H18V9.5" /></>,
  caretDown: <path d="M6 9l6 6 6-6" fill="currentColor" stroke="none" transform="translate(0 0)" />,
  chevronDown: <path d="M5 9l7 7 7-7" />,
  chevronUp: <path d="M5 15l7-7 7 7" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>,
  more: <><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></>,
  file: <><path d="M6 2.5h8.5L19 7v14.5H6z" /><path d="M14.5 2.5V7H19M9 11h7M9 14h7M9 17h7" /></>,
  document: <><path d="M6 2.5h8.5L19 7v14.5H6z" /><path d="M14.5 2.5V7H19M9 10.5h7M9 13h7M9 15.5h7M9 18h4" /><rect x="9" y="10" width="2.5" height="2.5" /></>,
  assignment: <><path d="M6 2.5h8.5L19 7v14.5H6z" /><path d="M14.5 2.5V7H19M8.5 11l1.2 1.2 2-2M13 11.5h3.5M8.5 16l1.2 1.2 2-2M13 16.5h3.5" /></>,
  folder: <path d="M3 5.5h6.5l2 2.5H21v11.5H3z" />,
  folderOpen: <><path d="M3 5.5h6.5l2 2.5H20v3" /><path d="M3 5.5v14h17l1.5-8.5H5.5L3 19.5" /></>,
  image: <><rect x="3" y="3" width="18" height="18" /><path d="M3 18l6-6 4 4 3-3 5 5M15.5 8.5h.01" /><circle cx="15.5" cy="8.5" r="1.5" /></>,
  roster: <><circle cx="10" cy="8" r="4" /><path d="M3 21c0-4 3-7 7-7M14 18l2 2 5-5" /></>,
  collaborate: <><rect x="2.5" y="6" width="19" height="12" /><path d="M7 10v4l3-2zM14 10h4M14 14h4" /></>,
  attendance: <><rect x="3.5" y="5" width="17" height="15.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4M8 15l2.5 2.5L16 12" /></>,
  wrench: <path d="M14.5 6.5a4.5 4.5 0 0 0 5.7 5.7L12 20.5 8.5 20 4 15.5l8.3-8.2a4.5 4.5 0 0 0 2.2-.8z" />,
  envelope: <><rect x="3" y="5.5" width="18" height="13" /><path d="M3 5.5l9 7 9-7M3 18.5l6.5-6M21 18.5l-6.5-6" /></>,
  help: <><path d="M12 21a9 9 0 1 0-8-4.9L3 21l4.9-1A9 9 0 0 0 12 21z" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 16.5h.01" /></>,
  rocket: <><path d="M14 4c3-1.5 6-1 6-1s.5 3-1 6l-7 7-5-5z" /><path d="M7 11l-3 .5L2.5 14l4 1M13 17l-.5 3L10 21.5l-1-4M15.5 8.5h.01M3 21l4-4" /></>,
  list: <><rect x="3" y="4" width="5" height="4" /><rect x="3" y="10" width="5" height="4" /><rect x="3" y="16" width="5" height="4" /><path d="M11 6h10M11 12h10M11 18h10" /></>,
  grid: <><circle cx="6" cy="6" r="1.8" fill="currentColor" /><circle cx="12" cy="6" r="1.8" fill="currentColor" /><circle cx="18" cy="6" r="1.8" fill="currentColor" /><circle cx="6" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="18" cy="12" r="1.8" fill="currentColor" /><circle cx="6" cy="18" r="1.8" fill="currentColor" /><circle cx="12" cy="18" r="1.8" fill="currentColor" /><circle cx="18" cy="18" r="1.8" fill="currentColor" /></>,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
  book: <><path d="M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4zM20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6z" /></>,
  pulse: <><path d="M3 12h4l2-5 4 10 2-5h6" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
};

export default function Icon({ name, size = 20, className = "", title }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"
      aria-hidden={title ? undefined : "true"} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
