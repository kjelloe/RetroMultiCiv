-- R6: the action bar (roblox/SPEC.md §3g, docs/13 Tier-1 row — a bottom-bar
-- ScreenGui, not Billboards, per the adopted review). Buttons mirror the
-- hotkeys and grey out when the context is wrong; every action is a command
-- through ClientState.send, nothing acts locally. Hotkeys here: G fortify,
-- Space wait (skip unit), X disband, I/M/R irrigate/mine/road (settlers,
-- startWork on the stood-on tile) — B (found) and Return (end turn) stay in
-- Select, P/N in Possess, T in ResearchPicker, L in TurnLog. All chat-guarded.
-- GoTo/pathfind: deferred (flagged @b3084114) — Select's click-move covers it.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local GoToPlan = require(script.Parent:WaitForChild("GoToPlan")) -- round 20
local techModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("tech"))
local upgradeModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("upgrade")) -- CP18

local gui = Instance.new("ScreenGui")
gui.Name = "RMCActionBar"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

-- session-E: buttons sized like CLOSE CITY VIEW (big, bold, rounded)
local bar = Instance.new("Frame")
bar.Size = UDim2.new(0, 1436, 0, 50)
bar.Position = UDim2.new(0.5, -718, 1, -58)
bar.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
bar.BackgroundTransparency = 0.25
bar.BorderSizePixel = 0
bar.Parent = gui
local layout = Instance.new("UIListLayout")
layout.FillDirection = Enum.FillDirection.Horizontal
layout.Padding = UDim.new(0, 4)
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.VerticalAlignment = Enum.VerticalAlignment.Center
layout.Parent = bar

-- runI item 22: widen the enabled/disabled contrast so an inapplicable action
-- reads clearly as grayed-out (a live action is a lit blue; disabled is a flat,
-- near-black gray). The can()-gate already blocks the send + colors every button.
local ENABLED = Color3.fromRGB(58, 82, 118)
local DISABLED = Color3.fromRGB(28, 30, 35)

local buttons = {}
local function addButton(order, text, width)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, math.floor(width * 1.3), 0, 40)
	b.LayoutOrder = order
	b.BackgroundColor3 = DISABLED
	b.TextColor3 = Color3.fromRGB(235, 235, 235)
	b.Font = Enum.Font.SourceSansBold
	b.TextSize = 18
	b.Text = text
	b.Parent = bar
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = b
	table.insert(buttons, b)
	return b
end

-- session-E round 14 (user): the selected tile's friendly units get TAB
-- CARDS just above the action bar — ALWAYS shown for the selected/ridden
-- unit (round 17: even alone), name + Attack/Defense/Moves per card,
-- active unit highlighted; click selects (mounted: rides) it.
local stackBar = Instance.new("Frame")
stackBar.Size = UDim2.new(0, 940, 0, 38)
stackBar.Position = UDim2.new(0.5, -470, 1, -100)
stackBar.BackgroundTransparency = 1
stackBar.Parent = gui
local stackLayout = Instance.new("UIListLayout")
stackLayout.FillDirection = Enum.FillDirection.Horizontal
stackLayout.Padding = UDim.new(0, 4)
stackLayout.SortOrder = Enum.SortOrder.LayoutOrder
stackLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
stackLayout.Parent = stackBar

local lastStackKey = nil
RunService.Heartbeat:Connect(function()
	local view = ClientState.view
	local sel = view ~= nil and ClientState.selectedUnitId ~= nil
		and view.units[ClientState.selectedUnitId] or nil
	local ids = {}
	if sel ~= nil then
		for id, u in pairs(view.units) do
			if u.owner == view.you and u.x == sel.x and u.y == sel.y then
				table.insert(ids, id)
			end
		end
		table.sort(ids)
	end
	local keyParts = {}
	for _, id in ipairs(ids) do
		local u = view.units[id]
		-- moves/fortified join the key so the A/D/M line repaints on change
		table.insert(keyParts, id .. ":" .. u.moves .. (u.fortified == true and "F" or ""))
	end
	local sentryMarks = ""
	for _, id in ipairs(ids) do
		if ClientState.sentried[id] == true then
			sentryMarks ..= "s" .. id
		end
		if ClientState.autoSettlers[id] == true then
			sentryMarks ..= "a" .. id
		end
	end
	local key = table.concat(keyParts, ",") .. "|" .. tostring(ClientState.selectedUnitId)
		.. "|" .. tostring(ClientState.possessedUnitId) .. "|" .. sentryMarks
	if key == lastStackKey then
		return
	end
	lastStackKey = key
	for _, child in ipairs(stackBar:GetChildren()) do
		if child:IsA("TextButton") then
			child:Destroy()
		end
	end
	if #ids < 1 then
		return
	end
	local rs = ClientState.rulesets()
	for i, id in ipairs(ids) do
		local u = view.units[id]
		local card = Instance.new("TextButton")
		card.LayoutOrder = i
		card.Size = UDim2.new(0, 132, 0, 36)
		local active = id == ClientState.selectedUnitId
		card.BackgroundColor3 = active and Color3.fromRGB(46, 88, 148) or Color3.fromRGB(34, 40, 54)
		card.TextColor3 = Color3.fromRGB(235, 235, 235)
		card.Font = Enum.Font.SourceSansBold
		card.TextSize = 14
		card.RichText = true
		local def = rs.units[u.type]
		-- round 17 (user): name + Attack/Defense/Moves always visible
		card.Text = ("%s%s%s\n<font size=\"12\" color=\"#b8c6d8\">A%d D%d M%d/%d</font>")
			:format(def and def.name or u.type,
				u.fortified == true and " [F]" or (u.moves <= 0 and " ·" or ""),
				(ClientState.sentried[id] == true and " [Zz]" or "")
					.. (ClientState.autoSettlers[id] == true and " [Au]" or ""),
				def and def.attack or 0, def and def.defense or 0,
				u.moves, def and def.moves or u.moves)
		card.Parent = stackBar
		-- CP20 (ruling @1e2f43eb): the sentry toggle lives ON the card
		local zz = Instance.new("TextButton")
		zz.Size = UDim2.new(0, 26, 0, 16)
		zz.Position = UDim2.new(1, -28, 0, 2)
		zz.BackgroundColor3 = ClientState.sentried[id] == true
			and Color3.fromRGB(90, 90, 150) or Color3.fromRGB(40, 44, 58)
		zz.TextColor3 = Color3.fromRGB(200, 210, 235)
		zz.Font = Enum.Font.SourceSansBold
		zz.TextSize = 12
		zz.Text = "Zz"
		zz.Parent = card
		local zc = Instance.new("UICorner")
		zc.CornerRadius = UDim.new(0, 5)
		zc.Parent = zz
		zz.Activated:Connect(function()
			ClientState.toggleSentry(id)
			print(("[ActionBar] sentry %s: %s"):format(id,
				ClientState.sentried[id] == true and "ON" or "off"))
		end)
		-- CP20 (ruling @6679e9c0): settlers also get an Au automation toggle
		if def ~= nil and u.type == "settlers" then
			local au = Instance.new("TextButton")
			au.Size = UDim2.new(0, 26, 0, 16)
			au.Position = UDim2.new(1, -56, 0, 2)
			au.BackgroundColor3 = ClientState.autoSettlers[id] == true
				and Color3.fromRGB(70, 130, 90) or Color3.fromRGB(40, 44, 58)
			au.TextColor3 = Color3.fromRGB(210, 235, 215)
			au.Font = Enum.Font.SourceSansBold
			au.TextSize = 12
			au.Text = "Au"
			au.Parent = card
			local ac = Instance.new("UICorner")
			ac.CornerRadius = UDim.new(0, 5)
			ac.Parent = au
			au.Activated:Connect(function()
				ClientState.toggleAuto(id)
				print(("[ActionBar] automate %s: %s"):format(id,
					ClientState.autoSettlers[id] == true and "ON" or "off"))
			end)
		end
		local c = Instance.new("UICorner")
		c.CornerRadius = UDim.new(0, 8)
		c.Parent = card
		card.Activated:Connect(function()
			print("[ActionBar] stack tab: " .. id)
			if ClientState.possessedUnitId ~= nil then
				ClientState.requestPossess(id) -- mounted: hop rides
			else
				ClientState.selectedUnitId = id
			end
		end)
	end
end)

local foundBtn = addButton(1, "Found (B)", 90)
local fortifyBtn = addButton(2, "Fortify (O)", 90)
local waitBtn = addButton(3, "Wait (Spc)", 90)
-- session-E round 20 (user): GoTo as a visible action — arms the same
-- target-pick the G key uses; the plan then marches MULTI-TURN by design
-- (GoToPlan re-plans and steps every turn until arrival)
local gotoBtn = addButton(4, "GoTo (G)", 80)
local disbandBtn = addButton(5, "Disband (X)", 100)
local irrigateBtn = addButton(6, "Irr (I)", 70)
local mineBtn = addButton(7, "Mine (M)", 70)
local roadBtn = addButton(8, "Road (R)", 70)
-- CP3 (catalog): fortress + pillage complete the browser action set —
-- fortress is a startWork like irrigate/mine/road (tech-gated, server
-- judges); pillage strips the stood-on tile's improvement
local fortBtn = addButton(9, "Fort", 60)
local pillageBtn = addButton(10, "Pillage", 76)
-- CP17 (marker-0052): caravans establish trade routes standing in a city;
-- the engine judges the nine rejections (red banners explain)
local tradeBtn = addButton(11, "Trade", 66)
-- CP18 (marker-0055/browser 6f30a46): paid unit upgrade IN an own city;
-- the button carries the live upgradeCost price
local upgradeBtn = addButton(12, "Upgrade", 82)
local possessBtn = addButton(13, "Ride (P)", 80)

-- R7a (6): research leaves the unit bar for a top-center cluster (slots
-- reserved for diplomacy later). R12 (2)(5): Government joins it, and a
-- live research-status line sits beside the Research button.
local cluster = Instance.new("Frame")
cluster.Size = UDim2.new(0, 760, 0, 46)
cluster.Position = UDim2.new(0.5, -380, 0, 30) -- run-F #10: dropped 24px so the
-- research-status line sits ABOVE the Research/Cities button row
cluster.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
cluster.BackgroundTransparency = 0.25
cluster.BorderSizePixel = 0
cluster.Parent = gui
local clusterLayout = Instance.new("UIListLayout")
clusterLayout.FillDirection = Enum.FillDirection.Horizontal
clusterLayout.Padding = UDim.new(0, 4)
clusterLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
clusterLayout.VerticalAlignment = Enum.VerticalAlignment.Center
clusterLayout.Parent = cluster

local researchBtn = Instance.new("TextButton")
researchBtn.LayoutOrder = 1
researchBtn.Size = UDim2.new(0, 140, 0, 38)
researchBtn.BackgroundColor3 = DISABLED
researchBtn.TextColor3 = Color3.fromRGB(235, 235, 235)
researchBtn.Font = Enum.Font.SourceSansBold
researchBtn.TextSize = 18
researchBtn.Text = "Research (T)"
researchBtn.Parent = cluster
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = researchBtn
end

-- R12 (5): always-visible research status (tech + turns remaining). run-F #10
-- (user): moved OUT of the button row to a centered line just ABOVE it, so
-- "current research" reads clearly over the Research/Cities buttons.
local researchStatus = Instance.new("TextLabel")
researchStatus.Size = UDim2.new(0, 760, 0, 22)
researchStatus.Position = UDim2.new(0.5, -380, 0, 6)
researchStatus.BackgroundTransparency = 1
researchStatus.TextColor3 = Color3.fromRGB(180, 210, 240)
researchStatus.Font = Enum.Font.SourceSansBold
researchStatus.TextSize = 17
researchStatus.TextXAlignment = Enum.TextXAlignment.Center
researchStatus.Text = ""
researchStatus.Parent = gui

-- session-E round 18 (user): Cities button, LEFT of Government + Research —
-- the C hotkey's clickable twin (ClientState.toggleCityList channel)
local citiesBtn = Instance.new("TextButton")
citiesBtn.LayoutOrder = -1
citiesBtn.Size = UDim2.new(0, 110, 0, 38)
citiesBtn.BackgroundColor3 = DISABLED
citiesBtn.TextColor3 = Color3.fromRGB(235, 235, 235)
citiesBtn.Font = Enum.Font.SourceSansBold
citiesBtn.TextSize = 18
citiesBtn.Text = "Cities (C)"
citiesBtn.Parent = cluster
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = citiesBtn
end
citiesBtn.Activated:Connect(function()
	if ClientState.view ~= nil then
		ClientState.toggleCityList()
	end
end)

-- R12 (2): government button — panel hosts the rate steppers (and later
-- the government switch). Run-4 live request: sits LEFT of Research.
local governmentBtn = Instance.new("TextButton")
governmentBtn.LayoutOrder = 0
governmentBtn.Size = UDim2.new(0, 150, 0, 38)
governmentBtn.BackgroundColor3 = DISABLED
governmentBtn.TextColor3 = Color3.fromRGB(235, 235, 235)
governmentBtn.Font = Enum.Font.SourceSansBold
governmentBtn.TextSize = 18
governmentBtn.Text = "Government"
governmentBtn.Parent = cluster
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = governmentBtn
end

local function selectedUnit()
	local view = ClientState.view
	if view == nil or ClientState.selectedUnitId == nil then
		return nil
	end
	local u = view.units[ClientState.selectedUnitId]
	if u ~= nil and u.owner == view.you then
		return u
	end
	return nil
end

local function ownCityCount(view)
	local n = 0
	for _, c in pairs(view.cities) do
		if c.owner == view.you then
			n += 1
		end
	end
	return n
end

-- R7a (4): view-side legality PRECHECK — grey + dead when the action can't
-- apply to the selected unit (A29 pattern: display-only, the server still
-- judges the real rules at command time)
local function onLandTile(u)
	local view = ClientState.view
	local tile = view.map.tiles[u.y * view.map.width + u.x + 1]
	local terr = tile and ClientState.rulesets().terrain.terrains[tile.t]
	return terr ~= nil and terr.domain == "land"
end

local function can(action)
	if not ClientState.myTurn() then
		return false
	end
	local u = selectedUnit()
	if action == "research" then
		return true
	end
	if u == nil then
		return false
	end
	if action == "disband" then
		return true
	end
	if action == "fortify" or action == "wait" then
		return u.moves > 0 and u.fortified ~= true
	end
	if action == "pillage" then -- CP3: any unit with moves; server judges the tile
		return u.moves > 0
	end
	if action == "trade" then -- CP17: caravan-flagged types only (rs overlay)
		local def = ClientState.rulesets().units[u.type]
		return def ~= nil and def.tradeRoutes == true
	end
	if action == "upgrade" then -- CP18: upgradesTo exists + standing in an own city
		local rs = ClientState.rulesets()
		local def = rs.units[u.type]
		if def == nil or def.upgradesTo == nil then
			return false
		end
		local view = ClientState.view
		for _, c in pairs(view.cities) do
			if c.owner == view.you and c.x == u.x and c.y == u.y then
				return true
			end
		end
		return false
	end
	-- settlers jobs: found / irrigate / mine / road / possess-shaped
	if action == "possess" then
		return true
	end
	if u.type ~= "settlers" or u.moves <= 0 then
		return false
	end
	if action == "found" then
		return true
	end
	return onLandTile(u) -- irrigate / mine / road
end

-- ---- actions (commands only; the precheck gates the SEND, the server
-- still judges the real rules) ------------------------------------------------
local function doFound()
	if not can("found") then
		return
	end
	local u = selectedUnit()
	local name = "Colony " .. (ownCityCount(ClientState.view) + 1)
	print(("[ActionBar] found city '%s' with %s"):format(name, u.id))
	ClientState.send({ type = "foundCity", unitId = u.id, name = name })
end

local function doUnitCmd(cmdType)
	if not can(cmdType) then
		return
	end
	local u = selectedUnit()
	print(("[ActionBar] %s %s"):format(cmdType, u.id))
	ClientState.send({ type = cmdType, unitId = u.id })
end

-- settlers job on the stood-on tile; the server judges terrain/tech/dupes
local function doWork(work)
	if not can(work) then
		return
	end
	local u = selectedUnit()
	print(("[ActionBar] startWork %s %s"):format(work, u.id))
	ClientState.send({ type = "startWork", unitId = u.id, work = work })
end

foundBtn.Activated:Connect(doFound)
fortifyBtn.Activated:Connect(function()
	doUnitCmd("fortify")
end)
waitBtn.Activated:Connect(function()
	doUnitCmd("wait")
end)
disbandBtn.Activated:Connect(function()
	doUnitCmd("disband")
end)
irrigateBtn.Activated:Connect(function()
	doWork("irrigate")
end)
mineBtn.Activated:Connect(function()
	doWork("mine")
end)
fortBtn.Activated:Connect(function()
	doWork("fortress")
end)
tradeBtn.Activated:Connect(function()
	if can("trade") then
		local u = selectedUnit()
		print("[ActionBar] establishTradeRoute " .. u.id)
		ClientState.send({ type = "establishTradeRoute", unitId = u.id })
	end
end)
upgradeBtn.Activated:Connect(function()
	if can("upgrade") then
		local u = selectedUnit()
		print("[ActionBar] upgradeUnit " .. u.id)
		ClientState.send({ type = "upgradeUnit", unitId = u.id })
	end
end)
pillageBtn.Activated:Connect(function()
	if can("pillage") then
		local u = selectedUnit()
		print("[ActionBar] pillage " .. u.id)
		ClientState.send({ type = "pillage", unitId = u.id })
	end
end)
roadBtn.Activated:Connect(function()
	doWork("road")
end)
researchBtn.Activated:Connect(function()
	if ClientState.view ~= nil then -- session-E: dead on the deck
		ClientState.openResearch()
	end
end)
governmentBtn.Activated:Connect(function()
	if ClientState.view ~= nil then
		ClientState.openGovernment()
	end
end)
gotoBtn.Activated:Connect(function()
	if ClientState.view ~= nil then
		GoToPlan.arm() -- toggles target-pick; the next map click is the target
	end
end)
possessBtn.Activated:Connect(function()
	-- R12 (6): the button IS the P toggle now — ride the selected unit or
	-- dismount; Possess.client.luau owns the mode (nil request = dismount)
	if ClientState.possessedUnitId ~= nil then
		ClientState.requestPossess(nil)
	elseif ClientState.selectedUnitId ~= nil then
		ClientState.requestPossess(ClientState.selectedUnitId)
	else
		print("[ActionBar] select one of your units first (or press N)")
	end
end)

-- ---- context refresh (selection isn't evented; cheap per-frame compare).
-- R7b (11): the Research button BLINKS while research is unset on your turn
-- (the blink phase joins the key so the repaint keeps ticking).
local BLINK = Color3.fromRGB(90, 160, 235)
researchBtn.BackgroundColor3 = DISABLED -- session-E: grey until a game exists
governmentBtn.BackgroundColor3 = DISABLED

-- session-E: unset research nudges ONCE PER TURN — a notification + a
-- bounded 5 s blink burst. Round 7 (user): the note sits slightly ABOVE
-- CENTER, and the whole surface — note frame+font AND the Research
-- button frame+font — swaps colour once a second for the burst.
local researchNote = Instance.new("TextLabel")
researchNote.Size = UDim2.new(0, 380, 0, 38)
researchNote.Position = UDim2.new(0.5, -190, 0.5, -130)
researchNote.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
researchNote.BackgroundTransparency = 0.15
researchNote.TextColor3 = Color3.fromRGB(140, 200, 255)
researchNote.Font = Enum.Font.SourceSansBold
researchNote.TextSize = 22
researchNote.Text = "Select research (T)"
researchNote.Visible = false
researchNote.Parent = gui
local NOTE_BG = researchNote.BackgroundColor3
local NOTE_FG = researchNote.TextColor3
local DARK_FG = Color3.fromRGB(18, 22, 30)
local PLAIN_FG = Color3.fromRGB(235, 235, 235)

local blinkBurstUntil = 0 -- 5 blinks at the 1 Hz phase = a 5s window
local lastNudgeTurn = -1
ClientState.onView(function(view)
	local me = view.players[view.you]
	if ClientState.myTurn() and me ~= nil and me.researching == nil
		and view.turn ~= lastNudgeTurn then
		lastNudgeTurn = view.turn
		blinkBurstUntil = os.clock() + 5
		researchNote.Visible = true
		task.delay(5, function()
			researchNote.Visible = false
		end)
	end
end)

-- R12 (5): "researching: <tech> · ~N turns" from the same read-only engine
-- math as the picker (cost via tech.researchCost, bulbs/turn via
-- tech.playerIncome on a view shim, pcall — presentational only)
local function researchLine(view, me)
	if me.researching == nil then
		return ClientState.myTurn() and "no research set!" or ""
	end
	local rs = ClientState.rulesets()
	local def = rs.techs[me.researching]
	local line = "researching: " .. (def and def.name or me.researching)
	local cost = techModule.researchCost({ players = { [view.you] = me } }, view.you, rs)
	local shim = { players = view.players, cities = view.cities,
		cityOrder = view.cityOrder, map = view.map }
	local ok, income = pcall(techModule.playerIncome, shim, view.you, rs)
	if ok and income ~= nil and (income.bulbs or 0) > 0 then
		line ..= (" - %d turns"):format(math.ceil(math.max(0, cost - (me.bulbs or 0)) / income.bulbs))
	end
	return line
end

local lastKey = nil
RunService.Heartbeat:Connect(function()
	local view = ClientState.view
	local u = selectedUnit()
	local me = view and view.players[view.you]
	-- session-E: the blink is a bounded 5-cycle burst per turn (set above),
	-- not the old endless flash
	local needBlink = ClientState.myTurn() and me ~= nil and me.researching == nil
		and os.clock() < blinkBurstUntil
	-- once-a-second colour swap (user spec), not the old 2 Hz flash
	local phase = needBlink and (math.floor(os.clock()) % 2) or 0
	local mounted = ClientState.possessedUnitId ~= nil
	local key = (view and view.turn or -1) .. "|" .. tostring(u and u.id) .. "|"
		.. tostring(u and u.moves) .. "|" .. tostring(ClientState.myTurn())
		.. "|" .. tostring(needBlink) .. phase .. "|" .. tostring(mounted)
		.. "|" .. tostring(me and me.researching) .. "|" .. tostring(me and me.bulbs)
		.. "|" .. tostring(GoToPlan.armed)
	if key == lastKey then
		return
	end
	lastKey = key
	-- session-E: on the deck (no game) EVERYTHING greys and goes dead —
	-- the can() gates below already return false with no view, and the
	-- research/government activations check the view too
	possessBtn.Text = mounted and "Dismount (P)" or "Ride (P)"
	if me ~= nil then
		researchStatus.Text = researchLine(view, me)
	else
		researchStatus.Text = ""
	end
	governmentBtn.BackgroundColor3 = view ~= nil and ENABLED or DISABLED
	citiesBtn.BackgroundColor3 = view ~= nil and ENABLED or DISABLED
	foundBtn.BackgroundColor3 = can("found") and ENABLED or DISABLED
	irrigateBtn.BackgroundColor3 = can("irrigate") and ENABLED or DISABLED
	mineBtn.BackgroundColor3 = can("mine") and ENABLED or DISABLED
	roadBtn.BackgroundColor3 = can("road") and ENABLED or DISABLED
	fortBtn.BackgroundColor3 = can("fortress") and ENABLED or DISABLED
	pillageBtn.BackgroundColor3 = can("pillage") and ENABLED or DISABLED
	tradeBtn.BackgroundColor3 = can("trade") and ENABLED or DISABLED
	if can("upgrade") then
		local su = selectedUnit()
		local cost = upgradeModule.upgradeCost(su, ClientState.rulesets())
		upgradeBtn.Text = cost ~= nil and ("Upg %dg"):format(cost) or "Upgrade"
		upgradeBtn.BackgroundColor3 = ENABLED
	else
		upgradeBtn.Text = "Upgrade"
		upgradeBtn.BackgroundColor3 = DISABLED
	end
	fortifyBtn.BackgroundColor3 = can("fortify") and ENABLED or DISABLED
	waitBtn.BackgroundColor3 = can("wait") and ENABLED or DISABLED
	-- armed target-pick shows gold; otherwise enabled like Wait (any movable unit)
	gotoBtn.BackgroundColor3 = GoToPlan.armed and Color3.fromRGB(230, 185, 60)
		or (can("wait") and ENABLED or DISABLED)
	disbandBtn.BackgroundColor3 = can("disband") and ENABLED or DISABLED
	possessBtn.BackgroundColor3 = can("possess") and ENABLED or DISABLED
	if needBlink then
		local hot = phase == 0
		researchBtn.BackgroundColor3 = hot and BLINK or ENABLED
		researchBtn.TextColor3 = hot and DARK_FG or PLAIN_FG
		researchNote.BackgroundColor3 = hot and BLINK or NOTE_BG
		researchNote.TextColor3 = hot and DARK_FG or NOTE_FG
	else
		researchBtn.TextColor3 = PLAIN_FG
		researchNote.BackgroundColor3 = NOTE_BG
		researchNote.TextColor3 = NOTE_FG
		researchBtn.BackgroundColor3 = can("research") and ENABLED or DISABLED
	end
end)

-- ---- hotkeys ----------------------------------------------------------------
UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil then
		return
	end
	if input.KeyCode == Enum.KeyCode.O then -- runI item 23: fortify moved G->O (G is now GoTo)
		doUnitCmd("fortify")
	elseif input.KeyCode == Enum.KeyCode.Space then
		doUnitCmd("wait")
	elseif input.KeyCode == Enum.KeyCode.X then
		doUnitCmd("disband")
	elseif input.KeyCode == Enum.KeyCode.I then
		doWork("irrigate")
	elseif input.KeyCode == Enum.KeyCode.M then
		doWork("mine")
	elseif input.KeyCode == Enum.KeyCode.R then
		doWork("road")
	end
end)

print("[ActionBar] action bar up (O fortify, Space wait, X disband, I/M/R work, P ride/dismount; cluster: research + government)")
