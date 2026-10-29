import { NavLink } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useApi } from "../api.js";

const ITEMS = [
  ["/activity", "Activity", "globe"],
  ["/courses", "Courses", "courses"],
  ["/calendar", "Calendar", "calendar"],
  ["/messages", "Messages", "mail"],
  ["/grades", "Grades", "grades"],
  ["/tools", "Tools", "tools"],
  ["/lexpace-hub", "LexPace", "book"],
];

const navClass = ({ isActive }) => "nav-item" + (isActive ? " is-active" : "");

export default function Sidebar() {
  const [me] = useApi("/api/me");
  return (
    <nav className="sidebar" aria-label="Main navigation">
      <div className="sidebar-logo"><img src="/aurak-logo.png" alt="AURAK, American University of Ras Al Khaimah" /></div>
      <NavLink to="/profile" className={(s) => navClass(s) + " nav-profile"}>
        <span className="nav-avatar"><Icon name="user" size={18} /></span>
        <span>{me ? me.name : "Bethelhem Habte"}</span>
      </NavLink>
      {ITEMS.map(([to, label, icon]) => (
        <NavLink key={to} to={to} className={navClass}>
          <Icon name={icon} size={20} /><span>{label}</span>
        </NavLink>
      ))}
      <div className="sidebar-bottom">
        <NavLink to="/signout" className={navClass}><Icon name="signout" size={20} /><span>Sign Out</span></NavLink>
        <p className="sidebar-legal"><a href="#privacy">Privacy</a> • <a href="#terms">Terms</a> • <a href="#accessibility">Accessibility</a></p>
      </div>
    </nav>
  );
}
