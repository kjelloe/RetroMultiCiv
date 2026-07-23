-- XII.6 (#1726 §2) — the Roblox TECH-TREE tier: the era-GROUPED-LIST fork of
-- the browser's graphical tree (docs/13 — the cheaper shape for Roblox), plus
-- the client-side BEELINE (Beeline.luau, ported from shared/beeline.js). Nodes
-- are grouped by era, sorted by level; each shows its state from the VIEWER's
-- own techs (fog-honest): ✓ known / ○ available / · locked, the current
-- research highlighted, the beeline goal ◇ + its prereq path picked out. Click
-- an available tech → setResearch; click a locked/distant one → set the beeline
-- goal, and each turn the tree issues the next setResearch toward it. All
-- ordinary logged commands (golden-neutral); the goal is CLIENT-only session
-- state (no localStorage on Roblox — accepted divergence, like AdviceCards).
-- Name labels ship now; procedural glyphs (Part C) layer in later.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local Beeline = require(script.Parent:WaitForChild("Beeline"))
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
openBtn.Size = UDim2.new(0, 44, 0, 36)
openBtn.Position = UDim2.new(1, -546, 0, 8) -- left of 🧠 (Strategic -458)
openBtn.BackgroundColor3 = Color3.fromRGB(38, 46, 40)
openBtn.TextColor3 = Color3.fromRGB(220, 235, 210)
openBtn.Font = Enum.Font.SourceSansBold
openBtn.TextSize = 20
openBtn.Text = "🌳"
openBtn.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = openBtn
end

local frame = Instance.new("Frame")
frame.Size = UDim2.new(0, 520, 0, 460)
frame.Position = UDim2.new(0.5, -260, 0.5, -230)
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
title.Text = "🌳 Technology tree"
title.Parent = frame

local legend = Instance.new("TextLabel")
legend.Size = UDim2.new(1, -40, 0, 16)
legend.Position = UDim2.new(0, 12, 0, 32)
legend.BackgroundTransparency = 1
legend.TextColor3 = Color3.fromRGB(150, 160, 150)
legend.Font = Enum.Font.Code
legend.TextSize = 13
legend.TextXAlignment = Enum.TextXAlignment.Left
legend.Text = "✓ known    ○ available    · locked    ◇ beeline goal"
legend.Parent = frame

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 26, 0, 26)
closeBtn.Position = UDim2.new(1, -30, 0, 6)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
closeBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
closeBtn.Font = Enum.Font.SourceSansBold
closeBtn.TextSize = 16
closeBtn.Text = "X"
closeBtn.Parent = frame

local list = Instance.new("ScrollingFrame")
list.Size = UDim2.new(1, -20, 1, -56)
list.Position = UDim2.new(0, 10, 0, 50)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 6
list.AutomaticCanvasSize = Enum.AutomaticSize.Y
list.CanvasSize = UDim2.new(0, 0, 0, 0)
list.Parent = frame
local layout = Instance.new("UIListLayout")
layout.FillDirection = Enum.FillDirection.Vertical
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 3)
layout.Parent = list

local rows = {} -- id -> { btn, era }
local researchGoal = nil
local onRowClick, render -- forward (build's row handlers + onView call them)

-- build the static rows once (the DAG never changes); state paints on render
local function build()
	local techs = ClientState.rulesets().techs
	local order = 0
	for _, era in ipairs(ERA_ORDER) do
		local ids = {}
		for id, def in pairs(techs) do
			if def.era == era then
				table.insert(ids, id)
			end
		end
		if #ids > 0 then
			table.sort(ids, function(a, b)
				if techs[a].level ~= techs[b].level then
					return techs[a].level < techs[b].level
				end
				return a < b
			end)
			order += 1
			local head = Instance.new("TextLabel")
			head.Size = UDim2.new(1, -6, 0, 22)
			head.LayoutOrder = order
			head.BackgroundTransparency = 1
			head.TextColor3 = ERA_COLOR[era].edge
			head.Font = Enum.Font.SourceSansBold
			head.TextSize = 15
			head.TextXAlignment = Enum.TextXAlignment.Left
			head.Text = "▸ " .. ERA_NAME[era]
			head.Parent = list
			for _, id in ipairs(ids) do
				order += 1
				local btn = Instance.new("TextButton")
				btn.Size = UDim2.new(1, -6, 0, 26)
				btn.LayoutOrder = order
				btn.BackgroundColor3 = ERA_COLOR[era].fill
				btn.TextColor3 = ERA_COLOR[era].ink
				btn.Font = Enum.Font.SourceSans
				btn.TextSize = 15
				btn.TextXAlignment = Enum.TextXAlignment.Left
				btn.AutoButtonColor = false
				btn.Text = "  ·  " .. techs[id].name
				btn.Parent = list
				local c = Instance.new("UICorner")
				c.CornerRadius = UDim.new(0, 6)
				c.Parent = btn
				local s = Instance.new("UIStroke")
				s.Color = ERA_COLOR[era].edge
				s.Transparency = 1
				s.Thickness = 2
				s.Parent = btn
				btn.Activated:Connect(function()
					onRowClick(id)
				end)
				rows[id] = { btn = btn, stroke = s, era = era }
			end
		end
	end
end

local function knownSet()
	local view = ClientState.view
	local out = {}
	if view ~= nil then
		local me = view.players[view.you]
		for _, t in ipairs((me ~= nil and me.techs) or {}) do
			out[t] = true
		end
	end
	return out
end

local function stateOf(techs, id, known)
	if known[id] then
		return "known"
	end
	for _, p in ipairs(techs[id].prereqs or {}) do
		if not known[p] then
			return "locked"
		end
	end
	return "avail"
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
	for id, row in pairs(rows) do
		local st = stateOf(techs, id, known)
		local glyph = (researchGoal == id and "◇")
			or (st == "known" and "✓") or (st == "avail" and "○") or "·"
		row.btn.Text = ("  %s  %s"):format(glyph, techs[id].name)
		local ink = ERA_COLOR[row.era].ink
		if st == "known" then
			row.btn.TextColor3 = Color3.fromRGB(150, 205, 150)
		elseif st == "locked" then
			row.btn.TextColor3 = ink:Lerp(Color3.fromRGB(90, 92, 98), 0.55)
		else
			row.btn.TextColor3 = ink
		end
		-- highlight: current research (solid), goal/on-path (dashed-ish stroke)
		if researching == id then
			row.stroke.Color = Color3.fromRGB(240, 220, 120)
			row.stroke.Transparency = 0
		elseif researchGoal == id then
			row.stroke.Color = Color3.fromRGB(120, 210, 235)
			row.stroke.Transparency = 0.1
		elseif onPath[id] and not known[id] then
			row.stroke.Color = Color3.fromRGB(120, 210, 235)
			row.stroke.Transparency = 0.55
		else
			row.stroke.Transparency = 1
		end
	end
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

build()
print("[TechTree] XII.6 era-grouped tech tree up (🌳 / Shift+T; client beeline)")
