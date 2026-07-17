-- R9 (docs/13 Tier-3, user design 2026-07-16): the OBSERVATION DECK — the
-- place's lobby IS a platform in the sky. Players spawn here (SpawnLocation),
-- spectate the world below, and drive everything through three ground pads
-- (ProximityPrompts — native E-to-interact, works on touch/gamepad):
--   START A NEW GAME  (phase idle)     first user becomes HOST
--   JOIN GAME         (phase setup)    claim one of the host's human seats
--   TAKE OVER AI CIV  (phase running)  RANDOM vacant seat (regency-in-reverse)
-- Pure presentation/physical: no game logic here — GameServer connects the
-- prompt events and calls setPhase(). Own/procedural art only.

local M = {}

local DECK_Y = 140
local DECK_POS = Vector3.new(78, DECK_Y, 48) -- above a medium map's center

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

local function pad(parent, name, offsetX, color, promptText)
	-- flush with the floor plane (the user's one-common-plate ruling)
	local base = part(parent, name, Vector3.new(8, 1, 8),
		CFrame.new(DECK_POS + Vector3.new(offsetX, 0.56, -10)), color,
		{ Material = Enum.Material.Neon })
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "Prompt"
	prompt.ActionText = promptText
	prompt.ObjectText = "RetroMultiCiv"
	prompt.HoldDuration = 0.3
	prompt.RequiresLineOfSight = false
	prompt.MaxActivationDistance = 12
	prompt.Parent = base
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.new(0, 220, 0, 26)
	bb.StudsOffset = Vector3.new(0, 3, 0)
	bb.AlwaysOnTop = true
	bb.Adornee = base
	local label = Instance.new("TextLabel")
	label.Size = UDim2.new(1, 0, 1, 0)
	label.BackgroundTransparency = 1
	label.TextColor3 = Color3.fromRGB(235, 235, 235)
	label.TextStrokeTransparency = 0.2
	label.Font = Enum.Font.SourceSansBold
	label.TextSize = 20
	label.Text = promptText
	label.Parent = bb
	bb.Parent = base
	return base, prompt
end

function M.build()
	local folder = Instance.new("Folder")
	folder.Name = "ObservationDeck"

	-- the platform: a wide disc with a rim so avatars don't step off by accident
	part(folder, "Floor", Vector3.new(60, 2, 40),
		CFrame.new(DECK_POS), Color3.fromRGB(52, 58, 72))
	for _, rim in ipairs({
		{ Vector3.new(60, 3, 1), Vector3.new(0, 2, -20.5) },
		{ Vector3.new(60, 3, 1), Vector3.new(0, 2, 20.5) },
		{ Vector3.new(1, 3, 40), Vector3.new(-30.5, 2, 0) },
		{ Vector3.new(1, 3, 40), Vector3.new(30.5, 2, 0) },
	}) do
		part(folder, "Rim", rim[1], CFrame.new(DECK_POS + rim[2]),
			Color3.fromRGB(80, 88, 106), { Transparency = 0.35 })
	end

	-- ONE COMMON PLANE (user run-4 live feedback): the spawn plate, the lobby
	-- pads, and the action strip are all FLUSH tiles in the deck floor —
	-- every walk-tile top sits at floor-top + 0.06 (no z-fight, no steps)
	local spawnLoc = Instance.new("SpawnLocation")
	spawnLoc.Name = "DeckSpawn"
	spawnLoc.Anchored = true
	spawnLoc.Size = Vector3.new(10, 1, 10)
	spawnLoc.CFrame = CFrame.new(DECK_POS + Vector3.new(0, 0.56, 10))
	spawnLoc.Color = Color3.fromRGB(70, 80, 100)
	spawnLoc.TopSurface = Enum.SurfaceType.Smooth
	spawnLoc.Duration = 0
	spawnLoc.Neutral = true -- everyone spawns here, teams or not
	spawnLoc.Parent = folder

	-- the ACTION STRIP (run-4 item 2, shape per the user's live ruling):
	-- flush trigger tiles along the south edge; the CLIENT binds Touched and
	-- fires its own selected unit's commands (ActionPads.client.luau)
	local actionFolder = Instance.new("Folder")
	actionFolder.Name = "ActionPads"
	actionFolder.Parent = folder
	local STRIP = {
		{ name = "found", label = "FOUND", w = 4, color = Color3.fromRGB(60, 130, 80) },
		{ name = "fortify", label = "FORTIFY", w = 4, color = Color3.fromRGB(90, 100, 120) },
		{ name = "wait", label = "WAIT", w = 4, color = Color3.fromRGB(80, 90, 110) },
		{ name = "irrigate", label = "IRRIGATE", w = 4, color = Color3.fromRGB(80, 140, 90) },
		{ name = "mine", label = "MINE", w = 4, color = Color3.fromRGB(120, 100, 70) },
		{ name = "road", label = "ROAD", w = 4, color = Color3.fromRGB(130, 120, 90) },
		{ name = "endturn", label = "END TURN", w = 8, color = Color3.fromRGB(46, 88, 148) },
	}
	local totalW = 0
	for _, s in ipairs(STRIP) do
		totalW += s.w + 1
	end
	local x = -totalW / 2
	for _, s in ipairs(STRIP) do
		local tile = part(actionFolder, "Pad_" .. s.name, Vector3.new(s.w, 0.12, 4),
			CFrame.new(DECK_POS + Vector3.new(x + s.w / 2, 1.06, 16)), s.color,
			{ Material = Enum.Material.Neon, CanCollide = false, Transparency = 0.1 })
		local bb = Instance.new("BillboardGui")
		bb.Size = UDim2.new(0, 90, 0, 16)
		bb.StudsOffset = Vector3.new(0, 1.6, 0)
		bb.AlwaysOnTop = true
		bb.Adornee = tile
		local t = Instance.new("TextLabel")
		t.Size = UDim2.new(1, 0, 1, 0)
		t.BackgroundTransparency = 1
		t.TextColor3 = Color3.fromRGB(235, 235, 235)
		t.TextStrokeTransparency = 0.3
		t.Font = Enum.Font.SourceSansBold
		t.TextSize = 14
		t.Text = s.label
		t.Parent = bb
		bb.Parent = tile
		x += s.w + 1
	end

	-- run-4 fix: a PERMANENT catch floor — pre-game there is no other floor
	-- anywhere (VoidCover's builds only with the first view), so any fall
	-- (boot races, deck step-offs) must land here and bounce back to the deck
	local catchFloor = part(folder, "CatchFloor", Vector3.new(2000, 2, 2000),
		CFrame.new(DECK_POS.X, -20, DECK_POS.Z), Color3.fromRGB(14, 16, 22))
	catchFloor.Touched:Connect(function(hit)
		local character = hit.Parent
		local humanoid = character and character:FindFirstChildOfClass("Humanoid")
		local rootPart = character and character:FindFirstChild("HumanoidRootPart")
		if humanoid ~= nil and rootPart ~= nil then
			rootPart.CFrame = spawnLoc.CFrame + Vector3.new(0, 4, 0)
		end
	end)

	local startPad, startPrompt = pad(folder, "StartPad", -20,
		Color3.fromRGB(60, 130, 80), "START A NEW GAME")
	local joinPad, joinPrompt = pad(folder, "JoinPad", 0,
		Color3.fromRGB(60, 90, 150), "JOIN GAME")
	local takeoverPad, takeoverPrompt = pad(folder, "TakeoverPad", 20,
		Color3.fromRGB(150, 110, 50), "TAKE OVER AI CIV")

	folder.Parent = workspace

	local pads = {
		start = { pad = startPad, prompt = startPrompt },
		join = { pad = joinPad, prompt = joinPrompt },
		takeover = { pad = takeoverPad, prompt = takeoverPrompt },
	}

	local deck = { folder = folder, prompts = {
		start = startPrompt, join = joinPrompt, takeover = takeoverPrompt,
	}, padParts = {
		start = startPad, join = joinPad, takeover = takeoverPad,
	} }

	-- phase DIMS non-applicable pads but never disables them (run-4 live
	-- ruling: a touched pad that doesn't apply EXPLAINS itself instead of
	-- silently doing nothing — GameServer sends the toast)
	function deck.setPhase(phase, takeoverAvailable)
		local live = {
			idle = { start = true },
			setup = { join = true },
			starting = { join = true },
			running = { takeover = takeoverAvailable == true },
		}
		local on = live[phase] or {}
		for name, entry in pairs(pads) do
			entry.prompt.Enabled = on[name] == true -- E-hold stays a backup
			entry.pad.Transparency = on[name] == true and 0 or 0.6
		end
	end

	deck.setPhase("idle")
	return deck
end

return M
