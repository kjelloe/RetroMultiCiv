-- runL/runM: the "One City Through Time" boot intro (specs/roblox-intro-animation.md,
-- architect-ruled; user refinements runM round 2). A ~25s staged, fully-procedural
-- scene — existing part idioms only, NO engine (no rng/state) → golden-neutral,
-- deterministic by being scripted. Beats: fade-in-from-black over the empty world
-- → founding + title → era arc (era BUILDINGS advance beside the silo while two
-- unit groups SKIRMISH through the ages) → the skirmishers flee, the rocket
-- launches, white-out → fade to the deck. ALWAYS skippable (large SKIP,
-- lower-right). The regular UI is hidden throughout and restored at the reveal.

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local AssetFactory = require(script.Parent:WaitForChild("AssetFactory"))

-- ---- config -----------------------------------------------------------------
-- Both constants one-line swappable (#2541 user ruling; trademark gate stands).
local INTRO_TITLE = "A World Begun"
local INTRO_SUBTITLE = "Start with one city. Build a civilization that lasts."
-- beat seconds (ally timing: founding 5, launch 4) — total 25
local BEAT_EMPTY, BEAT_FOUND, BEAT_ARC, BEAT_LAUNCH, BEAT_FADE = 4, 5, 10, 4, 2

local player = Players.LocalPlayer

-- returning-player auto-skip (session attribute; DataStore seen-flag is the
-- publish-time upgrade). First-time default = play.
if player:GetAttribute("seenIntro") then
	return
end
player:SetAttribute("seenIntro", true)

-- ---- BLACK COVER FIRST (runM refinement 1) -----------------------------------
-- The cover goes up the very first frame this script runs, so the camera hop
-- from the spawn to the far scene is never seen; beat 1 FADES IN from black.
-- The same frame later turns WHITE for the launch white-out.
local gui = Instance.new("ScreenGui")
gui.Name = "RMCIntro"
gui.ResetOnSpawn = false
gui.DisplayOrder = 100
gui.IgnoreGuiInset = true
gui.Parent = player:WaitForChild("PlayerGui")

local cover = Instance.new("Frame")
cover.Size = UDim2.new(1, 0, 1, 0)
cover.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
cover.BackgroundTransparency = 0
cover.BorderSizePixel = 0
cover.ZIndex = 100
cover.Parent = gui

-- runM: HIDE the whole regular UI while the intro plays — every OTHER ScreenGui,
-- including ones that boot DURING the intro (client scripts load in parallel);
-- restored at the deck reveal. Deliberately does NOT touch CoreGui.
local playerGui = player:WaitForChild("PlayerGui")
local hiddenGuis = {}
local function hideGui(g)
	if g ~= gui and g:IsA("ScreenGui") and g.Enabled then
		g.Enabled = false
		table.insert(hiddenGuis, g)
	end
end
for _, g in ipairs(playerGui:GetChildren()) do
	hideGui(g)
end
local hideWatch = playerGui.ChildAdded:Connect(function(g)
	task.defer(hideGui, g)
end)
local function restoreUi()
	hideWatch:Disconnect()
	for _, g in ipairs(hiddenGuis) do
		if g.Parent ~= nil then
			g.Enabled = true
		end
	end
end

-- ---- the camera DRIVER (runM round 3) -----------------------------------------
-- The character can spawn LATE and REPLACE workspace.CurrentCamera — a claim or
-- tween bound to the old instance dies, and the fresh camera pans to the avatar
-- on the deck (the runM screenshot: deck pads visible through the fade). So the
-- intro drives the camera PER FRAME: re-grab CurrentCamera every RenderStepped,
-- hold Scriptable, and lerp our own choreographed CFrame (easeInOutSine).
local RunService = game:GetService("RunService")
local ORIGIN = Vector3.new(3000, 40, 3000)
ClientState.introActive = true -- Camera.client skips its own CFrame while set
local camFrom = CFrame.lookAt(ORIGIN + Vector3.new(-34, 22, 34), ORIGIN)
local camTo = camFrom
local camT, camDur = 1, 1
local function easedCF()
	local a = math.min(camT, 1)
	a = -(math.cos(math.pi * a) - 1) / 2
	return camFrom:Lerp(camTo, a)
end
local camConn = RunService.RenderStepped:Connect(function(dt)
	local cam = workspace.CurrentCamera
	if cam == nil then
		return
	end
	cam.CameraType = Enum.CameraType.Scriptable
	camT += dt / camDur
	cam.CFrame = easedCF()
end)

-- ---- the scene ----------------------------------------------------------------
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

-- terrain diorama: grass plate + coast + trees + a resource glint
part(Vector3.new(64, 2, 64), Vector3.new(0, -1, 0), Color3.fromRGB(76, 154, 63), Enum.Material.Grass)
part(Vector3.new(64, 2, 16), Vector3.new(0, -0.85, 28), Color3.fromRGB(34, 90, 134), Enum.Material.Glass)
for i = 1, 7 do
	local a = i * 0.9
	local trunk = part(Vector3.new(0.8, 2, 0.8), Vector3.new(math.cos(a) * 24, 1, math.sin(a) * 15 - 8), Color3.fromRGB(90, 62, 40))
	local top = part(Vector3.new(3.2, 3.2, 3.2), Vector3.new(0, 0, 0), Color3.fromRGB(45, 106, 53), Enum.Material.Grass, Enum.PartType.Ball)
	top.CFrame = trunk.CFrame * CFrame.new(0, 2.4, 0)
end
part(Vector3.new(1.4, 1.4, 1.4), Vector3.new(-20, 1.4, 12), Color3.fromRGB(240, 210, 90), Enum.Material.Neon)

-- the SILO (runM refinement 2): a launch pad + the standing rocket, visible from
-- the start so the era buildings grow BESIDE it
part(Vector3.new(7, 1, 7), Vector3.new(9, 0.5, -3), Color3.fromRGB(96, 98, 104), Enum.Material.Concrete)
local rocket = part(Vector3.new(1.8, 8, 1.8), Vector3.new(9, 5, -3), Color3.fromRGB(228, 228, 235), Enum.Material.Metal, Enum.PartType.Cylinder)
rocket.CFrame = CFrame.new(ORIGIN + Vector3.new(9, 5, -3)) * CFrame.Angles(0, 0, math.rad(90))
rocket.Size = Vector3.new(8, 1.8, 1.8)
local nose = part(Vector3.new(1.2, 1.2, 1.2), Vector3.new(9, 9.6, -3), Color3.fromRGB(200, 80, 60), Enum.Material.SmoothPlastic, Enum.PartType.Ball)

-- the CITY beside the silo (runM refinement 2): actual-game-style era houses —
-- wall + roof + the band's signature prop, colors/materials mirroring
-- ViewRenderer's BAND_STYLE (mud/thatch → stone/tile → brick/tar → concrete/glass).
local BAND = {
	{ wall = Color3.fromRGB(198, 178, 146), wallMat = Enum.Material.Ground,
	  roof = Color3.fromRGB(158, 120, 72), roofMat = Enum.Material.Grass, prop = "" },
	{ wall = Color3.fromRGB(188, 186, 178), wallMat = Enum.Material.Slate,
	  roof = Color3.fromRGB(168, 86, 64), roofMat = Enum.Material.Slate, prop = "keep" },
	{ wall = Color3.fromRGB(168, 104, 86), wallMat = Enum.Material.Brick,
	  roof = Color3.fromRGB(60, 58, 56), roofMat = Enum.Material.Slate, prop = "smokestack" },
	{ wall = Color3.fromRGB(160, 178, 202), wallMat = Enum.Material.Concrete,
	  roof = Color3.fromRGB(150, 190, 220), roofMat = Enum.Material.Glass, prop = "spire" },
}
local cityParts = {}
local function buildCity(band)
	for _, p in ipairs(cityParts) do
		p:Destroy()
	end
	cityParts = {}
	local st = BAND[band]
	local n = 3 + band -- the town grows with the era
	for i = 1, n do
		local a = i * 2.4
		local r = 2 + (i % 3) * 1.4
		local h = 1.6 + band * 0.7
		local x, z = -6 + math.cos(a) * r, -2 + math.sin(a) * r
		local wall = part(Vector3.new(2, h, 2), Vector3.new(x, h / 2, z), st.wall, st.wallMat)
		table.insert(cityParts, wall)
		local roof
		if band <= 2 then -- peaked: a 45°-rotated slab reads as a roofline
			roof = part(Vector3.new(1.9, 1.9, 2.1), Vector3.new(x, h + 0.55, z), st.roof, st.roofMat)
			roof.CFrame = CFrame.new(ORIGIN + Vector3.new(x, h + 0.55, z)) * CFrame.Angles(0, 0, math.rad(45))
		else -- flat slab (industrial tar / modern glass)
			roof = part(Vector3.new(2.2, 0.3, 2.2), Vector3.new(x, h + 0.15, z), st.roof, st.roofMat)
		end
		table.insert(cityParts, roof)
	end
	if st.prop == "keep" then
		table.insert(cityParts, part(Vector3.new(1.6, 5, 1.6), Vector3.new(-6, 2.5, -2), Color3.fromRGB(170, 168, 160), Enum.Material.Slate))
	elseif st.prop == "smokestack" then
		table.insert(cityParts, part(Vector3.new(0.8, 6, 0.8), Vector3.new(-6, 3, -2), Color3.fromRGB(70, 62, 58), Enum.Material.Brick, Enum.PartType.Cylinder))
	elseif st.prop == "spire" then
		local s = part(Vector3.new(0.6, 7, 0.6), Vector3.new(-6, 3.5, -2), Color3.fromRGB(210, 225, 240), Enum.Material.Metal, Enum.PartType.Cylinder)
		table.insert(cityParts, s)
		table.insert(cityParts, part(Vector3.new(0.5, 0.5, 0.5), Vector3.new(-6, 7.2, -2), Color3.fromRGB(120, 220, 255), Enum.Material.Neon, Enum.PartType.Ball))
	end
end

-- a wonder rising at the city's far edge
local wonder = part(Vector3.new(4, 1, 4), Vector3.new(-14, 0.5, -8), Color3.fromRGB(224, 214, 180), Enum.Material.Marble)
wonder.Transparency = 1

-- ---- the SKIRMISH (runM refinement 3) -----------------------------------------
-- Two small groups face off in front of the city and LUNGE at each other; each
-- era band swaps them for that era's units; before the launch they FLEE.
local ERA_MATCHUP = {
	{ "militia", "phalanx" },
	{ "legion", "knights" },
	{ "musketeers", "riflemen" },
	{ "riflemen", "armor" },
}
local BLUE = { primary = Color3.fromRGB(70, 120, 190), secondary = Color3.fromRGB(180, 205, 235) }
local RED = { primary = Color3.fromRGB(190, 70, 60), secondary = Color3.fromRGB(235, 190, 180) }
local fighters = {} -- { model, homeCF, dir } — dir = lunge direction (+x/-x)
local skirmishGen = 0

local function clearFighters()
	skirmishGen += 1
	for _, f in ipairs(fighters) do
		f.model:Destroy()
	end
	fighters = {}
end

local function spawnFighter(unitType, colors, x, z, dir)
	local model = Instance.new("Model")
	model.Parent = scene
	local home = CFrame.new(ORIGIN + Vector3.new(x, 1, z)) * CFrame.Angles(0, dir > 0 and math.rad(-90) or math.rad(90), 0)
	local ok = pcall(AssetFactory.buildUnit, model, unitType, colors, home)
	if not ok then
		model:Destroy()
		return
	end
	table.insert(fighters, { model = model, homeCF = home, dir = dir })
end

local function startSkirmish(band)
	clearFighters()
	local gen = skirmishGen
	local pair = ERA_MATCHUP[band]
	spawnFighter(pair[1], BLUE, -4.5, 12, 1)
	spawnFighter(pair[1], BLUE, -6, 14.5, 1)
	spawnFighter(pair[2], RED, 4.5, 12, -1)
	spawnFighter(pair[2], RED, 6, 14.5, -1)
	-- the lunge loop: each fighter darts toward the enemy line and back
	task.spawn(function()
		local phase = 0
		while gen == skirmishGen do
			phase += 1
			for i, f in ipairs(fighters) do
				if f.model.Parent ~= nil then
					local lunging = (phase + i) % 2 == 0
					local dx = lunging and f.dir * 2.2 or 0
					pcall(function()
						f.model:PivotTo(f.homeCF * CFrame.new(0, 0, -math.abs(dx)) )
					end)
				end
			end
			task.wait(0.35)
			for _, f in ipairs(fighters) do
				if f.model.Parent ~= nil then
					pcall(function()
						f.model:PivotTo(f.homeCF)
					end)
				end
			end
			task.wait(0.35)
		end
	end)
end

local function fleeFighters()
	skirmishGen += 1 -- stops the lunge loop; the models remain for the flight
	for _, f in ipairs(fighters) do
		if f.model.Parent ~= nil then
			task.spawn(function()
				for s = 1, 12 do
					pcall(function()
						-- run AWAY from the pad: back the way each side came
						f.model:PivotTo(f.homeCF * CFrame.new(0, 0, s * 1.6))
					end)
					task.wait(0.08)
				end
				f.model:Destroy()
			end)
		end
	end
	fighters = {}
end

-- ---- title / subtitle / SKIP (runM refinement 4: +50% fonts) -------------------
local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, 0, 0, 190)
title.Position = UDim2.new(0, 0, 0.58, -135) -- runM r3: up one line height
title.BackgroundTransparency = 1
title.Font = Enum.Font.GothamBlack
title.TextColor3 = Color3.fromRGB(245, 232, 190)
title.TextStrokeTransparency = 0.5
title.TextSize = 135 -- runM r3: +50% again (60 -> 90 -> 135)
title.TextTransparency = 1
title.Text = INTRO_TITLE
title.ZIndex = 101
title.Parent = gui

local subtitle = Instance.new("TextLabel")
subtitle.Size = UDim2.new(1, 0, 0, 50)
subtitle.Position = UDim2.new(0, 0, 0.58, 62) -- sits under the raised title block
subtitle.BackgroundTransparency = 1
subtitle.Font = Enum.Font.Gotham
subtitle.TextColor3 = Color3.fromRGB(215, 222, 235)
subtitle.TextStrokeTransparency = 0.6
subtitle.TextSize = 39 -- was 26 (+50%)
subtitle.TextTransparency = 1
subtitle.Text = INTRO_SUBTITLE
subtitle.ZIndex = 101
subtitle.Parent = gui

local skipping = false
local skipBtn = Instance.new("TextButton")
skipBtn.Size = UDim2.new(0, 220, 0, 72) -- LARGE (the only UI during the intro)
skipBtn.AnchorPoint = Vector2.new(1, 1)
skipBtn.Position = UDim2.new(1, -28, 1, -28) -- lower-right (user-specified)
skipBtn.BackgroundColor3 = Color3.fromRGB(20, 24, 34)
skipBtn.BackgroundTransparency = 0.2
skipBtn.TextColor3 = Color3.fromRGB(235, 235, 235)
skipBtn.Font = Enum.Font.GothamBold
skipBtn.TextSize = 34
skipBtn.Text = "SKIP \u{25B8}"
skipBtn.ZIndex = 102
skipBtn.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 10)
	c.Parent = skipBtn
end

-- ---- helpers -------------------------------------------------------------------
local function look(from, at, dur)
	-- feed the per-frame driver (never a tween on a camera instance — it can be
	-- replaced mid-flight by a late character spawn)
	camFrom = easedCF()
	camTo = CFrame.lookAt(ORIGIN + from, ORIGIN + at)
	camT, camDur = 0, math.max(dur, 0.01)
end
local function fade(inst, prop, to, dur)
	TweenService:Create(inst, TweenInfo.new(dur, Enum.EasingStyle.Quad), { [prop] = to }):Play()
end
local function beat(seconds) -- interruptible wait
	local t = 0
	while t < seconds and not skipping do
		t += task.wait()
	end
end

-- ---- finish: ALWAYS restores UI + camera ---------------------------------------
local finished = false
local function finish()
	if finished then
		return
	end
	finished = true
	clearFighters()
	-- cover the swap (white if the launch got there, black on an early skip)
	fade(cover, "BackgroundTransparency", 0, skipping and 0.25 or 0.4)
	task.delay(skipping and 0.3 or 0.5, function()
		scene:Destroy()
		camConn:Disconnect() -- stop the intro camera driver...
		ClientState.introActive = false -- ...and the deck camera (Camera.client) resumes
		restoreUi() -- runM: the regular UI returns exactly at the deck reveal
		task.wait(0.15)
		fade(cover, "BackgroundTransparency", 1, BEAT_FADE * 0.6)
		fade(title, "TextTransparency", 1, 0.3)
		fade(subtitle, "TextTransparency", 1, 0.3)
		task.delay(BEAT_FADE, function()
			gui:Destroy()
		end)
	end)
end

skipBtn.Activated:Connect(function()
	skipping = true
	finish()
end)

-- ---- choreography ---------------------------------------------------------------
buildCity(1)
for _, p in ipairs(cityParts) do
	p.Transparency = 1 -- hidden until the founding beat
end

task.spawn(function()
	-- pcall-guarded: with the UI hidden, ANY beat error must still reach finish()
	local ok, err = pcall(function()
	-- beat 1: fade IN FROM BLACK over the empty world, slow drift (no city yet)
	fade(cover, "BackgroundTransparency", 1, 1.4)
	look(Vector3.new(-20, 18, 40), Vector3.new(0, 1, 0), BEAT_EMPTY)
	beat(BEAT_EMPTY)
	if skipping then return end

	-- beat 2: the founding — the ancient town fades up beside the silo, the
	-- title + sub-heading rise in
	look(Vector3.new(-2, 14, 26), Vector3.new(0, 2, 0), BEAT_FOUND)
	for _, p in ipairs(cityParts) do
		fade(p, "Transparency", 0, 0.8)
	end
	local puff = part(Vector3.new(1, 1, 1), Vector3.new(-6, 1, -2), Color3.fromRGB(240, 235, 210), Enum.Material.Neon, Enum.PartType.Ball)
	fade(puff, "Size", Vector3.new(10, 10, 10), 0.6)
	fade(puff, "Transparency", 1, 0.7)
	if INTRO_TITLE ~= "" then
		fade(title, "TextTransparency", 0, 1.2)
		fade(subtitle, "TextTransparency", 0, 1.5)
	end
	beat(BEAT_FOUND)
	if skipping then return end

	-- beat 3: the arc — one slow orbit while the town advances the four eras
	-- beside the silo, the era skirmish escalates, a wonder rises. runN r2
	-- (user): the title + sub-heading HOLD 5s INTO the arc before fading.
	task.delay(5, function()
		fade(title, "TextTransparency", 1, 0.8)
		fade(subtitle, "TextTransparency", 1, 0.8)
	end)
	fade(wonder, "Transparency", 0, 1.5)
	TweenService:Create(wonder, TweenInfo.new(BEAT_ARC * 0.5, Enum.EasingStyle.Quad),
		{ Size = Vector3.new(4, 14, 4), Position = ORIGIN + Vector3.new(-14, 7, -8) }):Play()
	task.spawn(function()
		for band = 1, 4 do
			if skipping then break end
			buildCity(band)
			startSkirmish(band)
			beat(BEAT_ARC / 4)
		end
	end)
	local segs = 6
	for s = 1, segs do
		if skipping then break end
		local a0 = math.rad(20 + (s - 1) / segs * 300)
		look(Vector3.new(math.cos(a0) * 26, 15, math.sin(a0) * 26), Vector3.new(0, 3, 0), BEAT_ARC / segs)
		beat(BEAT_ARC / segs)
	end
	if skipping then return end

	-- beat 4: the skirmishers FLEE, then the rocket ignites and lifts — the
	-- frame brightens to WHITE
	fleeFighters()
	look(Vector3.new(4, 10, 24), Vector3.new(9, 12, -3), BEAT_LAUNCH * 0.4)
	beat(0.9) -- a breath while they run
	if skipping then return end
	local flame = part(Vector3.new(2.4, 2.4, 2.4), Vector3.new(9, 1.4, -3), Color3.fromRGB(255, 180, 80), Enum.Material.Neon, Enum.PartType.Ball)
	TweenService:Create(rocket, TweenInfo.new(BEAT_LAUNCH, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
		{ CFrame = CFrame.new(ORIGIN + Vector3.new(9, 130, -3)) * CFrame.Angles(0, 0, math.rad(90)) }):Play()
	TweenService:Create(nose, TweenInfo.new(BEAT_LAUNCH, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
		{ Position = ORIGIN + Vector3.new(9, 134.6, -3) }):Play()
	TweenService:Create(flame, TweenInfo.new(BEAT_LAUNCH, Enum.EasingStyle.Quad),
		{ Position = ORIGIN + Vector3.new(9, 70, -3), Transparency = 1 }):Play()
	cover.BackgroundColor3 = Color3.fromRGB(255, 255, 255) -- the white-out cover
	fade(cover, "BackgroundTransparency", 0, BEAT_LAUNCH)
	beat(BEAT_LAUNCH)
	end) -- pcall
	if not ok then
		warn("[Intro] beat error (cutting to the deck): " .. tostring(err))
	end
	-- beat 5: white → the deck (ALWAYS runs — restores UI + camera)
	finish()
end)

print("[Intro] One City Through Time boot intro up (Skip lower-right)")
