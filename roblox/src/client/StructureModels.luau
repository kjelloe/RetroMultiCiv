-- Wonder and building models as PURE DATA (specs/roblox-pedia-art.md 2.3).
-- One model serves the encyclopedia picture and the wonder scene. A model
-- lives in a box 12 wide, 12 deep, 12 high, origin at the centre of its
-- floor. part = { s = shape, at = { x, y, z } (centre of the part's base),
-- size = { w, h, d }, role, yaw = degrees about Y (optional), tilt = degrees
-- about the part's own X axis after the yaw, pivot at the base centre
-- (optional; a cone at tilt 180 is a bowl) }.
-- Shapes: box, cyl (upright), cone (round), pyramid (square), wedge (ramp,
-- high edge at +z), ball, arch (two posts and a lintel, opening along z).
-- StructureBuilder turns M.expand(def) into Parts; roblox/tools/
-- model-preview.js draws the same list headless. Gate 65
-- (roblox/selftest/structure-models.luau) pins the budget.
local M = {}

M.SHAPES = { box = true, cyl = true, cone = true, pyramid = true, wedge = true, ball = true, arch = true }
M.LIMIT = { parts = 80, half = 6, height = 12 }

-- colour and material by role; no hex in the model data
M.ROLES = {
	sand = { color = "#d8c48a", material = "Sand" },
	sandstone = { color = "#d9b56a", material = "Sandstone" },
	sandstoneDark = { color = "#b8934e", material = "Sandstone" },
	marble = { color = "#ece8de", material = "Marble" },
	stone = { color = "#9a9a94", material = "Slate" },
	brick = { color = "#a8553d", material = "Brick" },
	timber = { color = "#7a5230", material = "WoodPlanks" },
	bronze = { color = "#b07a3a", material = "Metal" },
	gold = { color = "#f0c63c", material = "Metal" },
	steel = { color = "#8d97a3", material = "Metal" },
	concrete = { color = "#b9b7b0", material = "Concrete" },
	glass = { color = "#9fd0e6", material = "Glass" },
	water = { color = "#3f86c4", material = "SmoothPlastic" },
	grass = { color = "#5f9a48", material = "Grass" },
	foliage = { color = "#3f8f43", material = "SmoothPlastic" },
	lamp = { color = "#ffe9a0", material = "Neon" },
	plaster = { color = "#efe9dc", material = "SmoothPlastic" },
	terracotta = { color = "#b5553a", material = "Slate" },
	slate = { color = "#4d5560", material = "Slate" },
	thatch = { color = "#c9a857", material = "Fabric" },
	canvas = { color = "#f4f0e2", material = "Fabric" },
	red = { color = "#c8402f", material = "SmoothPlastic" },
	rock = { color = "#7d7468", material = "Slate" },
	black = { color = "#2b2d33", material = "SmoothPlastic" },
	copper = { color = "#6fae9a", material = "Metal" },
	violet = { color = "#7a4fa0", material = "Fabric" },
}

local function part(s, x, y, z, w, h, d, role, yaw, tilt)
	return { s = s, at = { x, y, z }, size = { w, h, d }, role = role, yaw = yaw, tilt = tilt }
end
local function r2(n)
	return math.floor(n * 100 + 0.5) / 100
end

local G = 0.3 -- the top of the ground slab

-- a model under construction: m:add(...) one part, m:group(...) parts given
-- in their own frame, placed at (ox, oy, oz) and turned by yaw
local Model = {}
Model.__index = Model
local function new(groundRole, slabRole)
	local m = setmetatable({ parts = {}, ground = groundRole }, Model)
	m:add("box", 0, 0, 0, 11.6, G, 11.6, slabRole or groundRole)
	return m
end
function Model:add(...)
	self.parts[#self.parts + 1] = part(...)
	return self
end
function Model:group(ox, oy, oz, yaw, items)
	local a = math.rad(yaw)
	for _, it in ipairs(items) do
		local lx, lz = it.at[1], it.at[3]
		local turn = ((it.yaw or 0) + yaw) % 360
		self.parts[#self.parts + 1] = part(it.s, r2(ox + lx * math.cos(a) + lz * math.sin(a)), r2(oy + it.at[2]),
			r2(oz - lx * math.sin(a) + lz * math.cos(a)), it.size[1], it.size[2], it.size[3], it.role,
			turn ~= 0 and turn or nil, it.tilt)
	end
	return self
end
local function done(m, camera)
	return { ground = m.ground, parts = m.parts, camera = camera or { yaw = 35, pitch = 18, fit = 1.1 } }
end

-- ---- shared pieces (lists of parts in their own frame) ---------------------
-- a pitched roof, ridge along x, over a w x d footprint
local function gable(x, y, z, w, h, d, role)
	return { part("wedge", x, y, z - d / 4, w, h, d / 2, role), part("wedge", x, y, z + d / 4, w, h, d / 2, role, 180) }
end
local function house(w, h, d, wall, roof, roofH)
	local out = { part("box", 0, 0, 0, w, h, d, wall) }
	for _, p in ipairs(gable(0, h, 0, w + 0.2, roofH or h * 0.5, d + 0.2, roof)) do
		out[#out + 1] = p
	end
	return out
end
local function palm(h)
	return { part("cyl", 0, 0, 0, 0.22, h, 0.22, "timber"), part("pyramid", 0, h - 0.1, 0, 1.1, 0.5, 1.1, "foliage", 20) }
end
local function tree(h)
	return { part("cyl", 0, 0, 0, 0.2, h * 0.4, 0.2, "timber"), part("ball", 0, h * 0.3, 0, h * 0.7, h * 0.7, h * 0.7, "foliage") }
end
local function cypress(h)
	return { part("cone", 0, 0, 0, h * 0.32, h, h * 0.32, "foliage") }
end
local function obelisk(h, cap)
	return { part("box", 0, 0, 0, 0.34, h, 0.34, "sandstoneDark"), part("pyramid", 0, h, 0, 0.34, 0.34, 0.34, cap or "gold") }
end
local function flag(h, role)
	return { part("cyl", 0, 0, 0, 0.08, h, 0.08, "steel"), part("box", 0.28, h - 0.42, 0, 0.5, 0.36, 0.05, role) }
end
-- a row of n columns along x, centred on 0
local function columns(n, gap, h, d, role)
	local out = {}
	for i = 0, n - 1 do
		out[#out + 1] = part("cyl", r2((i - (n - 1) / 2) * gap), 0, 0, d, h, d, role)
	end
	return out
end
-- a sailing ship, bow toward +z; masts = { { z, height, sailWidth } }
local function ship(len, beam, masts, cross)
	local out = {
		part("box", 0, 0, 0, beam, 0.45, len, "timber"),
		part("box", 0, 0.45, -len * 0.36, beam, 0.4, len * 0.28, "timber"),
		part("wedge", 0, 0.45, len * 0.4, beam, 0.34, len * 0.2, "timber"),
	}
	for _, m in ipairs(masts) do
		out[#out + 1] = part("cyl", 0, 0.45, m[1], 0.1, m[2], 0.1, "timber")
		out[#out + 1] = part("box", 0, 0.45 + m[2] * 0.3, m[1] + 0.12, m[3], m[2] * 0.55, 0.06, "canvas")
		if cross then
			out[#out + 1] = part("box", 0, 0.45 + m[2] * 0.3 + m[2] * 0.2, m[1] + 0.16, m[3] * 0.7, 0.12, 0.04, "red")
			out[#out + 1] = part("box", 0, 0.45 + m[2] * 0.36, m[1] + 0.16, 0.12, m[2] * 0.4, 0.04, "red")
		end
	end
	return out
end
-- a stepped pyramid: n square courses from w wide down to top wide
local function courses(w, top, n, h, roleA, roleB)
	local out = {}
	for i = 0, n - 1 do
		local side = r2(w - (w - top) * i / (n - 1))
		out[#out + 1] = part("box", 0, i * h, 0, side, h, side, i % 2 == 0 and roleA or (roleB or roleA))
	end
	return out
end

-- id -> model, in the diorama style (user pick 2026-11-23: the subject in
-- its setting, smooth faces)
M.MODELS = {}

do -- Pyramids
	local m = new("sand")
	m:add("box", 0, G, 5.1, 11.6, 0.06, 1.4, "water") -- the river
	m:add("box", 0, G, 4.05, 11.6, 0.1, 0.7, "grass") -- its bank
	m:add("pyramid", 1.6, G, -2, 6.2, 4.9, 6.2, "sandstone")
	m:add("pyramid", 1.6, 4.15, -2, 1.4, 1.1, 1.4, "gold")
	m:add("pyramid", -2.9, G, 0.2, 3.6, 2.8, 3.6, "sandstone")
	m:add("pyramid", -4.4, G, 2.6, 1.9, 1.5, 1.9, "sandstoneDark")
	m:add("box", 1.6, G, 2.45, 0.8, 0.1, 2.5, "marble") -- causeway to the river
	m:add("box", 1.6, G, 3.5, 1.6, 0.7, 0.9, "sandstoneDark") -- valley temple
	m:add("box", 1.6, 1.0, 3.5, 1.8, 0.14, 1.1, "marble")
	m:add("box", 3.9, G, 2.3, 0.7, 0.5, 1.7, "sandstoneDark") -- the sphinx
	m:add("box", 3.9, G, 3.3, 0.7, 0.24, 0.5, "sandstoneDark")
	m:add("box", 3.9, 0.8, 2.85, 0.56, 0.6, 0.5, "sandstone")
	m:group(0.9, G, 1.1, 0, obelisk(1.7)):group(2.3, G, 1.1, 0, obelisk(1.7))
	m:group(-4.6, 0.4, 4.05, 0, palm(1.3)):group(-3.4, 0.4, 4.15, 0, palm(1.0))
	m:group(4.9, 0.4, 4.0, 0, palm(1.2)):group(-0.6, 0.4, 4.1, 0, palm(0.9))
	M.MODELS["pyramids"] = done(m)
end

do -- Colossus: the bronze figure at the harbour mouth
	local m = new("water")
	m:add("box", 0, G, -4.3, 11.6, 0.5, 3, "sand") -- the town shore
	m:add("box", -3.7, G, 1.4, 4.2, 0.6, 2, "stone"):add("box", 3.7, G, 1.4, 4.2, 0.6, 2, "stone") -- the moles
	m:group(-4, 0.8, -4.4, 0, house(1.6, 1.0, 1.4, "plaster", "terracotta"))
	m:group(-1.6, 0.8, -4.7, 0, house(2.0, 1.3, 1.4, "plaster", "terracotta"))
	m:group(1.2, 0.8, -4.4, 0, house(1.5, 0.9, 1.3, "plaster", "terracotta"))
	m:group(3.8, 0.8, -4.6, 0, house(2.2, 1.2, 1.5, "plaster", "terracotta"))
	m:add("box", 2.3, 0.9, 1.4, 1.5, 0.9, 1.5, "marble") -- pedestal
	m:add("box", 2.02, 1.8, 1.4, 0.34, 1.7, 0.4, "bronze"):add("box", 2.58, 1.8, 1.4, 0.34, 1.7, 0.4, "bronze") -- legs
	m:add("box", 2.3, 3.5, 1.4, 1.0, 1.6, 0.55, "bronze") -- torso
	m:add("box", 1.66, 3.7, 1.4, 0.26, 1.3, 0.3, "bronze") -- the lowered arm
	m:add("box", 2.94, 4.7, 1.4, 0.26, 1.4, 0.3, "bronze") -- the raised arm
	m:add("ball", 2.3, 5.1, 1.4, 0.62, 0.62, 0.62, "bronze")
	m:add("cone", 2.3, 5.62, 1.4, 0.7, 0.3, 0.7, "gold") -- the crown
	m:add("cyl", 2.94, 6.1, 1.4, 0.4, 0.16, 0.4, "bronze"):add("cone", 2.94, 6.26, 1.4, 0.36, 0.5, 0.36, "lamp") -- the torch
	m:group(-0.2, G, 1.9, 60, ship(2.4, 0.8, { { 0.1, 1.7, 1.2 } }))
	m:group(-3.6, G, 4.3, 110, ship(1.6, 0.6, { { 0, 1.2, 0.9 } }))
	M.MODELS["colossus"] = done(m)
end

do -- Great Library
	local m = new("sand")
	m:add("box", 0, G, -0.4, 8.4, 0.25, 7, "marble"):add("box", 0, 0.55, -0.4, 7.8, 0.25, 6.4, "marble") -- steps
	m:add("box", 0, 0.8, -0.8, 5.2, 2.4, 4, "plaster") -- the hall
	m:add("box", 0, 0.8, 1.3, 1.1, 1.7, 0.1, "timber") -- the door
	m:group(0, 0.8, 2.3, 0, columns(6, 1.3, 2.4, 0.45, "marble"))
	m:group(-3.3, 0.8, -0.7, 90, columns(4, 1.3, 2.4, 0.45, "marble"))
	m:group(3.3, 0.8, -0.7, 90, columns(4, 1.3, 2.4, 0.45, "marble"))
	m:add("box", 0, 3.2, -0.4, 7.4, 0.4, 6, "marble") -- entablature
	m:group(0, 3.6, -0.4, 90, gable(0, 0, 0, 6, 1.3, 7.4, "terracotta"))
	m:add("box", -2.6, G, 4.2, 0.7, 0.9, 0.7, "marble"):add("box", 2.6, G, 4.2, 0.7, 0.9, 0.7, "marble") -- plinths
	m:add("cyl", -2.6, 1.2, 4.2, 0.3, 0.5, 0.3, "plaster"):add("cyl", 2.6, 1.2, 4.2, 0.3, 0.5, 0.3, "plaster") -- scroll jars
	m:group(-5, G, 3.6, 0, cypress(2.4)):group(5, G, 3.6, 0, cypress(2.4))
	m:group(-5, G, -4.6, 0, cypress(2.0)):group(5, G, -4.6, 0, cypress(2.0))
	M.MODELS["great-library"] = done(m)
end

do -- Great Wall: towers on the ridge, the wall between them
	local m = new("grass")
	local pts = { { -4.6, 2.2, 0.9 }, { -2.0, 0.2, 2.0 }, { 0.6, 1.6, 1.3 }, { 2.8, -1.0, 2.6 }, { 4.6, -3.4, 1.6 } } -- x, z, rise
	for _, p in ipairs(pts) do
		local w = r2(math.min(4.6, 2 * (5.8 - math.abs(p[1])), 2 * (5.8 - math.abs(p[2]))))
		m:add("pyramid", p[1], G, p[2], w, p[3] + 0.9, w, "grass") -- the hill under the tower
	end
	m:add("pyramid", -3.4, G, -3.6, 4.4, 3.2, 4.4, "rock"):add("pyramid", -3.4, 2.6, -3.6, 1.2, 0.9, 1.2, "plaster") -- far peak, snow
	for i = 1, #pts - 1 do
		local a, b = pts[i], pts[i + 1]
		local dx, dz, dy = b[1] - a[1], b[2] - a[2], b[3] - a[3]
		local len = math.sqrt(dx * dx + dz * dz)
		local yaw = r2(math.deg(math.atan2(dx, dz)) % 360)
		local tilt = r2(-math.deg(math.atan2(dy, len)))
		local mx, mz, my = r2((a[1] + b[1]) / 2), r2((a[2] + b[2]) / 2), r2(G + (a[3] + b[3]) / 2)
		m:add("box", mx, my, mz, 0.6, 0.9, r2(len + 0.2), "stone", yaw, tilt)
		m:add("box", mx, r2(my + 0.9), mz, 0.76, 0.14, r2(len + 0.2), "sandstoneDark", yaw, tilt) -- the walkway
	end
	for _, p in ipairs(pts) do
		local y = r2(G + p[3])
		m:add("box", p[1], y, p[2], 1.1, 1.7, 1.1, "stone"):add("box", p[1], y + 1.7, p[2], 1.4, 0.2, 1.4, "sandstoneDark")
		m:add("pyramid", p[1], y + 1.9, p[2], 1.2, 0.5, 1.2, "terracotta")
	end
	m:group(1.2, G, 4.4, 0, tree(1.4)):group(-0.6, G, 4.8, 0, tree(1.1)):group(4.6, G, 3.8, 0, tree(1.3))
	M.MODELS["great-wall"] = done(m, { yaw = 20, pitch = 22, fit = 1.1 })
end

do -- Hanging Gardens
	local m = new("sand")
	m:add("box", 0, G, 5.0, 11.6, 0.06, 1.5, "water")
	local sizes = { 8.4, 6.4, 4.6, 3.0 }
	for i, w in ipairs(sizes) do
		local y = r2(G + (i - 1) * 1.15)
		m:add("box", 0, y, -0.6, w, 1.15, w, i % 2 == 1 and "sandstone" or "sandstoneDark")
		-- planting along the front and both sides of each terrace, vines over the edge
		m:add("box", 0, y + 1.15, -0.6 + w / 2 - 0.3, w - 0.3, 0.28, 0.5, "foliage")
		m:add("box", -w / 2 + 0.3, y + 1.15, -0.6, 0.5, 0.28, w - 0.3, "foliage")
		m:add("box", w / 2 - 0.3, y + 1.15, -0.6, 0.5, 0.28, w - 0.3, "foliage")
		m:add("box", -w / 4, y + 0.45, -0.6 + w / 2 + 0.03, 0.5, 0.7, 0.08, "grass")
		m:add("box", w / 4, y + 0.55, -0.6 + w / 2 + 0.03, 0.4, 0.6, 0.08, "grass")
		m:add("box", 0, y + 0.1, -0.6 + w / 2 + 0.05, 0.5, 1.05, 0.08, "water") -- the cascade
	end
	m:group(-3.4, 1.73, 2.9, 0, palm(1.1)):group(3.4, 1.73, 2.9, 0, palm(1.2))
	m:group(-2.4, 2.88, 1.9, 0, palm(1.0)):group(2.4, 2.88, 1.9, 0, palm(0.9))
	m:group(-1.5, 4.03, 1.0, 0, palm(0.9)):group(1.5, 4.03, 1.0, 0, palm(0.8))
	m:group(0, 4.9, -0.6, 0, columns(2, 1.6, 1.0, 0.24, "marble")) -- the pavilion
	m:add("box", 0, 5.9, -0.6, 2.2, 0.16, 1.2, "marble"):add("pyramid", 0, 6.06, -0.6, 1.2, 0.5, 1.2, "gold")
	m:add("arch", -2.2, G, 3.75, 1.3, 0.9, 0.3, "sandstoneDark"):add("arch", 2.2, G, 3.75, 1.3, 0.9, 0.3, "sandstoneDark")
	M.MODELS["hanging-gardens"] = done(m)
end

do -- Lighthouse
	local m = new("water")
	m:add("box", 0.4, G, -0.4, 6.6, 0.5, 6.2, "rock"):add("box", 0.4, 0.8, -0.4, 5, 0.3, 4.8, "sand")
	m:add("box", -3.6, G, 2.6, 1.4, 0.3, 1.2, "rock"):add("box", 4.6, G, -3.6, 1.2, 0.35, 1.1, "rock")
	m:add("box", 0.4, 1.1, -0.4, 3.4, 0.5, 3.4, "stone") -- the platform
	m:add("box", 0.4, 1.6, -0.4, 2.5, 3.4, 2.5, "marble")
	m:add("box", 0.4, 5.0, -0.4, 2.9, 0.2, 2.9, "stone")
	m:add("cyl", 0.4, 5.2, -0.4, 1.8, 2.4, 1.8, "marble")
	m:add("cyl", 0.4, 7.6, -0.4, 2.2, 0.18, 2.2, "stone")
	m:add("cyl", 0.4, 7.78, -0.4, 1.1, 1.3, 1.1, "marble")
	m:add("cyl", 0.4, 9.08, -0.4, 1.5, 0.14, 1.5, "stone")
	m:add("ball", 0.4, 9.22, -0.4, 0.8, 0.8, 0.8, "lamp") -- the fire
	for _, o in ipairs({ { -0.5, -0.5 }, { 0.5, -0.5 }, { -0.5, 0.5 }, { 0.5, 0.5 } }) do
		m:add("box", 0.4 + o[1], 9.22, -0.4 + o[2], 0.12, 0.9, 0.12, "bronze")
	end
	m:add("cone", 0.4, 10.12, -0.4, 1.5, 0.7, 1.5, "bronze"):add("box", 0.4, 10.82, -0.4, 0.14, 0.5, 0.14, "gold")
	m:add("wedge", 0.4, 1.1, 2.0, 1.2, 0.5, 1.4, "stone", 180) -- the ramp
	m:group(-3.4, G, -3.4, 40, ship(2.2, 0.75, { { 0.1, 1.6, 1.1 } }))
	m:group(4.2, G, 3.6, 300, ship(1.7, 0.6, { { 0, 1.2, 0.9 } }))
	M.MODELS["lighthouse"] = done(m, { yaw = 35, pitch = 14, fit = 1.15 })
end

do -- Oracle: the round temple under the mountain
	local m = new("grass")
	m:add("pyramid", -2.4, G, -2.8, 6.4, 5.6, 6.4, "rock"):add("pyramid", 2.8, G, -3.8, 4.2, 3.6, 4.2, "rock")
	m:add("box", 0.6, G, 1.4, 7, 0.4, 5.4, "sandstone") -- the terrace
	m:add("cyl", 0.6, 0.7, 1.2, 4.4, 0.3, 4.4, "marble"):add("cyl", 0.6, 1.0, 1.2, 3.9, 0.2, 3.9, "marble")
	m:add("cyl", 0.6, 1.2, 1.2, 1.9, 2.2, 1.9, "plaster") -- the cella
	for i = 0, 9 do
		local a = math.rad(i * 36)
		m:add("cyl", r2(0.6 + math.cos(a) * 1.65), 1.2, r2(1.2 + math.sin(a) * 1.65), 0.3, 2.2, 0.3, "marble")
	end
	m:add("cyl", 0.6, 3.4, 1.2, 4.0, 0.3, 4.0, "marble")
	m:add("cone", 0.6, 3.7, 1.2, 4.2, 1.3, 4.2, "terracotta"):add("ball", 0.6, 4.9, 1.2, 0.36, 0.36, 0.36, "gold")
	m:add("cyl", 0.6, 0.7, 3.7, 0.5, 0.5, 0.5, "bronze"):add("cone", 0.6, 1.2, 3.7, 0.44, 0.7, 0.44, "lamp") -- the tripod fire
	m:add("box", 0.6, G, 4.5, 1.6, 0.2, 1.0, "marble") -- steps
	m:group(-3.4, G, 3.0, 0, cypress(2.6)):group(4.6, G, 2.6, 0, cypress(2.8)):group(-4.6, G, 4.6, 0, cypress(2.0))
	m:group(4.8, G, 4.8, 0, cypress(1.8))
	M.MODELS["oracle"] = done(m)
end

do -- Copernicus' Observatory
	local m = new("grass")
	m:add("box", 0, G, 0.4, 7.6, 0.3, 6.4, "stone") -- the yard
	m:add("cyl", -1.2, 0.6, -0.4, 3.2, 4.6, 3.2, "brick")
	m:add("cyl", -1.2, 5.2, -0.4, 3.7, 0.3, 3.7, "stone")
	m:add("ball", -1.2, 4.1, -0.4, 3.1, 3.1, 3.1, "copper") -- the dome, half sunk into the tower
	m:add("cyl", -1.2, 6.5, -0.4, 0.4, 2.6, 0.4, "steel", 60, 50) -- the telescope
	m:add("box", -1.2, 0.6, 1.25, 0.8, 1.4, 0.12, "timber") -- door
	m:group(2.5, 0.6, -0.8, 90, house(3.2, 1.9, 2.4, "plaster", "terracotta", 1.1))
	m:add("box", 2.4, 0.6, 2.4, 0.9, 0.7, 0.9, "stone") -- the armillary on its plinth
	m:add("ball", 2.4, 1.3, 2.4, 0.9, 0.9, 0.9, "gold")
	m:add("cyl", 2.4, 1.69, 2.4, 1.3, 0.1, 1.3, "bronze")
	m:add("box", 0, 0.6, 3.5, 7.6, 0.6, 0.25, "brick") -- the yard wall
	m:group(-4.8, G, 3.8, 0, tree(1.8)):group(4.8, G, -4.2, 0, tree(2.0)):group(-4.6, G, -4.4, 0, tree(1.5))
	M.MODELS["copernicus-observatory"] = done(m)
end

do -- Darwin's Voyage: the survey ship off the island
	local m = new("water")
	m:add("box", -2.6, G, -2.4, 5.6, 0.35, 5.2, "sand"):add("box", -3.2, 0.65, -3.0, 3.6, 0.3, 3.4, "grass")
	m:add("pyramid", -3.6, 0.95, -3.4, 2.6, 2.2, 2.6, "rock")
	m:add("box", -0.6, G, 1.0, 1.6, 0.25, 1.4, "rock")
	m:group(-1.2, 0.65, -0.6, 0, palm(1.3)):group(-4.6, 0.65, -0.6, 0, palm(1.1)):group(-1.4, 0.95, -3.6, 0, palm(1.2))
	for _, t in ipairs({ { -2.4, -0.5 }, { -3.4, 0.1 }, { -0.9, -1.8 } }) do -- the tortoises
		m:add("ball", t[1], 0.5, t[2], 0.56, 0.56, 0.56, "foliage"):add("box", t[1] + 0.32, 0.65, t[2], 0.2, 0.14, 0.18, "thatch")
	end
	m:group(2.6, G, 1.2, 200, ship(3.6, 1.0, { { 1.0, 2.6, 1.5 }, { -0.5, 3.0, 1.7 } }))
	m:group(0.6, G, -0.4, 250, { part("box", 0, 0, 0, 0.4, 0.2, 1.0, "timber") }) -- the landing boat
	M.MODELS["darwin-s-voyage"] = done(m)
end

do -- Magellan's Expedition: the carrack in the strait
	local m = new("water")
	m:add("pyramid", -4.2, G, -3.6, 3.2, 3.4, 3.2, "rock"):add("pyramid", -4.6, G, -1.2, 2.2, 1.8, 2.2, "rock")
	m:add("pyramid", -4.2, G, 3.9, 2.6, 2.0, 2.6, "rock"):add("pyramid", 4.6, G, -0.6, 2.2, 1.7, 2.2, "rock")
	m:add("pyramid", -4.2, 2.7, -3.6, 1.0, 1.0, 1.0, "plaster") -- snow cap
	m:group(-0.2, G, 0.4, 35, ship(4.6, 1.3, { { 1.5, 2.6, 1.6 }, { 0.1, 3.6, 2.1 }, { -1.3, 2.4, 1.4 } }, true))
	m:group(-0.2, G, 0.4, 35, { part("box", 0, 0.85, -1.9, 1.3, 0.5, 0.9, "timber"), part("box", 0, 0.79, 1.9, 1.1, 0.35, 0.7, "timber"),
		part("box", 0.34, 4.05, 0.1, 0.6, 0.3, 0.05, "red") }) -- castles, pennant
	m:group(3.0, G, -3.6, 20, ship(2.0, 0.7, { { 0.1, 1.6, 1.0 } }, true))
	M.MODELS["magellan-s-expedition"] = done(m)
end

do -- Isaac Newton's College
	local m = new("grass")
	m:add("box", 0, G, 0.6, 4.4, 0.06, 4.0, "foliage") -- the quad lawn
	m:add("box", 0, G, 3.4, 1.0, 0.07, 2.6, "marble") -- the path
	m:group(0, G, -2.8, 0, house(8.4, 2.2, 1.8, "sandstone", "slate", 1.0))
	m:group(-3.3, G, 0.6, 90, house(5.0, 2.0, 1.7, "sandstone", "slate", 0.9))
	m:group(3.3, G, 0.6, 90, house(5.0, 2.0, 1.7, "sandstone", "slate", 0.9))
	m:add("box", 0, G, -2.8, 1.8, 4.4, 2.0, "sandstoneDark") -- the gate tower
	for _, o in ipairs({ { -0.8, -0.9 }, { 0.8, -0.9 }, { -0.8, 0.9 }, { 0.8, 0.9 } }) do
		m:add("box", o[1], 4.7, -2.8 + o[2], 0.34, 0.8, 0.34, "sandstoneDark"):add("pyramid", o[1], 5.5, -2.8 + o[2], 0.34, 0.5, 0.34, "slate")
	end
	m:add("arch", 0, G, -1.75, 1.1, 1.5, 0.2, "marble")
	m:group(-3.3, G, 4.2, 0, house(1.7, 2.6, 2.2, "sandstone", "slate", 1.3)) -- the chapel
	m:add("cyl", 1.0, G, 1.0, 0.24, 0.9, 0.24, "timber"):add("ball", 1.0, 0.9, 1.0, 1.7, 1.7, 1.7, "foliage") -- the apple tree
	m:add("ball", 1.5, 1.0, 1.7, 0.22, 0.22, 0.22, "red"):add("ball", 0.5, 1.3, 1.75, 0.22, 0.22, 0.22, "red")
	m:add("ball", 1.3, G, 2.2, 0.22, 0.22, 0.22, "red") -- the one that fell
	m:group(4.9, G, 4.6, 0, tree(1.6))
	M.MODELS["isaac-newton-s-college"] = done(m)
end

do -- J.S. Bach's Cathedral
	local m = new("grass", "stone")
	m:group(0.6, G, -0.8, 90, house(6.6, 3.4, 3.0, "plaster", "slate", 1.8)) -- the nave
	m:add("box", -1.5, G, -0.8, 1.2, 1.8, 6.0, "plaster"):add("wedge", -1.5, 2.1, -0.8, 6.0, 0.7, 1.2, "slate", 90) -- aisles
	m:add("box", 2.7, G, -0.8, 1.2, 1.8, 6.0, "plaster"):add("wedge", 2.7, 2.1, -0.8, 6.0, 0.7, 1.2, "slate", 270)
	m:add("box", 0.6, G, 3.4, 2.4, 6.4, 2.2, "plaster") -- the west tower
	m:add("box", 0.6, 6.7, 3.4, 2.7, 0.2, 2.5, "stone")
	m:add("cyl", 0.6, 6.9, 3.4, 1.7, 1.2, 1.7, "plaster")
	m:add("ball", 0.6, 7.7, 3.4, 1.9, 1.9, 1.9, "copper") -- the onion dome
	m:add("cone", 0.6, 9.3, 3.4, 0.7, 1.6, 0.7, "copper"):add("box", 0.6, 10.9, 3.4, 0.1, 0.5, 0.1, "gold")
	m:add("arch", 0.6, G, 4.55, 1.3, 1.8, 0.2, "stone")
	m:add("cyl", 0.6, 4.2, 4.52, 0.9, 0.08, 0.9, "gold", 0, 90) -- the clock
	m:add("box", -4.2, G, 3.6, 2.6, 0.5, 1.0, "timber") -- the organ, shown outside its loft
	for i = 0, 6 do
		local h = 1.2 + math.abs(3 - i) * 0.45
		m:add("cyl", r2(-5.25 + i * 0.35), 0.8, 3.6, 0.28, r2(h), 0.28, "gold")
	end
	m:group(-4.6, G, -4.2, 0, tree(1.9)):group(4.9, G, 4.4, 0, tree(1.6))
	M.MODELS["j-s-bach-s-cathedral"] = done(m)
end

do -- Michelangelo's Chapel: the domed basilica
	local m = new("sand", "stone")
	m:add("box", 0, G, -1.4, 6.4, 2.6, 5.6, "marble")
	m:add("box", 0, 2.9, -1.4, 6.8, 0.25, 6.0, "stone")
	m:add("cyl", 0, 3.15, -1.6, 3.6, 1.5, 3.6, "marble") -- the drum
	for i = 0, 7 do
		local a = math.rad(i * 45 + 22.5)
		m:add("cyl", r2(math.cos(a) * 1.85), 3.15, r2(-1.6 + math.sin(a) * 1.85), 0.26, 1.5, 0.26, "plaster")
	end
	m:add("ball", 0, 2.95, -1.6, 3.5, 3.5, 3.5, "slate") -- the dome
	m:add("cyl", 0, 6.4, -1.6, 0.7, 0.8, 0.7, "marble"):add("ball", 0, 7.2, -1.6, 0.5, 0.5, 0.5, "gold")
	m:add("ball", -2.3, 2.6, 0.4, 1.3, 1.3, 1.3, "slate"):add("ball", 2.3, 2.6, 0.4, 1.3, 1.3, 1.3, "slate") -- side domes
	m:group(0, G, 1.9, 0, columns(6, 1.0, 2.4, 0.36, "marble")) -- the portico
	m:add("box", 0, 2.7, 1.8, 6.0, 0.3, 1.0, "marble")
	m:group(0, 3.0, 1.8, 90, gable(0, 0, 0, 1.0, 0.9, 6.0, "marble"))
	m:add("box", 0, G, 3.2, 3.4, 0.14, 1.6, "marble") -- steps
	m:group(0, G, 4.9, 0, obelisk(2.2, "bronze"))
	m:group(-4.4, G, 3.4, 60, columns(4, 0.9, 1.6, 0.3, "marble")):group(4.4, G, 3.4, 120, columns(4, 0.9, 1.6, 0.3, "marble"))
	M.MODELS["michelangelo-s-chapel"] = done(m)
end

do -- Shakespeare's Theatre: the round playhouse by the river
	local m = new("grass")
	m:add("box", 0, G, 5.0, 11.6, 0.06, 1.5, "water")
	m:add("cyl", 0, G, -0.6, 6.4, 3.0, 6.4, "plaster")
	for _, y in ipairs({ 0.3, 1.3, 2.3, 3.2 }) do
		m:add("cyl", 0, y, -0.6, 6.5, 0.14, 6.5, "timber") -- the timber frame
	end
	for i = 0, 11 do
		local a = math.rad(i * 30)
		m:add("box", r2(math.sin(a) * 3.2), 0.44, r2(-0.6 + math.cos(a) * 3.2), 0.16, 2.76, 0.12, "timber", i * 30)
	end
	m:add("cyl", 0, 3.34, -0.6, 3.8, 0.06, 3.8, "black") -- the open yard
	for i = 0, 7 do
		local a = math.rad(i * 45)
		m:add("box", r2(math.sin(a) * 2.55), 3.34, r2(-0.6 + math.cos(a) * 2.55), 2.75, 0.5, 1.5, "thatch", i * 45)
	end
	m:group(0, 3.34, -2.1, 0, house(2.2, 1.3, 1.3, "plaster", "thatch", 0.9)) -- the stage house
	m:group(0.6, 5.3, -2.1, 0, flag(1.4, "red"))
	m:add("arch", 0, G, 2.62, 1.2, 1.5, 0.3, "timber")
	m:group(-4.6, G, 3.2, 0, house(1.5, 1.0, 1.3, "plaster", "thatch")):group(4.5, G, 3.0, 0, house(1.6, 1.1, 1.3, "plaster", "thatch"))
	m:group(-4.8, G, -4.4, 0, tree(1.7))
	M.MODELS["shakespeare-s-theatre"] = done(m, { yaw = 30, pitch = 24, fit = 1.1 })
end

do -- Leonardo's Workshop
	local m = new("grass")
	m:add("box", 0, G, 0.4, 9, 0.1, 8, "sand") -- the yard
	m:group(-2.2, 0.4, -2.6, 0, house(4.8, 2.4, 3.0, "plaster", "terracotta", 1.3))
	m:add("box", -2.2, 0.4, -1.06, 1.0, 1.6, 0.1, "timber")
	for _, o in ipairs({ { 1.0, -3.6 }, { 4.2, -3.6 }, { 1.0, -1.4 }, { 4.2, -1.4 } }) do -- the open shed
		m:add("box", o[1], 0.4, o[2], 0.2, 1.9, 0.2, "timber")
	end
	m:add("wedge", 2.6, 2.3, -2.5, 3.8, 0.7, 2.8, "terracotta")
	m:add("cyl", 2.6, 1.5, -2.5, 2.0, 0.3, 2.0, "timber", 0, 90) -- the great gear
	m:add("cyl", 2.6, 1.4, -2.3, 0.5, 0.3, 0.5, "bronze", 0, 90)
	-- the flying machine on its stand
	m:add("box", 2.6, 0.4, 1.8, 0.2, 1.3, 0.2, "timber"):add("box", 2.6, 1.7, 1.8, 0.3, 0.24, 2.6, "timber")
	m:add("box", 1.3, 1.9, 1.8, 2.4, 0.06, 1.5, "canvas", 0, 0):add("box", 3.9, 1.9, 1.8, 2.4, 0.06, 1.5, "canvas")
	m:add("box", 2.6, 1.8, 0.4, 1.0, 0.05, 0.7, "canvas")
	-- the armoured car
	m:add("cyl", -2.6, 0.4, 2.4, 2.4, 0.4, 2.4, "timber"):add("cone", -2.6, 0.8, 2.4, 2.4, 1.1, 2.4, "timber")
	m:add("cyl", -2.6, 1.7, 2.4, 0.5, 0.3, 0.5, "bronze")
	m:add("box", -0.2, 0.4, 3.4, 0.9, 1.3, 0.1, "canvas", 20):add("box", -0.2, 0.4, 3.6, 0.1, 1.5, 0.1, "timber") -- the easel
	m:group(4.9, G, 4.6, 0, cypress(2.2)):group(-4.9, G, 4.8, 0, cypress(1.8))
	M.MODELS["leonardo-s-workshop"] = done(m)
end

do -- Women's Suffrage: the assembly hall and the ballot
	local m = new("grass", "stone")
	m:add("box", 0, G, -1.2, 8, 0.25, 6, "marble"):add("box", 0, 0.55, -1.2, 7.4, 0.25, 5.4, "marble")
	m:add("box", 0, 0.8, -1.6, 6, 2.6, 3.8, "plaster")
	m:group(0, 0.8, 0.9, 0, columns(6, 1.15, 2.6, 0.4, "marble"))
	m:add("box", 0, 3.4, -1.2, 7, 0.35, 5, "marble")
	m:group(0, 3.75, -1.2, 90, gable(0, 0, 0, 5, 1.1, 7, "marble"))
	m:add("cyl", 0, 3.9, -2.0, 1.8, 0.9, 1.8, "plaster"):add("ball", 0, 4.0, -2.0, 1.7, 1.7, 1.7, "copper")
	m:add("box", 0, 0.8, 0.32, 1.2, 1.9, 0.1, "timber")
	m:add("box", 0, G, 3.4, 1.3, 1.0, 1.3, "timber"):add("box", 0, 1.3, 3.4, 0.7, 0.05, 0.14, "black") -- the ballot box, its slot
	m:add("box", 0, 1.3, 3.75, 0.5, 0.6, 0.04, "canvas", 0, 20) -- a ballot going in
	m:group(-2.6, G, 3.4, 0, flag(2.4, "violet")):group(-1.6, G, 3.4, 0, flag(2.4, "canvas"))
	m:group(1.6, G, 3.4, 0, flag(2.4, "grass")):group(2.6, G, 3.4, 0, flag(2.4, "violet"))
	m:add("box", -3.9, G, 4.4, 1.6, 0.5, 0.6, "timber"):add("box", 3.9, G, 4.4, 1.6, 0.5, 0.6, "timber") -- benches
	m:group(-5, G, -4.6, 0, tree(1.8)):group(5, G, -4.6, 0, tree(1.8))
	M.MODELS["women-s-suffrage"] = done(m)
end

do -- Hoover Dam
	local m = new("sand", "rock")
	m:add("box", -4.5, G, 0, 2.6, 6.2, 11.6, "rock"):add("box", 4.5, G, 0, 2.6, 6.2, 11.6, "rock") -- the canyon walls
	m:add("box", -3.4, G, 3, 1.0, 3.4, 5.6, "sandstoneDark"):add("box", 3.4, G, 3, 1.0, 3.0, 5.6, "sandstoneDark")
	m:add("box", 0, G, -3.2, 6.4, 5.0, 5.2, "water") -- the reservoir
	m:add("box", 0, G, -0.3, 6.4, 5.6, 0.7, "concrete") -- the dam: crest wall and sloping face
	m:add("wedge", 0, G, 0.9, 6.4, 5.4, 1.8, "concrete", 180)
	m:add("box", 0, 5.9, -0.3, 6.4, 0.12, 0.9, "black") -- the road
	for _, x in ipairs({ -2.2, -0.8, 0.8, 2.2 }) do
		m:add("cyl", x, 5.3, -1.5, 0.6, 1.4, 0.6, "concrete"):add("cone", x, 6.7, -1.5, 0.7, 0.35, 0.7, "copper") -- intake towers
	end
	m:add("box", -1.9, G, 2.6, 1.6, 1.1, 2.0, "concrete"):add("box", 1.9, G, 2.6, 1.6, 1.1, 2.0, "concrete") -- powerhouse wings
	m:add("box", -1.9, 1.4, 2.6, 1.7, 0.1, 2.1, "slate"):add("box", 1.9, 1.4, 2.6, 1.7, 0.1, 2.1, "slate")
	m:add("box", 0, G, 4.0, 2.0, 0.1, 3.6, "water") -- the tailrace
	for _, x in ipairs({ -4.4, 4.4 }) do -- pylons on the rim
		m:add("box", x, 6.5, 2.0, 0.14, 1.9, 0.14, "steel"):add("box", x, 7.9, 2.0, 1.1, 0.1, 0.1, "steel")
		m:add("box", x, 7.4, 2.0, 0.8, 0.1, 0.1, "steel")
	end
	M.MODELS["hoover-dam"] = done(m, { yaw = 0, pitch = 30, fit = 1.1 })
end

do -- Manhattan Project: the test site
	local m = new("sand")
	for _, o in ipairs({ { -0.5, -0.5 }, { 0.5, -0.5 }, { -0.5, 0.5 }, { 0.5, 0.5 } }) do -- the shot tower
		m:add("box", 1.6 + o[1], G, -1.4 + o[2], 0.14, 6.0, 0.14, "steel")
	end
	for _, y in ipairs({ 1.8, 3.3, 4.8 }) do
		m:add("box", 1.6, y, -1.4, 1.2, 0.08, 1.2, "steel")
	end
	m:add("box", 1.6, 6.3, -1.4, 1.5, 0.12, 1.5, "steel"):add("box", 1.6, 6.42, -1.4, 1.3, 1.1, 1.3, "slate")
	m:add("wedge", 1.6, 7.52, -1.4, 1.5, 0.3, 1.5, "slate")
	m:add("ball", 1.6, 5.2, -1.4, 0.9, 0.9, 0.9, "black") -- the device, hoisted
	m:add("box", -3.6, G, 3.4, 2.6, 0.9, 1.6, "concrete"):add("wedge", -3.6, G, 4.6, 2.6, 0.9, 0.9, "sand", 180) -- the bunker
	m:add("box", -3.6, 0.8, 2.62, 1.6, 0.16, 0.05, "black")
	m:group(-3.6, G, -3.4, 0, house(2.6, 1.1, 1.5, "plaster", "slate", 0.5))
	m:group(-3.6, G, -1.2, 0, house(2.6, 1.1, 1.5, "plaster", "slate", 0.5))
	m:group(-0.6, G, -4.4, 0, house(2.2, 1.0, 1.4, "plaster", "slate", 0.5))
	m:add("cyl", 4.4, G, 2.8, 1.8, 1.6, 1.8, "concrete"):add("cyl", 4.4, 1.9, 2.8, 0.5, 2.6, 0.5, "brick") -- the pile and its stack
	m:add("box", 2.6, G, 3.6, 0.9, 0.6, 1.8, "grass"):add("box", 2.6, 0.9, 4.1, 0.8, 0.5, 0.7, "grass") -- a truck
	for i = 0, 5 do
		m:add("box", r2(-1.4 + i * 1.2), G, 1.2, 0.08, 0.6, 0.08, "timber") -- fence posts
	end
	m:add("box", 1.6, 0.7, 1.2, 6.1, 0.04, 0.04, "steel")
	M.MODELS["manhattan-project"] = done(m)
end

do -- Apollo Program: the rocket on its pad
	local m = new("grass", "concrete")
	m:add("box", -0.6, G, 0, 5.4, 0.6, 5.4, "concrete"):add("box", -0.6, G, 3.3, 1.6, 0.5, 1.4, "black") -- pad, flame trench
	m:add("box", -0.6, 0.9, 0, 3.2, 0.4, 3.2, "steel") -- the launch platform
	m:add("cyl", -0.6, 1.3, 0, 1.5, 4.0, 1.5, "plaster"):add("cyl", -0.6, 5.3, 0, 1.52, 0.3, 1.52, "black")
	m:add("cyl", -0.6, 5.6, 0, 1.5, 2.2, 1.5, "plaster"):add("cone", -0.6, 7.8, 0, 1.5, 0.5, 1.5, "black")
	m:add("cyl", -0.6, 7.9, 0, 1.0, 1.5, 1.0, "plaster"):add("cone", -0.6, 9.4, 0, 1.0, 0.9, 1.0, "steel")
	m:add("cyl", -0.6, 10.3, 0, 0.12, 1.0, 0.12, "steel") -- the escape tower
	for _, o in ipairs({ { 0.9, 0, 0 }, { -0.9, 0, 0 }, { 0, 0.9, 90 }, { 0, -0.9, 90 } }) do -- fins
		m:add("box", -0.6 + o[1], 1.3, o[2], 0.5, 1.0, 0.1, "black", o[3])
	end
	for _, o in ipairs({ { -0.45, -0.45 }, { 0.45, -0.45 }, { -0.45, 0.45 }, { 0.45, 0.45 } }) do -- the umbilical tower
		m:add("box", 1.9 + o[1], 0.9, o[2], 0.16, 9.2, 0.16, "red")
	end
	for _, y in ipairs({ 2.6, 4.4, 6.2, 8.0, 9.8 }) do
		m:add("box", 1.9, y, 0, 1.1, 0.12, 1.1, "red")
	end
	m:add("box", 0.9, 4.4, 0, 1.2, 0.14, 0.3, "red"):add("box", 0.8, 8.0, 0, 1.4, 0.14, 0.3, "red") -- swing arms
	m:add("box", 1.9, 10.1, 0, 0.1, 1.2, 0.1, "steel") -- lightning mast
	m:add("ball", 4.4, G, -3.6, 1.6, 1.6, 1.6, "plaster"):add("ball", 4.4, G, 3.8, 1.3, 1.3, 1.3, "plaster") -- fuel spheres
	m:add("box", -4.4, G, -4.0, 2.0, 1.0, 1.8, "concrete"):add("box", -4.4, 1.3, -4.0, 1.4, 0.4, 1.2, "glass") -- launch control
	M.MODELS["apollo-program"] = done(m, { yaw = 35, pitch = 12, fit = 1.2 })
end

do -- SETI Program: the listening dishes
	local m = new("sand")
	local function dish(x, z, d, h, yaw)
		m:add("cyl", x, G, z, d * 0.3, 0.4, d * 0.3, "concrete")
		m:add("box", x, 0.7, z, 0.3, h, 0.3, "steel")
		m:add("box", x, h + 0.5, z, d * 0.4, 0.3, 0.5, "steel", yaw)
		m:add("cone", x, r2(h + 0.8 + d * 0.3), z, d, d * 0.26, d, "plaster", yaw, 150) -- the bowl
		m:add("cyl", x, r2(h + 0.8 + d * 0.3), z, 0.1, d * 0.5, 0.1, "steel", yaw, -30) -- the feed mast
	end
	dish(-0.8, -0.6, 5.6, 3.6, 210)
	dish(3.8, 3.2, 2.6, 1.6, 210)
	dish(-4.2, 3.6, 2.2, 1.4, 210)
	m:add("box", 3.8, G, -3.6, 2.6, 1.1, 1.8, "concrete"):add("box", 3.8, 1.4, -3.6, 2.8, 0.12, 2.0, "slate") -- the control room
	m:add("box", 3.8, 0.7, -2.68, 1.8, 0.4, 0.05, "glass")
	m:add("box", 5.0, 1.52, -4.1, 0.08, 2.2, 0.08, "steel"):add("ball", 5.0, 3.72, -4.1, 0.2, 0.2, 0.2, "red") -- the mast and its light
	m:add("box", 0.8, G, 4.6, 3.0, 0.04, 0.5, "black") -- the track road
	M.MODELS["seti-program"] = done(m)
end

do -- United Nations
	local m = new("grass", "concrete")
	m:add("box", 5.0, G, 0, 1.6, 0.06, 11.6, "water") -- the river
	m:add("box", -1.2, G, -2.6, 4.4, 8.8, 1.3, "glass") -- the slab tower
	m:add("box", -3.46, G, -2.6, 0.14, 9.0, 1.4, "marble"):add("box", 1.06, G, -2.6, 0.14, 9.0, 1.4, "marble")
	m:add("box", -1.2, 9.1, -2.6, 4.66, 0.2, 1.4, "marble")
	for _, y in ipairs({ 2.4, 4.6, 6.8 }) do
		m:add("box", -1.2, y, -2.6, 4.42, 0.12, 1.34, "steel")
	end
	m:add("box", 2.4, G, 1.2, 3.2, 1.5, 3.4, "marble") -- the assembly hall
	m:add("wedge", 2.4, 1.8, 1.2, 3.2, 0.6, 3.4, "marble")
	m:add("ball", 2.4, 1.7, 0.8, 1.3, 1.3, 1.3, "copper")
	m:add("box", -1.6, G, 0.2, 3.6, 1.0, 2.2, "plaster"):add("box", -1.6, 0.6, 1.33, 3.4, 0.5, 0.05, "glass") -- conference block
	m:add("cyl", -1.4, G, 3.6, 1.8, 0.2, 1.8, "stone"):add("cyl", -1.4, 0.5, 3.6, 1.4, 0.06, 1.4, "water") -- fountain
	local colours = { "red", "canvas", "gold", "grass", "water", "violet", "red", "canvas" }
	for i, c in ipairs(colours) do
		m:group(r2(-5.2 + (i - 1) * 0.5), G, 5.0, 0, flag(1.7, c))
	end
	m:group(-4.9, G, 2.2, 0, tree(1.5)):group(3.6, G, 4.4, 0, tree(1.4))
	M.MODELS["united-nations"] = done(m)
end

do -- Cure for Cancer: the research hospital
	local m = new("grass")
	m:add("box", 0, G, -2.2, 7.6, 2.8, 3.4, "plaster")
	m:add("box", 0, 1.1, -0.48, 7.2, 0.5, 0.06, "glass"):add("box", 0, 2.1, -0.48, 7.2, 0.5, 0.06, "glass")
	m:add("box", 0, 3.1, -2.2, 7.8, 0.14, 3.6, "slate")
	m:add("box", 0, G, 0.2, 2.6, 1.9, 1.6, "glass") -- the atrium
	m:add("box", 0, 2.2, 0.2, 2.8, 0.12, 1.8, "steel")
	m:add("box", 2.6, 3.24, -1.6, 1.2, 0.3, 0.06, "red"):add("box", 2.6, 2.94, -1.6, 0.3, 0.9, 0.07, "red") -- the cross on the roof sign
	m:add("box", 2.6, 2.84, -1.66, 1.5, 1.1, 0.05, "plaster")
	m:add("cyl", 0, G, 3.4, 1.6, 0.3, 1.6, "stone"):add("cyl", 0, 0.6, 3.4, 0.12, 3.4, 0.12, "steel") -- the helix on its plinth
	for i = 0, 10 do
		m:add("box", 0, r2(0.8 + i * 0.3), 3.4, 1.4, 0.1, 0.12, i % 2 == 0 and "red" or "water", (i * 34) % 360)
		local a = math.rad(i * 34)
		m:add("ball", r2(math.cos(a) * 0.7), r2(0.74 + i * 0.3), r2(3.4 - math.sin(a) * 0.7), 0.22, 0.22, 0.22, "plaster")
		m:add("ball", r2(-math.cos(a) * 0.7), r2(0.74 + i * 0.3), r2(3.4 + math.sin(a) * 0.7), 0.22, 0.22, 0.22, "plaster")
	end
	m:add("box", -3.6, G, 2.6, 1.0, 0.6, 2.0, "plaster"):add("box", -3.6, 0.9, 2.2, 0.9, 0.4, 1.0, "plaster") -- the ambulance
	m:add("box", -3.6, 0.9, 3.2, 0.6, 0.06, 0.2, "red")
	m:group(4.6, G, 3.0, 0, tree(1.8)):group(-5, G, -4.8, 0, tree(1.6)):group(4.9, G, -4.9, 0, tree(1.5))
	M.MODELS["cure-for-cancer"] = done(m)
end

-- governments and concepts: a small emblem scene each (EmblemModels fills it)
M.EMBLEMS = { governments = {}, concepts = {} }

-- what BuildingModels and EmblemModels author with
M.kit = { new = new, done = done, part = part, r2 = r2, G = G, gable = gable, house = house, palm = palm, tree = tree,
	cypress = cypress, obelisk = obelisk, flag = flag, columns = columns, ship = ship, courses = courses }

-- style candidates awaiting a pick: id -> { { key, name, ground, parts, camera } x3 }
M.VARIANTS = {}

-- the primitive list a builder draws: an arch becomes two posts and a
-- lintel; the list is bottom-up (the order the wonder scene assembles in)
function M.expand(def)
	local out = {}
	for _, p in ipairs(def.parts) do
		if p.s == "arch" then
			local w, h, d = p.size[1], p.size[2], p.size[3]
			local t = w / 5
			local a = math.rad(p.yaw or 0)
			local ox = w / 2 - t / 2
			for _, side in ipairs({ -1, 1 }) do
				out[#out + 1] = { s = "box", at = { p.at[1] + side * ox * math.cos(a), p.at[2], p.at[3] - side * ox * math.sin(a) },
					size = { t, h - t, d }, role = p.role, yaw = p.yaw }
			end
			out[#out + 1] = { s = "box", at = { p.at[1], p.at[2] + h - t, p.at[3] }, size = { w, t, d }, role = p.role, yaw = p.yaw }
		else
			out[#out + 1] = p
		end
	end
	local order = {}
	for i, p in ipairs(out) do
		order[p] = i
	end
	table.sort(out, function(a, b)
		if a.at[2] ~= b.at[2] then
			return a.at[2] < b.at[2]
		end
		return order[a] < order[b]
	end)
	return out
end

return M
