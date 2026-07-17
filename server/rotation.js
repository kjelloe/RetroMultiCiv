// saves/ rotation (A50 item 3, USER spec 2026-07-16 night): keep the saves
// directory under a COUNT and a SIZE budget by retiring games in PRIORITY
// TIERS, never by age alone:
//   tier 0 — ACTIVE (live in the registry, still playable): NEVER evicted.
//   tier 1 — COMPLETED (gameOver): retired first, oldest-first.
//   tier 2 — RESUMABLE (not loaded, not finished — a host could resume it by
//            its game code): retired ONLY if the budget still doesn't fit after
//            every completed game is gone. Oldest-first within the tier.
// This is the closest realizable form of the user's "retire completed/abandoned
// first, NEVER evict a resumable save" under a HARD budget: resumable saves go
// LAST (not by accident of age). The budget IS hard — if only resumable saves
// remain and the dir is still over budget, the oldest resumable is dropped, so
// SIZE THE BUDGET GENEROUSLY IF YOU HOST LONG-LIVED RESUMABLE GAMES
// (docs/how-to-host.md). Pure: the caller supplies file descriptors + the
// active set; fs/clock stay in the caller and the policy is unit-tested.
//
// Log rotation (maxLogDays/maxLogMb) uses the SAME shape but rides A50 item 5
// (there is no server file-logging yet; console only).

export const DEFAULT_ROTATION = { maxSaves: 100, maxSavesMb: 500 };

// files: [{ path, gameId, savedAt (ISO string | ms), sizeBytes, over (bool) }]
//        over === true → a completed (gameOver) game (tier 1); else resumable.
// active: { [gameId]: true } — never evicted (tier 0)
// caps:  { maxSaves, maxSavesMb }  (partial overrides DEFAULT_ROTATION)
// returns: string[] of file paths to delete, in eviction order.
export function planRotation(files, active, caps) {
  const cfg = Object.assign({}, DEFAULT_ROTATION, caps || {});
  const maxBytes = cfg.maxSavesMb * 1024 * 1024;
  const isActive = f => !!(active && active[f.gameId] === true);
  const ageKey = f => (typeof f.savedAt === 'number' ? f.savedAt : (Date.parse(f.savedAt) || 0));
  const byAge = (a, b) => ageKey(a) - ageKey(b) || (a.path < b.path ? -1 : (a.path > b.path ? 1 : 0));

  let count = files.length;
  let bytes = files.reduce((s, f) => s + (f.sizeBytes || 0), 0);
  if (count <= cfg.maxSaves && bytes <= maxBytes) return [];

  const evictable = files.filter(f => !isActive(f));
  const completed = evictable.filter(f => f.over === true).sort(byAge); // tier 1
  const resumable = evictable.filter(f => f.over !== true).sort(byAge); // tier 2
  const order = completed.concat(resumable);                           // tiers in priority

  const remove = [];
  for (const f of order) {
    if (count <= cfg.maxSaves && bytes <= maxBytes) break;
    remove.push(f.path);
    count -= 1;
    bytes -= (f.sizeBytes || 0);
  }
  return remove; // active (and, budget permitting, resumable) saves are spared
}
