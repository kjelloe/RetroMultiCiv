-- R9 (docs/13 Tier-3, user design 2026-07-16): the OBSERVATION DECK — the
-- place's lobby IS a platform in the sky. Players spawn here (SpawnLocation),
-- spectate the world below, and drive everything through three ground pads
-- (ProximityPrompts — native E-to-interact, works on touch/gamepad):
--   START A NEW GAME  (phase idle)     first user becomes HOST
--   JOIN GAME         (phase setup)    claim one of the host's human seats
--   TAKE OVER AI CIV  (phase running)  RANDOM vacant seat (regency-in-reverse)
-- run-R (user): rebuilt as an observation platform — glass railings, a glass
-- look-down balcony, lit pylons, and one STATION per action (pad + sign with
-- what it does and whether it is open right now). Layout and copy come from
-- DeckPlan (pure, gate 43). The contract GameServer relies on is unchanged:
-- folder.DeckSpawn, folder.Floor, prompts/padParts for start/join/takeover/
-- spectate, capitolPad, setPhase.
-- Pure presentation/physical: no game logic here — GameServer connects the
-- prompt events and calls setPhase(). Own/procedural art only.

local DeckPlan = require(script.Parent:WaitForChild("DeckPlan"))

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
	p.CastShadow = false -- runL item 2: the floating deck must not shadow the board
	for k, v in pairs(props or {}) do
		p[k] = v
	end
	p.Parent = parent
	return p
end

local function pad(parent, name, offsetX, color, promptText, zOffset)
	-- a 0.3 stud lip above the floor (run-S: flush at +0.06 the pad tops
	-- flickered against the floor from the spawn camera; still a walk-on step)
	local base = part(parent, name, Vector3.new(8, 1, 8),
		CFrame.new(DECK_POS + Vector3.new(offsetX, 0.8, zOffset or -10)), color,
		{ Material = Enum.Material.Neon })
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "Prompt"
	prompt.ActionText = promptText
	prompt.ObjectText = "A World Begun" -- name ruled #2541
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

local GLASS = Color3.fromRGB(170, 210, 235)
local METAL = Color3.fromRGB(70, 78, 96)
local SIGN_BG = Color3.fromRGB(22, 26, 36)

local function rgb(c)
	return Color3.fromRGB(c[1], c[2], c[3])
end

local function text(parent, y, h, size, font, color, str)
	local l = Instance.new("TextLabel")
	l.Size = UDim2.new(1, -40, 0, h)
	l.Position = UDim2.new(0, 20, 0, y)
	l.BackgroundTransparency = 1
	l.TextColor3 = color
	l.Font = font
	l.TextSize = size
	l.TextWrapped = true
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.TextYAlignment = Enum.TextYAlignment.Top
	l.Text = str
	l.Parent = parent
	return l
end

-- a board facing the spawn (+Z) with a SurfaceGui canvas at 50 px per stud
-- (`faceBack` = facing -Z instead, for a sign at the front edge read from the deck)
local function board(parent, name, size, pos, faceBack)
	local p = part(parent, name, size, CFrame.new(pos) * CFrame.Angles(0, faceBack and 0 or math.pi, 0), SIGN_BG)
	local sg = Instance.new("SurfaceGui")
	sg.Face = Enum.NormalId.Front
	sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	sg.PixelsPerStud = 50
	sg.LightInfluence = 0
	sg.Parent = p
	return p, sg
end

-- a run of glass railing along one edge: posts, panes between them, a top rail.
-- `gap` = { from, to } along the edge leaves an opening (the balcony doorway).
local function railing(parent, from, to, gap)
	local dir = to - from
	local len = dir.Magnitude
	local unit = dir.Unit
	local alongX = math.abs(unit.X) > 0.5
	local bays = math.max(1, math.floor(len / 12 + 0.5))
	local bay = len / bays
	for i = 0, bays do
		part(parent, "RailPost", Vector3.new(0.7, 5, 0.7), CFrame.new(from + unit * (bay * i) + Vector3.new(0, 3.5, 0)), METAL,
			{ Material = Enum.Material.Metal })
	end
	for i = 1, bays do
		local a, b = bay * (i - 1), bay * i
		local open = gap ~= nil and a >= gap[1] - 0.01 and b <= gap[2] + 0.01
		if not open then
			local mid = from + unit * ((a + b) / 2)
			local w = bay - 0.7
			part(parent, "GlassPane", alongX and Vector3.new(w, 4, 0.25) or Vector3.new(0.25, 4, w),
				CFrame.new(mid + Vector3.new(0, 3.2, 0)), GLASS, { Material = Enum.Material.Glass, Transparency = 0.6 })
			part(parent, "TopRail", alongX and Vector3.new(bay, 0.35, 0.5) or Vector3.new(0.5, 0.35, bay),
				CFrame.new(mid + Vector3.new(0, 5.4, 0)), METAL, { Material = Enum.Material.Metal })
		end
	end
end

function M.build()
	local folder = Instance.new("Folder")
	folder.Name = "ObservationDeck"
	local W, D = DeckPlan.FLOOR.w, DeckPlan.FLOOR.d
	local hw, hd = W / 2, D / 2
	local top = 1 -- floor top above DECK_POS

	-- the platform: a dark deck with a lighter walkway from the spawn to the
	-- station row and a lit edge strip
	part(folder, "Floor", Vector3.new(W, 2, D), CFrame.new(DECK_POS), Color3.fromRGB(46, 52, 66))
	part(folder, "Walkway", Vector3.new(W - 8, 0.06, 10),
		CFrame.new(DECK_POS + Vector3.new(0, top + 0.03, DeckPlan.STATION_Z)), Color3.fromRGB(66, 74, 94),
		{ CanCollide = false })
	part(folder, "Walkway", Vector3.new(12, 0.06, DeckPlan.SPAWN_Z - DeckPlan.STATION_Z),
		CFrame.new(DECK_POS + Vector3.new(0, top + 0.03, (DeckPlan.SPAWN_Z + DeckPlan.STATION_Z) / 2)),
		Color3.fromRGB(66, 74, 94), { CanCollide = false })
	for _, e in ipairs({
		{ Vector3.new(W, 0.3, 0.6), Vector3.new(0, top - 0.1, -hd + 0.3) },
		{ Vector3.new(W, 0.3, 0.6), Vector3.new(0, top - 0.1, hd - 0.3) },
		{ Vector3.new(0.6, 0.3, D), Vector3.new(-hw + 0.3, top - 0.1, 0) },
		{ Vector3.new(0.6, 0.3, D), Vector3.new(hw - 0.3, top - 0.1, 0) },
	}) do
		part(folder, "EdgeLight", e[1], CFrame.new(DECK_POS + e[2]), Color3.fromRGB(120, 190, 255),
			{ Material = Enum.Material.Neon, CanCollide = false })
	end

	-- glass railings all round (they also keep avatars on the deck); the front
	-- edge opens onto the look-down balcony
	local BAL_W, BAL_D = 24, 10
	local c = DECK_POS + Vector3.new(0, top, 0)
	railing(folder, c + Vector3.new(-hw, 0, -hd), c + Vector3.new(hw, 0, -hd))
	railing(folder, c + Vector3.new(-hw, 0, -hd), c + Vector3.new(-hw, 0, hd))
	railing(folder, c + Vector3.new(hw, 0, -hd), c + Vector3.new(hw, 0, hd))
	railing(folder, c + Vector3.new(-hw, 0, hd), c + Vector3.new(-BAL_W / 2, 0, hd))
	railing(folder, c + Vector3.new(BAL_W / 2, 0, hd), c + Vector3.new(hw, 0, hd))

	-- the balcony: a glass floor past the front edge, to look straight down at
	-- the world (the catch floor below returns anyone who gets over a rail)
	part(folder, "BalconyFloor", Vector3.new(BAL_W, 1, BAL_D),
		CFrame.new(DECK_POS + Vector3.new(0, top - 0.5, hd + BAL_D / 2)), GLASS,
		{ Material = Enum.Material.Glass, Transparency = 0.45 })
	local b0 = c + Vector3.new(0, 0, hd)
	railing(folder, b0 + Vector3.new(-BAL_W / 2, 0, 0), b0 + Vector3.new(-BAL_W / 2, 0, BAL_D))
	railing(folder, b0 + Vector3.new(BAL_W / 2, 0, 0), b0 + Vector3.new(BAL_W / 2, 0, BAL_D))
	railing(folder, b0 + Vector3.new(-BAL_W / 2, 0, BAL_D), b0 + Vector3.new(BAL_W / 2, 0, BAL_D))
	do
		local _, sg = board(folder, "BalconySign", Vector3.new(16, 1.6, 0.3), b0 + Vector3.new(0, 6.6, BAL_D), true)
		local t = text(sg, 10, 60, 40, Enum.Font.FredokaOne, Color3.fromRGB(200, 230, 255), "LOOK DOWN - THE WORLD BELOW")
		t.TextXAlignment = Enum.TextXAlignment.Center
	end

	-- four lit pylons mark the corners from far away
	for _, corner in ipairs({ { -1, -1 }, { 1, -1 }, { -1, 1 }, { 1, 1 } }) do
		local base = c + Vector3.new(corner[1] * (hw - 1), 0, corner[2] * (hd - 1))
		part(folder, "Pylon", Vector3.new(1.4, 14, 1.4), CFrame.new(base + Vector3.new(0, 7, 0)), METAL,
			{ Material = Enum.Material.Metal })
		local cap = part(folder, "PylonLight", Vector3.new(2, 1.2, 2), CFrame.new(base + Vector3.new(0, 14.6, 0)),
			Color3.fromRGB(255, 226, 150), { Material = Enum.Material.Neon })
		local light = Instance.new("PointLight")
		light.Range = 34
		light.Brightness = 1.2
		light.Color = Color3.fromRGB(255, 232, 180)
		light.Parent = cap
	end

	-- the banner over the station row
	do
		local _, sg = board(folder, "Banner", Vector3.new(44, 3.4, 0.4),
			c + Vector3.new(0, 12.6, -hd + 1.2))
		local t = text(sg, 16, 80, 72, Enum.Font.FredokaOne, Color3.fromRGB(255, 240, 200), "A WORLD BEGUN") -- name ruled #2541
		t.TextXAlignment = Enum.TextXAlignment.Center
		local sub = text(sg, 100, 50, 36, Enum.Font.GothamMedium, Color3.fromRGB(190, 205, 230),
			"Observation deck  -  walk onto a station to act")
		sub.TextXAlignment = Enum.TextXAlignment.Center
		for _, x in ipairs({ -21, 21 }) do
			part(folder, "BannerPost", Vector3.new(0.8, 12, 0.8), CFrame.new(c + Vector3.new(x, 6, -hd + 1.2)), METAL,
				{ Material = Enum.Material.Metal })
		end
	end

	-- ONE COMMON PLANE (user run-4 live feedback): the spawn plate and the
	-- station pads are tiles in the deck floor. The spawn plate is flush
	-- (invisible); the pads stand 0.3 proud (run-S: +0.06 flickered)
	local spawnLoc = Instance.new("SpawnLocation")
	spawnLoc.Name = "DeckSpawn"
	spawnLoc.Anchored = true
	spawnLoc.Size = Vector3.new(10, 1, 10)
	spawnLoc.CFrame = CFrame.new(DECK_POS + Vector3.new(0, 0.56, DeckPlan.SPAWN_Z))
	spawnLoc.Color = Color3.fromRGB(70, 80, 100)
	spawnLoc.TopSurface = Enum.SurfaceType.Smooth
	spawnLoc.Duration = 0
	spawnLoc.Neutral = true -- everyone spawns here, teams or not
	-- user request: the spawn plate is INVISIBLE (the deck floor shows
	-- through) but still physical + a working spawn — Transparency only,
	-- CanCollide stays true so it catches the spawn like before
	spawnLoc.Transparency = 1
	spawnLoc.Parent = folder

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

	-- the stations: pad + a sign behind it (what it does, and whether it is
	-- open in the current phase)
	local stations = {} -- id -> { pad, prompt, status, header }
	for _, st in ipairs(DeckPlan.STATIONS) do
		local color = rgb(st.color)
		local padPart, prompt
		if st.id == "capitol" then
			-- session-E (user ruling): a flush walk-on tile; GameServer teleports
			-- the toucher to their own civ's capital with sparkles
			padPart = part(folder, st.pad, Vector3.new(DeckPlan.PAD, 0.3, DeckPlan.PAD),
				CFrame.new(DECK_POS + Vector3.new(st.x, 1.15, DeckPlan.STATION_Z)), color,
				{ Material = Enum.Material.Neon, CanCollide = false, Transparency = 0.1 })
		else
			padPart, prompt = pad(folder, st.pad, st.x, color, st.title, DeckPlan.STATION_Z)
		end
		local signPos = c + Vector3.new(st.x, 4.9, DeckPlan.STATION_Z - DeckPlan.PAD / 2 - 2.6)
		-- 12 x 6.6 studs = a 600 x 330 px canvas (review: at 500 x 280 the
		-- longest title and the two-line status did not fit)
		local _, sg = board(folder, "StationSign", Vector3.new(12, 6.6, 0.4), signPos)
		for _, dx in ipairs({ -5.6, 5.6 }) do
			part(folder, "SignPost", Vector3.new(0.5, 1.6, 0.5), CFrame.new(signPos + Vector3.new(dx, -3.9, 0)), METAL,
				{ Material = Enum.Material.Metal })
		end
		local header = part(folder, "SignHeader", Vector3.new(12, 0.5, 0.6), CFrame.new(signPos + Vector3.new(0, 3.55, 0)),
			color, { Material = Enum.Material.Neon })
		local title = text(sg, 14, 50, 44, Enum.Font.FredokaOne, Color3.fromRGB(245, 245, 250), st.title)
		title.TextScaled = true -- one line at up to 44 px, shrunk to the width
		local cap = Instance.new("UITextSizeConstraint")
		cap.MaxTextSize = 44
		cap.MinTextSize = 24
		cap.Parent = title
		text(sg, 74, 156, 27, Enum.Font.GothamMedium, Color3.fromRGB(205, 212, 226), st.text)
		local status = text(sg, 240, 76, 27, Enum.Font.GothamBold, Color3.fromRGB(150, 160, 180), "")
		stations[st.id] = { pad = padPart, prompt = prompt, status = status, header = header, color = color }
	end

	folder.Parent = workspace

	local deck = { folder = folder, prompts = {
		start = stations.start.prompt, join = stations.join.prompt, takeover = stations.takeover.prompt,
		spectate = stations.spectate.prompt,
	}, padParts = {
		start = stations.start.pad, join = stations.join.pad, takeover = stations.takeover.pad,
		spectate = stations.spectate.pad,
	}, capitolPad = stations.capitol.pad }

	-- phase DIMS non-applicable stations but never disables them (run-4 live
	-- ruling: a touched pad that doesn't apply EXPLAINS itself instead of
	-- silently doing nothing — GameServer sends the toast; the sign says why)
	function deck.setPhase(phase, takeoverAvailable)
		for id, entry in pairs(stations) do
			local open, line = DeckPlan.status(id, phase, takeoverAvailable)
			if entry.prompt ~= nil then
				entry.prompt.Enabled = open -- E-hold stays a backup
			end
			entry.pad.Transparency = open and (id == "capitol" and 0.1 or 0) or 0.6
			entry.status.Text = line
			entry.status.TextColor3 = open and Color3.fromRGB(130, 235, 150) or Color3.fromRGB(235, 190, 120)
			entry.header.Color = open and entry.color or Color3.fromRGB(70, 74, 84)
			entry.header.Material = open and Enum.Material.Neon or Enum.Material.SmoothPlastic
		end
	end

	deck.setPhase("idle")
	return deck
end

return M
