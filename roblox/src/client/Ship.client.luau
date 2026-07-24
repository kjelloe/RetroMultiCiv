-- SO11 (catalog row; browser H8 twin, client/ui/ship.js): the SPACESHIP
-- screen — the assembly drawn as flat Frames (every slot always visible:
-- empty = faint outline, built+functional = solid, built-but-unsupported =
-- dimmed with a red edge, Civ1's red-box rule), the characteristics table,
-- the two-step irreversible-launch confirm, and rival-launch banners.
-- ALL math comes from the shared spaceship twin (marker-0049) — nothing
-- reimplemented; acting is one ordinary launchShip command.
-- Divergence from browser (flagged): no ?ship=1 mock preview (Studio tests
-- run real games); Esc-close is platform-reserved, the X button closes.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local spaceship = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("spaceship"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCShip"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

-- top-right row: Ship sits left of Pedia; hidden until the race exists
local openBtn = Instance.new("TextButton")
openBtn.Size = UDim2.new(0, 78, 0, 36)
openBtn.Position = UDim2.new(1, -370, 0, 8) -- shifted for the wider Gamepedia button
openBtn.BackgroundColor3 = Color3.fromRGB(64, 52, 76)
openBtn.TextColor3 = Color3.fromRGB(230, 215, 245)
openBtn.Font = Enum.Font.SourceSansBold
openBtn.TextSize = 18
openBtn.Text = "Ship"
openBtn.Visible = false
openBtn.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = openBtn
end

local frame = Instance.new("Frame")
frame.Size = UDim2.new(0, 780, 0, 490)
frame.Position = UDim2.new(0.5, -390, 0.5, -245)
frame.BackgroundColor3 = Color3.fromRGB(18, 20, 30)
frame.BorderSizePixel = 0
frame.Visible = false
frame.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 10)
	c.Parent = frame
end

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -40, 0, 30)
title.Position = UDim2.new(0, 12, 0, 4)
title.BackgroundTransparency = 1
title.TextColor3 = Color3.fromRGB(235, 235, 245)
title.Font = Enum.Font.SourceSansBold
title.TextSize = 22
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = "Spaceship"
title.Parent = frame

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 26, 0, 26)
closeBtn.Position = UDim2.new(1, -30, 0, 4)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
closeBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
closeBtn.Font = Enum.Font.SourceSansBold
closeBtn.TextSize = 16
closeBtn.Text = "X"
closeBtn.Parent = frame

local diagram = Instance.new("Frame")
diagram.Size = UDim2.new(0, 316, 0, 446)
diagram.Position = UDim2.new(0, 12, 0, 36)
diagram.BackgroundColor3 = Color3.fromRGB(10, 12, 20)
diagram.BorderSizePixel = 0
diagram.ClipsDescendants = true
diagram.Parent = frame

local side = Instance.new("Frame")
side.Size = UDim2.new(1, -352, 1, -48)
side.Position = UDim2.new(0, 340, 0, 36)
side.BackgroundTransparency = 1
side.Parent = frame

local function sideLabel(y, h, size)
	local l = Instance.new("TextLabel")
	l.Size = UDim2.new(1, 0, 0, h)
	l.Position = UDim2.new(0, 0, 0, y)
	l.BackgroundTransparency = 1
	l.TextColor3 = Color3.fromRGB(220, 226, 238)
	l.Font = Enum.Font.Code
	l.TextSize = size
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.TextYAlignment = Enum.TextYAlignment.Top
	l.TextWrapped = true
	l.RichText = true
	l.Text = ""
	l.Parent = side
	return l
end

local partsText = sideLabel(0, 128, 15)
local statsText = sideLabel(134, 150, 15)
local statusText = sideLabel(290, 60, 15)

local launchBtn = Instance.new("TextButton")
launchBtn.Size = UDim2.new(0, 130, 0, 34)
launchBtn.Position = UDim2.new(0, 0, 1, -40)
launchBtn.BackgroundColor3 = Color3.fromRGB(150, 80, 40)
launchBtn.TextColor3 = Color3.fromRGB(255, 235, 220)
launchBtn.Font = Enum.Font.SourceSansBold
launchBtn.TextSize = 18
launchBtn.Text = "Launch"
launchBtn.Visible = false
launchBtn.Parent = side
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = launchBtn
end

local confirmLabel = sideLabel(352, 40, 13)
confirmLabel.TextColor3 = Color3.fromRGB(255, 180, 150)

local confirmYes = Instance.new("TextButton")
confirmYes.Size = UDim2.new(0, 130, 0, 30)
confirmYes.Position = UDim2.new(0, 140, 1, -38)
confirmYes.BackgroundColor3 = Color3.fromRGB(170, 60, 40)
confirmYes.TextColor3 = Color3.fromRGB(255, 240, 235)
confirmYes.Font = Enum.Font.SourceSansBold
confirmYes.TextSize = 15
confirmYes.Text = "CONFIRM LAUNCH"
confirmYes.Visible = false
confirmYes.Parent = side

local confirmNo = Instance.new("TextButton")
confirmNo.Size = UDim2.new(0, 70, 0, 30)
confirmNo.Position = UDim2.new(0, 278, 1, -38)
confirmNo.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
confirmNo.TextColor3 = Color3.fromRGB(240, 240, 240)
confirmNo.Font = Enum.Font.SourceSansBold
confirmNo.TextSize = 15
confirmNo.Text = "Cancel"
confirmNo.Visible = false
confirmNo.Parent = side

-- race banners (launches are public; destruction is personal)
local banner = Instance.new("TextLabel")
banner.Size = UDim2.new(0, 820, 0, 44)
banner.Position = UDim2.new(0.5, -410, 0.3, 0)
banner.BackgroundTransparency = 1
banner.Font = Enum.Font.SourceSansBold
banner.TextSize = 28
banner.TextStrokeTransparency = 0.3
banner.Visible = false
banner.Parent = gui
local bannerGen = 0
local function showBanner(text, color)
	bannerGen += 1
	local gen = bannerGen
	banner.Text = text
	banner.TextColor3 = color
	banner.Visible = true
	task.delay(5, function()
		if gen == bannerGen then
			banner.Visible = false
		end
	end)
end

-- ---- the assembly (browser drawShip geometry, scaled 316x446 <- 360x544) ---
local SCALE = 316 / 360
local PART_STYLE = {
	structural = Color3.fromRGB(200, 200, 208),
	propulsion = Color3.fromRGB(230, 140, 60),
	fuel = Color3.fromRGB(205, 175, 85),
	habitation = Color3.fromRGB(110, 170, 230),
	lifeSupport = Color3.fromRGB(120, 200, 140),
	solar = Color3.fromRGB(230, 200, 90),
}
local NONSTRUCT_ORDER = { "propulsion", "fuel", "habitation", "lifeSupport", "solar" }

local function idiv(a, b)
	return math.floor(a / b)
end

local function slot(x, y, w, h, color, stateName, round)
	local f = Instance.new("Frame")
	f.Position = UDim2.new(0, math.floor(x * SCALE), 0, math.floor(y * SCALE))
	f.Size = UDim2.new(0, math.max(2, math.floor(w * SCALE)), 0, math.max(2, math.floor(h * SCALE)))
	f.BorderSizePixel = 0
	f.BackgroundColor3 = color
	local c = Instance.new("UICorner")
	c.CornerRadius = round and UDim.new(0.5, 0) or UDim.new(0, 3)
	c.Parent = f
	if stateName == "built" then
		f.BackgroundTransparency = 0.05
	elseif stateName == "dead" then
		-- Civ1's red-box rule: built beyond structural support = dim + red edge
		f.BackgroundTransparency = 0.55
		local s = Instance.new("UIStroke")
		s.Color = Color3.fromRGB(230, 70, 60)
		s.Thickness = 2
		s.Parent = f
	else
		f.BackgroundTransparency = 0.88
		local s = Instance.new("UIStroke")
		s.Color = color
		s.Transparency = 0.6
		s.Parent = f
	end
	f.Parent = diagram
end

local function slotState(i, built, functional)
	if i <= functional then
		return "built"
	elseif i <= built then
		return "dead"
	end
	return "empty"
end

local function count(ship, key)
	return (ship ~= nil and ship[key] ~= nil) and ship[key] or 0
end

local function drawShip(ship, rs)
	diagram:ClearAllChildren()
	local P = rs.rules.ssParts
	local fn = spaceship.functionalCounts(ship, rs)
	local sBuilt = count(ship, "structural")
	for i = 0, P.structural.max - 1 do -- truss: 3-wide ladder up the middle
		local col, row = i % 3, idiv(i, 3)
		slot(150 + col * 20, 470 - row * 34, 16, 30, PART_STYLE.structural,
			i < sBuilt and "built" or "empty", false)
	end
	for i = 1, P.propulsion.max do -- engine bells across the base
		slot(62 + (i - 1) * 30, 512, 26, 22, PART_STYLE.propulsion,
			slotState(i, count(ship, "propulsion"), fn.propulsion), false)
	end
	for i = 1, P.fuel.max do -- tanks above the engines
		slot(60 + (i - 1) * 30, 478, 24, 28, PART_STYLE.fuel,
			slotState(i, count(ship, "fuel"), fn.fuel), true)
	end
	for i = 1, P.habitation.max do -- domes, upper left column
		slot(70, 60 + (i - 1) * 78, 60, 60, PART_STYLE.habitation,
			slotState(i, count(ship, "habitation"), fn.habitation), true)
	end
	for i = 1, P.lifeSupport.max do -- boxes, upper right column
		slot(232, 66 + (i - 1) * 78, 48, 48, PART_STYLE.lifeSupport,
			slotState(i, count(ship, "lifeSupport"), fn.lifeSupport), false)
	end
	for i = 1, P.solar.max do -- panel wings, two per side at the top
		local left = (i - 1) % 2 == 0
		slot(left and 6 or 296, 28 + idiv(i - 1, 2) * 46, 58, 30, PART_STYLE.solar,
			slotState(i, count(ship, "solar"), fn.solar), false)
	end
	-- nose cap (full frame only)
	slot(150, 6, 56, 16, PART_STYLE.structural, sBuilt >= P.structural.max and "built" or "empty", false)
end

local PART_LABELS = {
	{ "structural", "Structural" }, { "propulsion", "Propulsion" },
	{ "fuel", "Fuel" }, { "habitation", "Habitation" },
	{ "lifeSupport", "Life Support" }, { "solar", "Solar Panel" },
}

local function apollo(view, rs)
	local shim = { wonders = view.wonders, cities = view.cities, cityOrder = view.cityOrder }
	local ok, active = pcall(spaceship.apolloActive, shim, rs)
	return ok and active == true
end

local function render()
	local view = ClientState.view
	if view == nil then
		return
	end
	local rs = ClientState.rulesets()
	local me = view.players[view.you]
	local ship = me ~= nil and me.spaceship or nil
	local shown = ship or { launched = 0 }
	drawShip(shown, rs)

	local P = rs.rules.ssParts
	local fn = spaceship.functionalCounts(shown, rs)
	local lines = {}
	for _, row in ipairs(PART_LABELS) do
		local k, label = row[1], row[2]
		local built = count(shown, k)
		local dead = k == "structural" and 0 or built - fn[k]
		table.insert(lines, ("%-13s %d/%d%s"):format(label, built, P[k].max,
			dead > 0 and (' <font color="#e04840">(' .. dead .. " unsupported)</font>") or ""))
	end
	partsText.Text = table.concat(lines, "\n")

	local st = spaceship.shipStats(shown, rs)
	statsText.Text = table.concat({
		("Population     %d colonists"):format(st.population),
		("Life support   %d%%"):format(st.supportPct),
		("Energy         %d%%"):format(st.energyPct),
		("Mass           %d tons"):format(st.mass),
		("Fuel           %d%%"):format(st.fuelPct),
		("Flight time    %d years"):format(st.flightYears),
		("Success chance %d%%"):format(st.successPct),
	}, "\n")

	local launched = shown.launched ~= nil and shown.launched ~= 0
	local viable = spaceship.isViable(shown, rs)
	confirmLabel.Text = ""
	confirmYes.Visible = false
	confirmNo.Visible = false
	if launched then
		local left = (shown.arrivalTurn or view.turn) - view.turn
		statusText.Text = ("Launched on turn %d - arrival turn %d%s"):format(shown.launched,
			shown.arrivalTurn or 0, left > 0 and (" (" .. left .. " to go)") or "")
		launchBtn.Visible = false
	elseif ship == nil then
		statusText.Text = apollo(view, rs)
			and "No parts built yet - cities build spaceship parts like improvements once the techs are in."
			or "Spaceship construction opens once any civilization completes the Apollo Program."
		launchBtn.Visible = false
	else
		statusText.Text = viable and "The ship is viable and ready to launch."
			or "Not yet viable - a launch needs a working propulsion + fuel pair and one functional module of each type."
		launchBtn.Visible = ClientState.myTurn() and viable and apollo(view, rs)
	end
end

closeBtn.Activated:Connect(function()
	frame.Visible = false
end)
openBtn.Activated:Connect(function()
	frame.Visible = not frame.Visible
	if frame.Visible then
		ClientState.panelOpened("ship") -- runI item 18: closes the city view
		render()
	end
end)
launchBtn.Activated:Connect(function()
	launchBtn.Visible = false
	confirmLabel.Text = "Launch is IRREVERSIBLE - no recall, and a captured capital destroys the ship mid-flight."
	confirmYes.Visible = true
	confirmNo.Visible = true
end)
confirmNo.Activated:Connect(function()
	confirmLabel.Text = ""
	confirmYes.Visible = false
	confirmNo.Visible = false
	render()
end)
confirmYes.Activated:Connect(function()
	confirmYes.Visible = false
	confirmNo.Visible = false
	confirmLabel.Text = ""
	print("[Ship] launchShip")
	ClientState.send({ type = "launchShip" })
end)

ClientState.onView(function(view)
	local me = view.players[view.you]
	openBtn.Visible = (me ~= nil and me.spaceship ~= nil)
		or apollo(view, ClientState.rulesets())
	if frame.Visible then
		render()
	end
end)

ClientState.onEvents(function(events, view)
	for _, e in ipairs(events) do
		if e.type == "shipLaunched" then
			local who = view ~= nil and view.players[e.playerId] or nil
			if e.playerId == (view and view.you) then
				showBanner(("Your spaceship is away - arrival on turn %d"):format(e.arrivalTurn or 0),
					Color3.fromRGB(255, 220, 90))
			else
				showBanner(("%s has LAUNCHED a spaceship - arrival turn %d!")
					:format(who ~= nil and who.name or tostring(e.playerId), e.arrivalTurn or 0),
					Color3.fromRGB(255, 160, 70))
			end
		elseif e.type == "shipDestroyed" and view ~= nil and e.playerId == view.you then
			showBanner("Your spaceship was destroyed with the capital - a new one may be built",
				Color3.fromRGB(255, 90, 80))
		end
	end
end)

print("[Ship] SO11 spaceship screen up (Ship button appears once the race exists)")
