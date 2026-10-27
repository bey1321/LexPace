// The adaptive rule shared by Sound-Alike, Sound Lab and Echo.
//   right + fast  → one level harder
//   right + slow  → same level
//   wrong         → one level easier

export function nextLevel(level, { ok, rt }, { fastMs, levels }) {
  if (!ok) return Math.max(1, level - 1);
  return rt <= fastMs ? Math.min(levels, level + 1) : level;
}

// Picks an unused item from the level's bank (falls back to reuse if the bank runs out).
function pick(bank, used) {
  const key = (x) => JSON.stringify(x);
  const fresh = bank.filter((x) => !used.has(key(x)));
  const pool = fresh.length ? fresh : bank;
  const item = pool[Math.floor(Math.random() * pool.length)];
  used.add(key(item));
  return item;
}

/**
 * Runs the staircase.
 * ask(item, level)  → Promise<{ ok, rt, ...extra }>   (rt in ms, from when audio ended)
 * onStep({ i, n, level })  → called before each item (for the progress UI)
 * record(entry)  → called after each item
 * Returns the level the student finished on.
 */
export async function runStaircase({ bank, levels, start, items, fastMs, ask, onStep, record, isAlive = () => true }) {
  let level = start;
  const used = new Set();
  for (let i = 0; i < items; i++) {
    if (!isAlive()) return level;
    onStep?.({ i, n: items, level });
    const item = pick(bank[level], used);
    const r = await ask(item, level);
    if (!isAlive()) return level;
    record({ n: i + 1, level, ...r, rt: Math.round(r.rt), fast: r.ok && r.rt <= fastMs });
    level = nextLevel(level, r, { fastMs, levels });
  }
  return level;
}

// Level score = mean level over the second half of the items (after the staircase has settled).
export function levelScore(entries) {
  const adaptive = entries.filter((e) => !e.probe);
  const half = adaptive.slice(Math.floor(adaptive.length / 2));
  return half.length ? half.reduce((s, e) => s + e.level, 0) / half.length : 0;
}
