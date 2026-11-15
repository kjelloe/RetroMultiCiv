-- R7d (4): statistics panel (roblox/SPEC.md §3j) in the reserved top-center
-- slot. THE FOG RULE (architect @8285016a): only what the seat's view
-- exposes — rival rows show counts DERIVED FROM THE VIEW (cities seen,
-- units in sight), never omniscient internals; the own row adds the fields
-- filterView grants its own seat (gold, techs, research, rates). J toggles.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local Palette = require(script.Parent:WaitForChild("Palette")) -- SO14

local gui = Instance.new("ScreenGui")
gui.Name = "RMCStats"
gui.ResetOnSpawn = false
gui.Enabled = false
gui:SetAttribute("CloseByEnabled", true) -- PanelDress adds the X: this panel opens by gui.Enabled
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local UiTheme = require(script.Parent:WaitForChild("UiTheme"))
local StatsView = require(script.Parent:WaitForChild("StatsView"))

-- 2026-11-15: civ cards (colour disc, name, tags, labelled figures, battle
-- record), a wonders list and the score chart, in one scrolling body. What a
-- card may show is decided in StatsView (the fog rule); this file only draws.
local W = StatsView.W
local INK = Color3.fromRGB(226, 231, 242)
local MUTED = Color3.fromRGB(143, 155, 179)

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, W, 0, StatsView.HEAD_H + 120)
panel.Position = UDim2.new(0.5, -W / 2, 0, 44)
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
	l.TextColor3 = color or INK
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
local function civColor(hex)
	return Color3.fromHex(Palette.displayColor(hex)) -- SO14
end

local heading = text(panel, 14, 8, W - 70, 28, 22, UiTheme.FONT, Color3.fromRGB(240, 242, 248))
heading.Name = "Heading"
heading.Text = "Statistics"
text(panel, 14, 36, W - 28, 18, 14, nil, MUTED).Text = "What your envoys can see. Rivals show only what is in your sight."

local body = Instance.new("ScrollingFrame")
body.Name = "Body"
body.Position = UDim2.new(0, 8, 0, StatsView.HEAD_H)
body.Size = UDim2.new(1, -16, 0, 120)
body.BackgroundTransparency = 1
body.BorderSizePixel = 0
body.ScrollBarThickness = 8
body.Parent = panel
local INNER = W - 16 - 12

-- SO8: the last pulled series / battles / wonders (world-public, pulled on
-- every expand, never pushed)
local lastSeries = {}
local lastBattles = {}
local lastWonders = {}
local chartMetric = "score" -- which figure the chart draws (StatsView.METRICS)

local function section(y, label, color)
	local h = text(body, 6, y + 4, INNER, 20, 15, Enum.Font.GothamBold, color)
	h.Text = label
end

local function drawCard(y, card)
	local row = Instance.new("Frame")
	row.Position = UDim2.new(0, 0, 0, y)
	row.Size = UDim2.new(0, INNER, 0, StatsView.CARD_H)
	row.BackgroundColor3 = card.you and Color3.fromRGB(46, 58, 82) or Color3.fromRGB(40, 48, 66)
	row.BorderSizePixel = 0
	row.Parent = body
	round(row, 8)
	local disc = Instance.new("Frame")
	disc.Position = UDim2.new(0, 10, 0, 6)
	disc.Size = UDim2.new(0, 16, 0, 16)
	disc.BackgroundColor3 = civColor(card.color)
	disc.BorderSizePixel = 0
	disc.Parent = row
	round(disc, 8)
	local name = text(row, 34, 3, 0, 22, 16, Enum.Font.GothamBold)
	name.AutomaticSize = Enum.AutomaticSize.X
	name.TextTruncate = Enum.TextTruncate.None
	name.Text = card.name
	local tagX = 34 + math.min(190, #card.name * 10 + 12)
	for _, tag in ipairs(card.tags) do
		local chip = text(row, tagX, 4, 0, 20, 14, Enum.Font.GothamBold, Color3.fromRGB(18, 20, 28))
		chip.AutomaticSize = Enum.AutomaticSize.X
		chip.TextTruncate = Enum.TextTruncate.None
		chip.BackgroundTransparency = 0
		chip.BackgroundColor3 = tag == "You" and Color3.fromRGB(140, 196, 255) or Color3.fromRGB(170, 178, 196)
		chip.Text = " " .. tag .. " "
		round(chip, 10)
		tagX += #tag * 9 + 18
	end
	if card.record ~= nil then
		local rec = text(row, 0, 4, 150, 20, 14, Enum.Font.GothamBold)
		rec.Position = UDim2.new(1, -160, 0, 4)
		rec.TextXAlignment = Enum.TextXAlignment.Right
		rec.RichText = true
		rec.Text = ('Battles  <font color="#8fd17a">%d won</font>  <font color="#f0846c">%d lost</font>'):format(card.record.won, card.record.lost)
	end
	local bits = {}
	for _, f in ipairs(card.facts) do
		bits[#bits + 1] = ('<font color="#8f9bb3">%s</font> <b>%s</b>'):format(f.label, f.value)
	end
	if card.research ~= nil then
		bits[#bits + 1] = ('<font color="#8f9bb3">Research</font> <b>%s</b>'):format(card.research)
	elseif card.researchUnset then
		bits[#bits + 1] = '<font color="#f0846c"><b>No research chosen</b></font>'
	end
	local facts = text(row, 34, 26, INNER - 44, 20, 14)
	facts.RichText = true
	facts.Text = table.concat(bits, "    ")
end

local function refresh()
	local view = ClientState.view
	if view == nil then
		return
	end
	local rs = ClientState.rulesets()
	for _, child in ipairs(body:GetChildren()) do
		child:Destroy()
	end
	local cards = StatsView.cards(view, rs, lastBattles)
	local wonders = StatsView.wonderRows(lastWonders, view, rs)
	local hasChart = #lastSeries >= 2
	local plan = StatsView.layout(#cards, #wonders, hasChart)
	for i, card in ipairs(cards) do
		drawCard(plan.cardsY + (i - 1) * (StatsView.CARD_H + StatsView.CARD_GAP), card)
	end
	if plan.wondersY ~= nil then
		section(plan.wondersY, "Wonders", Color3.fromRGB(255, 225, 130))
		for i, w in ipairs(wonders) do
			local y = plan.wondersY + StatsView.SECTION_H + (i - 1) * StatsView.WONDER_H
			local line = text(body, 6, y, INNER - 12, 20, 14)
			line.RichText = true
			line.Text = ('<font color="#8f9bb3">T%d</font>   <b>%s</b>   <font color="#8f9bb3">built by</font> %s'):format(w.turn, w.name, w.owner)
		end
	end
	if plan.chartY ~= nil then
		section(plan.chartY, StatsView.chartCaption(lastSeries, chartMetric), Color3.fromRGB(140, 196, 255))
		-- plan step 2.2: one chart, a chip per figure the server samples
		local chipsY = plan.chartY + StatsView.SECTION_H
		for i, m in ipairs(StatsView.metricsIn(lastSeries)) do
			local on = m.id == StatsView.metric(chartMetric).id
			local b = Instance.new("TextButton")
			b.Name = "Metric_" .. m.id
			b.Position = UDim2.new(0, (i - 1) * (StatsView.CHIP_W + 6), 0, chipsY)
			b.Size = UDim2.new(0, StatsView.CHIP_W, 0, StatsView.CHIP_H)
			b.Font = Enum.Font.GothamBold
			b.TextSize = 14
			b.Text = m.label
			b.BorderSizePixel = 0
			b.BackgroundColor3 = on and Color3.fromRGB(96, 150, 230) or Color3.fromRGB(46, 54, 74)
			b.TextColor3 = on and Color3.fromRGB(16, 20, 28) or Color3.fromRGB(200, 208, 224)
			b.Parent = body
			round(b, 13)
			b.Activated:Connect(function()
				chartMetric = m.id
				refresh()
			end)
		end
		local chart = Instance.new("Frame")
		chart.Name = "Chart"
		chart.Position = UDim2.new(0, 0, 0, chipsY + StatsView.CHIP_H + 6)
		chart.Size = UDim2.new(0, INNER, 0, StatsView.CHART_H)
		chart.BackgroundColor3 = Color3.fromRGB(12, 14, 22)
		chart.BorderSizePixel = 0
		chart.Parent = body
		round(chart, 6)
		local key = StatsView.metric(chartMetric).key
		local maxValue = StatsView.maxValue(lastSeries, key)
		for _, card in ipairs(cards) do
			local color = civColor(card.color)
			for _, d in ipairs(StatsView.chartDots(lastSeries, card.pid, INNER - 4, maxValue, key)) do
				local dot = Instance.new("Frame")
				dot.Size = UDim2.new(0, 4, 0, 3)
				dot.Position = UDim2.new(0, d.x, 0, d.y)
				dot.BorderSizePixel = 0
				dot.BackgroundColor3 = color
				dot.Parent = chart
			end
		end
	end
	body.Size = UDim2.new(1, -16, 0, plan.body)
	body.CanvasSize = UDim2.new(0, 0, 0, plan.content)
	panel.Size = UDim2.new(0, W, 0, plan.panelH)
end

ClientState.onStats(function(series, battles, wonders)
	lastSeries = series or {}
	lastBattles = battles or {}
	lastWonders = wonders or {}
	refresh()
end)

ClientState.onView(function()
	if gui.Enabled then
		refresh()
	end
end)

-- open = true forces it open (the end screen's button); nil toggles
local function setOpen(open)
	if open == nil then
		open = not gui.Enabled
	end
	gui.Enabled = open
	if open then
		ClientState.panelOpened("stats") -- runI item 18: closes the city view
		refresh()
		ClientState.requestStats() -- SO8: pull the series on expand
	end
end
ClientState.onStatsToggle(setOpen) -- the top-row Statistics button, the end screen
ClientState.onPanelOpen(function(id)
	if id ~= "stats" then
		gui.Enabled = false
	end
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil then
		return
	end
	if input.KeyCode == Enum.KeyCode.J then
		setOpen(nil)
	end
end)

-- UI tour (specs/roblox-parity-plan.md step 0): open / close without a click
ClientState.registerPanel("stats", panel, function()
	setOpen(true)
end, function()
	setOpen(false)
end)

print("[Stats] R7d statistics up (J toggles; SO8 score chart + battles/wonders)")
