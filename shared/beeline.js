// XII.6 Part B — the PURE client-side beeline computation, DOM-free so it
// node-tests (the strategic.js / diplomacy-view.js precedent). Given the tech
// DAG (data/techs.json shape: id -> { level, prereqs[] }) and the VIEWER's known
// tech ids, compute the NEXT tech to research toward a GOAL. The goal is
// CLIENT-only state (never game state) — the tree issues normal setResearch
// commands for the returned step, so recordings replay hash-exact.

// The set of techs on any prereq path to `goal` — the goal's prereq closure,
// including the goal itself. { id: true }.
export function prereqClosure(techs, goal) {
  const seen = {};
  const stack = [goal];
  while (stack.length > 0) {
    const id = stack.pop();
    if (seen[id] || !techs[id]) continue;
    seen[id] = true;
    for (const p of techs[id].prereqs || []) stack.push(p);
  }
  return seen;
}

// researchable-now: the tech exists and every one of its prereqs is known.
export function researchableNow(techs, id, known) {
  const def = techs[id];
  if (!def) return false;
  for (const p of def.prereqs || []) if (!known[p]) return false;
  return true;
}

// The NEXT tech to research toward `goal`: the shallowest researchable-now,
// still-unknown tech within the goal's prereq closure. Stable tie-break by
// `level` then id, so the walk is deterministic. Returns null when the goal is
// already known (reached) or nothing on the path is researchable (stuck /
// unreachable) — the caller clears the goal in either case.
export function nextBeelineStep(techs, knownArr, goal) {
  if (!goal || !techs[goal]) return null;
  const known = {};
  for (const t of knownArr || []) known[t] = true;
  if (known[goal]) return null;
  const closure = prereqClosure(techs, goal);
  let best = null;
  for (const id of Object.keys(closure)) {
    if (known[id] || !researchableNow(techs, id, known)) continue;
    if (best === null) { best = id; continue; }
    const a = techs[id], b = techs[best];
    if (a.level < b.level || (a.level === b.level && id < best)) best = id;
  }
  return best;
}

// Has the goal been reached (its id is in the known set)?
export function goalReached(knownArr, goal) {
  return !!goal && (knownArr || []).indexOf(goal) !== -1;
}
