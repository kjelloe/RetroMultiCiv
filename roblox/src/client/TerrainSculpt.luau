-- Roblox-native look, phase T1 (specs/roblox-native-look.md): sculpted
-- mountains and hills for the ENHANCED look. PURE planner — each function
-- returns a list of prop items for TileProps' existing `put` pipeline
-- ({ k = PROP_SHAPES key, color, dx, dz, dy, sx, sy, sz, rotY }, offsets in
-- tile units), built from shapes that already exist (treeCanopy sphere / rock /
-- treeCanopy), so the shared recipe key set is untouched (gate 25).
-- A mountain is a three-summit massif (one tall summit + two shoulders on a
-- ring that leaves the tile centre clear, snow caps fitted to each cone, foot
-- boulders) instead of one small cone on a block;
-- hills are low rounded mounds. Deterministic: `rand(salt)` is the caller's
-- position hash (TileProps.visualRand), never engine RNG.
-- Lune-pinned by roblox/selftest/terrain-sculpt.luau (check.sh gate 36).

local M = {}

-- run-S shot12 (user): the wedge-fan cones read as coarse spikes and the
-- mounds as eggs. Both are now built from ELLIPSOIDS (the treeCanopy sphere
-- with `ell = true`: three independent scales, smooth shading), each sitting
-- with its centre on the ground so only the upper half shows:
--   summit = foot (wide, low) + body + crown (narrow, full height), nested on
--            one axis: a smooth concave flank with a rounded top; the snow is
--            a fourth ellipsoid fitted to the crown's upper part
--   hills  = one broad low dome and two lesser ones, each longer one way
local BALL_R = 0.11 -- TileProps.PROP_SHAPES treeCanopy radius

M.FOOT = { "#5d6054", "#646659", "#585a52" } -- scree with a trace of turf
M.ROCK_GREYS = { "#6c6b72", "#74737a", "#646369" }
M.CROWN = { "#86858c", "#8e8d94" }
M.SNOW = "#eef2f4"
M.BOULDER = "#6a655d"
M.MOUND = { "#8f8750", "#867d49", "#98905a" } -- the hills palette family
M.LITE_ABOVE = 150 -- more sculpted mountain tiles than this in view = lite massifs

local function ell(role, color, dx, dz, rx, h, rz, dy, rotY)
	return { k = "treeCanopy", ell = true, role = role, color = color, dx = dx, dz = dz, dy = dy or 0,
		sx = rx / BALL_R, sy = h / BALL_R, sz = rz / BALL_R, rotY = rotY or 0 }
end

local function pick(list, r)
	return list[1 + math.floor(r * #list)]
end

-- r = foot radius, h = summit height (tile units); lite drops the body layer
local function summit(out, rand, salt, dx, dz, r, h, snowFrac, lite)
	local rotY = rand(salt) * math.pi
	local squash = 0.88 + rand(salt + 2) * 0.12 -- the foot is a little oval
	out[#out + 1] = ell("foot", pick(M.FOOT, rand(salt + 1)), dx, dz, r, h * 0.42, r * squash, 0, rotY)
	if not lite then
		out[#out + 1] = ell("body", pick(M.ROCK_GREYS, rand(salt + 3)), dx, dz, r * 0.66, h * 0.78, r * 0.66 * squash, 0, rotY)
	end
	local rc = r * (lite and 0.46 or 0.38)
	out[#out + 1] = ell("crown", pick(M.CROWN, rand(salt + 4)), dx, dz, rc, h, rc, 0, rotY)
	if snowFrac > 0 then
		-- centred where the snow line cuts the crown, a touch wider than the
		-- crown there: the upper half is the cap, the lower half is inside
		local hc = h * (1 - snowFrac)
		local rs = rc * math.sqrt(1 - (1 - snowFrac) ^ 2) * 1.1
		out[#out + 1] = ell("snow", M.SNOW, dx, dz, rs, h * snowFrac * 1.02, rs, hc, rotY)
	end
end

-- Three summits stand on a RING around the tile centre (never on it): a unit
-- or city seated on a mountain tile stays visible in the saddle between them.
M.RING = 0.3 -- summit axis distance from the tile centre
M.MAX_R = 0.28 -- summit foot radius cap (< RING keeps the centre clear)

-- lite = the reduced massif for views with very many mountain tiles
function M.mountain(rand, lite)
	local out = {}
	local a0 = rand(7) * math.pi * 2
	local summits = lite and 2 or 3
	for i = 0, summits - 1 do
		local a = a0 + i * (math.pi * 2 / 3) + (rand(8 + i) - 0.5) * 0.5
		local main = i == 0
		local h = main and (0.64 + rand(6) * 0.16) or (0.38 + rand(12 + i) * 0.2)
		local r = math.min(M.MAX_R, main and (0.26 + rand(5) * 0.02) or (0.21 + rand(14 + i) * 0.06))
		local snow = main and 0.34 or ((not lite and h > 0.5) and 0.24 or 0)
		summit(out, rand, 100 + i * 10, math.cos(a) * M.RING, math.sin(a) * M.RING, r, h, snow, lite)
	end
	if not lite then
		for i = 0, 1 do
			local a = a0 + math.pi / 3 + i * (math.pi * 2 / 3) + (rand(16 + i) - 0.5) * 0.4
			out[#out + 1] = { k = "rock", role = "boulder", color = M.BOULDER, dx = math.cos(a) * 0.36, dz = math.sin(a) * 0.36,
				dy = 0.04, sx = 1.1, sy = 0.9, sz = 1.1, rotY = rand(18 + i) * math.pi }
		end
	end
	return out
end

-- rolling ground: one broad low dome off the tile centre and two lesser ones
-- on the far side, each longer along its own heading
M.HILL_MAX_H = 0.17
function M.hills(rand)
	local out = {}
	local a0 = rand(21) * math.pi * 2
	local d0 = 0.08 + rand(25) * 0.06
	out[#out + 1] = ell("dome", pick(M.MOUND, rand(31)), math.cos(a0) * d0, math.sin(a0) * d0,
		0.3 + rand(28) * 0.06, 0.12 + rand(29) * 0.05, 0.24 + rand(30) * 0.06, 0, rand(32) * math.pi)
	for i = 1, 2 do
		local a = a0 + math.pi + (i == 1 and -0.9 or 0.9) + (rand(22 + i) - 0.5) * 0.5
		local dist = 0.2 + rand(25 + i) * 0.06
		out[#out + 1] = ell("dome", pick(M.MOUND, rand(31 + i)), math.cos(a) * dist, math.sin(a) * dist,
			0.19 + rand(34 + i) * 0.05, 0.07 + rand(36 + i) * 0.04, 0.16 + rand(38 + i) * 0.05, 0, rand(40 + i) * math.pi)
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
	return nil
end
function M.baseRadiusOf(item)
	if item.ell then
		return BALL_R * math.max(item.sx, item.sz)
	end
	return nil
end

return M
