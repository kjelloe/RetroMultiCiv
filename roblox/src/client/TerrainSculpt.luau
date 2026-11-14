-- Roblox-native look, phase T1 (specs/roblox-native-look.md): sculpted
-- mountains and hills for the ENHANCED look. PURE planner — each function
-- returns a list of prop items for TileProps' existing `put` pipeline
-- ({ k = PROP_SHAPES key, color, dx, dz, dy, sx, sy, sz, rotY }, offsets in
-- tile units), built from shapes that already exist (peak / snow / rock /
-- treeCanopy), so the shared recipe key set is untouched (gate 25).
-- A mountain is a three-summit massif (one tall summit + two shoulders on a
-- ring that leaves the tile centre clear, snow caps fitted to each cone, foot
-- boulders) instead of one small cone on a block;
-- hills are two rolling ridges on a half-height block. Deterministic: `rand(salt)` is the caller's
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
		-- run-M screenshot: at 1.75-2.2 the summits read as needles; lowered ~25 %
		local sy = main and (1.35 + rand(6) * 0.35) or (0.85 + rand(12 + i) * 0.4)
		local sx = math.min(M.MAX_R / PEAK_R, main and (1.0 + rand(5) * 0.07) or (0.82 + rand(14 + i) * 0.18))
		local snow = main and 0.36 or ((not lite and sy > 1.11) and 0.26 or 0)
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

-- where a resource marker stands on a mountain tile: the one gap of the ring
-- that holds neither a summit (a0, +120, +240 deg) nor a boulder (+60, +180)
M.FLANK_R = 0.38
function M.flank(rand)
	local a = rand(7) * math.pi * 2 - math.pi / 3
	return math.cos(a) * M.FLANK_R, math.sin(a) * M.FLANK_R
end

-- Hills (user, run-S shot16): the hill BLOCK stands at half its old height
-- (ViewRenderer.tileTop) and the tile itself is two rolling hills - two long
-- low ELLIPSOID ridges (`ell = true`: AssetFactory builds a true ellipsoid),
-- side by side across the tile with a valley through the centre, where a
-- unit or city stands. No rotation: the ridges run along X or along Z.
local BALL_R = 0.11 -- TileProps.PROP_SHAPES treeCanopy radius
M.HILL = { "#857a4a", "#8c8150", "#7e7446" }
M.HILL_MAX_H = 0.4 -- tile units; with the half block this restores the old hill top
M.HILL_GAP = 0.25 -- ridge axis distance from the tile centre
function M.hills(rand)
	local out = {}
	local alongX = rand(21) > 0.5 -- the two ridges sit left/right (true) or front/back
	for i = 0, 1 do
		local side = i == 0 and -1 or 1
		local across = 0.2 + rand(22 + i) * 0.035 -- half-width toward the centre: < HILL_GAP
		local along = 0.4 + rand(24 + i) * 0.07 -- half-length along the ridge
		local h = (i == 0 and 0.32 or 0.24) + rand(26 + i) * 0.08
		local slide = (rand(28 + i) - 0.5) * 0.08 -- the ridges are not perfectly opposite
		local color = M.HILL[1 + math.floor(rand(31 + i) * #M.HILL)]
		out[#out + 1] = { k = "treeCanopy", ell = true, role = "ridge", color = color, dy = 0,
			dx = alongX and side * M.HILL_GAP or slide, dz = alongX and slide or side * M.HILL_GAP,
			sx = (alongX and across or along) / BALL_R, sy = h / BALL_R, sz = (alongX and along or across) / BALL_R }
	end
	return out
end

-- T4: a mixed wood — 2-3 spruces (a trunk under the existing cone) and two
-- broadleaf trees (trunk + ball canopy) on a jittered ring, three greens.
-- The cone count drops from 3-5 to 2-3, so the part count stays near the
-- classic forest's; the ring keeps the tile centre open for a unit.
M.SPRUCE = { "#1e6b2f", "#24753a", "#195c2b" }
M.LEAF = { "#4f8f3a", "#5a9a44", "#447f36" }
M.TRUNK = "#6b4a2b"
M.WOOD_RING_MIN = 0.2
M.WOOD_RING_MAX = 0.34
local TRUNK_H = 0.16 -- TileProps treeTrunk height
local TREE_H = 0.28 -- TileProps tree cone height
local CANOPY_R = 0.11 -- TileProps treeCanopy radius

function M.forest(rand)
	local out = {}
	local spruces = 2 + (rand(41) > 0.5 and 1 or 0)
	local total = spruces + 2
	local a0 = rand(42) * math.pi * 2
	for i = 0, total - 1 do
		local a = a0 + i * (math.pi * 2 / total) + (rand(43 + i) - 0.5) * 0.6
		local dist = M.WOOD_RING_MIN + rand(50 + i) * (M.WOOD_RING_MAX - M.WOOD_RING_MIN)
		local dx, dz = math.cos(a) * dist, math.sin(a) * dist
		local s = 0.8 + rand(57 + i) * 0.5
		if i < spruces then
			local stem = 0.4 * s -- a short bare trunk under the cone
			out[#out + 1] = { k = "treeTrunk", color = M.TRUNK, dx = dx, dz = dz,
				dy = TRUNK_H * stem / 2, sx = s, sy = stem, sz = s }
			out[#out + 1] = { k = "tree", color = M.SPRUCE[1 + math.floor(rand(64 + i) * #M.SPRUCE)],
				dx = dx, dz = dz, dy = TRUNK_H * stem * 0.8 + TREE_H * s / 2, sx = s, sy = s, sz = s }
		else
			out[#out + 1] = { k = "treeTrunk", color = M.TRUNK, dx = dx, dz = dz,
				dy = TRUNK_H * s / 2, sx = 1.3 * s, sy = s, sz = 1.3 * s }
			out[#out + 1] = { k = "treeCanopy", color = M.LEAF[1 + math.floor(rand(71 + i) * #M.LEAF)],
				dx = dx, dz = dz, dy = TRUNK_H * s * 0.85 + CANOPY_R * s * 0.8, sx = 1.15 * s, sy = 0.9 * s, sz = 1.15 * s }
		end
	end
	return out
end

-- geometry facts the selftest pins (tile units)
function M.apexOf(item)
	if item.ell then
		return item.dy + BALL_R * item.sy
	end
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
