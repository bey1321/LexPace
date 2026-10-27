import Icon from "../components/Icon.jsx";

export default function EmptyPage({ title, icon, text }) {
  return (
    <>
      <header className="page-header"><h1 className="page-title">{title}</h1></header>
      <div className="empty-state">
        <span className="empty-icon"><Icon name={icon} size={40} /></span>
        <p>{text}</p>
      </div>
    </>
  );
}
