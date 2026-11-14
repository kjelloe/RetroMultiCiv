-- Roblox-native look, phase T1 (specs/roblox-native-look.md): sculpted
-- mountains and hills for the ENHANCED look. PURE planner — each function
-- returns a list of prop items for TileProps' existing `put` pipeline
-- ({ k = PROP_SHAPES key, color, dx, dz, dy, sx, sy, sz, rotY }, offsets in
-- tile units), built from shapes that already exist (peak / snow / rock /
-- treeCanopy), so the shared recipe key set is untouched (gate 25).
-- A mountain is a three-summit massif (one tall summit + two shoulders on a
-- ring that leaves the tile centre clear, snow caps fitted to each cone, foot
-- boulders) instead of one small cone on a block;
-- hills are low rounded mounds. Deterministic: `rand(salt)` is the caller's
-- position hash (TileProps.visualRand), never engine RNG.
-- Lune-pinned by roblox/selftest/terrain-sculpt.luau (check.sh gate 36).

local M = {}

-- base shape sizes, tile units (TileProps.PROP_SHAPES peak / snow)
local PEAK_R, PEAK_H = 0.26, 0.5
local SNOW_R, SNOW_H = 0.12, 0.2

M.ROCK_GREYS = { "#63636d", "#6f6e76", "#58585f" }
M.SNOW = "#e8eef0"
M.BOULDER = "#6a655d"
M.MOUND = { "#96854f", "#8a7a47", "#a08f58" } -- the hills palette family
M.SINK = 0.03 -- cones sit slightly into the tile top (no visible seam)
M.LITE_ABOVE = 150 -- more sculpted mountain tiles than this in view = lite massifs

local function summit(out, rand, salt, dx, dz, sx, sy, snowFrac)
	local rotY = rand(salt) * math.pi
	out[#out + 1] = { k = "peak", color = M.ROCK_GREYS[1 + math.floor(rand(salt + 1) * #M.ROCK_GREYS)],
		dx = dx, dz = dz, dy = PEAK_H * sy / 2 - M.SINK, sx = sx, sy = sy, sz = sx, rotY = rotY }
	if snowFrac > 0 then
		-- cap = the top snowFrac of the cone: same apex, radius matched to the
		-- cone at that height (+6% so the faces do not z-fight)
		local capH = PEAK_H * sy * snowFrac
		local ky = capH / SNOW_H
		local kxz = (PEAK_R * sx * snowFrac) / SNOW_R * 1.06
		out[#out + 1] = { k = "snow", color = M.SNOW, dx = dx, dz = dz,
			dy = PEAK_H * sy - capH / 2 - M.SINK + 0.004, sx = kxz, sy = ky, sz = kxz, rotY = rotY }
	end
end

-- Three summits stand on a RING around the tile centre (never on it): a unit
-- or city seated on a mountain tile stays visible in the saddle between them.
M.RING = 0.3 -- summit axis distance from the tile centre
M.MAX_R = 0.28 -- summit base radius cap (< RING keeps the centre clear)

-- lite = the reduced massif for views with very many mountain tiles
function M.mountain(rand, lite)
	local out = {}
	local a0 = rand(7) * math.pi * 2
	local summits = lite and 2 or 3
	for i = 0, summits - 1 do
		local a = a0 + i * (math.pi * 2 / 3) + (rand(8 + i) - 0.5) * 0.5
		local main = i == 0
		local sy = main and (1.75 + rand(6) * 0.45) or (1.1 + rand(12 + i) * 0.5)
		local sx = math.min(M.MAX_R / PEAK_R, main and (1.0 + rand(5) * 0.07) or (0.82 + rand(14 + i) * 0.18))
		local snow = main and 0.36 or ((not lite and sy > 1.42) and 0.26 or 0)
		summit(out, rand, 100 + i * 10, math.cos(a) * M.RING, math.sin(a) * M.RING, sx, sy, snow)
	end
	if not lite then
		for i = 0, 1 do
			local a = a0 + math.pi / 3 + i * (math.pi * 2 / 3) + (rand(16 + i) - 0.5) * 0.4
			out[#out + 1] = { k = "rock", color = M.BOULDER, dx = math.cos(a) * 0.36, dz = math.sin(a) * 0.36,
				dy = 0.04, sx = 1.1, sy = 0.9, sz = 1.1, rotY = rand(18 + i) * math.pi }
		end
	end
	return out
end

-- rounded mounds: balls sunk so only a low cap shows above the hill top
function M.hills(rand)
	local out = {}
	local count = 2 + (rand(2) > 0.5 and 1 or 0)
	local a0 = rand(21) * math.pi * 2
	for i = 0, count - 1 do
		local a = a0 + i * (math.pi * 2 / count) + (rand(22 + i) - 0.5) * 0.7
		local dist = 0.14 + rand(25 + i) * 0.1
		local k = 2.2 + rand(28 + i) * 0.7 -- ball radius 0.11 * k
		out[#out + 1] = { k = "treeCanopy", color = M.MOUND[1 + math.floor(rand(31 + i) * #M.MOUND)],
			dx = math.cos(a) * dist, dz = math.sin(a) * dist, dy = -0.11 * k * 0.62, sx = k, sy = k, sz = k }
	end
	return out
end

-- geometry facts the selftest pins (tile units)
function M.apexOf(item)
	if item.k == "peak" then
		return item.dy + PEAK_H * item.sy / 2
	end
	return item.dy + SNOW_H * item.sy / 2
end
function M.baseRadiusOf(item)
	if item.k == "peak" then
		return PEAK_R * item.sx
	elseif item.k == "snow" then
		return SNOW_R * item.sx
	end
	return nil
end

return M
