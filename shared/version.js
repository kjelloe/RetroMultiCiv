// The game's release version (semver x.y.z), stamped into save + recording
// ENVELOPES (never into game state — envelope fields are not hashed, so this is
// golden-neutral). Loaders reject a MAJOR-version mismatch with a friendly line
// instead of a hash surprise: cheap now, painful to lack at the 2.0 boundary.
// Bump this on a release; the MAJOR component gates cross-version loads.
//
// 1.0.1 (2026-08-05): the deployed tree moved past the v1.0.0 tag with
// player-facing client fixes (the no-WebGL card and its browser-aware help, the
// Options graphics panel, the mobile compass default, the published Roblox
// link). The constant is bumped because it is stamped into save envelopes,
// recordings and bug reports — leaving it at 1.0.0 would have every report from
// the live box name a version whose client code it is not running, which sends
// whoever reads it hunting the wrong tree.
export const GAME_VERSION = '1.0.1';

// the leading integer of a version string, or null when absent/unparseable
export function majorOf(v) {
  const m = String(v === undefined || v === null ? '' : v).match(/^\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

// null → load it (compatible, or a legacy/version-less file — forward-compat);
// a STRING → the friendly reason to REFUSE the load.
export function versionMismatch(fileVersion, current) {
  const cur = current || GAME_VERSION;
  const fMaj = majorOf(fileVersion);
  const cMaj = majorOf(cur);
  if (fMaj === null || cMaj === null || fMaj === cMaj) return null;
  return `This save is from RetroMultiCiv ${fMaj}.x — this build runs ${cMaj}.x.`;
}
