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
	local base = part(parent, name, Vector3.new(8, 1, 8),
		CFrame.new(DECK_POS + Vector3.new(offsetX, 0.75, -10)), color,
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

	local spawnLoc = Instance.new("SpawnLocation")
	spawnLoc.Name = "DeckSpawn"
	spawnLoc.Anchored = true
	spawnLoc.Size = Vector3.new(10, 1, 10)
	spawnLoc.CFrame = CFrame.new(DECK_POS + Vector3.new(0, 1.5, 10))
	spawnLoc.Color = Color3.fromRGB(70, 80, 100)
	spawnLoc.TopSurface = Enum.SurfaceType.Smooth
	spawnLoc.Duration = 0
	spawnLoc.Neutral = true -- everyone spawns here, teams or not
	spawnLoc.Parent = folder

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
	} }

	-- phase gates which pads are live (dead pads dim + lose their prompt)
	function deck.setPhase(phase, takeoverAvailable)
		local live = {
			idle = { start = true },
			setup = { join = true },
			starting = { join = true },
			running = { takeover = takeoverAvailable == true },
		}
		local on = live[phase] or {}
		for name, entry in pairs(pads) do
			entry.prompt.Enabled = on[name] == true
			entry.pad.Transparency = on[name] == true and 0 or 0.7
		end
	end

	deck.setPhase("idle")
	return deck
end

return M
