-- R7b (2): void cover (roblox/SPEC.md §3i) — the map no longer floats in
-- grey nothing, and avatars can't fall off the world.
--   PHYSICAL GUARD (always on): four invisible walls just outside the map
--   edge + an invisible catch floor below sea level.
--   ART (the soundboard pattern; V cycles frame -> galaxy -> none):
--     (i)  "frame"  — Dutch-Golden-Age ornate map border: parchment apron
--          around the map with darker trim rails and corner medallions.
--          USER PICK 2026-07-17 (runC): frame is FINAL as the boot default.
--     (ii) "galaxy" — art ROUND 2 (user direction: "much more interesting
--          galaxy backdrop"): three star DEPTH layers + a milky-way band,
--          layered nebulae, and the mode OWNS Lighting while active
--          (midnight + a Sky with sun/moon shrunk to zero — kills the
--          default skybox moon; engine-drawn sky stars are procedural).
--   Own/procedural art ONLY (license discipline — no imported textures).
--   Star placement is a position-hashed LCG, not math.random: screenshots
--   stay byte-comparable (the R2 rule).

local Lighting = game:GetService("Lighting")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local TILE = ClientState.TILE

local root = Instance.new("Folder")
root.Name = "VoidCover"
root.Parent = workspace

local guardFolder = Instance.new("Folder")
guardFolder.Name = "Guard"
local frameFolder = Instance.new("Folder")
frameFolder.Name = "VoidFrame"
local galaxyFolder = Instance.new("Folder")
galaxyFolder.Name = "VoidGalaxy"

local function part(parent, name, size, cframe, color, props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.Name = name
	p.Size = size
	p.CFrame = cframe
	p.Color = color
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in pairs(props or {}) do
		p[k] = v
	end
	p.Parent = parent
	return p
end

local built = false
local function build(view)
	if built then
		return
	end
	built = true
	local w, h = view.map.width * TILE, view.map.height * TILE
	local cx, cz = (view.map.width - 1) * TILE / 2, (view.map.height - 1) * TILE / 2
	local x0, x1 = -TILE / 2, w - TILE / 2
	local z0, z1 = -TILE / 2, h - TILE / 2

	-- ---- physical guard (invisible, always on) ------------------------------
	local WALL_H = 40
	local invisible = { Transparency = 1, CanQuery = false }
	part(guardFolder, "Floor", Vector3.new(w + 400, 2, h + 400),
		CFrame.new(cx, -8, cz), Color3.new(), invisible)
	for _, wall in ipairs({
		{ Vector3.new(w + 8, WALL_H, 2), CFrame.new(cx, WALL_H / 2 - 4, z0 - 1) },
		{ Vector3.new(w + 8, WALL_H, 2), CFrame.new(cx, WALL_H / 2 - 4, z1 + 1) },
		{ Vector3.new(2, WALL_H, h + 8), CFrame.new(x0 - 1, WALL_H / 2 - 4, cz) },
		{ Vector3.new(2, WALL_H, h + 8), CFrame.new(x1 + 1, WALL_H / 2 - 4, cz) },
	}) do
		part(guardFolder, "Wall", wall[1], wall[2], Color3.new(), invisible)
	end
	guardFolder.Parent = root

	-- ---- variant (i): ornate map-border frame -------------------------------
	local APRON = TILE * 8
	local PARCHMENT = Color3.fromRGB(212, 192, 150)
	local TRIM = Color3.fromRGB(94, 66, 40)
	local GOLD = Color3.fromRGB(176, 141, 66)
	local Y = -1.2 -- just under the ocean tops so coasts stay readable
	for _, ap in ipairs({
		{ Vector3.new(w + 2 * APRON, 1, APRON), CFrame.new(cx, Y, z0 - APRON / 2) },
		{ Vector3.new(w + 2 * APRON, 1, APRON), CFrame.new(cx, Y, z1 + APRON / 2) },
		{ Vector3.new(APRON, 1, h), CFrame.new(x0 - APRON / 2, Y, cz) },
		{ Vector3.new(APRON, 1, h), CFrame.new(x1 + APRON / 2, Y, cz) },
	}) do
		part(frameFolder, "Apron", ap[1], ap[2], PARCHMENT, { Material = Enum.Material.Fabric })
	end
	-- trim rails: an inner dark rail hugging the map and an outer gold rail
	for _, rail in ipairs({
		{ Vector3.new(w + 4, 0.6, 1.4), CFrame.new(cx, Y + 0.5, z0 - 0.7), TRIM },
		{ Vector3.new(w + 4, 0.6, 1.4), CFrame.new(cx, Y + 0.5, z1 + 0.7), TRIM },
		{ Vector3.new(1.4, 0.6, h + 4), CFrame.new(x0 - 0.7, Y + 0.5, cz), TRIM },
		{ Vector3.new(1.4, 0.6, h + 4), CFrame.new(x1 + 0.7, Y + 0.5, cz), TRIM },
		{ Vector3.new(w + 2 * APRON, 0.8, 2), CFrame.new(cx, Y + 0.6, z0 - APRON + 1), GOLD },
		{ Vector3.new(w + 2 * APRON, 0.8, 2), CFrame.new(cx, Y + 0.6, z1 + APRON - 1), GOLD },
		{ Vector3.new(2, 0.8, h + 2 * APRON), CFrame.new(x0 - APRON + 1, Y + 0.6, cz), GOLD },
		{ Vector3.new(2, 0.8, h + 2 * APRON), CFrame.new(x1 + APRON - 1, Y + 0.6, cz), GOLD },
	}) do
		part(frameFolder, "Rail", rail[1], rail[2], rail[3])
	end
	-- corner medallions (compass-rose stand-ins: stacked cylinders)
	for _, corner in ipairs({
		{ x0 - APRON / 2, z0 - APRON / 2 }, { x1 + APRON / 2, z0 - APRON / 2 },
		{ x0 - APRON / 2, z1 + APRON / 2 }, { x1 + APRON / 2, z1 + APRON / 2 },
	}) do
		for i, disc in ipairs({ { TILE * 3, TRIM }, { TILE * 2.2, GOLD }, { TILE * 1.4, PARCHMENT } }) do
			part(frameFolder, "Medallion", Vector3.new(0.4, disc[1], disc[1]),
				CFrame.new(corner[1], Y + 0.4 + i * 0.2, corner[2]) * CFrame.Angles(0, 0, math.rad(90)),
				disc[2], { Shape = Enum.PartType.Cylinder })
		end
	end

	-- ---- variant (ii): galaxy — art round 2 ---------------------------------
	part(galaxyFolder, "Deep", Vector3.new(w + 1400, 1, h + 1400),
		CFrame.new(cx, -80, cz), Color3.fromRGB(5, 5, 10))
	-- deterministic starfield (LCG, position-hashed — screenshot-stable)
	local s = 12345
	local function rnd()
		s = (s * 1103515245 + 12345) % 2147483648
		return s / 2147483648
	end
	local COOL = Color3.fromRGB(225, 235, 255)
	local WARM = Color3.fromRGB(255, 226, 180)
	local GIANT = Color3.fromRGB(170, 200, 255)
	local function star(sx, sy, sz, mag, color)
		part(galaxyFolder, "Star", Vector3.new(mag, mag, mag),
			CFrame.new(sx, sy, sz), color,
			{ Material = Enum.Material.Neon, CanQuery = false, CanCollide = false })
	end
	-- three depth layers: near/mid/far — parallax sells the depth
	for _, layer in ipairs({
		{ n = 220, y0 = -24, spread = 10, magMin = 0.35, magMax = 0.9 },
		{ n = 260, y0 = -42, spread = 14, magMin = 0.5, magMax = 1.3 },
		{ n = 220, y0 = -66, spread = 16, magMin = 0.8, magMax = 2.0 },
	}) do
		for _ = 1, layer.n do
			local sx = cx + (rnd() - 0.5) * (w + 1200)
			local sz = cz + (rnd() - 0.5) * (h + 1200)
			local sy = layer.y0 + rnd() * layer.spread
			local mag = layer.magMin + rnd() * (layer.magMax - layer.magMin)
			local roll = rnd()
			star(sx, sy, sz, mag, roll < 0.18 and WARM or (roll < 0.26 and GIANT or COOL))
		end
	end
	-- the milky-way band: a dense diagonal ribbon across the deep (two rnd
	-- draws summed = triangular falloff around the band's spine)
	for _ = 1, 360 do
		local t = rnd() * 2 - 1 -- position along the spine
		local off = (rnd() + rnd() - 1) * (w + h) * 0.09
		local sx = cx + t * (w + 1000) * 0.5 - off * 0.45
		local sz = cz + t * (h + 1000) * 0.35 + off
		local sy = -34 - rnd() * 26
		star(sx, sy, sz, 0.3 + rnd() * 0.8, rnd() < 0.3 and WARM or COOL)
	end
	-- layered nebulae: big dim far shells with brighter cores, colors spread
	-- along the band for a painted-depth read
	for _, neb in ipairs({
		{ 84, Color3.fromRGB(70, 40, 115), -0.42, -0.34, -58, 0.82 },
		{ 52, Color3.fromRGB(110, 60, 160), -0.40, -0.32, -50, 0.68 },
		{ 66, Color3.fromRGB(35, 70, 125), 0.48, 0.28, -54, 0.8 },
		{ 38, Color3.fromRGB(60, 110, 180), 0.46, 0.26, -46, 0.66 },
		{ 48, Color3.fromRGB(140, 55, 85), 0.08, -0.5, -52, 0.74 },
		{ 30, Color3.fromRGB(185, 90, 110), 0.10, -0.48, -44, 0.62 },
		{ 40, Color3.fromRGB(45, 120, 110), -0.15, 0.46, -48, 0.72 },
	}) do
		part(galaxyFolder, "Nebula", Vector3.new(neb[1], neb[1] / 3, neb[1]),
			CFrame.new(cx + neb[3] * w, neb[5], cz + neb[4] * h), neb[2],
			{ Shape = Enum.PartType.Ball, Transparency = neb[6], Material = Enum.Material.Neon,
				CanQuery = false, CanCollide = false })
	end

	frameFolder.Parent = root -- boot default: frame
	print("[VoidCover] R7b void cover up: guard walls on, art = frame (V cycles)")
end

ClientState.onView(build)

-- galaxy OWNS Lighting while active: midnight + a Sky whose sun/moon are
-- shrunk to zero (kills the default skybox moon — runC triage) while the
-- engine's own procedural sky stars stay (no imported textures). Restored
-- exactly on leaving the mode.
local galaxySky = Instance.new("Sky")
galaxySky.Name = "GalaxySky"
galaxySky.SunAngularSize = 0
galaxySky.MoonAngularSize = 0
galaxySky.StarCount = 5000
local savedClockTime = nil

local function applyLighting(galaxyOn)
	if galaxyOn then
		if savedClockTime == nil then
			savedClockTime = Lighting.ClockTime
		end
		Lighting.ClockTime = 0
		galaxySky.Parent = Lighting
	else
		galaxySky.Parent = nil
		if savedClockTime ~= nil then
			Lighting.ClockTime = savedClockTime
			savedClockTime = nil
		end
	end
end

-- R16: ClientState.options.voidArt is the ONE source (the Options panel's
-- "map border" row sets it); V stays as the dev shortcut writing the same
-- option. A light watcher applies changes from either surface.
local MODES = { "frame", "galaxy", "none" }
local applied = "frame" -- build() boots with the frame parented (user-final)

local function applyArt(mode)
	if mode == applied or not built then
		return
	end
	applied = mode
	frameFolder.Parent = mode == "frame" and root or nil
	galaxyFolder.Parent = mode == "galaxy" and root or nil
	applyLighting(mode == "galaxy")
	print("[VoidCover] art = " .. mode)
end

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil or not built then
		return
	end
	if input.KeyCode == Enum.KeyCode.V then
		local i = table.find(MODES, ClientState.options.voidArt) or 1
		ClientState.options.voidArt = MODES[i % #MODES + 1]
	end
end)

task.spawn(function()
	while true do
		if built then
			applyArt(ClientState.options.voidArt)
		end
		task.wait(0.25)
	end
end)
