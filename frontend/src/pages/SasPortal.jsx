// The SAS Portal (staff side) runs on its own server (sas-portal/, port 8010); this page shows it inside LexPace.
const SAS_PORTAL_URL = `${window.location.protocol}//${window.location.hostname}:8010/sas/`;

export default function SasPortal() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <iframe className="lexpace-frame" style={{ minHeight: 600 }} src={SAS_PORTAL_URL} title="SAS Portal" />
    </div>
  );
}
