-- R7b (2): void cover (roblox/SPEC.md §3i) — the map no longer floats in
-- grey nothing, and avatars can't fall off the world.
--   PHYSICAL GUARD (always on): four invisible walls just outside the map
--   edge + an invisible catch floor below sea level.
--   ART (the soundboard pattern — BOTH variants built cheap, the user picks
--   by screenshot; V cycles frame -> galaxy -> none):
--     (i)  "frame"  — Dutch-Golden-Age ornate map border: parchment apron
--          around the map with darker trim rails and corner medallions.
--     (ii) "galaxy" — earth-map-in-space: black deep floor + deterministic
--          starfield + a few translucent nebula spheres.
--   Own/procedural art ONLY (license discipline — no imported textures).
--   Star placement is a position-hashed LCG, not math.random: screenshots
--   stay byte-comparable (the R2 rule).

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

	-- ---- variant (ii): galaxy ----------------------------------------------
	part(galaxyFolder, "Deep", Vector3.new(w + 900, 1, h + 900),
		CFrame.new(cx, -30, cz), Color3.fromRGB(8, 8, 14))
	-- deterministic starfield (LCG, position-hashed — screenshot-stable)
	local s = 12345
	local function rnd()
		s = (s * 1103515245 + 12345) % 2147483648
		return s / 2147483648
	end
	for i = 1, 260 do
		local sx = cx + (rnd() - 0.5) * (w + 800)
		local sz = cz + (rnd() - 0.5) * (h + 800)
		local sy = -26 + rnd() * 14
		local mag = 0.3 + rnd() * 0.5
		local warm = rnd() < 0.2
		part(galaxyFolder, "Star", Vector3.new(mag, mag, mag),
			CFrame.new(sx, sy, sz),
			warm and Color3.fromRGB(255, 226, 180) or Color3.fromRGB(225, 235, 255),
			{ Material = Enum.Material.Neon, CanQuery = false, CanCollide = false })
	end
	for _, neb in ipairs({
		{ 60, Color3.fromRGB(90, 50, 130), -0.35, -0.3 }, -- dx/dz as map fractions
		{ 44, Color3.fromRGB(40, 80, 130), 0.45, 0.25 },
		{ 30, Color3.fromRGB(130, 60, 80), 0.1, -0.45 },
	}) do
		part(galaxyFolder, "Nebula", Vector3.new(neb[1], neb[1] / 3, neb[1]),
			CFrame.new(cx + neb[3] * w, -24, cz + neb[4] * h), neb[2],
			{ Shape = Enum.PartType.Ball, Transparency = 0.75, Material = Enum.Material.Neon,
				CanQuery = false, CanCollide = false })
	end

	frameFolder.Parent = root -- boot default: frame
	print("[VoidCover] R7b void cover up: guard walls on, art = frame (V cycles)")
end

ClientState.onView(build)

-- V cycles the art for the user's screenshot pick: frame -> galaxy -> none
local MODES = { "frame", "galaxy", "none" }
local mode = 1
UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil or not built then
		return
	end
	if input.KeyCode == Enum.KeyCode.V then
		mode = mode % #MODES + 1
		frameFolder.Parent = MODES[mode] == "frame" and root or nil
		galaxyFolder.Parent = MODES[mode] == "galaxy" and root or nil
		print("[VoidCover] art = " .. MODES[mode])
	end
end)
