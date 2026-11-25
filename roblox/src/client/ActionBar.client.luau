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
local BarFit = require(script.Parent:WaitForChild("BarFit")) -- where the bottom bar stands per viewport width
local EmpireView = require(script.Parent:WaitForChild("EmpireView"))
local GoToPlan = require(script.Parent:WaitForChild("GoToPlan")) -- round 20
local UnitOrders = require(script.Parent:WaitForChild("UnitOrders")) -- plan step 3: which orders, labels, reasons
local Tooltip = require(script.Parent:WaitForChild("Tooltip"))
local SettlerJobs = require(script.Parent:WaitForChild("SettlerJobs"))
local TourPlan = require(script.Parent:WaitForChild("TourPlan"))
local DiplomatMissions = require(script.Parent:WaitForChild("DiplomatMissions"))
local Motion = require(script.Parent:WaitForChild("Motion"))
local ORDER_DEPS = { improvements = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("improvements")) }
local FoundCity = require(script.Parent:WaitForChild("FoundCity")) -- F1 name prompt
local techModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("tech"))
local upgradeModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("upgrade")) -- CP18

local gui = Instance.new("ScreenGui")
gui.Name = "RMCActionBar"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

-- session-E: buttons sized like CLOSE CITY VIEW (big, bold, rounded)
local bar = Instance.new("Frame")
-- U4: the bar is as wide as its buttons and scales down to the room between
-- the bottom-left toggles and End Turn (it was a fixed 1436 px frame that ran
-- off any viewport narrower than that)
bar.AutomaticSize = Enum.AutomaticSize.X
bar.Size = UDim2.new(0, 0, 0, 50)
bar.AnchorPoint = Vector2.new(0.5, 1)
bar.Position = UDim2.new(0.5, 0, 1, -8)
local barScale = Instance.new("UIScale")
barScale.Parent = bar
local fitBar = nil -- set below; the phone filter calls it
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
do
	local function fit()
		local cam = workspace.CurrentCamera
		if cam == nil then
			return
		end
		-- the natural width from the buttons' own offsets (independent of the
		-- current scale, so a refit can never feed on itself)
		local natural, n = 0, 0
		for _, c in ipairs(bar:GetChildren()) do
			if c:IsA("GuiObject") and c.Visible then
				natural += c.Size.X.Offset
				n += 1
			end
		end
		if n == 0 then
			return
		end
		natural += (n - 1) * layout.Padding.Offset
		local plan = BarFit.plan(cam.ViewportSize.X, natural)
		barScale.Scale = plan.scale
		bar.Position = UDim2.new(0.5, 0, 1, -BarFit.BOTTOM - plan.lift)
	end
	bar.ChildAdded:Connect(function()
		task.defer(fit)
	end)
	task.spawn(function()
		while workspace.CurrentCamera == nil do
			task.wait(0.2)
		end
		workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(fit)
		fit()
	end)
	fitBar = fit
end

-- runI item 22: widen the enabled/disabled contrast so an inapplicable action
-- reads clearly as grayed-out (a live action is a lit blue; disabled is a flat,
-- near-black gray). The can()-gate already blocks the send + colors every button.
local UiTheme = require(script.Parent:WaitForChild("UiTheme")) -- U1 chunky dress
local ENABLED = UiTheme.COLOR.menu
local DISABLED = Color3.fromRGB(46, 50, 60)

local ICON_ROOM = 26
local buttons = {}
local function addButton(order, text, width, icon)
	local b = Instance.new("TextButton")
	-- U4: an icon takes ~28 px of the face; the button grows so the label keeps its room
	b.Size = UDim2.new(0, math.floor(width * 1.3) + (icon ~= nil and ICON_ROOM or 0), 0, 40)
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
	UiTheme.apply(b, { icon = icon })
	table.insert(buttons, b)
	-- U3b: a phone has no room for greyed-out verbs — one that cannot apply
	-- is hidden there (desktop keeps the stable greyed row)
	local function phoneFilter()
		local show = not UiTheme.phone() or b.BackgroundColor3 ~= DISABLED
		if b.Visible ~= show then
			b.Visible = show
			if fitBar ~= nil then
				fitBar()
			end
		end
	end
	b:GetPropertyChangedSignal("BackgroundColor3"):Connect(phoneFilter)
	task.spawn(function()
		while workspace.CurrentCamera == nil do
			task.wait(0.2)
		end
		workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(phoneFilter)
		phoneFilter()
	end)
	return b
end

-- session-E round 14 (user): the selected tile's friendly units get TAB
-- CARDS just above the action bar — ALWAYS shown for the selected/ridden
-- unit (round 17: even alone), name + Attack/Defense/Moves per card,
-- active unit highlighted; click selects (mounted: rides) it.
local stackBar = Instance.new("Frame")
stackBar.Size = UDim2.new(0, 940, 0, 38)
-- phone: the 940 px card row follows the action bar's own fit (bottom-centre
-- anchored, so it shrinks toward the bar instead of off both screen edges)
stackBar.AnchorPoint = Vector2.new(0.5, 1)
stackBar.Position = UDim2.new(0.5, 0, 1, -62)
stackBar.BackgroundTransparency = 1
stackBar.Parent = gui
local stackScale = Instance.new("UIScale")
stackScale.Parent = stackBar
task.spawn(function()
	while workspace.CurrentCamera == nil do
		task.wait(0.2)
	end
	local function fitStack()
		local vw = workspace.CurrentCamera.ViewportSize.X
		stackScale.Scale = math.clamp((vw - 16) / 940, 0.5, 1)
		-- the cards sit on top of the (also scaled) action bar
		stackBar.Position = UDim2.new(0.5, 0, 1, -(8 + math.floor(40 * barScale.Scale + 0.5) + 14))
	end
	workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(fitStack)
	barScale:GetPropertyChangedSignal("Scale"):Connect(fitStack)
	fitStack()
end)
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
		zz.Size = UDim2.new(0, 30, 0, 18)
		zz.Position = UDim2.new(1, -32, 0, 2)
		zz.BackgroundColor3 = ClientState.sentried[id] == true
			and Color3.fromRGB(90, 90, 150) or Color3.fromRGB(40, 44, 58)
		zz.TextColor3 = Color3.fromRGB(200, 210, 235)
		zz.Font = Enum.Font.GothamBold
		zz.TextSize = 14
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
			au.Size = UDim2.new(0, 30, 0, 18)
			au.Position = UDim2.new(1, -64, 0, 2)
			au.BackgroundColor3 = ClientState.autoSettlers[id] == true
				and Color3.fromRGB(70, 130, 90) or Color3.fromRGB(40, 44, 58)
			au.TextColor3 = Color3.fromRGB(210, 235, 215)
			au.Font = Enum.Font.GothamBold
			au.TextSize = 14
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

local foundBtn = addButton(1, "Found (B)", 90, "found")
local fortifyBtn = addButton(2, "Fortify (O)", 90, "fortify")
local waitBtn = addButton(3, "Wait (Spc)", 90, "wait")
-- session-E round 20 (user): GoTo as a visible action — arms the same
-- target-pick the G key uses; the plan then marches MULTI-TURN by design
-- (GoToPlan re-plans and steps every turn until arrival)
local gotoBtn = addButton(4, "GoTo (G)", 80, "goto")
local disbandBtn = addButton(5, "Disband (X)", 100, "disband")
local irrigateBtn = addButton(6, "Irr (I)", 70, "irrigate")
local mineBtn = addButton(7, "Mine (M)", 70, "mine")
local roadBtn = addButton(8, "Road (R)", 70, "road")
-- CP3 (catalog): fortress + pillage complete the browser action set —
-- fortress is a startWork like irrigate/mine/road (tech-gated, server
-- judges); pillage strips the stood-on tile's improvement
local fortBtn = addButton(9, "Fort", 60, "fort")
local pillageBtn = addButton(10, "Pillage", 76, "pillage")
-- CP17 (marker-0052): caravans establish trade routes standing in a city;
-- the engine judges the nine rejections (red banners explain)
local tradeBtn = addButton(11, "Trade", 66, "trade")
-- CP18 (marker-0055/browser 6f30a46): paid unit upgrade IN an own city;
-- the button carries the live upgradeCost price
-- plan step 3.1: a caravan in a city building a wonder adds its shields (H);
-- the button stands in the bar only for a unit that can help
local helpBtn = addButton(12, "Help Wonder", 120, "trade")
local upgradeBtn = addButton(13, "Upgrade", 82, "upgrade")
local possessBtn = addButton(14, "Ride (P)", 80, "ride")
-- uo-15 (plan R2.1): what automation favours, cycled Balanced / Food /
-- Shield / Trade; in the bar only while the selected settler is automated
local priorityBtn = addButton(15, "Auto: Balanced", 104, nil)
-- plan R3: a Diplomat beside a rival city or unit opens its mission picker
local spyBtn = addButton(16, "Missions", 84, nil)

-- R7a (6): research leaves the unit bar for a top-center cluster (slots
-- reserved for diplomacy later). R12 (2)(5): Government joins it, and a
-- live research-status line sits beside the Research button.
local cluster = Instance.new("Frame")
-- run-R (user): the cluster sits in the Roblox top bar strip, as wide as its
-- buttons; the research-status line moved from above it to just below
-- (the inset reads 0 while the client is still loading: shot4 had the cluster
-- at y=4 with the menu row already in the strip, so it is re-read below)
local function clusterTop()
	local topInset = game:GetService("GuiService"):GetGuiInset().Y
	return topInset >= 54 and (-topInset + math.floor((topInset - 46) / 2)) or 4
end
local clusterY = clusterTop()
cluster.Size = UDim2.new(0, 0, 0, 46)
cluster.AutomaticSize = Enum.AutomaticSize.X
cluster.AnchorPoint = Vector2.new(0.5, 0)
cluster.Position = UDim2.new(0.5, 0, 0, clusterY)
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 12)
	c.Parent = cluster
	local p = Instance.new("UIPadding")
	p.PaddingLeft = UDim.new(0, 6)
	p.PaddingRight = UDim.new(0, 6)
	p.Parent = cluster
end
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
researchBtn.Size = UDim2.new(0, 166, 0, 38)
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
UiTheme.apply(researchBtn, { icon = "research" })
local clusterButtons = {} -- { btn, fullW }: the top row, placed by placeCluster below
local function joinCluster(btn)
	table.insert(clusterButtons, { btn = btn, fullW = btn.Size.X.Offset })
end

-- R12 (5): always-visible research status (tech + turns remaining). run-F #10
-- (user): moved OUT of the button row to a centered line just ABOVE it, so
-- "current research" reads clearly over the Research/Cities buttons.
local researchStatus = Instance.new("TextLabel")
-- run-R (user, shot6): 17 px with no backing was hard to read over the map —
-- a 20 px chip as wide as its text, hidden while empty
researchStatus.Size = UDim2.new(0, 0, 0, 32)
researchStatus.AutomaticSize = Enum.AutomaticSize.X
researchStatus.AnchorPoint = Vector2.new(0.5, 0)
researchStatus.Position = UDim2.new(0.5, 0, 0, clusterY + 52)
researchStatus.BackgroundColor3 = Color3.fromRGB(20, 24, 34)
researchStatus.BackgroundTransparency = 0.15
researchStatus.BorderSizePixel = 0
researchStatus.Visible = false
researchStatus.TextColor3 = Color3.fromRGB(190, 222, 255)
researchStatus.Font = Enum.Font.GothamBold
researchStatus.TextSize = 20
researchStatus.TextXAlignment = Enum.TextXAlignment.Center
researchStatus.Text = ""
researchStatus.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 10)
	c.Parent = researchStatus
	local p = Instance.new("UIPadding")
	p.PaddingLeft, p.PaddingRight = UDim.new(0, 14), UDim.new(0, 14)
	p.Parent = researchStatus
	researchStatus:GetPropertyChangedSignal("Text"):Connect(function()
		researchStatus.Visible = researchStatus.Text ~= ""
	end)
end
-- step 0.3: the row follows TopRowPlan (labels, icon squares, pushed left,
-- or a second row) so it never shares pixels with the turn chip or the menu
-- row. placeCluster is re-run on every viewport change; the buttons join
-- `clusterButtons` as they are built.
local TopRowPlan = require(script.Parent:WaitForChild("TopRowPlan"))
local lastPlanKey = nil
local function placeCluster()
	local cam = workspace.CurrentCamera
	local vw = cam ~= nil and cam.ViewportSize.X or 1280
	local plan = vw >= 320 and TopRowPlan.plan(vw) or { compact = false, align = "centre", x = 0, row = 0 }
	local y = clusterY + plan.row * TopRowPlan.ROW_STEP
	for _, cb in ipairs(clusterButtons) do
		UiTheme.setCompact(cb.btn, plan.compact)
		cb.btn.Size = UDim2.new(0, plan.compact and TopRowPlan.COMPACT_W or cb.fullW, 0, 38)
	end
	if plan.align == "left" then
		cluster.AnchorPoint = Vector2.new(0, 0)
		cluster.Position = UDim2.new(0, plan.x, 0, y)
	else
		cluster.AnchorPoint = Vector2.new(0.5, 0)
		cluster.Position = UDim2.new(0.5, 0, 0, y)
	end
	researchStatus.Position = UDim2.new(0.5, 0, 0, y + 52)
	local key = ("%s/%s/%d"):format(plan.compact and "icons" or "labels", plan.align, plan.row)
	if key ~= lastPlanKey then
		lastPlanKey = key
		require(script.Parent:WaitForChild("Diag")).note("toprow", ("%s at viewport width %d"):format(key, math.floor(vw)))
	end
end
task.spawn(function()
	for _ = 1, 20 do
		local y = clusterTop()
		if y ~= clusterY then
			clusterY = y
		end
		placeCluster()
		task.wait(0.5)
	end
	local cam = workspace.CurrentCamera
	if cam ~= nil then
		cam:GetPropertyChangedSignal("ViewportSize"):Connect(placeCluster)
	end
end)

-- session-E round 18 (user): Cities button, LEFT of Government + Research —
-- the C hotkey's clickable twin (ClientState.toggleCityList channel)
local citiesBtn = Instance.new("TextButton")
citiesBtn.LayoutOrder = -1
citiesBtn.Size = UDim2.new(0, 136, 0, 38)
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
UiTheme.apply(citiesBtn, { icon = "cities" })
joinCluster(researchBtn)
joinCluster(citiesBtn)
citiesBtn.Activated:Connect(function()
	if ClientState.view ~= nil then
		ClientState.toggleCityList()
	end
end)

-- 2026-11-15 (user): Statistics had no button (J only) and there was no
-- military overview. Both sit right of Government.
local function clusterButton(order, w, label, icon, onClick)
	local b = Instance.new("TextButton")
	b.LayoutOrder = order
	b.Size = UDim2.new(0, w, 0, 38)
	b.BackgroundColor3 = DISABLED
	b.TextColor3 = Color3.fromRGB(235, 235, 235)
	b.Font = Enum.Font.GothamBold
	b.TextSize = 18
	b.Text = label
	b.Parent = cluster
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = b
	UiTheme.apply(b, { icon = icon })
	joinCluster(b)
	b.Activated:Connect(function()
		if ClientState.view ~= nil then
			onClick()
		end
	end)
	return b
end
local militaryBtn = clusterButton(2, 136, "Military", "military", function()
	ClientState.toggleMilitary()
end)
local statsBtn = clusterButton(3, 170, "Statistics (J)", "stats", function()
	ClientState.toggleStats(nil)
end)

-- R12 (2): government button — panel hosts the rate steppers (and later
-- the government switch). Run-4 live request: sits LEFT of Research.
local governmentBtn = Instance.new("TextButton")
governmentBtn.LayoutOrder = 0
governmentBtn.Size = UDim2.new(0, 170, 0, 38)
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
UiTheme.apply(governmentBtn, { icon = "government" })
joinCluster(governmentBtn)

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

-- R7a (4): view-side legality PRECHECK — grey + dead when the action can't
-- apply to the selected unit (A29 pattern: display-only, the server still
-- judges the real rules at command time)
local function onLandTile(u)
	local view = ClientState.view
	local tile = view.map.tiles[u.y * view.map.width + u.x + 1]
	local terr = tile and ClientState.rulesets().terrain.terrains[tile.t]
	return terr ~= nil and terr.domain == "land"
end

-- plan step 3: the rules live in UnitOrders (enabled, reason, label, work)
local function orderOf(action)
	local view = ClientState.view
	local u = view ~= nil and selectedUnit() or nil
	return UnitOrders.order(action, view, u, ClientState.rulesets(), {
		myTurn = ClientState.myTurn(),
		hasPlan = u ~= nil and GoToPlan.hasPlan(u.id),
		armed = GoToPlan.armed,
	}, ORDER_DEPS)
end
local function can(action)
	if action == "research" then
		return ClientState.myTurn()
	end
	return orderOf(action).enabled
end

-- ---- actions (commands only; the precheck gates the SEND, the server
-- still judges the real rules) ------------------------------------------------
local function doFound()
	if not can("found") then
		return
	end
	FoundCity.prompt(selectedUnit().id) -- F1: the name prompt sends the command
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
	work = orderOf(work).work or work -- the road button builds rails on a roaded tile
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
-- plan step 3.4: Disband asks once more — the first press arms the button
-- ("Sure? (X)"), a second inside UnitOrders.CONFIRM_WINDOW sends
local disbandArmed = { id = nil, at = nil }
local function doDisband()
	if not can("disband") then
		return
	end
	local u = selectedUnit()
	if UnitOrders.disbandPress(disbandArmed.id, disbandArmed.at, u.id, os.clock()) == "send" then
		disbandArmed.id, disbandArmed.at = nil, nil
		doUnitCmd("disband")
		return
	end
	disbandArmed.id, disbandArmed.at = u.id, os.clock()
	print("[ActionBar] disband armed for " .. u.id)
	task.delay(UnitOrders.CONFIRM_WINDOW, function()
		if disbandArmed.id == u.id and os.clock() - disbandArmed.at >= UnitOrders.CONFIRM_WINDOW then
			disbandArmed.id, disbandArmed.at = nil, nil
		end
	end)
end
disbandBtn.Activated:Connect(doDisband)
local function doHelpWonder()
	if can("helpWonder") then
		local u = selectedUnit()
		print("[ActionBar] helpWonder " .. u.id)
		ClientState.send({ type = "helpWonder", unitId = u.id })
	end
end
helpBtn.Activated:Connect(doHelpWonder)
-- plan R3: the mission picker - one button per mission with its price; a
-- paid mission asks once more ("Pay N gold?") before it is sent
local picker = Instance.new("Frame")
picker.Name = "DiplomatPicker"
picker.AnchorPoint = Vector2.new(0.5, 1)
picker.Position = UDim2.new(0.5, 0, 1, -120)
picker.Size = UDim2.new(0, 360, 0, 0)
picker.AutomaticSize = Enum.AutomaticSize.Y
picker.BackgroundColor3 = Color3.fromRGB(22, 26, 36)
picker.BorderSizePixel = 0
picker.Visible = false
picker.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 10)
	c.Parent = picker
	local pad = Instance.new("UIPadding")
	pad.PaddingTop, pad.PaddingBottom = UDim.new(0, 8), UDim.new(0, 8)
	pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 8), UDim.new(0, 8)
	pad.Parent = picker
	local lay = Instance.new("UIListLayout")
	lay.Padding = UDim.new(0, 4)
	lay.SortOrder = Enum.SortOrder.LayoutOrder
	lay.Parent = picker
end
local pickerArmed = nil -- mission id waiting for its second click
local function closePicker()
	picker.Visible = false
	pickerArmed = nil
end
local function openPicker()
	local u = selectedUnit()
	local view = ClientState.view
	local menu = (u ~= nil and view ~= nil) and DiplomatMissions.menu(view, u, ClientState.rulesets()) or {}
	for _, ch in ipairs(picker:GetChildren()) do
		if ch:IsA("GuiObject") then
			ch:Destroy()
		end
	end
	if #menu == 0 then
		closePicker()
		return menu
	end
	local head = Instance.new("TextLabel")
	head.LayoutOrder = 0
	head.Size = UDim2.new(1, 0, 0, 24)
	head.BackgroundTransparency = 1
	head.TextColor3 = Color3.fromRGB(255, 225, 130)
	head.Font = UiTheme.FONT
	head.TextSize = 18
	head.TextXAlignment = Enum.TextXAlignment.Left
	head.Text = "Diplomat beside " .. tostring(menu[1].targetName)
	head.Parent = picker
	for i, m in ipairs(menu) do
		local b = Instance.new("TextButton")
		b.Name = "Mission_" .. m.id
		b.LayoutOrder = i
		b.Size = UDim2.new(1, 0, 0, 34)
		b.BorderSizePixel = 0
		b.Font = Enum.Font.GothamBold
		b.TextSize = 16
		b.TextColor3 = m.affordable and Color3.fromRGB(240, 240, 240) or Color3.fromRGB(140, 140, 150)
		b.BackgroundColor3 = pickerArmed == m.id and Color3.fromRGB(150, 60, 50)
			or (m.affordable and ENABLED or DISABLED)
		b.Text = pickerArmed == m.id and ("Pay %d gold? Click again"):format(m.cost) or DiplomatMissions.buttonText(m)
		b.Parent = picker
		local c = Instance.new("UICorner")
		c.CornerRadius = UDim.new(0, 8)
		c.Parent = b
		Tooltip.attach(b, function()
			return m.title .. (m.affordable and "" or "\nNot enough gold."), "card"
		end)
		b.Activated:Connect(function()
			if not m.affordable then
				return
			end
			if m.cost ~= nil and pickerArmed ~= m.id then
				pickerArmed = m.id
				openPicker()
				return
			end
			print(("[ActionBar] diplomatMission %s %s"):format(m.id, m.cmd.unitId))
			ClientState.send(m.cmd)
			closePicker()
		end)
	end
	picker.Visible = true
	return menu
end
spyBtn.Activated:Connect(function()
	if picker.Visible then
		closePicker()
	else
		openPicker()
	end
end)

priorityBtn.Activated:Connect(function()
	ClientState.autoPriority = SettlerJobs.nextPriority(ClientState.autoPriority)
	print("[ActionBar] automation priority: " .. ClientState.autoPriority)
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
local function doGoto()
	local u = ClientState.view ~= nil and selectedUnit() or nil
	if u ~= nil and GoToPlan.hasPlan(u.id) then
		GoToPlan.cancel(u.id) -- plan step 3.2: the button reads "Cancel route" meanwhile
	elseif ClientState.view ~= nil then
		GoToPlan.arm() -- toggles target-pick; the next map click is the target
	end
end
gotoBtn.Activated:Connect(doGoto)
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
	local shim = EmpireView.shim(view) -- own cities only: rival shells break playerIncome
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
	local needBlink = Motion.blink(ClientState.options) and ClientState.myTurn() and me ~= nil and me.researching == nil
		and os.clock() < blinkBurstUntil
	-- once-a-second colour swap (user spec), not the old 2 Hz flash
	local phase = needBlink and (math.floor(os.clock()) % 2) or 0
	local mounted = ClientState.possessedUnitId ~= nil
	local key = (view and view.turn or -1) .. "|" .. tostring(u and u.id) .. "|"
		.. tostring(u and u.moves) .. "|" .. tostring(ClientState.myTurn())
		.. "|" .. tostring(needBlink) .. phase .. "|" .. tostring(mounted)
		.. "|" .. tostring(me and me.researching) .. "|" .. tostring(me and me.bulbs)
		.. "|" .. tostring(GoToPlan.armed)
		.. "|" .. tostring(u and u.x) .. "," .. tostring(u and u.y) .. "|" .. tostring(u and GoToPlan.hasPlan(u.id))
		.. "|" .. tostring(disbandArmed.id) .. "|" .. tostring(me and me.techs and #me.techs)
		.. "|" .. tostring(u and ClientState.autoSettlers[u.id]) .. ClientState.autoPriority
		.. "|" .. tostring(me and me.gold)
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
	militaryBtn.BackgroundColor3 = view ~= nil and ENABLED or DISABLED
	statsBtn.BackgroundColor3 = view ~= nil and ENABLED or DISABLED
	foundBtn.BackgroundColor3 = can("found") and ENABLED or DISABLED
	-- plan step 3.3: the label follows the tile (Clear / Drain, Plant, Rail)
	local irr, mine, road = orderOf("irrigate"), orderOf("mine"), orderOf("road")
	irrigateBtn.Text = irr.label or "Irr (I)"
	mineBtn.Text = mine.label or "Mine (M)"
	roadBtn.Text = road.label or "Road (R)"
	irrigateBtn.BackgroundColor3 = irr.enabled and ENABLED or DISABLED
	mineBtn.BackgroundColor3 = mine.enabled and ENABLED or DISABLED
	roadBtn.BackgroundColor3 = road.enabled and ENABLED or DISABLED
	local help = orderOf("helpWonder")
	helpBtn.Text = help.label or "Help Wonder"
	helpBtn.BackgroundColor3 = help.enabled and ENABLED or DISABLED
	if (helpBtn.Parent ~= nil) ~= help.shown then
		helpBtn.Parent = help.shown and bar or nil
		if fitBar ~= nil then
			fitBar()
		end
	end
	local spyShown = u ~= nil and u.type == "diplomat" and view ~= nil
		and #DiplomatMissions.menu(view, u, ClientState.rulesets()) > 0
	spyBtn.BackgroundColor3 = spyShown and ENABLED or DISABLED
	if (spyBtn.Parent ~= nil) ~= spyShown then
		spyBtn.Parent = spyShown and bar or nil
		if fitBar ~= nil then
			fitBar()
		end
	end
	if not spyShown and picker.Visible then
		closePicker()
	end
	local autoShown = u ~= nil and ClientState.autoSettlers[u.id] == true
	priorityBtn.Text = "Auto: " .. SettlerJobs.LABELS[ClientState.autoPriority]
	priorityBtn.BackgroundColor3 = autoShown and ENABLED or DISABLED
	if (priorityBtn.Parent ~= nil) ~= autoShown then
		priorityBtn.Parent = autoShown and bar or nil
		if fitBar ~= nil then
			fitBar()
		end
	end
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
	local gotoOrder = orderOf("goto")
	gotoBtn.Text = gotoOrder.label or "GoTo (G)"
	gotoBtn.BackgroundColor3 = GoToPlan.armed and Color3.fromRGB(230, 185, 60)
		or (gotoOrder.enabled and ENABLED or DISABLED)
	local sure = disbandArmed.id ~= nil and u ~= nil and disbandArmed.id == u.id
	disbandBtn.Text = sure and "Sure? (X)" or "Disband (X)"
	disbandBtn.BackgroundColor3 = sure and Color3.fromRGB(214, 84, 70) or (can("disband") and ENABLED or DISABLED)
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
		doDisband()
	elseif input.KeyCode == Enum.KeyCode.H then
		doHelpWonder()
	elseif input.KeyCode == Enum.KeyCode.I then
		doWork("irrigate")
	elseif input.KeyCode == Enum.KeyCode.M then
		doWork("mine")
	elseif input.KeyCode == Enum.KeyCode.R then
		doWork("road")
	end
end)

-- plan step 3.3: every order button says what it does and, greyed, why
for action, def in pairs({
	found = { foundBtn, "Found a city here" }, fortify = { fortifyBtn, "Fortify: dig in, +50% defence" },
	wait = { waitBtn, "Wait: come back to this unit later" }, goto = { gotoBtn, "Go to a tile you pick; the unit keeps marching over turns" },
	disband = { disbandBtn, "Disband this unit for good (asks once more)" },
	irrigate = { irrigateBtn, "Irrigate, or clear / drain where the land does not take water" },
	mine = { mineBtn, "Mine, or plant forest where there is nothing to mine" },
	road = { roadBtn, "Road; on a roaded tile, a railroad" }, fortress = { fortBtn, "Build a fortress" },
	pillage = { pillageBtn, "Destroy the improvement on this tile" },
	trade = { tradeBtn, "Set up a trade route with this city (uses up the Caravan)" },
	helpWonder = { helpBtn, "Add this Caravan's shields to the wonder being built here (H)" },
	upgrade = { upgradeBtn, "Upgrade to the newer unit for gold" }, possess = { possessBtn, "Ride with this unit" },
}) do
	Tooltip.attach(def[1], function()
		return UnitOrders.card(def[2], orderOf(action))
	end)
end
Tooltip.attach(priorityBtn, function()
	return ("Automated settlers favour: %s. Click to cycle Balanced / Food / Shield / Trade (applies to every automated settler)")
		:format(SettlerJobs.LABELS[ClientState.autoPriority])
end)

-- ---- plan R1: tour action stops (each presses through the click's own function)
local function ownUnit(unitType)
	local view = ClientState.view
	if view == nil then
		return nil
	end
	local best = nil
	for _, u in pairs(view.units) do
		if u.owner == view.you and u.type == unitType and (best == nil or u.id < best.id) then
			best = u
		end
	end
	return best
end
local function pick(u)
	ClientState.selectedUnitId = u.id
	task.wait(0.3) -- the bar repaints on the next frames
end

ClientState.registerAction("act-order-labels", function()
	local u = ownUnit("settlers")
	if u == nil then
		return {}, "no Settlers (the staging spawns one in a debug game)"
	end
	pick(u)
	local out = {}
	local defaults = { irrigate = "Irr (I)", mine = "Mine (M)", road = "Road (R)" }
	local shown = {}
	for _, pair in ipairs({ { irrigateBtn, "irrigate" }, { mineBtn, "mine" }, { roadBtn, "road" } }) do
		local want = orderOf(pair[2]).label or defaults[pair[2]]
		shown[#shown + 1] = pair[1].Text
		if pair[1].Text ~= want then
			out[#out + 1] = ("%s reads '%s', the rule says '%s'"):format(pair[2], pair[1].Text, want)
		end
	end
	local view = ClientState.view
	local tile = view.map.tiles[u.y * view.map.width + u.x + 1]
	print(("[Tour] order labels on %s%s: %s"):format(tile.t, tile.road == true and " (road)" or "", table.concat(shown, " / ")))
	return out
end)

ClientState.registerAction("act-greyed-reason", function()
	local u = ownUnit("settlers") or ownUnit("caravan") or ownUnit("diplomat")
	if u == nil then
		return {}, "no unit to select"
	end
	pick(u)
	for _, pair in ipairs({ { fortBtn, "fortress" }, { pillageBtn, "pillage" }, { tradeBtn, "trade" },
		{ upgradeBtn, "upgrade" }, { foundBtn, "found" }, { fortifyBtn, "fortify" } }) do
		local o = orderOf(pair[2])
		if not o.enabled and o.reason ~= nil and pair[1].Parent ~= nil then
			if not Tooltip.preview(pair[1]) then
				return { pair[2] .. ": no hover card" }
			end
			local card = TourPlan.plain(Tooltip.card().Text)
			Tooltip.unpin()
			if not string.find(card, TourPlan.plain(o.reason), 1, true) then
				return { ("%s card does not give the reason '%s'"):format(pair[2], TourPlan.plain(o.reason)) }
			end
			print(("[Tour] greyed %s: %s"):format(pair[2], card))
			return {}
		end
	end
	return {}, "every order is live for this unit"
end)

ClientState.registerAction("act-help-wonder", function()
	local u = ownUnit("caravan")
	local view = ClientState.view
	if u == nil then
		return {}, "no Caravan (the staging spawns one in a debug game)"
	end
	local city = nil
	for _, c in pairs(view.cities) do
		if c.owner == view.you and c.x == u.x and c.y == u.y then
			city = c
		end
	end
	if city == nil then
		return {}, "the Caravan is not in a city"
	end
	local rs = ClientState.rulesets()
	local me = view.players[view.you]
	local before = city.producing
	if before == nil or before.kind ~= "wonder" then
		local ids = {}
		for id, w in pairs(rs.wonders) do
			local built = view.wonders ~= nil and view.wonders[id] ~= nil
			if not built and (w.tech == nil or w.tech == "" or table.find(me.techs or {}, w.tech) ~= nil) then
				ids[#ids + 1] = id
			end
		end
		table.sort(ids)
		if ids[1] == nil then
			return {}, "no wonder is open yet"
		end
		ClientState.send({ type = "setProduction", cityId = city.id, item = { kind = "wonder", id = ids[1] } })
		task.wait(0.8)
	end
	pick(u)
	local o = orderOf("helpWonder")
	local out = {}
	if not o.enabled then
		out[#out + 1] = "Help Wonder stays greyed: " .. tostring(o.reason)
	else
		local shields = ClientState.view.cities[city.id].shields or 0
		doHelpWonder()
		task.wait(0.8)
		local after = ClientState.view.cities[city.id]
		if ClientState.view.units[u.id] ~= nil then
			out[#out + 1] = "the Caravan is still there"
		elseif (after.shields or 0) <= shields then
			out[#out + 1] = ("shields did not rise (%d before, %d after)"):format(shields, after.shields or 0)
		end
	end
	if before ~= nil and before.kind ~= "wonder" then
		ClientState.send({ type = "setProduction", cityId = city.id, item = { kind = before.kind, id = before.id } })
		task.wait(0.4)
	end
	return out
end)

ClientState.registerAction("act-goto-route", function()
	local u = ownUnit("settlers") or ownUnit("diplomat")
	if u == nil then
		return {}, "no unit to send"
	end
	local view = ClientState.view
	local rs = ClientState.rulesets()
	local tx, ty = nil, nil
	for _, d in ipairs({ { 2, 0 }, { -2, 0 }, { 0, 2 }, { 0, -2 }, { 2, 2 }, { -2, -2 }, { 2, -2 }, { -2, 2 } }) do
		local x, y = u.x + d[1], u.y + d[2]
		if x >= 0 and y >= 0 and x < view.map.width and y < view.map.height then
			local t = view.map.tiles[y * view.map.width + x + 1]
			local terr = t ~= nil and rs.terrain.terrains[t.t] or nil
			if terr ~= nil and terr.domain == "land" then
				tx, ty = x, y
				break
			end
		end
	end
	if tx == nil then
		return {}, "no known land two tiles away"
	end
	pick(u)
	if not GoToPlan.armed then
		doGoto()
	end
	GoToPlan.pick(tx, ty)
	task.wait(0.4)
	local out = {}
	if not GoToPlan.hasPlan(u.id) then
		return { ("no route to (%d,%d)"):format(tx, ty) }
	end
	if GoToPlan.dotsShown() < 1 then
		out[#out + 1] = "the route has no dots on the map"
	end
	if not string.find(gotoBtn.Text, "Cancel", 1, true) then
		out[#out + 1] = ("the button reads '%s', not Cancel route"):format(gotoBtn.Text)
	end
	doGoto()
	task.wait(0.3)
	if GoToPlan.hasPlan(u.id) then
		out[#out + 1] = "Cancel route left the plan in place"
	end
	return out
end)

ClientState.registerAction("act-diplomat", function()
	local u = ownUnit("diplomat")
	if u == nil then
		return {}, "no Diplomat (the staging spawns one in a debug game)"
	end
	pick(u)
	local menu = openPicker()
	if #menu == 0 then
		return {}, "no rival city or unit beside the Diplomat (move it next to one, then run the tour again)"
	end
	task.wait(0.3)
	local out = {}
	if not spyBtn.Visible or spyBtn.Parent == nil then
		out[#out + 1] = "the Missions button is not in the bar"
	end
	for _, m in ipairs(menu) do
		local b = picker:FindFirstChild("Mission_" .. m.id)
		if b == nil then
			out[#out + 1] = m.id .. ": no button"
		elseif m.cost ~= nil and not string.find(b.Text, tostring(m.cost), 1, true) then
			out[#out + 1] = ("%s: the price %d is not on the button"):format(m.id, m.cost)
		end
	end
	closePicker()
	print(("[Tour] diplomat missions offered: %d"):format(#menu))
	return out
end)

ClientState.registerAction("act-disband", function()
	local u = ownUnit("diplomat")
	if u == nil then
		return {}, "no Diplomat (the staging spawns one in a debug game)"
	end
	pick(u)
	doDisband()
	task.wait(0.3)
	local out = {}
	if disbandBtn.Text ~= "Sure? (X)" then
		out[#out + 1] = ("first press: the button reads '%s'"):format(disbandBtn.Text)
	end
	if ClientState.view.units[u.id] == nil then
		return { "the first press disbanded the unit" }
	end
	doDisband()
	task.wait(0.8)
	if ClientState.view.units[u.id] ~= nil then
		out[#out + 1] = "second press: the unit is still there"
	end
	return out
end)

print("[ActionBar] action bar up (O fortify, Space wait, X disband, I/M/R work, P ride/dismount; cluster: research + government)")
