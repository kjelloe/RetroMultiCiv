-- Wonder and building models as PURE DATA (specs/roblox-pedia-art.md 2.3).
-- One model serves the encyclopedia picture and the wonder scene. A model
-- lives in a box 12 wide, 12 deep, 12 high, origin at the centre of its
-- floor. part = { s = shape, at = { x, y, z } (centre of the part's base),
-- size = { w, h, d }, role, yaw = degrees about Y (optional) }.
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
}

local function part(s, x, y, z, w, h, d, role, yaw)
	return { s = s, at = { x, y, z }, size = { w, h, d }, role = role, yaw = yaw }
end

-- a stepped pyramid: `n` square courses from `w` wide down to `top` wide
local function courses(out, x, y, z, w, top, n, h, roleA, roleB)
	for i = 0, n - 1 do
		local side = w - (w - top) * i / (n - 1)
		side = math.floor(side * 100 + 0.5) / 100
		out[#out + 1] = part("box", x, y + i * h, z, side, h, side, i % 2 == 0 and roleA or roleB)
	end
	return y + n * h
end

local function palm(out, x, y, z, h)
	out[#out + 1] = part("cyl", x, y, z, 0.22, h, 0.22, "timber")
	out[#out + 1] = part("pyramid", x, y + h - 0.1, z, 1.1, 0.5, 1.1, "foliage", 20)
end

local function obelisk(out, x, y, z)
	out[#out + 1] = part("box", x, y, z, 0.34, 1.7, 0.34, "sandstoneDark")
	out[#out + 1] = part("pyramid", x, y + 1.7, z, 0.34, 0.34, 0.34, "gold")
end

-- ---- P0: three styles of the Pyramids for the user's pick ------------------
-- A "icon": the subject alone, few bold parts
local iconA = {
	part("box", 0, 0, 0, 10.4, 0.4, 10.4, "sandstoneDark"),
	part("pyramid", 0.9, 0.4, -0.9, 7.4, 5.8, 7.4, "sandstone"),
	part("pyramid", 0.9, 4.95, -0.9, 1.7, 1.33, 1.7, "gold"),
	part("pyramid", -3.2, 0.4, 3.2, 3.2, 2.5, 3.2, "sandstone"),
}

-- B "courses": the subject built of visible stone courses
local coursesB = { part("box", 0, 0, 0, 10.8, 0.3, 10.8, "sandstoneDark") }
local topB = courses(coursesB, 0.8, 0.3, -0.8, 8, 1.2, 11, 0.5, "sandstone", "sandstoneDark")
coursesB[#coursesB + 1] = part("pyramid", 0.8, topB, -0.8, 1.2, 0.8, 1.2, "gold")
courses(coursesB, -3.6, 0.3, 3.6, 3.2, 0.8, 5, 0.42, "sandstone", "sandstoneDark")
coursesB[#coursesB + 1] = part("box", 0.8, 0.3, 3.9, 1.1, 0.14, 2.6, "marble") -- causeway
coursesB[#coursesB + 1] = part("arch", 0.8, 0.3, 4.9, 1.6, 1.5, 0.5, "sandstoneDark")

-- C "diorama": the subject in its setting, smooth faces
local dioramaC = {
	part("box", 0, 0, 0, 11.6, 0.3, 11.6, "sand"),
	part("box", 0, 0.3, 5.1, 11.6, 0.06, 1.4, "water"), -- the river
	part("box", 0, 0.3, 4.05, 11.6, 0.1, 0.7, "grass"), -- its bank
	part("pyramid", 1.6, 0.3, -2, 6.2, 4.9, 6.2, "sandstone"),
	part("pyramid", 1.6, 4.15, -2, 1.4, 1.1, 1.4, "gold"),
	part("pyramid", -2.9, 0.3, 0.2, 3.6, 2.8, 3.6, "sandstone"),
	part("pyramid", -4.4, 0.3, 2.6, 1.9, 1.5, 1.9, "sandstoneDark"),
	part("box", 1.6, 0.3, 2.45, 0.8, 0.1, 2.5, "marble"), -- causeway to the river
	part("box", 1.6, 0.3, 3.5, 1.6, 0.7, 0.9, "sandstoneDark"), -- valley temple
	part("box", 1.6, 1.0, 3.5, 1.8, 0.14, 1.1, "marble"),
	-- the sphinx: body, forelegs, head
	part("box", 3.9, 0.3, 2.3, 0.7, 0.5, 1.7, "sandstoneDark"),
	part("box", 3.9, 0.3, 3.3, 0.7, 0.24, 0.5, "sandstoneDark"),
	part("box", 3.9, 0.8, 2.85, 0.56, 0.6, 0.5, "sandstone"),
}
obelisk(dioramaC, 0.9, 0.3, 1.1)
obelisk(dioramaC, 2.3, 0.3, 1.1)
palm(dioramaC, -4.6, 0.4, 4.05, 1.3)
palm(dioramaC, -3.4, 0.4, 4.15, 1.0)
palm(dioramaC, 4.9, 0.4, 4.0, 1.2)
palm(dioramaC, -0.6, 0.4, 4.1, 0.9)

M.VARIANTS = {
	pyramids = {
		{ key = "A", name = "icon", ground = "sand", parts = iconA, camera = { yaw = 35, pitch = 18, fit = 1.1 } },
		{ key = "B", name = "courses", ground = "sand", parts = coursesB, camera = { yaw = 35, pitch = 18, fit = 1.1 } },
		{ key = "C", name = "diorama", ground = "sand", parts = dioramaC, camera = { yaw = 35, pitch = 18, fit = 1.1 } },
	},
}

-- id -> model, in the picked style (filled from P2 on)
M.MODELS = {}

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
