// Plays a recorded file when one exists, otherwise the browser voice.
// play() resolves when the sound ENDS, so response timing starts at the right moment.
//
// Recorded files: createJourney(el, { audio: { baseUrl: "audio/", files: { "lab-blim": "lab-blim.mp3" } } })
// Keys used by the games: story-<id>, alike-*, lab-<word>, echo-<word>, soundcheck.

export function createAudio({ files = {}, baseUrl = "", lang = "en-GB", rate = 0.9 } = {}) {
  let voice = null, current = null;
  const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

  const pickVoice = () => {
    try {
      const vs = synth.getVoices();
      voice = vs.find((v) => v.lang === lang) || vs.find((v) => v.lang.startsWith(lang.split("-")[0])) || null;
    } catch { voice = null; }
  };
  if (synth) { pickVoice(); synth.addEventListener?.("voiceschanged", pickVoice); }

  function stop() {
    try { synth?.cancel(); } catch {}
    if (current) { try { current.pause(); } catch {} current = null; }
  }

  function speak(text, r) {
    return new Promise((resolve) => {
      if (!synth) return setTimeout(resolve, 400);
      let done = false; const fin = () => { if (!done) { done = true; resolve(); } };
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang; u.rate = r; if (voice) u.voice = voice;
        u.onend = fin; u.onerror = fin;
        setTimeout(fin, 1500 + text.length * 110); // some browsers never fire onend
        synth.speak(u);
      } catch { fin(); }
    });
  }

  function play(key, text, r = rate) {
    stop();
    const file = key && files[key];
    if (!file) return speak(text, r);
    return new Promise((resolve) => {
      const a = new Audio(baseUrl + file);
      current = a;
      const fallback = () => speak(text, r).then(resolve);
      a.onended = () => resolve();
      a.onerror = fallback;
      a.play().catch(fallback);
    });
  }

  // Load recorded files early so there is no delay mid-game.
  function preload() {
    for (const f of Object.values(files)) { try { const a = new Audio(); a.preload = "auto"; a.src = baseUrl + f; } catch {} }
  }

  return { play, stop, preload, hasVoice: !!synth };
}
