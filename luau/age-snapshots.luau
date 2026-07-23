--!strict
-- Luau twin of shared/age-snapshots.js — the PURE matcher for pre-baked
-- starting-age snapshots (tools/bake-age-snapshots.js). Given the bake manifest
-- and a game config, matchSnapshot finds the preset that a live fast-forward
-- (shared/fastforward.js) would reproduce EXACTLY, or nil; the caller then runs
-- the live ff unchanged, so arbitrary seeds keep working. No fetch/DOM/engine
-- here — the host does the I/O and the state load/verify.
-- EXPORTS (stable): matchSnapshot(manifest, cfg), snapshotUsable(state, preset,
-- humanSeats, hashState).

local M = {}

-- A snapshot is only usable when the config would produce the IDENTICAL world:
-- the baker bakes the DEFAULT lineup (sorted+seed-shuffled civs, all AI) at a
-- fixed map type / difficulty. A ?civ pick reorders the roster, and a different
-- map type / difficulty changes the world — those never match.
function M.matchSnapshot(manifest: any, cfg: any): any
	if manifest == nil or type(manifest.presets) ~= "table" or cfg == nil then
		return nil
	end
	if cfg.picked then
		return nil
	end
	if manifest.mapType ~= nil and cfg.mapType ~= manifest.mapType then
		return nil
	end
	if manifest.difficulty ~= nil and cfg.difficulty ~= manifest.difficulty then
		return nil
	end
	for _, p in ipairs(manifest.presets) do
		if not p.aborted
			and p.age == cfg.age and p.size == cfg.size
			and p.seed == cfg.seed and p.civs == cfg.civs then
			return p
		end
	end
	return nil
end

-- After loading a matched snapshot's state, it is USABLE only if it verifies
-- against the preset's pinned statehash (file intact) AND none of the human
-- seats died during the baked history (a later-age start whose civ is already
-- dead must fall through to the live ff, which aborts with the casualty
-- message). Returns true when the state may be adopted. `hashState` is injected
-- (shared/statehash.js twin) so this module imports nothing.
function M.snapshotUsable(state: any, preset: any, humanSeats: any, hashState: any): boolean
	if state == nil or preset == nil then
		return false
	end
	if hashState(state) ~= preset.statehash then
		return false
	end
	if humanSeats ~= nil then
		for _, pid in ipairs(humanSeats) do
			local p = state.players ~= nil and state.players[pid] or nil
			if p == nil or p.alive == false then
				return false
			end
		end
	end
	return true
end

return M
