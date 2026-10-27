import { useApi } from "../api.js";

function InfoTable({ rows }) {
  return (
    <div className="info-table">
      {rows.map(([label, value]) => (
        <div className="info-row" key={label}>
          <span className="info-label">{label}</span>
          <span className="info-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

const add = (what) => <span>Add {what}</span>;
const link = (text) => <a href="#demo" onClick={(e) => e.preventDefault()}>{text}</a>;

export default function Profile() {
  const [me] = useApi("/api/me");
  if (!me) return null;
  return (
    <div className="profile">
      <div className="profile-cover" />
      <div className="profile-head">
        <div className="profile-avatar" />
        <h1 className="profile-name">{me.name}</h1>
        <p className="profile-id">{me.studentId}</p>
      </div>
      <div className="profile-cols">
        <div className="profile-col">
          <h2>Basic Information</h2>
          <InfoTable rows={[
            ["Full Name", link(me.name)],
            ["Email Address", me.email],
            ["Student ID", me.studentId],
            ["Password", link("Change password")],
          ]} />
          <h2>Additional Information</h2>
          <InfoTable rows={[
            ["Gender", add("gender")],
            ["Additional Name", add("additional name")],
            ["Birthday", add("birthday")],
            ["Education Level", add("education level")],
            ["Website", add("website")],
          ]} />
          <h2>Contact Information</h2>
          <InfoTable rows={[
            ["Mailing Address", add("mailing address")],
            ["Phone Number", add("phone number")],
            ["Business Fax Number", add("business fax number")],
          ]} />
          <h2>Job Information</h2>
          <InfoTable rows={[
            ["Company", add("company")],
            ["Job Title", add("job title")],
            ["Department", add("department")],
          ]} />
        </div>
        <div className="profile-col profile-col-right">
          <h2>System Settings</h2>
          <InfoTable rows={[
            ["Language", link("System Default (English (United States))")],
            ["Privacy Settings", link("Only instructors can view my profile information")],
            ["Global Notification Settings", <span className="stack">{link("Stream notifications")}{link("Email notifications")}{link("Push notifications")}</span>],
          ]} />
        </div>
      </div>
    </div>
  );
}
