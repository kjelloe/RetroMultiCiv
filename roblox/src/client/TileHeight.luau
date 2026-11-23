-- The stud height of a terrain tile's top surface (pure): one rule for the
-- map (ViewRenderer.tileTop) and the encyclopedia's terrain picture.
-- palette = GameData.TerrainPalette ({ base, peak } per terrain id).
local M = {}

M.HEIGHT = 6 -- studs per 1.0 of TERRAIN base height

function M.top(palette, id)
	local spec = palette[id] or palette.grassland
	-- runI item 7: mountains should be only 2x as tall as hills (was ~4x). The
	-- generated TerrainPalette mirrors the browser terrain.js source and is
	-- gate-4 locked, so the ratio is corrected render-side: hills sit at half
	-- the mountain top. The top also seats units/cities/props.
	if id == "hills" then
		local m = palette.mountains or palette.grassland
		-- run-S shot16 (user): the hill block at 50 % of that again
		-- (run-S shot17: no ridges on top; the half block alone is the hill)
		return (m.base + m.peak * 0.5) * M.HEIGHT * 0.25
	end
	-- T1: the height is carried by a sculpted massif, so the block under it
	-- drops to a shoulder (0.6) instead of standing as a tower. Every look
	-- (ruling 2026-11-14: retro and brick get the new mountains too).
	if id == "mountains" then
		return (spec.base + spec.peak * 0.5) * M.HEIGHT * 0.6
	end
	return (spec.base + spec.peak * 0.5) * M.HEIGHT
end

return M
