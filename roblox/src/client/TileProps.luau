-- CP1 (docs/13): tile props — terrain features, improvements, resources as
-- procedural Parts. The browser client/renderer/three/props.js twin: shapes
-- come from the shared PROP_SHAPES recipe (recipes.js:217), built through
-- AssetFactory.buildShape (the R8 composer, SCALE = 4 = TILE, so recipe units
-- map 1:1). Render-only + fog-honest: derives from the filtered VIEW alone,
-- dims explored-but-not-visible tiles toward fog, never touches state/hash.
-- visualRand mirrors props.js exactly (32-bit modular math) so the scatter
-- matches the browser screenshots. Parity gate: check.sh gate 25.
local AssetFactory = require(script.Parent:WaitForChild("AssetFactory"))

local M = {}

-- PROP_SHAPES twin (recipes.js:217) — gate 25 asserts key-for-key match.
M.PROP_SHAPES = {
	strip = { shape = "box", size = { 0.72, 0.02, 0.14 } },
	roadSeg = { shape = "box", size = { 0.5, 0.02, 0.12 } },
	mine = { shape = "cone", size = { 0.13, 0.2 }, seg = 4 },
	tree = { shape = "cone", size = { 0.11, 0.28 }, seg = 6 },
	scrub = { shape = "cone", size = { 0.055, 0.11 }, seg = 5 },
	rock = { shape = "dodeca", size = { 0.14 }, seg = 0 },
	peak = { shape = "cone", size = { 0.26, 0.5 }, seg = 5 },
	snow = { shape = "cone", size = { 0.12, 0.2 }, seg = 5 },
	special = { shape = "sphere", size = { 0.07 }, seg = { 8, 6 } },
	fortress = { shape = "torus", size = { 0.34, 0.05 }, seg = { 6, 12 } },
	tie = { shape = "box", size = { 0.03, 0.024, 0.17 } },
	mineDoor = { shape = "box", size = { 0.11, 0.1, 0.02 } },
	mineBeam = { shape = "box", size = { 0.15, 0.03, 0.04 } },
	fieldPatch = { shape = "box", size = { 0.24, 0.012, 0.16 } },
	foam = { shape = "box", size = { 0.82, 0.01, 0.06 } },
	hutBase = { shape = "cyl", size = { 0.13, 0.15, 0.12 }, seg = 6 },
	hutRoof = { shape = "cone", size = { 0.18, 0.14 }, seg = 6 },
	-- XV §5: tropical rainforest — buttress base + slender trunk + broad dome canopy
	jungleTrunk = { shape = "cyl", size = { 0.028, 0.042, 0.46 }, seg = 6 },
	jungleCanopy = { shape = "sphere", size = { 0.21 }, seg = { 8, 5 } },
	jungleButtress = { shape = "cone", size = { 0.085, 0.16 }, seg = 6 },
	-- specials-icons: per-resource Civ-1 special motifs (recipes.js twin)
	resFish = { shape = "sphere", size = { 0.09 }, seg = { 8, 6 } },
	resFishTail = { shape = "cone", size = { 0.06, 0.09 }, seg = 4 },
	resCrystal = { shape = "dodeca", size = { 0.075 }, seg = 0 },
	resWater = { shape = "cyl", size = { 0.16, 0.16, 0.015 }, seg = 12 },
	resPalm = { shape = "cone", size = { 0.034, 0.36 }, seg = 3 }, -- palm FROND blade (a ring = the crown)
	resDerrick = { shape = "cone", size = { 0.06, 0.34 }, seg = 4 },
	resStraw = { shape = "cone", size = { 0.035, 0.4 }, seg = 4 },
	pond = { shape = "cyl", size = { 0.11, 0.11, 0.012 }, seg = 10 },
	resBeast = { shape = "sphere", size = { 0.1 }, seg = { 8, 6 } },
	resBeastHead = { shape = "sphere", size = { 0.06 }, seg = { 8, 6 } },
	resAntler = { shape = "cone", size = { 0.022, 0.2 }, seg = 4 },
}

M.PROP_COLOR = {
	irrigation = "#5db8e8", road = "#8a6f4d", railroad = "#3c3c46", mine = "#8a8494",
	forest = "#1e6b2f", jungle = "#2f8d3f", special = "#ffd75e", fortress = "#b8ab8e",
	jungleTrunk = "#6a5236", jungleButtress = "#5c472f", jungleCanopy = "#2f8d3f", -- XV §5
	rock = "#7d7468", peak = "#63636d", snow = "#e8eef0",
	tie = "#2c2620", mineDoor = "#17130e", mineBeam = "#6b4a2a",
	fieldPatch = "#59a03e", foam = "#dcecf2",
	hutWall = "#b08d5a", hutRoof = "#c9a94c",
}

local SCRUB_COLOR = { grassland = "#3f8f3f", plains = "#9d8f55", desert = "#9d8f55", tundra = "#9fae9d" }
-- specials-icons (props.js SPECIAL_MOTIF twin): the Civ-1 terrain-keyed special
-- resource -> its map motif (prop primitives with per-instance color/scale/offset).
-- An ocean special (fish) rides the water surface (see the special handler below).
local SPECIAL_MOTIF = {
	ocean = {
		{ k = "resFish", color = "#d2e6f5", sx = 1.7, sy = 0.55, sz = 0.95, dy = 0.03 }, -- Fish
		{ k = "resFishTail", color = "#bcd2e4", dx = 0.14, dy = 0.03, rotY = math.pi / 2, sx = 0.8, sy = 0.7 },
	},
	grassland = { -- Shield -> wheat sheaf (XVII #8/#14): a cluster of golden stalks
		{ k = "resStraw", color = "#f2d84e", dy = 0.2 },
		{ k = "resStraw", color = "#f6e264", dx = 0.11, dz = 0.03, dy = 0.19, rotX = 0.3, rotY = 0.4 },
		{ k = "resStraw", color = "#e8c840", dx = -0.09, dz = 0.09, dy = 0.19, rotX = 0.3, rotY = 2.1 },
		{ k = "resStraw", color = "#fced7a", dx = 0.05, dz = -0.11, dy = 0.19, rotX = 0.3, rotY = 3.7 },
		{ k = "resStraw", color = "#e2be3a", dx = -0.08, dz = -0.06, dy = 0.19, rotX = 0.3, rotY = 5.1 },
		{ k = "resStraw", color = "#f2d84e", dx = 0.08, dz = -0.04, dy = 0.19, rotX = 0.26, rotY = 1.2 },
		{ k = "resStraw", color = "#f6e264", dx = -0.02, dz = 0.1, dy = 0.19, rotX = 0.26, rotY = 4.4 },
	},
	plains = { -- Horse — REARING profile (specials-silhouettes #4)
		{ k = "resBeast", color = "#9a6b3f", sx = 1.65, sy = 0.6, sz = 0.6, dy = 0.15, rotZ = -0.9 },
		{ k = "resBeastHead", color = "#9a6b3f", dx = -0.09, dy = 0.31 },
	},
	forest = { -- Game (deer) + stag-antler V fork
		{ k = "resBeast", color = "#7a5a35", sx = 1.35, sy = 0.85, sz = 0.9, dy = 0.05 },
		{ k = "resBeastHead", color = "#7a5a35", dx = -0.11, dy = 0.12 },
		{ k = "resAntler", color = "#533c22", dx = -0.12, dy = 0.26, rotZ = 0.62 },
		{ k = "resAntler", color = "#533c22", dx = -0.07, dy = 0.26, rotZ = -0.62 },
	},
	tundra = { -- Game + antlers
		{ k = "resBeast", color = "#8a6a45", sx = 1.35, sy = 0.85, sz = 0.9, dy = 0.05 },
		{ k = "resBeastHead", color = "#8a6a45", dx = -0.11, dy = 0.12 },
		{ k = "resAntler", color = "#5f4728", dx = -0.12, dy = 0.26, rotZ = 0.62 },
		{ k = "resAntler", color = "#5f4728", dx = -0.07, dy = 0.26, rotZ = -0.62 },
	},
	arctic = { -- Seal — low flat body + the upturned tail flipper
		{ k = "resBeast", color = "#c4cbd4", sx = 1.85, sy = 0.55, sz = 0.72, dy = 0.04 },
		{ k = "resBeastHead", color = "#c4cbd4", dx = -0.16, dy = 0.06 },
		{ k = "resFishTail", color = "#b4bcc6", dx = 0.17, dy = 0.09, rotZ = -0.95, sx = 1.1, sy = 1.3 },
	},
	desert = { -- Oasis (f92b088): pool + slender trunk + a 6-frond ring crown
		-- (position-offset splay, the wheat-sheaf idiom — rotY alone gimbal-
		-- collapses at this tilt; a palm spray, never a fir cone)
		{ k = "resWater", color = "#2f7fc0", dy = 0.02, sx = 1.3, sz = 1.3 },
		{ k = "jungleTrunk", color = "#8a6a3d", dy = 0.18, sx = 1.05, sy = 0.8, sz = 1.05 },
		{ k = "resPalm", color = "#3fae4f", dx = 0.07, dz = 0.0, dy = 0.33, rotX = 0.86, rotY = 0.0, sz = 0.55 },
		{ k = "resPalm", color = "#4cbf5c", dx = 0.035, dz = 0.061, dy = 0.33, rotX = 0.86, rotY = 1.05, sz = 0.55 },
		{ k = "resPalm", color = "#3fae4f", dx = -0.035, dz = 0.061, dy = 0.33, rotX = 0.86, rotY = 2.09, sz = 0.55 },
		{ k = "resPalm", color = "#4cbf5c", dx = -0.07, dz = 0.0, dy = 0.33, rotX = 0.86, rotY = 3.14, sz = 0.55 },
		{ k = "resPalm", color = "#3fae4f", dx = -0.035, dz = -0.061, dy = 0.33, rotX = 0.86, rotY = 4.19, sz = 0.55 },
		{ k = "resPalm", color = "#4cbf5c", dx = 0.035, dz = -0.061, dy = 0.33, rotX = 0.86, rotY = 5.24, sz = 0.55 },
	},
	hills = { { k = "resCrystal", color = "#2b2b30", dy = 0.11, sx = 1.3, sy = 1.3, sz = 1.3 } }, -- Coal
	mountains = { { k = "resCrystal", color = "#ffd23b", dy = 0.24, sx = 1.9, sy = 1.9, sz = 1.9 } }, -- Gold
	jungle = { { k = "resCrystal", color = "#5ad0c9", dy = 0.14, sx = 1.4, sy = 1.4, sz = 1.4 } }, -- Gem
	swamp = { { k = "resDerrick", color = "#2a2622", dy = 0.17 } }, -- Oil
}
local WATER_LEVEL = -0.02
local FOG = Color3.fromRGB(10, 14, 22) -- 0x0a0e16
-- eight neighbor directions for road connectivity (rotY aligns the segment)
local ROAD_DIRS = {
	{ dx = 1, dy = 0, rot = 0, diag = false }, { dx = -1, dy = 0, rot = 0, diag = false },
	{ dx = 0, dy = 1, rot = math.pi / 2, diag = false }, { dx = 0, dy = -1, rot = math.pi / 2, diag = false },
	{ dx = 1, dy = 1, rot = -math.pi / 4, diag = true }, { dx = -1, dy = -1, rot = -math.pi / 4, diag = true },
	{ dx = 1, dy = -1, rot = math.pi / 4, diag = true }, { dx = -1, dy = 1, rot = math.pi / 4, diag = true },
}

local function hexColor(hex)
	local n = tonumber(string.sub(hex, 2), 16) or 0
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
end

-- 32-bit modular multiply (Luau doubles lose precision past 2^53, so split the
-- multiplicand into 16-bit halves) — needed for props.js visualRand.
local function mul32(a, b)
	local al = a % 65536
	local ah = math.floor(a / 65536) % 65536
	return ((al * b) % 4294967296 + ((ah * b) % 65536) * 65536) % 4294967296
end

-- deterministic visual scatter (props.js visualRand), position-hashed so
-- decoration is stable across pushes/saves/clients and never touches state.
function M.visualRand(x, y, salt)
	local h = (mul32(x, 374761393) + mul32(y, 668265263) + mul32(salt + 1, 2246822519)) % 4294967296
	h = bit32.bxor(h, bit32.rshift(h, 13))
	h = mul32(h, 1274126177)
	h = bit32.bxor(h, bit32.rshift(h, 16))
	return h / 4294967296
end

-- one prop primitive -> Parts, via the R8 composer. o carries the browser
-- item fields (dx/dy/dz offsets, rotX/rotY, sx/sy/sz, hex color, dim).
local function placeProp(folder, kind, x, y, top, tile, o)
	local shape = M.PROP_SHAPES[kind]
	local col = hexColor(o.color)
	if o.dim then
		col = col:Lerp(FOG, 0.45)
	end
	local prim = {
		shape = shape.shape, size = shape.size, seg = shape.seg,
		scale = { o.sx or 1, o.sy or 1, o.sz or 1 },
		pos = { o.dx or 0, o.dy or 0, o.dz or 0 },
		rot = { o.rotX or 0, o.rotY or 0, o.rotZ or 0 },
		color = "primary",
	}
	AssetFactory.buildShape(folder, prim, { primary = col }, CFrame.new(x * o.TILE, top, y * o.TILE))
end

-- lightweight content signature so we only rebuild when prop-relevant tile
-- fields (not unit moves) change; fog visibility is included so dimming tracks.
local function signature(map)
	local h = 2166136261
	for i, t in ipairs(map.tiles) do
		if t.t ~= "unknown" then
			local bits = (t.road and 1 or 0) + (t.railroad and 2 or 0) + (t.irrigation and 4 or 0)
				+ (t.mine and 8 or 0) + (t.fortress and 16 or 0) + (t.special and 32 or 0)
				+ (t.hut and 64 or 0) + (t.visible == true and 128 or 0)
			h = bit32.bxor(h, i + bits * 131071 + string.len(t.t) * 7)
			h = (h * 16777619) % 4294967296
		end
	end
	return h
end

local lastSig = nil

-- Rebuild the whole props folder from the view (wholesale, guarded by the
-- content signature). tileTop maps a terrain id -> its top-surface stud height.
-- runN: the Studio soft-reset wipes the world — drop the signature so the next
-- game's first view rebuilds from scratch
function M.resetCache()
	lastSig = nil
end

function M.rebuild(folder, view, tileTop, TILE)
	local map = view.map
	local sig = signature(map)
	if sig == lastSig then
		return false
	end
	lastSig = sig
	folder:ClearAllChildren()

	local function tileAt(x, y)
		if y < 0 or y >= map.height then
			return nil
		end
		local xx = x
		if xx < 0 or xx >= map.width then
			if map.wrapX ~= true then
				return nil
			end
			xx = ((xx % map.width) + map.width) % map.width
		end
		return map.tiles[y * map.width + xx + 1]
	end
	local function roadAt(x, y)
		local n = tileAt(x, y)
		return n ~= nil and (n.road == true or n.railroad == true)
	end
	local function landAt(x, y)
		local n = tileAt(x, y)
		return n ~= nil and n.t ~= "ocean" and n.t ~= "unknown"
	end

	for y = 0, map.height - 1 do
		for x = 0, map.width - 1 do
			local t = map.tiles[y * map.width + x + 1]
			if t.t ~= "unknown" then
				local dim = t.visible ~= true
				local top = tileTop(t.t)
				local common = { dim = dim, TILE = TILE }
				local function put(kind, o)
					o.dim = dim
					o.TILE = TILE
					placeProp(folder, kind, x, y, o.top or top, t, o)
				end

				if t.irrigation then
					put("strip", { color = M.PROP_COLOR.irrigation, rotY = math.pi / 4, dy = 0.02 })
					put("fieldPatch", { color = M.PROP_COLOR.fieldPatch, dx = -0.2, dz = 0.14, dy = 0.015, rotY = math.pi / 4 })
					put("fieldPatch", { color = M.PROP_COLOR.fieldPatch, dx = 0.16, dz = -0.2, dy = 0.015, rotY = math.pi / 4 })
				end
				if t.road or t.railroad then
					local color = t.railroad and M.PROP_COLOR.railroad or M.PROP_COLOR.road
					local connected = 0
					for _, d in ipairs(ROAD_DIRS) do
						if roadAt(x + d.dx, y + d.dy) then
							connected += 1
							put("roadSeg", { color = color, rotY = d.rot, dy = 0.03,
								dx = d.dx * 0.25, dz = d.dy * 0.25, sx = d.diag and 1.42 or 1 })
							if t.railroad then
								for _, k in ipairs({ 0.14, 0.3 }) do
									put("tie", { color = M.PROP_COLOR.tie, rotY = d.rot, dy = 0.032,
										dx = d.dx * k, dz = d.dy * k })
								end
							end
						end
					end
					if connected == 0 then
						put("roadSeg", { color = color, rotY = 0, dy = 0.03, sx = 0.5 })
					end
				end
				if t.mine then
					put("mine", { color = M.PROP_COLOR.mine, dx = 0.18, dz = -0.16, dy = 0.1 })
					put("mineDoor", { color = M.PROP_COLOR.mineDoor, dx = 0.18, dz = -0.06, dy = 0.045 })
					put("mineBeam", { color = M.PROP_COLOR.mineBeam, dx = 0.18, dz = -0.055, dy = 0.1 })
				end
				if t.fortress then
					put("fortress", { color = M.PROP_COLOR.fortress, rotX = math.pi / 2, dy = 0.05 })
				end

				if t.t == "forest" then
					-- spruce cones (temperate forest)
					local color = M.PROP_COLOR.forest
					local count = 3 + math.floor(M.visualRand(x, y, 1) * 3)
					for i = 0, count - 1 do
						local s = 0.75 + M.visualRand(x, y, 10 + i) * 0.55
						put("tree", { color = color,
							dx = (M.visualRand(x, y, 20 + i) - 0.5) * 0.62,
							dz = (M.visualRand(x, y, 30 + i) - 0.5) * 0.62,
							dy = 0.14 * s, sx = s, sy = s, sz = s })
					end
				elseif t.t == "jungle" then
					-- XV §5: tropical rainforest — fewer, TALLER trees, each a buttress
					-- base + a slender trunk + a broad flat dome canopy; no cones.
					local count = 3 + math.floor(M.visualRand(x, y, 1) * 2) -- 3-4
					for i = 0, count - 1 do
						local s = 0.8 + M.visualRand(x, y, 10 + i) * 0.45
						local dx = (M.visualRand(x, y, 20 + i) - 0.5) * 0.5
						local dz = (M.visualRand(x, y, 30 + i) - 0.5) * 0.5
						put("jungleButtress", { color = M.PROP_COLOR.jungleButtress, dx = dx, dz = dz, dy = 0.075 * s, sx = s, sy = s, sz = s })
						put("jungleTrunk", { color = M.PROP_COLOR.jungleTrunk, dx = dx, dz = dz, dy = 0.24 * s, sx = s, sy = s, sz = s })
						put("jungleCanopy", { color = M.PROP_COLOR.jungleCanopy, dx = dx, dz = dz, dy = 0.52 * s, sx = 1.05 * s, sy = 0.42 * s, sz = 1.05 * s })
					end
				elseif t.t == "hills" then
					local count = 1 + (M.visualRand(x, y, 2) > 0.55 and 1 or 0)
					for i = 0, count - 1 do
						put("rock", { color = M.PROP_COLOR.rock,
							dx = (M.visualRand(x, y, 40 + i) - 0.5) * 0.5,
							dz = (M.visualRand(x, y, 50 + i) - 0.5) * 0.5,
							dy = 0.05, sy = 0.6, rotY = M.visualRand(x, y, 60 + i) * math.pi })
					end
				elseif t.t == "mountains" then
					local px = (M.visualRand(x, y, 3) - 0.5) * 0.3
					local pz = (M.visualRand(x, y, 4) - 0.5) * 0.3
					local s = 0.85 + M.visualRand(x, y, 5) * 0.4
					local rotY = M.visualRand(x, y, 6) * math.pi
					put("peak", { color = M.PROP_COLOR.peak, dx = px, dz = pz, dy = 0.25 * s, sx = s, sy = s, sz = s, rotY = rotY })
					put("snow", { color = M.PROP_COLOR.snow, dx = px, dz = pz, dy = 0.42 * s, sx = s, sy = s, sz = s, rotY = rotY })
				elseif SCRUB_COLOR[t.t] ~= nil and M.visualRand(x, y, 7) > 0.55 then
					local count = 1 + (M.visualRand(x, y, 8) > 0.7 and 1 or 0)
					for i = 0, count - 1 do
						put("scrub", { color = SCRUB_COLOR[t.t],
							dx = (M.visualRand(x, y, 70 + i) - 0.5) * 0.7,
							dz = (M.visualRand(x, y, 80 + i) - 0.5) * 0.7, dy = 0.05 })
					end
				end

				if t.t == "ocean" then
					for _, d in ipairs({
						{ dx = 1, dy = 0, rot = math.pi / 2 }, { dx = -1, dy = 0, rot = math.pi / 2 },
						{ dx = 0, dy = 1, rot = 0 }, { dx = 0, dy = -1, rot = 0 },
					}) do
						if landAt(x + d.dx, y + d.dy) then
							put("foam", { color = M.PROP_COLOR.foam, rotY = d.rot,
								dx = d.dx * 0.44, dz = d.dy * 0.44, dy = 0.008, top = tileTop("ocean") + WATER_LEVEL })
						end
					end
				end
				if t.special then
					-- per-resource motif by terrain (Civ 1 showed the resource itself).
					-- An OCEAN special (fish) rides the WATER SURFACE, not the
					-- submerged floor (top) where it would render underwater.
					local motif = SPECIAL_MOTIF[t.t]
					if motif ~= nil then
						local base = t.t == "ocean" and (tileTop("ocean") + WATER_LEVEL) or nil
						for _, m in ipairs(motif) do
							put(m.k, { color = m.color, dx = m.dx, dz = m.dz, dy = m.dy,
								sx = m.sx, sy = m.sy, sz = m.sz,
								rotX = m.rotX, rotY = m.rotY, rotZ = m.rotZ, top = base })
						end
					else -- any terrain without a motif keeps the generic marker
						put("special", { color = M.PROP_COLOR.special, dx = -0.2, dz = 0.2, dy = 0.08 })
					end
				end
				if t.hut == true then
					put("hutBase", { color = M.PROP_COLOR.hutWall, dy = 0.06 })
					put("hutRoof", { color = M.PROP_COLOR.hutRoof, dy = 0.19 })
				end
			end
		end
	end
	return true
end

return M
