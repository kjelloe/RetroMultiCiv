-- The Roblox TECH TREE: a dependency GRAPH (run-S shot13, user ruling - the
-- era-grouped list did not show what leads to what). Boxes stand in columns
-- by tech level, left to right, joined by elbow lines from each prerequisite;
-- the canvas scrolls sideways. Layout is the pure TechTreeLayout module. Box
-- colour = era; state from the VIEWER's own techs (fog-honest): known /
-- available / locked, current research gold, beeline goal + its path cyan.
-- Click an available tech -> setResearch; click a locked one -> set the
-- beeline goal (Beeline.luau), and each turn the tree issues the next
-- setResearch toward it. Ordinary logged commands (golden-neutral); the goal
-- is CLIENT-only session state.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local Beeline = require(script.Parent:WaitForChild("Beeline"))
local Layout = require(script.Parent:WaitForChild("TechTreeLayout"))
local Tooltip = require(script.Parent:WaitForChild("Tooltip"))
local TechInfo = require(script.Parent:WaitForChild("TechInfo"))
local Diag = require(script.Parent:WaitForChild("Diag"))
local TechGlyphs = require(script.Parent:WaitForChild("TechGlyphs")) -- CP-art: shared era palette

-- era palette 1:1 with the browser tech-glyphs.js ERA table (edge/fill/ink),
-- now sourced from the shared TechGlyphs module (dedup; gate 26 pins it).
local ERA_ORDER = TechGlyphs.ERA_ORDER
local ERA_NAME = TechGlyphs.ERA_NAME
local ERA_COLOR = TechGlyphs.ERA

local gui = Instance.new("ScreenGui")
gui.Name = "RMCTechTree"
gui.ResetOnSpawn = false
gui.DisplayOrder = 20
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local openBtn = Instance.new("TextButton")
openBtn.Size = UDim2.new(0, 147, 0, 40)
openBtn.Position = UDim2.new(1, -546, 0, 8) -- left of 🧠 (Strategic -458)
openBtn.BackgroundColor3 = Color3.fromRGB(38, 46, 40)
openBtn.TextColor3 = Color3.fromRGB(220, 235, 210)
openBtn.Font = Enum.Font.SourceSansBold
openBtn.TextSize = 18
openBtn.Text = "Tech Tree"
openBtn.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = openBtn
end
require(script.Parent:WaitForChild("UiTheme")).apply(openBtn, { color = "go", icon = "techtree" }) -- U1: chunky game-style dress
require(script.Parent:WaitForChild("HudDock")).register(openBtn, { id = "techtree", order = 5 }) -- U3: one planned top row

local frame = Instance.new("Frame")
frame.Size = UDim2.new(0, 1040, 0, 560)
frame.Position = UDim2.new(0.5, -520, 0.5, -280)
frame.BackgroundColor3 = Color3.fromRGB(16, 18, 24)
frame.BorderSizePixel = 0
frame.Visible = false
frame.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 10)
	c.Parent = frame
	local s = Instance.new("UIStroke")
	s.Color = Color3.fromRGB(120, 150, 110)
	s.Transparency = 0.4
	s.Parent = frame
end

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -40, 0, 26)
title.Position = UDim2.new(0, 12, 0, 8)
title.BackgroundTransparency = 1
title.TextColor3 = Color3.fromRGB(210, 230, 200)
title.Font = Enum.Font.SourceSansBold
title.TextSize = 20
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = "Technology tree"
title.Parent = frame

-- legend: the four era colours, then the states
local legend = Instance.new("Frame")
legend.Size = UDim2.new(1, -60, 0, 22)
legend.Position = UDim2.new(0, 12, 0, 38)
legend.BackgroundTransparency = 1
legend.Parent = frame
do
	local l = Instance.new("UIListLayout")
	l.FillDirection = Enum.FillDirection.Horizontal
	l.VerticalAlignment = Enum.VerticalAlignment.Center
	l.Padding = UDim.new(0, 6)
	l.SortOrder = Enum.SortOrder.LayoutOrder
	l.Parent = legend
	local order = 0
	local function chip(color, text, textColor)
		order += 1
		local c = Instance.new("Frame")
		c.Size = UDim2.new(0, 14, 0, 14)
		c.BackgroundColor3 = color
		c.BorderSizePixel = 0
		c.LayoutOrder = order
		c.Parent = legend
		local r = Instance.new("UICorner")
		r.CornerRadius = UDim.new(0, 4)
		r.Parent = c
		order += 1
		local t = Instance.new("TextLabel")
		t.AutomaticSize = Enum.AutomaticSize.X
		t.Size = UDim2.new(0, 0, 1, 0)
		t.BackgroundTransparency = 1
		t.TextColor3 = textColor or Color3.fromRGB(200, 208, 220)
		t.Font = Enum.Font.GothamMedium
		t.TextSize = 14
		t.Text = text .. "   "
		t.LayoutOrder = order
		t.Parent = legend
	end
	for _, era in ipairs(ERA_ORDER) do
		chip(ERA_COLOR[era].edge, ERA_NAME[era]:sub(1, 1) .. ERA_NAME[era]:sub(2):lower())
	end
	chip(Color3.fromRGB(110, 190, 120), "known")
	chip(Color3.fromRGB(240, 220, 120), "researching")
	chip(Color3.fromRGB(120, 210, 235), "goal and its path")
end

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 26, 0, 26)
closeBtn.Position = UDim2.new(1, -30, 0, 6)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
closeBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
closeBtn.Font = Enum.Font.SourceSansBold
closeBtn.TextSize = 16
closeBtn.Text = "X"
closeBtn.Parent = frame
require(script.Parent:WaitForChild("UiTheme")).apply(closeBtn, { color = "danger", radius = 8 }) -- U2 dress

local canvas = Instance.new("ScrollingFrame")
canvas.Name = "Graph"
canvas.Size = UDim2.new(1, -20, 1, -76)
canvas.Position = UDim2.new(0, 10, 0, 66)
canvas.BackgroundColor3 = Color3.fromRGB(11, 13, 18)
canvas.BorderSizePixel = 0
canvas.ScrollBarThickness = 10
canvas.ScrollingDirection = Enum.ScrollingDirection.XY
canvas.CanvasSize = UDim2.new(0, 0, 0, 0)
canvas.Parent = frame
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = canvas
end

local LINE_IDLE = Color3.fromRGB(70, 78, 96)
local LINE_KNOWN = Color3.fromRGB(96, 150, 104)
local LINE_PATH = Color3.fromRGB(120, 210, 235)

local rows = {} -- id -> { btn, stroke, mark, name, era }
local lines = {} -- per edge: { from, to, a, b, c }
local graph = nil
local researchGoal = nil
local onRowClick, render -- forward (build's box handlers + onView call them)

local function seg(x, y, w, h)
	local f = Instance.new("Frame")
	f.Position = UDim2.new(0, math.floor(x), 0, math.floor(y))
	f.Size = UDim2.new(0, math.max(2, math.floor(w)), 0, math.max(2, math.floor(h)))
	f.BackgroundColor3 = LINE_IDLE
	f.BorderSizePixel = 0
	f.ZIndex = 1
	f.Parent = canvas
	return f
end

local knownSet, stateOf = TechInfo.knownSet, TechInfo.stateOf

-- build the boxes and lines once (the DAG never changes); state paints on render
local function build()
	local techs = ClientState.rulesets().techs
	graph = Layout.layout(techs)
	canvas.CanvasSize = UDim2.new(0, graph.width, 0, graph.height)
	for _, e in ipairs(graph.edges) do
		local top, bottom = math.min(e.y1, e.y2), math.max(e.y1, e.y2)
		lines[#lines + 1] = { from = e.from, to = e.to,
			a = seg(e.x1, e.y1 - 1, e.mid - e.x1, 2),
			b = seg(e.mid - 1, top - 1, 2, bottom - top + 2),
			c = seg(e.mid, e.y2 - 1, e.x2 - e.mid, 2) }
	end
	for id, n in pairs(graph.nodes) do
		local era = techs[id].era
		local col = ERA_COLOR[era] or ERA_COLOR.ancient
		local btn = Instance.new("TextButton")
		btn.Name = id
		btn.Position = UDim2.new(0, n.x, 0, n.y)
		btn.Size = UDim2.new(0, Layout.BOX_W, 0, Layout.BOX_H)
		btn.BackgroundColor3 = col.fill
		btn.AutoButtonColor = false
		btn.Text = ""
		btn.ZIndex = 2
		btn.Parent = canvas
		local c = Instance.new("UICorner")
		c.CornerRadius = UDim.new(0, 8)
		c.Parent = btn
		local s = Instance.new("UIStroke")
		s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border -- shot13: a contextual stroke outlined the TEXT
		s.Color = col.edge
		s.Thickness = 2
		s.Parent = btn
		local stripe = Instance.new("Frame") -- the era colour, readable in every state
		stripe.Size = UDim2.new(0, 6, 1, -12)
		stripe.Position = UDim2.new(0, 6, 0, 6)
		stripe.BackgroundColor3 = col.edge
		stripe.BorderSizePixel = 0
		stripe.ZIndex = 3
		stripe.Parent = btn
		local sc = Instance.new("UICorner")
		sc.CornerRadius = UDim.new(0, 3)
		sc.Parent = stripe
		local name = Instance.new("TextLabel")
		name.Size = UDim2.new(1, -44, 1, 0)
		name.Position = UDim2.new(0, 18, 0, 0)
		name.BackgroundTransparency = 1
		name.Font = Enum.Font.GothamMedium
		name.TextSize = 15
		name.TextWrapped = true
		name.TextXAlignment = Enum.TextXAlignment.Left
		name.TextColor3 = col.ink
		name.Text = techs[id].name
		name.ZIndex = 3
		name.Parent = btn
		local mark = Instance.new("TextLabel")
		mark.Size = UDim2.new(0, 22, 1, 0)
		mark.Position = UDim2.new(1, -26, 0, 0)
		mark.BackgroundTransparency = 1
		mark.Font = Enum.Font.GothamBold
		mark.TextSize = 16
		mark.Text = ""
		mark.ZIndex = 3
		mark.Parent = btn
		btn.Activated:Connect(function()
			onRowClick(id)
		end)
		Tooltip.attach(btn, function()
			local ok, body, style = pcall(TechInfo.card, id)
			if not ok then
				Diag.fail("techtree", "hover card", body)
				return techs[id].name
			end
			return body, style
		end)
		rows[id] = { btn = btn, stroke = s, mark = mark, name = name, stripe = stripe, era = era }
	end
end

local function issueResearch(id)
	local view = ClientState.view
	if view == nil or view.you == "spectator" then
		return
	end
	local me = view.players[view.you]
	if me ~= nil and me.researching == id then
		return
	end
	ClientState.send({ type = "setResearch", tech = id })
end

local function advance()
	local view = ClientState.view
	if researchGoal == nil or view == nil or view.you == "spectator" then
		return
	end
	local me = view.players[view.you]
	if me == nil then
		return
	end
	local techs = ClientState.rulesets().techs
	if Beeline.goalReached(me.techs or {}, researchGoal) then
		print("[TechTree] beeline reached: " .. (techs[researchGoal] and techs[researchGoal].name or researchGoal))
		researchGoal = nil
		return
	end
	local next = Beeline.nextBeelineStep(techs, me.techs or {}, researchGoal)
	if next == nil then
		researchGoal = nil -- unreachable / stuck
		return
	end
	issueResearch(next)
end

function onRowClick(id)
	local view = ClientState.view
	if view == nil or view.you == "spectator" then
		return
	end
	local techs = ClientState.rulesets().techs
	local known = knownSet()
	if known[id] then
		return
	end
	if stateOf(techs, id, known) == "avail" then
		researchGoal = nil
		issueResearch(id)
	else
		researchGoal = id -- locked/distant → beeline goal
		advance()
	end
	render()
end

local function paintLine(ln, color, z)
	for _, f in ipairs({ ln.a, ln.b, ln.c }) do
		f.BackgroundColor3 = color
		f.ZIndex = z
	end
end

function render()
	if not frame.Visible then
		return
	end
	local view = ClientState.view
	if view == nil then
		return
	end
	local techs = ClientState.rulesets().techs
	local me = view.players[view.you]
	local researching = me ~= nil and me.researching or nil
	local known = knownSet()
	local onPath = (researchGoal ~= nil and techs[researchGoal] ~= nil)
		and Beeline.prereqClosure(techs, researchGoal) or {}
	if researchGoal ~= nil then
		onPath[researchGoal] = true
	end
	for id, row in pairs(rows) do
		local st = stateOf(techs, id, known)
		local col = ERA_COLOR[row.era] or ERA_COLOR.ancient
		if st == "known" then
			row.btn.BackgroundColor3 = col.fill:Lerp(Color3.fromRGB(40, 92, 52), 0.55)
			row.name.TextColor3 = Color3.fromRGB(196, 232, 196)
			row.mark.Text, row.mark.TextColor3 = "✓", Color3.fromRGB(140, 220, 150)
		elseif st == "avail" then
			row.btn.BackgroundColor3 = col.fill:Lerp(col.edge, 0.28)
			row.name.TextColor3 = Color3.fromRGB(250, 250, 252)
			row.mark.Text, row.mark.TextColor3 = "", col.ink
		else
			row.btn.BackgroundColor3 = col.fill:Lerp(Color3.fromRGB(16, 18, 24), 0.55)
			row.name.TextColor3 = col.ink:Lerp(Color3.fromRGB(96, 100, 110), 0.5)
			row.mark.Text, row.mark.TextColor3 = "", col.ink
		end
		row.stripe.BackgroundTransparency = st == "locked" and 0.45 or 0
		if researching == id then
			row.stroke.Color, row.stroke.Thickness, row.stroke.Transparency = Color3.fromRGB(240, 220, 120), 3, 0
			row.mark.Text, row.mark.TextColor3 = "▶", Color3.fromRGB(240, 220, 120)
		elseif researchGoal == id then
			row.stroke.Color, row.stroke.Thickness, row.stroke.Transparency = LINE_PATH, 3, 0
			row.mark.Text, row.mark.TextColor3 = "◆", LINE_PATH
		elseif onPath[id] and not known[id] then
			row.stroke.Color, row.stroke.Thickness, row.stroke.Transparency = LINE_PATH, 2, 0.25
		else
			row.stroke.Color, row.stroke.Thickness = col.edge, st == "avail" and 2 or 1
			row.stroke.Transparency = st == "locked" and 0.7 or (st == "known" and 0.5 or 0)
		end
	end
	for _, ln in ipairs(lines) do
		if onPath[ln.to] and not known[ln.to] then
			paintLine(ln, LINE_PATH, 1)
		elseif known[ln.from] and known[ln.to] then
			paintLine(ln, LINE_KNOWN, 1)
		elseif known[ln.from] then
			paintLine(ln, LINE_IDLE:Lerp(LINE_KNOWN, 0.5), 1)
		else
			paintLine(ln, LINE_IDLE, 1)
		end
	end
end

-- on open: bring the current research (else the first open tech) into view.
-- CanvasPosition counts canvas pixels AFTER the panel's UIScale, so the
-- target is taken as a share of AbsoluteCanvasSize.
local function scrollToCurrent()
	local view = ClientState.view
	if view == nil or graph == nil then
		return
	end
	local techs = ClientState.rulesets().techs
	local me = view.players[view.you]
	local target = me ~= nil and me.researching or nil
	if target == nil or graph.nodes[target] == nil then
		local known, best = knownSet(), nil
		for id, n in pairs(graph.nodes) do
			if stateOf(techs, id, known) == "avail" and (best == nil or n.x < graph.nodes[best].x) then
				best = id
			end
		end
		target = best
	end
	local n = target ~= nil and graph.nodes[target] or nil
	if n == nil then
		return
	end
	local k = canvas.AbsoluteCanvasSize.X / math.max(1, graph.width)
	local x = (n.x + Layout.BOX_W / 2) * k - canvas.AbsoluteWindowSize.X / 2
	canvas.CanvasPosition = Vector2.new(math.max(0, x), 0)
end

local function toggle(force)
	local show = force
	if show == nil then
		show = not frame.Visible
	end
	frame.Visible = show
	if show then
		ClientState.panelOpened("techtree") -- runI item 18: closes the city view
		render()
		task.defer(scrollToCurrent)
	end
end

closeBtn.Activated:Connect(function()
	toggle(false)
end)
openBtn.Activated:Connect(function()
	toggle()
end)

-- beeline auto-advances even with the tree closed; render only when visible
ClientState.onView(function()
	if researchGoal ~= nil then
		advance()
	end
	render()
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil then
		return
	end
	if input.KeyCode == Enum.KeyCode.T
		and (UserInputService:IsKeyDown(Enum.KeyCode.LeftShift)
			or UserInputService:IsKeyDown(Enum.KeyCode.RightShift)) then
		toggle()
	end
end)

do
	local ok, err = pcall(build)
	if not ok then
		Diag.fail("techtree", "graph build (panel stays empty)", err)
	elseif graph ~= nil then
		Diag.note("techtree", ("graph: %d columns x %d rows, %d lines, canvas %dx%d"):format(
			graph.cols, graph.rows, #lines, graph.width, graph.height))
	end
end
print("[TechTree] tech tree graph up (Tech Tree button / Shift+T; client beeline)")
