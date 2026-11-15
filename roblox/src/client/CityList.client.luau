-- R7d (3): city list (roblox/SPEC.md §3j). Own cities from the view — name,
-- pop, production with progress — tap a row to jump the camera there AND
-- open the city panel. C toggles (chat-guarded). View-only + channels.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local EmpireView = require(script.Parent:WaitForChild("EmpireView")) -- plan step 2: city figures, economy statement
local Shared = ReplicatedStorage:WaitForChild("Shared")
local DEPS = { tech = require(Shared:WaitForChild("tech")), cities = require(Shared:WaitForChild("cities")),
	government = require(Shared:WaitForChild("government")) }

local gui = Instance.new("ScreenGui")
gui.Name = "RMCCityList"
gui.ResetOnSpawn = false
gui.Enabled = false
gui:SetAttribute("CloseByEnabled", true) -- PanelDress adds the X: this panel opens by gui.Enabled
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local UiTheme = require(script.Parent:WaitForChild("UiTheme"))

-- run-S shot16 (user): the list was monospace one-liners. Each city is now a
-- card: a population badge coloured by size, the name, state chips, what it
-- builds (dot coloured by kind) and a progress bar.
local W = 440
local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, W, 0, 420)
panel.Position = UDim2.new(0.5, -620, 0, 44) -- under the Cities button, left of Government
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.05
panel.BorderSizePixel = 0
panel.Parent = gui

local function text(parent, x, y, w, h, size, font, color)
	local l = Instance.new("TextLabel")
	l.Position = UDim2.new(0, x, 0, y)
	l.Size = UDim2.new(0, w, 0, h)
	l.BackgroundTransparency = 1
	l.Font = font or UiTheme.BODY_FONT
	l.TextSize = size
	l.TextColor3 = color or Color3.fromRGB(226, 231, 242)
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.TextTruncate = Enum.TextTruncate.AtEnd
	l.Text = ""
	l.Parent = parent
	return l
end
local function round(inst, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r)
	c.Parent = inst
end

local title = text(panel, 14, 8, W - 70, 28, 22, UiTheme.FONT, Color3.fromRGB(240, 242, 248))
title.Name = "Heading"
title.Text = "Cities"
-- plan step 2: two views of the same empire in one panel
local tab = "cities"
local tabButtons = {}
local refresh
for i, def in ipairs({ { id = "cities", label = "Cities" }, { id = "economy", label = "Economy" } }) do
	local b = Instance.new("TextButton")
	b.Name = "Tab_" .. def.id
	b.Position = UDim2.new(0, 14 + (i - 1) * 108, 0, 40)
	b.Size = UDim2.new(0, 102, 0, 26)
	b.Font = Enum.Font.GothamBold
	b.TextSize = 15
	b.Text = def.label
	b.BorderSizePixel = 0
	b.AutoButtonColor = true
	b.Parent = panel
	round(b, 13)
	tabButtons[def.id] = b
	b.Activated:Connect(function()
		tab = def.id
		refresh()
	end)
end
local hint = text(panel, 14, 70, W - 28, 18, 14, nil, Color3.fromRGB(143, 155, 179))
hint.Text = "Click a city to go there and open it."

local list = Instance.new("ScrollingFrame")
list.Size = UDim2.new(1, -16, 1, -100)
list.Position = UDim2.new(0, 8, 0, 92)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 8
list.Parent = panel
local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 6)
layout.Parent = list

local ROW_H = 76
local ECO_H = 28
local KIND_COLOR = { unit = Color3.fromRGB(255, 160, 110), building = Color3.fromRGB(120, 190, 255),
	wonder = Color3.fromRGB(255, 225, 130) }
local function popColor(pop)
	return pop >= 13 and Color3.fromRGB(232, 190, 70) or pop >= 8 and Color3.fromRGB(60, 170, 190)
		or pop >= 4 and Color3.fromRGB(70, 170, 100) or Color3.fromRGB(110, 140, 110)
end

local function chip(parent, x, label, color)
	local c = text(parent, x, 6, 0, 20, 14, Enum.Font.GothamBold, Color3.fromRGB(18, 20, 28))
	c.AutomaticSize = Enum.AutomaticSize.X
	c.BackgroundTransparency = 0
	c.BackgroundColor3 = color
	c.Text = " " .. label .. " "
	round(c, 10)
	return c
end

local ECO_COLOR = { income = Color3.fromRGB(150, 220, 140), cost = Color3.fromRGB(240, 130, 116),
	note = Color3.fromRGB(143, 155, 179), upkeep = Color3.fromRGB(255, 160, 110) }

-- the Economy statement: where the gold per turn comes from and goes
local function drawEconomy(view, rs)
	local ok, eco = pcall(EmpireView.economy, EmpireView.shim(view), view.you, rs, DEPS)
	if not ok or eco == nil then
		title.Text = "Economy"
		hint.Text = "The figures are not available right now."
		list.CanvasSize = UDim2.new(0, 0, 0, 0)
		return
	end
	title.Text = ("Economy  -  %s%d gold a turn"):format(eco.net >= 0 and "+" or "", eco.net)
	hint.Text = eco.empty or ("Treasury %d gold.  Taxes %d%%, science %d%%."):format(eco.treasury, eco.tax or 0, eco.sci or 0)
	for i, r in ipairs(eco.rows) do
		local row = Instance.new("Frame")
		row.Name = "Eco"
		row.Size = UDim2.new(1, -10, 0, ECO_H)
		row.LayoutOrder = i
		row.BorderSizePixel = 0
		row.BackgroundColor3 = r.kind == "total" and Color3.fromRGB(58, 70, 98) or Color3.fromRGB(40, 48, 66)
		row.BackgroundTransparency = r.kind == "note" and 1 or 0
		row.Parent = list
		round(row, 6)
		local bold = r.kind == "total" and Enum.Font.GothamBold or nil
		local label = text(row, 10, 4, W - 150, 20, 15, bold, r.kind == "note" and ECO_COLOR.note or nil)
		label.Text = r.label
		local amount = text(row, 0, 4, 100, 20, 15, Enum.Font.GothamBold,
			r.kind == "total" and (r.amount < 0 and ECO_COLOR.cost or ECO_COLOR.income) or ECO_COLOR[r.kind])
		amount.Position = UDim2.new(1, -110, 0, 4)
		amount.TextXAlignment = Enum.TextXAlignment.Right
		amount.Text = EmpireView.amountText(r)
	end
	list.CanvasSize = UDim2.new(0, 0, 0, #eco.rows * (ECO_H + 6))
end

refresh = function()
	local view = ClientState.view
	if view == nil then
		return
	end
	local rs = ClientState.rulesets()
	for _, child in ipairs(list:GetChildren()) do
		if child:IsA("GuiObject") then
			child:Destroy()
		end
	end
	for id, b in pairs(tabButtons) do
		b.BackgroundColor3 = id == tab and Color3.fromRGB(96, 150, 230) or Color3.fromRGB(46, 54, 74)
		b.TextColor3 = id == tab and Color3.fromRGB(16, 20, 28) or Color3.fromRGB(200, 208, 224)
	end
	if tab == "economy" then
		drawEconomy(view, rs)
		return
	end
	local shim = EmpireView.shim(view)
	local okWorked, worked = pcall(DEPS.cities.resolveAllWorked, shim, rs)
	local order = 0
	for _, cid in ipairs(view.cityOrder or {}) do
		local c = view.cities[cid]
		if c ~= nil and c.owner == view.you and c.pop ~= nil then
			order += 1
			local kind = c.producing and c.producing.kind or nil
			local prodDef = kind and (rs[kind .. "s"] or {})[c.producing.id]
			local row = Instance.new("TextButton")
			row.Name = "City"
			row.Size = UDim2.new(1, -10, 0, ROW_H)
			row.LayoutOrder = order
			row.BackgroundColor3 = Color3.fromRGB(40, 48, 66)
			row.Text = ""
			row.Parent = list
			UiTheme.row(row) -- U5: rounded, lighter under the pointer
			local badge = text(row, 8, 8, 38, 38, 18, Enum.Font.GothamBold, Color3.fromRGB(16, 20, 26))
			badge.BackgroundTransparency = 0
			badge.BackgroundColor3 = popColor(c.pop)
			badge.TextXAlignment = Enum.TextXAlignment.Center
			badge.Text = tostring(c.pop)
			round(badge, 19)
			local name = text(row, 56, 5, 200, 22, 17, Enum.Font.GothamBold)
			name.AutomaticSize = Enum.AutomaticSize.X
			name.Size = UDim2.new(0, 0, 0, 22)
			name.TextTruncate = Enum.TextTruncate.None
			name.Text = c.name
			local chipX = 56 + math.min(190, #c.name * 10 + 12)
			if c.disorder == true then
				chip(row, chipX, "DISORDER", Color3.fromRGB(240, 110, 96))
			elseif c.celebrating == true then
				chip(row, chipX, "CELEBRATING", Color3.fromRGB(255, 225, 130))
			end
			local dot = Instance.new("Frame")
			dot.Position = UDim2.new(0, 58, 0, 34)
			dot.Size = UDim2.new(0, 10, 0, 10)
			dot.BackgroundColor3 = KIND_COLOR[kind] or Color3.fromRGB(150, 156, 170)
			dot.BorderSizePixel = 0
			dot.Parent = row
			round(dot, 5)
			local prod = text(row, 74, 29, 160, 20, 15, nil, Color3.fromRGB(200, 208, 224))
			prod.Text = prodDef and prodDef.name or (c.producing and c.producing.id or "nothing")
			-- progress toward the item
			local cost = prodDef and prodDef.cost or 0
			local done = c.shields or 0
			local track = Instance.new("Frame")
			track.Position = UDim2.new(1, -176, 0, 32)
			track.Size = UDim2.new(0, 104, 0, 12)
			track.BackgroundColor3 = Color3.fromRGB(22, 26, 36)
			track.BorderSizePixel = 0
			track.Parent = row
			round(track, 6)
			local fill = Instance.new("Frame")
			local share = cost > 0 and math.clamp(done / cost, 0, 1) or 0
			fill.Size = UDim2.new(share, 0, 1, 0)
			fill.BackgroundColor3 = share >= 1 and Color3.fromRGB(110, 210, 120) or (KIND_COLOR[kind] or Color3.fromRGB(120, 190, 255))
			fill.BorderSizePixel = 0
			fill.Parent = track
			round(fill, 6)
			local num = text(row, 0, 27, 60, 22, 14, Enum.Font.GothamBold, Color3.fromRGB(226, 231, 242))
			num.Position = UDim2.new(1, -66, 0, 27)
			num.Text = ("%d/%d"):format(done, cost)
			local size = text(row, 0, 6, 170, 18, 14, nil, Color3.fromRGB(143, 155, 179))
			size.Position = UDim2.new(1, -176, 0, 6)
			size.TextXAlignment = Enum.TextXAlignment.Right
			-- yields, what the city pays in, what it costs each turn
			local okRow, fig = false, nil
			if okWorked then
				okRow, fig = pcall(EmpireView.cityRow, shim, c, rs, DEPS, worked)
			end
			size.Text = (okRow and fig.capital and "capital  -  " or "") .. "population " .. tostring(c.pop)
			if okRow then
				local figures = text(row, 58, 52, W - 90, 18, 14, nil, Color3.fromRGB(170, 180, 200))
				figures.Name = "Figures"
				figures.RichText = true
				figures.Text = ('<font color="#96dc8c">%d food</font>  <font color="#ffa06e">%d shields</font>  <font color="#8cc4ff">%d trade</font>'
					.. '   <font color="#ffe182">+%d gold</font>  <font color="#b4a0ff">+%d science</font>   upkeep %s'):format(
					fig.food, fig.shields, fig.trade, fig.gold, fig.bulbs, fig.upkeepText)
			end
			row.Activated:Connect(function()
				print(("[CityList] jump to %s (%d,%d)"):format(c.name, c.x, c.y))
				ClientState.focusCamera(c.x, c.y)
				ClientState.openCity(cid)
			end)
		end
	end
	title.Text = ("Cities  -  %d"):format(order)
	hint.Text = order > 0 and "Click a city to go there and open it." or "You have no cities yet. Found one with a Settlers unit."
	list.CanvasSize = UDim2.new(0, 0, 0, order * (ROW_H + 6))
end

local function setOpen(open)
	gui.Enabled = open
	if open then
		ClientState.panelOpened("citylist") -- runI item 18: closes the city view
		refresh()
	end
end

ClientState.onView(function()
	if gui.Enabled then
		refresh()
	end
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil then
		return
	end
	if input.KeyCode == Enum.KeyCode.C then
		setOpen(not gui.Enabled)
	end
end)

-- session-E round 18: the ActionBar "Cities" button drives the same toggle
ClientState.onCityListToggle(function()
	setOpen(not gui.Enabled)
end)

-- UI tour (specs/roblox-parity-plan.md step 0): open / close without a click
ClientState.registerPanel("cities", panel, function()
	tab = "cities"
	setOpen(true)
end, function()
	setOpen(false)
end)
ClientState.registerPanel("economy", panel, function()
	tab = "economy"
	setOpen(true)
end, function()
	tab = "cities"
	setOpen(false)
end)

print("[CityList] R7d city list up (C toggles, Cities button)")
