-- Clone-on-write for state.map.tiles (deepClone map-sharing, #2320). Byte-shaped twin of
-- engine/cow.js. applyCommand SHARES state.map by reference; a tile-write goes through cowTile
-- (the ONE legal path), which clones the map + the written tile lazily. The module-local `owned`
-- is a per-command transient RESET at applyCommand entry (resetCow) — the sanctioned upvalue
-- exception (docs/02); it never survives across calls (the determinism guard proves it).
--
-- NOTE: luau tiles are 1-indexed; callers pass the SAME 0-based idx (y*W+x) as engine/cow.js and
-- cowTile adds +1 internally (the standard twin +1 for tiles[]).
local owned = false

local function resetCow()
	owned = false
end

local function cowTile(state: any, idx: number): any
	if not owned then
		local map = state.map
		local m = {}
		for k, v in pairs(map) do
			m[k] = v
		end
		m.tiles = table.clone(map.tiles) -- shallow: shares tile objects until each is cow'd below
		state.map = m
		owned = true
	end
	local t = state.map.tiles[idx + 1]
	local nt = {}
	for k, v in pairs(t) do
		nt[k] = v
	end
	state.map.tiles[idx + 1] = nt
	return nt
end

return { cowTile = cowTile, resetCow = resetCow }
