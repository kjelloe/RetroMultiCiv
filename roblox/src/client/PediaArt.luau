-- Which picture an encyclopedia entry shows, and how the detail pane makes
-- room for it (pure; specs/roblox-pedia-art.md 2.2 and 2.5). PediaPicture
-- draws. roblox/selftest/pedia-art.luau, gate 66.
local M = {}

-- kinds: unit (AssetFactory model), structure (StructureModels), plate
-- (tech glyph on its era card), terrain (3 x 3 tile patch), none
-- have = { units = unitSilhouette, structures = MODELS, glyphs = GLYPH, terrain = palette }
function M.resolve(catKey, id, have)
	if catKey == "units" then
		if have.units[id] ~= nil then
			return { kind = "unit", id = id }
		end
	elseif catKey == "buildings" or catKey == "wonders" then
		if have.structures[id] ~= nil then
			return { kind = "structure", id = id }
		end
	elseif catKey == "techs" then
		if have.glyphs[id] ~= nil then
			return { kind = "plate", id = id }
		end
	elseif catKey == "terrain" then
		if have.terrain[id] ~= nil then
			return { kind = "terrain", id = id }
		end
	end
	return { kind = "none", id = id }
end

-- entries = { { catKey, id }, ... } -> the ones without a picture, as "cat/id"
function M.missing(entries, have)
	local out = {}
	for _, e in ipairs(entries) do
		if M.resolve(e[1], e[2], have).kind == "none" then
			out[#out + 1] = e[1] .. "/" .. e[2]
		end
	end
	table.sort(out)
	return out
end

-- the detail pane: picture box on top, text below. An entry without a
-- picture gives the whole pane to the text.
M.PAD = 8
M.BOX_WIDE = 240
M.BOX_NARROW = 150
M.NARROW_BELOW = 360
function M.layout(paneW, kind)
	local boxH = 0
	if kind ~= "none" then
		boxH = paneW < M.NARROW_BELOW and M.BOX_NARROW or M.BOX_WIDE
	end
	local boxW = math.max(0, paneW - 2 * M.PAD)
	return {
		box = { x = M.PAD, y = M.PAD, w = boxW, h = boxH },
		textY = boxH > 0 and (boxH + 2 * M.PAD) or 6,
		-- a plate is a square card centred in the box
		plate = math.max(0, math.min(boxH - 24, boxW - 24)),
	}
end

-- camera per kind: degrees, distance as a multiple of the model's radius,
-- degrees per second of the slow turn
M.CAMERA = {
	unit = { yaw = 30, pitch = 16, fit = 2.6, turn = 24 },
	structure = { yaw = 35, pitch = 18, fit = 2.5, turn = 14 },
	terrain = { yaw = 35, pitch = 34, fit = 2.3, turn = 10 },
}

-- the 3 x 3 patch a terrain entry shows: the terrain itself, its special
-- resource (when it has one) on the centre tile. Ocean keeps a land corner
-- so the water reads as water.
function M.terrainPatch(id, hasSpecial)
	local tiles = {}
	for i = 1, 9 do
		tiles[i] = { t = id, visible = true }
	end
	if hasSpecial then
		tiles[5].special = true
	end
	if id == "ocean" then
		tiles[1].t = "grassland"
	end
	return { width = 3, height = 3, tiles = tiles }
end

return M
