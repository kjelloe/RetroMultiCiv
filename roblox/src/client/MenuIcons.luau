-- Roblox-native look, phase U1 (specs/roblox-native-look.md): menu-button
-- pictograms as PURE DATA in the tech-glyph primitive vocabulary (0..100 box,
-- y-DOWN; disc/ring/arc/ell/bar/poly/dots — EditableGlyph.renderPrims draws
-- them, no uploads). Lune-pinned by roblox/selftest/menu-icons.luau (gate 35):
-- known kinds only, coordinates inside the box, every icon id a button asks
-- for exists here.
local M = {}

local function tri(a, b, c)
	return { p = "poly", pts = { a, b, c }, fill = true, close = true }
end
local function quad(a, b, c, d)
	return { p = "poly", pts = { a, b, c, d }, fill = true, close = true }
end
local function bar(x, y, w, h, r, rot)
	return { p = "bar", x = x, y = y, w = w, h = h, r = r or 2, rot = rot or 0 }
end

local gear = { { p = "ring", x = 50, y = 50, r = 21, w = 13 } }
for i = 0, 7 do
	local a = math.pi * 2 * i / 8
	local x = math.floor((50 + math.cos(a) * 35) * 10 + 0.5) / 10
	local y = math.floor((50 + math.sin(a) * 35) * 10 + 0.5) / 10
	table.insert(gear, bar(x, y, 14, 13, 3, i * 45))
end

M.ICONS = {
	research = { -- flask
		bar(50, 15, 30, 8, 3),
		{ p = "poly", fill = true, close = true,
			pts = { { 42, 18 }, { 58, 18 }, { 58, 42 }, { 80, 82 }, { 20, 82 }, { 42, 42 } } },
	},
	cities = { bar(26, 64, 18, 38), bar(50, 52, 20, 62), bar(74, 68, 18, 30), bar(50, 88, 82, 7, 3) },
	government = { -- temple front
		tri({ 50, 12 }, { 90, 36 }, { 10, 36 }),
		bar(24, 58, 9, 34), bar(41, 58, 9, 34), bar(59, 58, 9, 34), bar(76, 58, 9, 34),
		bar(50, 83, 84, 9, 2),
	},
	options = gear,
	pedia = { -- open book
		quad({ 47, 28 }, { 14, 20 }, { 14, 76 }, { 47, 84 }),
		quad({ 53, 28 }, { 86, 20 }, { 86, 76 }, { 53, 84 }),
	},
	techtree = {
		{ p = "disc", x = 50, y = 34, r = 25 },
		{ p = "disc", x = 30, y = 48, r = 17 },
		{ p = "disc", x = 70, y = 48, r = 17 },
		bar(50, 76, 13, 30),
	},
	ship = { -- rocket
		{ p = "poly", fill = true, close = true,
			pts = { { 50, 8 }, { 66, 38 }, { 66, 68 }, { 34, 68 }, { 34, 38 } } },
		tri({ 34, 52 }, { 16, 78 }, { 34, 70 }),
		tri({ 66, 52 }, { 84, 78 }, { 66, 70 }),
		tri({ 42, 74 }, { 58, 74 }, { 50, 94 }),
	},
	strategic = { -- target rings
		{ p = "ring", x = 50, y = 50, r = 36, w = 9 },
		{ p = "ring", x = 50, y = 50, r = 17, w = 9 },
		{ p = "disc", x = 50, y = 50, r = 5 },
	},
	endturn = { -- hourglass
		bar(50, 12, 64, 8, 3), bar(50, 88, 64, 8, 3),
		tri({ 24, 18 }, { 76, 18 }, { 50, 50 }),
		tri({ 50, 50 }, { 76, 82 }, { 24, 82 }),
	},
	theater = { { p = "ring", x = 50, y = 50, r = 38, w = 8 }, tri({ 40, 30 }, { 72, 50 }, { 40, 70 }) },
	found = { tri({ 50, 14 }, { 88, 48 }, { 12, 48 }), bar(50, 68, 50, 36) }, -- house
	turnlog = { -- list: three bullet rows
		{ p = "dots", r = 6, pts = { { 20, 26 }, { 20, 50 }, { 20, 74 } } },
		bar(60, 26, 52, 10, 4), bar(60, 50, 52, 10, 4), bar(60, 74, 52, 10, 4),
	},
	diplomacy = { -- two flags on one pole base
		bar(30, 52, 7, 72), quad({ 34, 16 }, { 62, 24 }, { 34, 40 }, { 34, 28 }),
		bar(70, 58, 7, 60), quad({ 66, 28 }, { 40, 38 }, { 66, 52 }, { 66, 40 }),
		bar(50, 90, 70, 7, 3),
	},
	legend = { -- a key cap
		{ p = "bar", x = 50, y = 50, w = 70, h = 70, r = 14, rot = 0, fill = false, w2 = 9 },
		bar(50, 40, 10, 26, 4), { p = "disc", x = 50, y = 66, r = 6 },
	},
	overlays = { -- stacked layers
		quad({ 50, 14 }, { 88, 34 }, { 50, 54 }, { 12, 34 }),
		{ p = "poly", fill = false, close = false, w = 8, pts = { { 12, 52 }, { 50, 72 }, { 88, 52 } } },
		{ p = "poly", fill = false, close = false, w = 8, pts = { { 12, 70 }, { 50, 90 }, { 88, 70 } } },
	},
	fortify = { -- shield
		{ p = "poly", fill = true, close = true,
			pts = { { 50, 10 }, { 84, 22 }, { 80, 60 }, { 50, 90 }, { 20, 60 }, { 16, 22 } } },
	},
}

M.KINDS = { disc = true, ring = true, arc = true, ell = true, bar = true, poly = true, dots = true }

return M
