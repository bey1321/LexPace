// Where progress is kept so a student can resume. Swap in your own adapter
// (e.g. one that saves to the LexPace back end) with createJourney(el, { storage }).
// An adapter is any object with load(), save(state) and clear().

export function localStore(key = "lexpace-journey") {
  return {
    load() { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } },
    save(state) { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} },
    clear() { try { localStorage.removeItem(key); } catch {} },
  };
}

export function memoryStore() {
  let s = null;
  return { load: () => s, save: (v) => { s = structuredClone(v); }, clear: () => { s = null; } };
}
