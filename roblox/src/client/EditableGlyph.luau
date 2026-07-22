-- SO18 EditableImage tech-glyph RENDERER — draws the GlyphData.luau motif
-- primitives into an EditableImage (AssetService GA, no upload; the ruling-#2078
-- beta-flag blocker is lifted). Render-only, golden-neutral (no engine/state/RNG).
-- The browser client/ui/tech-glyphs.js drawPrim/drawGlyph twin, re-implemented
-- against EditableImage's DrawCircle/DrawLine/DrawRectangle vocabulary + a small
-- shim (thick strokes = brush-stamped discs for round caps/joins like the canvas
-- lineCap='round'; arcs/ellipses tessellated to polylines; filled polygons via a
-- scanline WritePixels rasterizer). Falls back to TechGlyphs.badge (the era frame)
-- if EditableImage is unavailable on a client — the graceful default from the spike.
--
-- STUDIO NOTE (SPEC.md §4): Luau/EditableImage execution is provable only in
-- Studio Play-Solo. This module is written against the documented GA API; the
-- first build-phase step is a one-motif confirmation render in Studio (see
-- roblox/acceptance/editableimage-glyph-spike.md). Gate 31 pins the HEADLESS
-- contract: GlyphData covers all 68 techs (browser parity) and every primitive
-- kind it uses is handled here.
local AssetService = game:GetService("AssetService")
local GlyphData = require(script.Parent:WaitForChild("GlyphData"))
local TechGlyphs = require(script.Parent:WaitForChild("TechGlyphs"))

local M = {}
local RES = 128 -- supersample resolution (glyphs shown ~24-48px; downscale = AA)
local SCALE = RES / 100 -- the motif box is 0..100

local function v2(x, y) return Vector2.new(x * SCALE, y * SCALE) end

-- ---- draw shim (all coords in the 0..100 motif space) ----------------------
-- thick round-capped segment: stamp discs from p0 to p1 (spacing ~ half the pen)
local function strokeSeg(img, x0, y0, x1, y1, w, color)
	local r = math.max(w, 1) * 0.5
	local dx, dy = x1 - x0, y1 - y0
	local len = math.sqrt(dx * dx + dy * dy)
	local steps = math.max(1, math.ceil(len / math.max(r, 0.5)))
	for i = 0, steps do
		local t = i / steps
		img:DrawCircle(v2(x0 + dx * t, y0 + dy * t), r * SCALE, color, 0)
	end
end

local function strokePolyline(img, pts, w, color, close)
	for i = 1, #pts - 1 do
		strokeSeg(img, pts[i][1], pts[i][2], pts[i + 1][1], pts[i + 1][2], w, color)
	end
	if close and #pts > 2 then
		strokeSeg(img, pts[#pts][1], pts[#pts][2], pts[1][1], pts[1][2], w, color)
	end
end

-- arc a0..a1 (degrees) as a tessellated polyline
local function arcPts(cx, cy, r, a0, a1)
	local pts = {}
	local segs = math.max(6, math.ceil(math.abs(a1 - a0) / 12))
	for i = 0, segs do
		local a = math.rad(a0 + (a1 - a0) * (i / segs))
		pts[#pts + 1] = { cx + math.cos(a) * r, cy + math.sin(a) * r }
	end
	return pts
end

local function ellPts(cx, cy, rx, ry, rotDeg)
	local pts = {}
	local ct, st = math.cos(math.rad(rotDeg or 0)), math.sin(math.rad(rotDeg or 0))
	for i = 0, 36 do
		local a = math.rad(i * 10)
		local ex, ey = math.cos(a) * rx, math.sin(a) * ry
		pts[#pts + 1] = { cx + ex * ct - ey * st, cy + ex * st + ey * ct }
	end
	return pts
end

-- even-odd scanline fill of a polygon (0..100 space) via per-row DrawRectangle spans
local function fillPoly(img, pts, color)
	local minY, maxY = math.huge, -math.huge
	for _, p in ipairs(pts) do minY = math.min(minY, p[2]); maxY = math.max(maxY, p[2]) end
	local y = math.floor(minY)
	while y <= math.ceil(maxY) do
		local yc = y + 0.5
		local xs = {}
		local n = #pts
		for i = 1, n do
			local a, b = pts[i], pts[(i % n) + 1]
			if (a[2] <= yc and b[2] > yc) or (b[2] <= yc and a[2] > yc) then
				xs[#xs + 1] = a[1] + (yc - a[2]) / (b[2] - a[2]) * (b[1] - a[1])
			end
		end
		table.sort(xs)
		for i = 1, #xs - 1, 2 do
			local x0, x1 = xs[i], xs[i + 1]
			if x1 > x0 then
				img:DrawRectangle(v2(x0, y), Vector2.new((x1 - x0) * SCALE, SCALE), color, 0)
			end
		end
		y += 1
	end
end

-- rounded-rect corner-tessellated outline points (centered at x,y, size w×h, radius r, rot deg)
local function barPts(x, y, w, h, r, rotDeg)
	local hw, hh = w / 2, h / 2
	r = math.min(r or 0, hw, hh)
	local corners = {
		{ hw - r, -hh, hw, -hh + r, 270, 360 },
		{ hw, hh - r, hw - r, hh, 0, 90 },
		{ -hw + r, hh, -hw, hh - r, 90, 180 },
		{ -hw, -hh + r, -hw + r, -hh, 180, 270 },
	}
	local pts = {}
	if r > 0 then
		for _, c in ipairs(corners) do
			local ccx = (c[1] >= 0) and (hw - r) or (-hw + r)
			local ccy = (c[2] >= 0) and (hh - r) or (-hh + r)
			for _, p in ipairs(arcPts(ccx, ccy, r, c[5], c[6])) do pts[#pts + 1] = p end
		end
	else
		pts = { { -hw, -hh }, { hw, -hh }, { hw, hh }, { -hw, hh } }
	end
	-- rotate + translate
	local ct, st = math.cos(math.rad(rotDeg or 0)), math.sin(math.rad(rotDeg or 0))
	local out = {}
	for _, p in ipairs(pts) do
		out[#out + 1] = { x + p[1] * ct - p[2] * st, y + p[1] * st + p[2] * ct }
	end
	return out
end

-- ---- primitive dispatch (the drawPrim twin) --------------------------------
local KINDS = { disc = true, ring = true, arc = true, ell = true, bar = true, poly = true, letter = true, dots = true }

local function drawPrim(img, pr, ink)
	local k = pr.p
	if k == "disc" then
		if pr.fill == false then
			strokePolyline(img, arcPts(pr.x, pr.y, pr.r, 0, 360), pr.w or 6, ink, true)
		else
			img:DrawCircle(v2(pr.x, pr.y), pr.r * SCALE, ink, 0)
		end
	elseif k == "ring" then
		strokePolyline(img, arcPts(pr.x, pr.y, pr.r, 0, 360), pr.w or 6, ink, true)
	elseif k == "arc" then
		strokePolyline(img, arcPts(pr.x, pr.y, pr.r, pr.a0, pr.a1), pr.w or 6, ink, false)
	elseif k == "ell" then
		if pr.fill then fillPoly(img, ellPts(pr.x, pr.y, pr.rx, pr.ry, pr.rot), ink)
		else strokePolyline(img, ellPts(pr.x, pr.y, pr.rx, pr.ry, pr.rot), pr.w or 6, ink, true) end
	elseif k == "bar" then
		local pts = barPts(pr.x, pr.y, pr.w, pr.h, pr.r, pr.rot)
		if pr.fill == false then strokePolyline(img, pts, pr.w2 or 4, ink, true)
		else fillPoly(img, pts, ink) end
	elseif k == "poly" then
		if pr.fill then fillPoly(img, pr.pts, ink)
		else strokePolyline(img, pr.pts, pr.w or 6, ink, pr.close) end
	elseif k == "dots" then
		for _, p in ipairs(pr.pts) do img:DrawCircle(v2(p[1], p[2]), (pr.r or 3) * SCALE, ink, 0) end
	elseif k == "letter" then
		-- EditableImage has no text; the caller overlays a TextLabel (see drawGlyph).
		-- Only 'alphabet' + the fallback use this; handled by the compositor.
	end
end

-- ---- compositor (the drawGlyph twin) ---------------------------------------
-- Returns an ImageLabel carrying the era-framed glyph, or (fallback) TechGlyphs.badge.
function M.render(parent, techs, id, px)
	local era = TechGlyphs.eraOf(techs, id)
	local pal = TechGlyphs.colorOf(era)
	local ok, img = pcall(function()
		return AssetService:CreateEditableImage({ Size = Vector2.new(RES, RES) })
	end)
	if not ok or img == nil then
		return TechGlyphs.badge(parent, era, px) -- graceful fallback: the era frame
	end
	-- frame: era-colored rounded badge (fill + edge), 7..93 box, r=20
	fillPoly(img, barPts(50, 50, 86, 86, 20, 0), pal.fill)
	strokePolyline(img, barPts(50, 50, 86, 86, 20, 0), 5, pal.edge, true)
	-- motif
	local motif = GlyphData.GLYPH[id]
	local letterCh, letterSize = nil, nil
	if motif ~= nil and #motif > 0 then
		for _, pr in ipairs(motif) do
			if pr.p == "letter" then letterCh, letterSize = pr.ch, pr.size else drawPrim(img, pr, pal.ink) end
		end
	else
		letterCh, letterSize = string.upper(string.sub(id, 1, 1)), 54
	end

	local label = Instance.new("ImageLabel")
	label.Name = "TechGlyph_" .. id
	label.Size = UDim2.fromOffset(px, px)
	label.BackgroundTransparency = 1
	pcall(function() label.ImageContent = Content.fromObject(img) end)
	-- letter overlay (EditableImage draws no text): a serif TextLabel matching the ink
	if letterCh ~= nil then
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(1, 1)
		t.BackgroundTransparency = 1
		t.Text = letterCh
		t.Font = Enum.Font.SourceSansBold
		t.TextScaled = true
		t.TextColor3 = pal.ink
		t.Parent = label
	end
	label.Parent = parent
	return label
end

M.PRIMITIVE_KINDS = KINDS -- gate 31: every kind GlyphData uses must be a key here
return M
