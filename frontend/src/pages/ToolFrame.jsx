import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";

export default function ToolFrame({ title, src }) {
  return (
    <div className="frame-page">
      <header className="page-header frame-header">
        <Link to="/tools" className="back-link"><Icon name="back" size={18} />Tools</Link>
        <h1 className="page-title">{title}</h1>
      </header>
      <iframe className="lexpace-frame" src={src} title={title} />
    </div>
  );
}
