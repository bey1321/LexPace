import { useEffect, useState } from "react";

export async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

// Saves the lesson version (base|read|write|calc, or null to clear). A manual pick has no skill flags.
export async function saveVersion(version, source = "manual") {
  const res = await fetch("/api/lexpace/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version, source }),
  });
  if (!res.ok) throw new Error(`save version: ${res.status}`);
  return res.json();
}

// Small fetch hook: returns [data, setData]. data is undefined while loading.
export function useApi(url) {
  const [data, setData] = useState();
  useEffect(() => {
    let live = true;
    getJSON(url).then((d) => live && setData(d)).catch((e) => console.error(e));
    return () => { live = false; };
  }, [url]);
  return [data, setData];
}

export const VERSION_OPTIONS = [
  ["base", "Base lesson"],
  ["read", "Reading support"],
  ["write", "Writing support"],
  ["calc", "Calculation support"],
];

// adaptation.html reads localStorage "pl2-prof" as JSON (its store wrapper JSON.parses values),
// so the shell writes the chosen version there before the lecture iframe loads.
export function writeLectureVersion(version) {
  try { if (version) localStorage.setItem("pl2-prof", JSON.stringify(version)); } catch {}
}
