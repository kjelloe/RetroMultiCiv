-- SO18 tech-glyph MOTIF DATA — the 1:1 Luau port of the browser
-- client/ui/tech-glyphs.js GLYPH table (the pure-data motif vocabulary in a
-- 0..100 box, y-DOWN). Render-only (golden-neutral); EditableGlyph.luau draws
-- these primitives via EditableImage. Primitive kinds: disc/ring/arc/ell/bar/
-- poly/letter/dots (see EditableGlyph for the render contract). Gate 31 pins the
-- key set to the browser GLYPH (all 68 techs covered, same ids). Helpers below
-- mirror the JS star/ringOf/atom/wheelSpoked (deterministic geometry, module-load).
local M = {}

local cos, sin, pi, round = math.cos, math.sin, math.pi, function(n) return math.floor(n * 10 + 0.5) / 10 end

local function star(x, y, r, points, inner)
	local pts = {}
	local ri = inner or r * 0.45
	for i = 0, points * 2 - 1 do
		local a = (pi * i) / points - pi / 2
		local rad = (i % 2 == 0) and r or ri
		pts[#pts + 1] = { round(x + cos(a) * rad), round(y + sin(a) * rad) }
	end
	return { p = "poly", pts = pts, close = true, fill = true }
end

-- make(px, py, a) -> a primitive; returns a LIST of primitives (spread by caller)
local function ringOf(count, cx, cy, r, make)
	local out = {}
	for i = 0, count - 1 do
		local a = (pi * 2 * i) / count
		out[#out + 1] = make(cx + cos(a) * r, cy + sin(a) * r, a)
	end
	return out
end

local function atom(x, y, s)
	return {
		{ p = "ell", x = x, y = y, rx = s, ry = s * 0.4, rot = 0, w = 5 },
		{ p = "ell", x = x, y = y, rx = s, ry = s * 0.4, rot = 60, w = 5 },
		{ p = "ell", x = x, y = y, rx = s, ry = s * 0.4, rot = 120, w = 5 },
		{ p = "disc", x = x, y = y, r = 8 },
	}
end

local function wheelSpoked(x, y, r)
	local out = { { p = "ring", x = x, y = y, r = r, w = 8 }, { p = "disc", x = x, y = y, r = 7 } }
	for _, pr in ipairs(ringOf(8, x, y, r, function(px, py)
		return { p = "poly", pts = { { x, y }, { px, py } }, w = 5 }
	end)) do
		out[#out + 1] = pr
	end
	return out
end

-- append helper: concat a spread list into a motif builder
local function cat(motif, list)
	for _, pr in ipairs(list) do motif[#motif + 1] = pr end
	return motif
end

M.GLYPH = {
	-- ancient
	["alphabet"] = { { p = "letter", ch = "A", x = 50, y = 52, size = 62 } },
	["writing"] = { { p = "poly", pts = { { 30, 74 }, { 70, 30 } }, w = 8 }, { p = "poly", pts = { { 24, 80 }, { 34, 70 }, { 30, 74 } }, close = true, fill = true }, { p = "poly", pts = { { 26, 78 }, { 22, 82 } }, w = 4 } },
	["literacy"] = { { p = "poly", pts = { { 22, 34 }, { 50, 42 }, { 78, 34 }, { 78, 70 }, { 50, 78 }, { 22, 70 } }, close = true, w = 6 }, { p = "poly", pts = { { 50, 42 }, { 50, 78 } }, w = 6 } },
	["wheel"] = wheelSpoked(50, 50, 30),
	["pottery"] = { { p = "poly", pts = { { 38, 30 }, { 62, 30 }, { 58, 40 }, { 70, 58 }, { 62, 74 }, { 38, 74 }, { 30, 58 }, { 42, 40 } }, close = true, w = 6 }, { p = "poly", pts = { { 40, 30 }, { 60, 30 } }, w = 7 } },
	["masonry"] = { { p = "bar", x = 34, y = 38, w = 30, h = 14, r = 2 }, { p = "bar", x = 66, y = 38, w = 30, h = 14, r = 2 }, { p = "bar", x = 50, y = 54, w = 30, h = 14, r = 2 }, { p = "bar", x = 34, y = 70, w = 30, h = 14, r = 2 }, { p = "bar", x = 66, y = 70, w = 30, h = 14, r = 2 } },
	["bronze-working"] = { { p = "poly", pts = { { 28, 60 }, { 72, 60 }, { 64, 44 }, { 36, 44 } }, close = true, fill = true } },
	["iron-working"] = { { p = "bar", x = 50, y = 44, w = 46, h = 12, r = 3 }, { p = "poly", pts = { { 34, 50 }, { 30, 66 }, { 70, 66 }, { 66, 50 } }, close = true, fill = true }, { p = "bar", x = 50, y = 72, w = 30, h = 8 } },
	["ceremonial-burial"] = { { p = "arc", x = 50, y = 76, r = 24, a0 = 180, a1 = 360, w = 7 }, { p = "bar", x = 50, y = 58, w = 14, h = 36, r = 5 }, { p = "arc", x = 50, y = 30, r = 10, a0 = 200, a1 = 340, w = 4 } },
	["code-of-laws"] = { { p = "poly", pts = { { 50, 24 }, { 50, 74 } }, w = 6 }, { p = "poly", pts = { { 24, 34 }, { 76, 34 } }, w = 6 }, { p = "arc", x = 30, y = 34, r = 14, a0 = 0, a1 = 180, w = 5 }, { p = "arc", x = 70, y = 34, r = 14, a0 = 0, a1 = 180, w = 5 }, { p = "bar", x = 50, y = 78, w = 34, h = 8 } },
	["currency"] = { { p = "ring", x = 50, y = 50, r = 27, w = 8 }, { p = "bar", x = 50, y = 50, w = 20, h = 20, r = 2, fill = false, w2 = 8 } },
	["mathematics"] = { { p = "poly", pts = { { 26, 72 }, { 74, 72 }, { 26, 30 } }, close = true, w = 7 }, { p = "poly", pts = { { 34, 66 }, { 40, 66 }, { 40, 72 } }, close = true, w = 4 } },
	["trade"] = { { p = "poly", pts = { { 24, 42 }, { 68, 42 } }, w = 6 }, { p = "poly", pts = { { 60, 34 }, { 72, 42 }, { 60, 50 } }, close = true, fill = true }, { p = "poly", pts = { { 76, 60 }, { 32, 60 } }, w = 6 }, { p = "poly", pts = { { 40, 52 }, { 28, 60 }, { 40, 68 } }, close = true, fill = true }, { p = "disc", x = 50, y = 51, r = 5 } },
	["construction"] = { { p = "bar", x = 32, y = 72, w = 22, h = 14, r = 2 }, { p = "bar", x = 46, y = 58, w = 22, h = 14, r = 2 }, { p = "bar", x = 60, y = 44, w = 22, h = 14, r = 2 }, { p = "arc", x = 54, y = 56, r = 26, a0 = 200, a1 = 340, w = 6 } },
	["engineering"] = { { p = "bar", x = 30, y = 58, w = 8, h = 44 }, { p = "bar", x = 70, y = 58, w = 8, h = 44 }, { p = "bar", x = 50, y = 34, w = 48, h = 8 }, { p = "poly", pts = { { 30, 38 }, { 50, 66 }, { 70, 38 } }, w = 6 } },
	["bridge-building"] = cat({ { p = "arc", x = 50, y = 58, r = 24, a0 = 180, a1 = 360, w = 7 }, { p = "bar", x = 50, y = 40, w = 60, h = 8 } }, ringOf(3, 50, 58, 24, function(px, py) return { p = "poly", pts = { { px, 44 }, { px, py } }, w = 4 } end)),
	["map-making"] = { { p = "poly", pts = { { 22, 34 }, { 40, 40 }, { 58, 34 }, { 78, 40 }, { 78, 68 }, { 58, 62 }, { 40, 68 }, { 22, 62 } }, close = true, w = 6 }, { p = "poly", pts = { { 40, 40 }, { 40, 68 } }, w = 3 }, { p = "poly", pts = { { 58, 34 }, { 58, 62 } }, w = 3 }, { p = "disc", x = 50, y = 52, r = 4 } },
	["horseback-riding"] = { { p = "poly", pts = { { 24, 60 }, { 26, 50 }, { 36, 34 }, { 42, 30 }, { 44, 20 }, { 50, 30 }, { 54, 36 }, { 62, 64 }, { 48, 66 }, { 34, 64 } }, close = true, fill = true }, { p = "poly", pts = { { 26, 58 }, { 14, 64 } }, w = 3 }, { p = "poly", pts = { { 52, 38 }, { 60, 34 } }, w = 3 }, { p = "poly", pts = { { 55, 48 }, { 64, 46 } }, w = 3 } },
	["monarchy"] = { { p = "poly", pts = { { 26, 68 }, { 30, 36 }, { 42, 54 }, { 50, 32 }, { 58, 54 }, { 70, 36 }, { 74, 68 } }, close = true, fill = true }, { p = "bar", x = 50, y = 74, w = 52, h = 8 } },
	["mysticism"] = { { p = "arc", x = 54, y = 50, r = 24, a0 = 40, a1 = 300, w = 12 }, star(70, 34, 9, 4) },
	["republic"] = { { p = "bar", x = 50, y = 30, w = 56, h = 8 }, { p = "bar", x = 28, y = 58, w = 8, h = 38 }, { p = "bar", x = 50, y = 58, w = 8, h = 38 }, { p = "bar", x = 72, y = 58, w = 8, h = 38 }, { p = "bar", x = 50, y = 80, w = 60, h = 8 } },
	["feudalism"] = { { p = "bar", x = 50, y = 62, w = 48, h = 34 }, { p = "bar", x = 30, y = 40, w = 10, h = 16 }, { p = "bar", x = 50, y = 40, w = 10, h = 16 }, { p = "bar", x = 70, y = 40, w = 10, h = 16 } },

	-- renaissance
	["astronomy"] = { star(50, 46, 16, 5), { p = "ell", x = 50, y = 50, rx = 34, ry = 14, rot = 20, w = 5 } },
	["banking"] = { { p = "bar", x = 50, y = 52, w = 52, h = 46, r = 4, fill = false, w2 = 7 }, { p = "disc", x = 50, y = 40, r = 7 }, { p = "disc", x = 50, y = 52, r = 7 }, { p = "disc", x = 50, y = 64, r = 7 } },
	["chemistry"] = { { p = "poly", pts = { { 42, 28 }, { 58, 28 } }, w = 6 }, { p = "poly", pts = { { 44, 30 }, { 44, 46 }, { 30, 74 }, { 70, 74 }, { 56, 46 }, { 56, 30 } }, close = true, w = 6 }, { p = "poly", pts = { { 38, 60 }, { 62, 60 } }, w = 6 } },
	["chivalry"] = { { p = "poly", pts = { { 50, 80 }, { 28, 54 }, { 30, 32 }, { 70, 32 }, { 72, 54 } }, close = true, w = 6 }, { p = "poly", pts = { { 32, 36 }, { 66, 66 } }, w = 6 }, { p = "poly", pts = { { 40, 28 }, { 42, 20 }, { 46, 25 }, { 50, 17 }, { 54, 25 }, { 58, 20 }, { 60, 28 } }, close = true, fill = true } },
	["gunpowder"] = cat({ { p = "disc", x = 50, y = 50, r = 10 } }, ringOf(10, 50, 50, 30, function(px, py, a) return { p = "poly", pts = { { 50 + cos(a) * 14, 50 + sin(a) * 14 }, { px, py } }, w = 4 } end)),
	["invention"] = { { p = "disc", x = 50, y = 40, r = 18, fill = false, w = 6 }, { p = "poly", pts = { { 42, 56 }, { 46, 62 }, { 50, 56 }, { 54, 62 }, { 58, 56 } }, w = 4 }, { p = "bar", x = 50, y = 68, w = 16, h = 5 }, { p = "bar", x = 50, y = 74, w = 12, h = 4 } },
	["magnetism"] = { { p = "arc", x = 50, y = 40, r = 20, a0 = 180, a1 = 360, w = 11 }, { p = "bar", x = 34, y = 62, w = 9, h = 20 }, { p = "bar", x = 66, y = 62, w = 9, h = 20 }, { p = "bar", x = 34, y = 74, w = 11, h = 7 }, { p = "bar", x = 66, y = 74, w = 11, h = 7 }, { p = "dots", pts = { { 50, 72 }, { 43, 80 }, { 57, 80 } }, r = 3 } },
	["medicine"] = { { p = "bar", x = 50, y = 50, w = 16, h = 48, r = 3 }, { p = "bar", x = 50, y = 50, w = 48, h = 16, r = 3 } },
	["metallurgy"] = { { p = "poly", pts = { { 34, 44 }, { 66, 44 }, { 60, 32 }, { 40, 32 } }, close = true, fill = true }, { p = "arc", x = 50, y = 56, r = 24, a0 = 20, a1 = 160, w = 6 }, { p = "poly", pts = { { 26, 58 }, { 74, 58 } }, w = 5 } },
	["navigation"] = { { p = "disc", x = 50, y = 50, r = 6 }, { p = "poly", pts = { { 50, 50 }, { 62, 26 } }, w = 5 }, { p = "poly", pts = { { 56, 30 }, { 62, 26 }, { 60, 34 } }, close = true, fill = true }, { p = "poly", pts = { { 50, 22 }, { 50, 30 } }, w = 4 }, { p = "poly", pts = { { 50, 70 }, { 50, 78 } }, w = 4 }, { p = "poly", pts = { { 22, 50 }, { 30, 50 } }, w = 4 }, { p = "poly", pts = { { 70, 50 }, { 78, 50 } }, w = 4 } },
	["philosophy"] = { { p = "bar", x = 50, y = 56, w = 12, h = 40 }, { p = "bar", x = 50, y = 34, w = 34, h = 8 }, { p = "bar", x = 50, y = 78, w = 34, h = 8 }, { p = "poly", pts = { { 46, 40 }, { 46, 72 } }, w = 3 }, { p = "poly", pts = { { 54, 40 }, { 54, 72 } }, w = 3 } },
	["physics"] = { { p = "poly", pts = { { 50, 28 }, { 68, 64 }, { 32, 64 } }, close = true, w = 6 }, { p = "poly", pts = { { 16, 46 }, { 42, 52 } }, w = 5 }, { p = "poly", pts = { { 58, 54 }, { 84, 44 } }, w = 4 }, { p = "poly", pts = { { 58, 58 }, { 84, 66 } }, w = 4 } },
	["religion"] = cat({ { p = "disc", x = 50, y = 50, r = 14 } }, ringOf(8, 50, 50, 30, function(px, py, a) return { p = "poly", pts = { { 50 + cos(a) * 20, 50 + sin(a) * 20 }, { px, py } }, w = 5 } end)),
	["theory-of-gravity"] = { { p = "arc", x = 22, y = 24, r = 54, a0 = 5, a1 = 68, w = 4 }, { p = "disc", x = 64, y = 58, r = 10 }, { p = "bar", x = 50, y = 80, w = 60, h = 5 } },
	["university"] = { { p = "poly", pts = { { 24, 42 }, { 50, 32 }, { 76, 42 }, { 50, 52 } }, close = true, fill = true }, { p = "poly", pts = { { 50, 52 }, { 50, 66 } }, w = 4 }, { p = "disc", x = 50, y = 68, r = 4 }, { p = "arc", x = 50, y = 42, r = 16, a0 = 20, a1 = 160, w = 4 } },

	-- industrial
	["atomic-theory"] = atom(50, 50, 30),
	["combustion"] = { { p = "bar", x = 50, y = 52, w = 32, h = 56, r = 3, fill = false, w2 = 6 }, { p = "bar", x = 50, y = 32, w = 14, h = 26, r = 2 }, { p = "poly", pts = { { 50, 60 }, { 44, 72 }, { 50, 68 }, { 47, 80 }, { 56, 66 }, { 50, 70 } }, close = true, fill = true } },
	["communism"] = { star(50, 36, 20, 5), { p = "bar", x = 50, y = 60, w = 52, h = 8 }, { p = "bar", x = 38, y = 74, w = 16, h = 8 }, { p = "bar", x = 62, y = 74, w = 16, h = 8 } },
	["conscription"] = { { p = "bar", x = 40, y = 50, w = 6, h = 52, rot = -8 }, { p = "bar", x = 52, y = 50, w = 6, h = 52 }, { p = "bar", x = 64, y = 50, w = 6, h = 52, rot = 8 }, { p = "poly", pts = { { 36, 64 }, { 52, 72 }, { 36, 80 } }, close = true, fill = true } },
	["corporation"] = { { p = "bar", x = 50, y = 50, w = 16, h = 60 }, { p = "bar", x = 30, y = 62, w = 14, h = 36 }, { p = "bar", x = 70, y = 60, w = 14, h = 40 }, { p = "bar", x = 50, y = 82, w = 60, h = 8 } },
	["democracy"] = { { p = "bar", x = 50, y = 66, w = 44, h = 36, r = 3, fill = false, w2 = 6 }, { p = "bar", x = 50, y = 48, w = 26, h = 5 }, { p = "bar", x = 53, y = 36, w = 18, h = 22, r = 2, rot = 14 } },
	["electricity"] = { { p = "poly", pts = { { 56, 22 }, { 34, 54 }, { 48, 54 }, { 42, 78 }, { 66, 44 }, { 52, 44 } }, close = true, fill = true } },
	["explosives"] = { { p = "bar", x = 38, y = 60, w = 11, h = 40, r = 2 }, { p = "bar", x = 50, y = 60, w = 11, h = 40, r = 2 }, { p = "bar", x = 62, y = 60, w = 11, h = 40, r = 2 }, { p = "poly", pts = { { 52, 40 }, { 60, 28 } }, w = 3 }, star(62, 22, 7, 4) },
	["flight"] = { { p = "bar", x = 50, y = 54, w = 12, h = 44, r = 4 }, { p = "bar", x = 50, y = 46, w = 64, h = 10, r = 3 }, { p = "disc", x = 50, y = 28, r = 7 }, { p = "bar", x = 50, y = 76, w = 24, h = 7, r = 2 } },
	["industrialization"] = { { p = "bar", x = 50, y = 66, w = 52, h = 34 }, { p = "bar", x = 30, y = 44, w = 10, h = 30 }, { p = "disc", x = 32, y = 32, r = 6 }, { p = "disc", x = 42, y = 26, r = 7 }, { p = "poly", pts = { { 40, 54 }, { 52, 46 }, { 52, 54 }, { 64, 46 }, { 64, 54 }, { 76, 46 } }, w = 4 } },
	["railroad"] = { { p = "poly", pts = { { 34, 24 }, { 26, 78 } }, w = 6 }, { p = "poly", pts = { { 66, 24 }, { 74, 78 } }, w = 6 }, { p = "bar", x = 46, y = 36, w = 40, h = 6 }, { p = "bar", x = 48, y = 54, w = 44, h = 6 }, { p = "bar", x = 50, y = 72, w = 48, h = 6 } },
	["refining"] = { { p = "bar", x = 44, y = 52, w = 16, h = 56, r = 3, fill = false, w2 = 6 }, { p = "poly", pts = { { 52, 42 }, { 72, 42 }, { 72, 54 } }, w = 5 }, { p = "disc", x = 72, y = 61, r = 7 }, { p = "poly", pts = { { 52, 64 }, { 28, 64 }, { 28, 74 } }, w = 5 }, { p = "disc", x = 28, y = 81, r = 7 } },
	["steam-engine"] = { { p = "bar", x = 46, y = 58, w = 40, h = 26, r = 3 }, { p = "disc", x = 66, y = 72, r = 10 }, { p = "bar", x = 40, y = 40, w = 10, h = 16 }, { p = "disc", x = 40, y = 28, r = 6 }, { p = "disc", x = 48, y = 22, r = 5 } },
	["steel"] = { { p = "bar", x = 34, y = 50, w = 10, h = 48 }, { p = "bar", x = 66, y = 50, w = 10, h = 48 }, { p = "bar", x = 50, y = 50, w = 34, h = 10 } },

	-- modern
	["advanced-flight"] = { { p = "poly", pts = { { 50, 20 }, { 58, 52 }, { 50, 46 }, { 42, 52 } }, close = true, fill = true }, { p = "poly", pts = { { 50, 46 }, { 78, 66 }, { 54, 60 }, { 50, 72 }, { 46, 60 }, { 22, 66 } }, close = true, fill = true }, { p = "poly", pts = { { 38, 76 }, { 36, 88 } }, w = 3 }, { p = "poly", pts = { { 50, 78 }, { 50, 90 } }, w = 3 }, { p = "poly", pts = { { 62, 76 }, { 64, 88 } }, w = 3 } },
	["automobile"] = { { p = "poly", pts = { { 24, 60 }, { 30, 46 }, { 44, 40 }, { 62, 40 }, { 72, 52 }, { 78, 54 }, { 78, 62 } }, close = true, w = 6 }, { p = "disc", x = 38, y = 64, r = 9 }, { p = "disc", x = 66, y = 64, r = 9 } },
	["computers"] = { { p = "bar", x = 50, y = 46, w = 52, h = 36, r = 3 }, { p = "bar", x = 50, y = 46, w = 40, h = 24, r = 2, fill = false, w2 = 3 }, { p = "bar", x = 50, y = 70, w = 20, h = 10 }, { p = "bar", x = 50, y = 78, w = 34, h = 6 } },
	["electronics"] = cat(cat(cat(cat({ { p = "bar", x = 50, y = 50, w = 36, h = 36, r = 3, fill = false, w2 = 6 }, { p = "disc", x = 50, y = 50, r = 5 } },
		(function() local t = {} for _, x in ipairs({ 38, 46, 54, 62 }) do t[#t + 1] = { p = "bar", x = x, y = 28, w = 4, h = 8 } end return t end)()),
		(function() local t = {} for _, x in ipairs({ 38, 46, 54, 62 }) do t[#t + 1] = { p = "bar", x = x, y = 72, w = 4, h = 8 } end return t end)()),
		(function() local t = {} for _, y in ipairs({ 38, 46, 54, 62 }) do t[#t + 1] = { p = "bar", x = 28, y = y, w = 8, h = 4 } end return t end)()),
		(function() local t = {} for _, y in ipairs({ 38, 46, 54, 62 }) do t[#t + 1] = { p = "bar", x = 72, y = y, w = 8, h = 4 } end return t end)()),
	["fusion-power"] = { { p = "disc", x = 32, y = 50, r = 8 }, { p = "disc", x = 68, y = 50, r = 8 }, { p = "disc", x = 50, y = 50, r = 11 }, { p = "arc", x = 50, y = 50, r = 26, a0 = 300, a1 = 600, w = 5 } },
	["future-tech"] = { { p = "arc", x = 50, y = 50, r = 20, a0 = 300, a1 = 590, w = 6 }, { p = "arc", x = 28, y = 52, r = 26, a0 = 250, a1 = 350, w = 4 }, { p = "arc", x = 72, y = 52, r = 26, a0 = 190, a1 = 290, w = 4 } },
	["genetic-engineering"] = cat({ { p = "poly", pts = { { 38, 26 }, { 62, 42 }, { 38, 58 }, { 62, 74 } }, w = 6 }, { p = "poly", pts = { { 62, 26 }, { 38, 42 }, { 62, 58 }, { 38, 74 } }, w = 6 } },
		(function() local t = {} for _, y in ipairs({ 34, 50, 66 }) do t[#t + 1] = { p = "poly", pts = { { 42, y }, { 58, y } }, w = 3 } end return t end)()),
	["labor-union"] = { { p = "bar", x = 34, y = 54, w = 8, h = 34 }, { p = "disc", x = 34, y = 34, r = 8 }, { p = "bar", x = 50, y = 50, w = 8, h = 38 }, { p = "disc", x = 50, y = 28, r = 8 }, { p = "bar", x = 66, y = 54, w = 8, h = 34 }, { p = "disc", x = 66, y = 34, r = 8 }, { p = "bar", x = 50, y = 72, w = 48, h = 7 } },
	["mass-production"] = cat({ { p = "bar", x = 50, y = 68, w = 60, h = 8 }, { p = "disc", x = 30, y = 50, r = 10 }, { p = "disc", x = 50, y = 50, r = 10 }, { p = "disc", x = 70, y = 50, r = 10 } },
		(function() local t = {} for _, x in ipairs({ 30, 50, 70 }) do t[#t + 1] = { p = "poly", pts = { { x, 60 }, { x, 64 } }, w = 3 } end return t end)()),
	["nuclear-fission"] = { { p = "disc", x = 34, y = 50, r = 13 }, { p = "disc", x = 66, y = 50, r = 13 }, { p = "dots", pts = { { 50, 24 }, { 24, 72 }, { 76, 72 } }, r = 4 } },
	["nuclear-power"] = { { p = "poly", pts = { { 32, 78 }, { 38, 48 }, { 62, 48 }, { 68, 78 } }, close = true, w = 6 }, { p = "arc", x = 43, y = 36, r = 6, a0 = 180, a1 = 360, w = 3 }, { p = "arc", x = 52, y = 30, r = 6, a0 = 180, a1 = 360, w = 3 }, { p = "arc", x = 61, y = 36, r = 6, a0 = 180, a1 = 360, w = 3 } },
	["plastics"] = { { p = "bar", x = 50, y = 62, w = 34, h = 44, r = 12 }, { p = "bar", x = 50, y = 38, w = 14, h = 16, r = 2 }, { p = "bar", x = 50, y = 28, w = 18, h = 8, r = 2 } },
	["recycling"] = cat(ringOf(3, 50, 50, 24, function(px, py, a) return { p = "poly", pts = { { px, py }, { 50 + cos(a + 2.0) * 24, 50 + sin(a + 2.0) * 24 } }, w = 7 } end),
		ringOf(3, 50, 50, 24, function(px, py, a) return { p = "poly", pts = { { 50 + cos(a + 1.7) * 30, 50 + sin(a + 1.7) * 30 }, { 50 + cos(a + 2.0) * 24, 50 + sin(a + 2.0) * 24 }, { 50 + cos(a + 2.0) * 16, 50 + sin(a + 2.0) * 16 } }, close = true, fill = true } end)),
	["robotics"] = { { p = "bar", x = 50, y = 52, w = 44, h = 40, r = 6 }, { p = "disc", x = 40, y = 48, r = 6 }, { p = "disc", x = 60, y = 48, r = 6 }, { p = "bar", x = 50, y = 66, w = 20, h = 6 }, { p = "poly", pts = { { 50, 32 }, { 50, 24 } }, w = 4 }, { p = "disc", x = 50, y = 22, r = 4 } },
	["rocketry"] = { { p = "poly", pts = { { 50, 22 }, { 60, 46 }, { 60, 70 }, { 40, 70 }, { 40, 46 } }, close = true, w = 6 }, { p = "poly", pts = { { 40, 62 }, { 28, 78 }, { 40, 74 } }, close = true, fill = true }, { p = "poly", pts = { { 60, 62 }, { 72, 78 }, { 60, 74 } }, close = true, fill = true }, { p = "disc", x = 50, y = 48, r = 6 } },
	["space-flight"] = { { p = "poly", pts = { { 44, 24 }, { 52, 40 }, { 52, 60 }, { 36, 60 }, { 36, 40 } }, close = true, w = 5 }, { p = "poly", pts = { { 36, 54 }, { 26, 68 }, { 36, 64 } }, close = true, fill = true }, { p = "ell", x = 56, y = 58, rx = 30, ry = 12, rot = -25, w = 5 } },
	["superconductor"] = { { p = "ring", x = 50, y = 50, r = 26, w = 6 }, { p = "disc", x = 50, y = 50, r = 9 }, { p = "poly", pts = { { 50, 24 }, { 44, 32 } }, w = 4 }, { p = "poly", pts = { { 50, 24 }, { 56, 32 } }, w = 4 }, { p = "poly", pts = { { 50, 76 }, { 44, 68 } }, w = 4 }, { p = "poly", pts = { { 50, 76 }, { 56, 68 } }, w = 4 } },
}

M.FLAGGED = {} -- all ally motif concepts landed (parity with browser FLAGGED = [])

return M
