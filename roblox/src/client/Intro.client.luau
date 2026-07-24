-- runL: the "One City Through Time" boot intro (specs/roblox-intro-animation.md,
-- architect-ruled). A ~25s staged, fully-procedural scene — existing part
-- recipes only, NO engine (no rng/state) → golden-neutral, deterministic by
-- being scripted. Played once before the lobby, ALWAYS skippable. Beats: empty
-- world → founding + title → era arc (marching units + a wonder + one battle
-- beat) → rocket launch white-out → fade to the deck. Lightweight (one city,
-- a handful of units, one rocket) per the slow-device rule. FIRST PASS — the
-- spec wants a Studio screencap per beat for acceptance; tune the camera CFrames
-- + beat feel there.

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local AssetFactory = require(script.Parent:WaitForChild("AssetFactory"))

-- ---- config -----------------------------------------------------------------
-- TITLE is behind ONE constant (naming pending the trademark search); "" = no
-- text, just the founding beat. Swap to "A World Begun" later = one string.
local INTRO_TITLE = "RETROMULTICIV"
-- beat seconds (ally timing ruling: founding 5, launch white-out 4) — total 25
local BEAT_EMPTY, BEAT_FOUND, BEAT_ARC, BEAT_LAUNCH, BEAT_FADE = 4, 5, 10, 4, 2

local player = Players.LocalPlayer

-- returning-player auto-skip (session attribute; a DataStore seen-flag is the
-- publish-time upgrade). First-time default = play.
if player:GetAttribute("seenIntro") then
	return
end
player:SetAttribute("seenIntro", true)

local camera = workspace.CurrentCamera

-- ---- the scene: its own little world, far from the deck (y~141) --------------
local ORIGIN = Vector3.new(3000, 40, 3000)
local scene = Instance.new("Folder")
scene.Name = "IntroScene"
scene.Parent = workspace

local function part(size, pos, color, mat, shape)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CastShadow = false
	p.Size = size
	p.Position = ORIGIN + pos
	p.Color = color
	p.Material = mat or Enum.Material.SmoothPlastic
	if shape ~= nil then
		p.Shape = shape
	end
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = scene
	return p
end

-- terrain diorama: grass plate + a coast strip + a few trees + a resource glint
part(Vector3.new(64, 2, 64), Vector3.new(0, -1, 0), Color3.fromRGB(76, 154, 63), Enum.Material.Grass)
part(Vector3.new(64, 2, 16), Vector3.new(0, -0.85, 28), Color3.fromRGB(34, 90, 134), Enum.Material.Glass)
for i = 1, 7 do
	local a = i * 0.9
	local trunk = part(Vector3.new(0.8, 2, 0.8), Vector3.new(math.cos(a) * 22, 1, math.sin(a) * 14 - 6), Color3.fromRGB(90, 62, 40))
	local top = Instance.new("Part")
	top.Anchored = true
	top.CanCollide = false
	top.CanQuery = false
	top.CastShadow = false
	top.Shape = Enum.PartType.Cylinder -- a squat cone stand-in via a tapered cyl look
	top.Size = Vector3.new(3.2, 3.2, 3.2)
	top.Color = Color3.fromRGB(45, 106, 53)
	top.Material = Enum.Material.Grass
	top.CFrame = trunk.CFrame * CFrame.new(0, 2, 0)
	top.Parent = scene
end
local glint = part(Vector3.new(1.4, 1.4, 1.4), Vector3.new(-18, 1.4, 10), Color3.fromRGB(240, 210, 90), Enum.Material.Neon)

-- the city cluster (grows + recolors through the four era bands). BAND colors
-- mirror ViewRenderer's BAND_STYLE.
local BANDS = {
	Color3.fromRGB(198, 178, 146), -- ancient (mud)
	Color3.fromRGB(188, 186, 178), -- classical/medieval (stone)
	Color3.fromRGB(168, 104, 86),  -- industrial (brick)
	Color3.fromRGB(160, 178, 202), -- modern/space (concrete)
}
local houses = {}
local function buildCity(band)
	for _, h in ipairs(houses) do
		h:Destroy()
	end
	houses = {}
	local n = 3 + band * 2 -- grows with the era
	for i = 1, n do
		local a = i * 2.3
		local r = 1.5 + (i % 3)
		local h = part(Vector3.new(1.8, 2 + band * 0.8, 1.8),
			Vector3.new(math.cos(a) * r, 1 + band * 0.4, math.sin(a) * r), BANDS[band], Enum.Material.Slate)
		table.insert(houses, h)
	end
end

-- a wonder rising beside the city (a simple columned block)
local wonder = part(Vector3.new(5, 1, 5), Vector3.new(12, 0.5, -4), Color3.fromRGB(224, 214, 180), Enum.Material.Marble)
wonder.Transparency = 1

-- the rocket (cylinder body + neon nose), hidden until the launch beat
local rocket = Instance.new("Part")
rocket.Anchored = true
rocket.CanCollide = false
rocket.CanQuery = false
rocket.CastShadow = false
rocket.Shape = Enum.PartType.Cylinder
rocket.Size = Vector3.new(9, 1.6, 1.6)
rocket.Color = Color3.fromRGB(228, 228, 235)
rocket.CFrame = CFrame.new(ORIGIN + Vector3.new(0, 4, 0)) * CFrame.Angles(0, 0, math.rad(90))
rocket.Transparency = 1
rocket.Parent = scene

-- ---- the white-out + title + skip overlay -----------------------------------
local gui = Instance.new("ScreenGui")
gui.Name = "RMCIntro"
gui.ResetOnSpawn = false
gui.DisplayOrder = 100
gui.IgnoreGuiInset = true
gui.Parent = player:WaitForChild("PlayerGui")

local whiteout = Instance.new("Frame")
whiteout.Size = UDim2.new(1, 0, 1, 0)
whiteout.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
whiteout.BackgroundTransparency = 1
whiteout.ZIndex = 100
whiteout.Parent = gui

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, 0, 0, 96)
title.Position = UDim2.new(0, 0, 0.62, 0)
title.BackgroundTransparency = 1
title.Font = Enum.Font.GothamBlack
title.TextColor3 = Color3.fromRGB(245, 232, 190)
title.TextStrokeTransparency = 0.5
title.TextSize = 60
title.TextTransparency = 1
title.Text = INTRO_TITLE
title.ZIndex = 101
title.Parent = gui

local skipping = false
local skipBtn = Instance.new("TextButton")
skipBtn.Size = UDim2.new(0, 96, 0, 34)
skipBtn.AnchorPoint = Vector2.new(1, 1)
skipBtn.Position = UDim2.new(1, -24, 1, -24) -- lower-right (user-specified)
skipBtn.BackgroundColor3 = Color3.fromRGB(20, 24, 34)
skipBtn.BackgroundTransparency = 0.25
skipBtn.TextColor3 = Color3.fromRGB(230, 230, 230)
skipBtn.Font = Enum.Font.GothamBold
skipBtn.TextSize = 18
skipBtn.Text = "Skip \u{25B8}"
skipBtn.ZIndex = 101
skipBtn.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = skipBtn
end

-- ---- helpers ----------------------------------------------------------------
local function look(from, at, dur)
	local tw = TweenService:Create(camera, TweenInfo.new(dur, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut),
		{ CFrame = CFrame.lookAt(ORIGIN + from, ORIGIN + at) })
	tw:Play()
	return tw
end
local function fade(inst, prop, to, dur)
	TweenService:Create(inst, TweenInfo.new(dur, Enum.EasingStyle.Quad), { [prop] = to }):Play()
end
-- an interruptible wait: returns early if a skip fires
local function beat(seconds)
	local t = 0
	while t < seconds and not skipping do
		t += task.wait()
	end
end

local function marchUnit(unitType, fromDx, toDx, dz, dur)
	local model = Instance.new("Model")
	model.Parent = scene
	local ok = pcall(AssetFactory.buildUnit, model, unitType,
		{ primary = Color3.fromRGB(70, 120, 190), secondary = Color3.fromRGB(180, 205, 235) },
		CFrame.new(ORIGIN + Vector3.new(fromDx, 1, dz)))
	if not ok then
		model:Destroy()
		return
	end
	task.spawn(function()
		local steps = math.max(1, math.floor(dur / 0.1))
		for s = 1, steps do
			if skipping then
				break
			end
			local x = fromDx + (toDx - fromDx) * (s / steps)
			pcall(function()
				model:PivotTo(CFrame.new(ORIGIN + Vector3.new(x, 1, dz)))
			end)
			task.wait(0.1)
		end
		model:Destroy()
	end)
end

-- ---- the cleanup / fade to the deck -----------------------------------------
local finished = false
local function finish()
	if finished then
		return
	end
	finished = true
	-- ensure a white cover, then swap to the deck under it and fade the white out
	fade(whiteout, "BackgroundTransparency", 0, skipping and 0.25 or 0.4)
	task.delay(skipping and 0.3 or 0.5, function()
		scene:Destroy()
		ClientState.introActive = false -- the deck camera (Camera.client) resumes
		task.wait(0.15)
		fade(whiteout, "BackgroundTransparency", 1, BEAT_FADE * 0.6)
		fade(title, "TextTransparency", 1, 0.3)
		task.delay(BEAT_FADE, function()
			gui:Destroy()
		end)
	end)
end

skipBtn.Activated:Connect(function()
	skipping = true
	finish()
end)

-- ---- the choreography -------------------------------------------------------
ClientState.introActive = true
buildCity(1) -- ancient, but hidden until the founding beat
for _, h in ipairs(houses) do
	h.Transparency = 1
end

task.spawn(function()
	-- beat 1: the empty world — a slow drift over the terrain, no city yet, no UI
	camera.CameraType = Enum.CameraType.Scriptable
	camera.CFrame = CFrame.lookAt(ORIGIN + Vector3.new(-34, 22, 34), ORIGIN)
	look(Vector3.new(-20, 18, 40), Vector3.new(0, 1, 0), BEAT_EMPTY)
	beat(BEAT_EMPTY)
	if skipping then return end

	-- beat 2: the founding — the city fades up (ancient), the title rises in
	look(Vector3.new(0, 14, 26), Vector3.new(0, 2, 0), BEAT_FOUND)
	for _, h in ipairs(houses) do
		fade(h, "Transparency", 0, 0.8)
	end
	local puff = part(Vector3.new(1, 1, 1), Vector3.new(0, 1, 0), Color3.fromRGB(240, 235, 210), Enum.Material.Neon, Enum.PartType.Ball)
	fade(puff, "Size", Vector3.new(10, 10, 10), 0.6)
	fade(puff, "Transparency", 1, 0.7)
	if INTRO_TITLE ~= "" then
		fade(title, "TextTransparency", 0, 1.2)
	end
	beat(BEAT_FOUND)
	if skipping then return end

	-- beat 3: the arc — one slow orbit while the city advances the four eras,
	-- units march past, a wonder rises, and one battle beat mid-arc
	fade(title, "TextTransparency", 1, 0.8)
	fade(wonder, "Transparency", 0, 1.5)
	TweenService:Create(wonder, TweenInfo.new(BEAT_ARC * 0.5, Enum.EasingStyle.Quad),
		{ Size = Vector3.new(5, 16, 5), Position = ORIGIN + Vector3.new(12, 8, -4) }):Play()
	local eraUnits = { "militia", "legion", "knights", "musketeers", "riflemen", "armor" }
	task.spawn(function()
		for band = 1, 4 do
			if skipping then break end
			buildCity(band)
			marchUnit(eraUnits[band], -26, 26, 8, BEAT_ARC / 4)
			if band == 2 then -- one battle beat: a second group clashes, a color flips
				marchUnit(eraUnits[5], 26, 4, 8, BEAT_ARC / 5)
			end
			beat(BEAT_ARC / 4)
		end
	end)
	-- the orbit
	local segs = 6
	for s = 1, segs do
		if skipping then break end
		local a0 = math.rad(20 + (s - 1) / segs * 300)
		look(Vector3.new(math.cos(a0) * 26, 15, math.sin(a0) * 26), Vector3.new(0, 3, 0), BEAT_ARC / segs)
		beat(BEAT_ARC / segs)
	end
	if skipping then return end

	-- beat 4: the launch — the rocket ignites, lifts off, the frame whites out
	rocket.Transparency = 0
	look(Vector3.new(6, 10, 22), Vector3.new(0, 12, 0), BEAT_LAUNCH * 0.4)
	local flame = part(Vector3.new(2, 2, 2), Vector3.new(0, 1, 0), Color3.fromRGB(255, 180, 80), Enum.Material.Neon, Enum.PartType.Ball)
	TweenService:Create(rocket, TweenInfo.new(BEAT_LAUNCH, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
		{ CFrame = CFrame.new(ORIGIN + Vector3.new(0, 120, 0)) * CFrame.Angles(0, 0, math.rad(90)) }):Play()
	TweenService:Create(flame, TweenInfo.new(BEAT_LAUNCH, Enum.EasingStyle.Quad),
		{ Position = ORIGIN + Vector3.new(0, 60, 0), Transparency = 1 }):Play()
	fade(whiteout, "BackgroundTransparency", 0, BEAT_LAUNCH) -- brighten to white
	beat(BEAT_LAUNCH)

	-- beat 5: white → the deck
	finish()
end)

print("[Intro] One City Through Time boot intro up (Skip lower-right)")
