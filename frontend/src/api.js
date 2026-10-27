import { useEffect, useState } from "react";

export async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export async function saveProfile(profile, source = "manual") {
  const res = await fetch("/api/lexpace/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, source }),
  });
  if (!res.ok) throw new Error(`save profile: ${res.status}`);
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

export const PROFILE_OPTIONS = [
  ["base", "Base lesson"],
  ["phon", "Phonological"],
  ["surf", "Surface"],
  ["rapid", "Rapid naming"],
  ["double", "Double deficit"],
  ["mixed", "Mixed"],
];

// adaptation.html reads localStorage "pl2-prof" as JSON (its store wrapper JSON.parses values).
export function writeLectureProfile(profile) {
  try { if (profile) localStorage.setItem("pl2-prof", JSON.stringify(profile)); } catch {}
}
