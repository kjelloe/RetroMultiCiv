-- R6: research picker (roblox/SPEC.md §3g, docs/13 Tier-1 rows).
-- Presentational math ONLY comes from the read-only luau engine modules
-- (architect ruling @b81f92dd's review round: the no-local-logic rule
-- governs ACTING, not explaining) — availableTechs and researchCost are
-- required from ReplicatedStorage.Shared, never reimplemented. Acting stays
-- commands through the dispatcher: setResearch {tech}. T toggles;
-- auto-opens once whenever research is unset on your turn.
-- R12 (2): the tax/lux steppers MOVED to GovernmentPanel (user runC ruling).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local techModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("tech"))
local TechGlyphs = require(script.Parent:WaitForChild("TechGlyphs")) -- CP-art: era badge

local lastRowClick = nil -- session-E round 12: double-click select-and-close

local gui = Instance.new("ScreenGui")
gui.Name = "RMCResearch"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local UiTheme = require(script.Parent:WaitForChild("UiTheme"))
local TechInfo = require(script.Parent:WaitForChild("TechInfo"))
local Diag = require(script.Parent:WaitForChild("Diag"))

-- run-S shot16 (user): clicking a technology EXPANDS an information panel
-- under its row - the same text as the tech tree's hover card (TechInfo) -
-- with the button that starts the research. A double-click still picks and
-- closes. The header shows the current research as a progress bar.
local W = 360
local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, W, 0, 470)
panel.Position = UDim2.new(0.5, 200, 0, 44) -- under the Research button, right of Government
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.05
panel.BorderSizePixel = 0
panel.Parent = gui

local MUTED = Color3.fromRGB(143, 155, 179)
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
title.Text = "Research"

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 30, 0, 28)
closeBtn.Position = UDim2.new(1, -38, 0, 8)
closeBtn.TextSize = 16
closeBtn.Text = "X"
closeBtn.Parent = panel
UiTheme.apply(closeBtn, { color = "danger", radius = 8 })

local current = text(panel, 14, 40, W - 28, 20, 16, Enum.Font.GothamBold)
local track = Instance.new("Frame")
track.Position = UDim2.new(0, 14, 0, 64)
track.Size = UDim2.new(0, W - 28, 0, 14)
track.BackgroundColor3 = Color3.fromRGB(18, 22, 32)
track.BorderSizePixel = 0
track.Parent = panel
round(track, 7)
local fill = Instance.new("Frame")
fill.Size = UDim2.new(0, 0, 1, 0)
fill.BackgroundColor3 = Color3.fromRGB(110, 180, 255)
fill.BorderSizePixel = 0
fill.Parent = track
round(fill, 7)
local progress = text(panel, 14, 82, W - 28, 18, 14, nil, MUTED)
local pickCap = text(panel, 14, 104, W - 28, 18, 14, Enum.Font.GothamBold, MUTED)
pickCap.Text = "YOU CAN RESEARCH  -  click one to read about it"

local list = Instance.new("ScrollingFrame")
list.Size = UDim2.new(1, -16, 1, -134)
list.Position = UDim2.new(0, 8, 0, 126)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 8
list.Parent = panel
local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 5)
layout.Parent = list
-- the content height is read in SCREEN pixels; the canvas is set in the
-- panel's own (pre-UIScale) pixels
local function fitCanvas()
	local sc = panel:FindFirstChild("PanelScale")
	local k = (sc ~= nil and sc.Scale > 0) and sc.Scale or 1
	list.CanvasSize = UDim2.new(0, 0, 0, math.ceil(layout.AbsoluteContentSize.Y / k) + 6)
end
layout:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(fitCanvas)

local function me()
	local view = ClientState.view
	return view and view.players[view.you]
end

local selected = nil -- the tech whose information is expanded

local function pickAndClose(id)
	print("[Research] setResearch " .. id)
	ClientState.send({ type = "setResearch", tech = id })
	gui.Enabled = false
end

-- ---- the picker list --------------------------------------------------------
local refresh
function refresh()
	local view = ClientState.view
	local m = me()
	if view == nil or m == nil then
		return
	end
	local rs = ClientState.rulesets()
	-- read-only engine math on a view-shaped shim: availableTechs/researchCost
	-- only read players[pid].techs, so the filtered own-player row suffices
	local shim = { players = { [view.you] = m } }
	local cost = techModule.researchCost(shim, view.you, rs)
	-- bulbs/turn: playerIncome over a view-shaped shim - own cities arrive
	-- WHOLE and their radius is always explored, which is everything the
	-- income walk reads. pcall: presentational only, never blocks the picker.
	local bulbs = 0
	local incomeShim = { players = view.players, cities = view.cities,
		cityOrder = view.cityOrder, map = view.map }
	local okIncome, income = pcall(techModule.playerIncome, incomeShim, view.you, rs)
	if okIncome and income ~= nil then
		bulbs = income.bulbs or 0
	end
	local have = m.bulbs or 0
	local turns = bulbs > 0 and math.ceil(math.max(0, cost - have) / bulbs) or nil
	if m.researching ~= nil then
		local def = rs.techs[m.researching]
		current.Text = "Researching " .. (def and def.name or m.researching)
		current.TextColor3 = Color3.fromRGB(226, 231, 242)
		fill.Size = UDim2.new(math.clamp(have / math.max(1, cost), 0, 1), 0, 1, 0)
		progress.Text = ("%d of %d bulbs  -  +%d a turn%s"):format(have, cost, bulbs,
			turns ~= nil and ("  -  about %d turn%s"):format(turns, turns == 1 and "" or "s") or "")
	else
		current.Text = "Nothing is being researched"
		current.TextColor3 = Color3.fromRGB(255, 190, 110)
		fill.Size = UDim2.new(0, 0, 1, 0)
		progress.Text = ("Each technology costs %d bulbs  -  you make +%d a turn"):format(cost, bulbs)
	end

	for _, child in ipairs(list:GetChildren()) do
		if not child:IsA("UIListLayout") then
			child:Destroy()
		end
	end
	local order = 0
	for _, id in ipairs(techModule.availableTechs(shim, view.you, rs)) do
		order += 1
		local isCurrent = id == m.researching
		local row = Instance.new("TextButton")
		row.Name = "Tech"
		row.Size = UDim2.new(1, -10, 0, 38)
		row.LayoutOrder = order * 2
		row.BackgroundColor3 = isCurrent and Color3.fromRGB(46, 88, 148)
			or (selected == id and Color3.fromRGB(58, 70, 98) or Color3.fromRGB(40, 48, 66))
		row.Text = ""
		row.Parent = list
		UiTheme.row(row) -- U5
		-- CP-art (glyphs fallback b): per-era colour badge at the row's left
		local badge = TechGlyphs.badge(row, TechGlyphs.eraOf(rs.techs, id), 18)
		badge.AnchorPoint = Vector2.new(0, 0.5)
		badge.Position = UDim2.new(0, 8, 0.5, 0)
		local name = text(row, 36, 0, 200, 38, 17, Enum.Font.GothamBold)
		name.Text = rs.techs[id] and rs.techs[id].name or id
		local side = text(row, 0, 0, 110, 38, 13, nil, isCurrent and Color3.fromRGB(255, 225, 130) or MUTED)
		side.Position = UDim2.new(1, -118, 0, 0)
		side.TextXAlignment = Enum.TextXAlignment.Right
		side.Text = isCurrent and "in progress" or (selected == id and "hide" or "details")
		row.Activated:Connect(function()
			-- session-E round 12 (user): DOUBLE-CLICK selects AND closes
			local now = os.clock()
			if lastRowClick ~= nil and lastRowClick.id == id and now - lastRowClick.t < 0.5 then
				lastRowClick = nil
				pickAndClose(id)
				return
			end
			lastRowClick = { id = id, t = now }
			selected = selected ~= id and id or nil
			refresh()
		end)
		if selected == id then
			local info = Instance.new("Frame")
			info.Name = "Info"
			info.LayoutOrder = order * 2 + 1
			info.Size = UDim2.new(1, -10, 0, 0)
			info.AutomaticSize = Enum.AutomaticSize.Y
			info.BackgroundColor3 = Color3.fromRGB(30, 35, 48)
			info.BorderSizePixel = 0
			info.Parent = list
			round(info, 8)
			local pad = Instance.new("UIPadding")
			pad.PaddingTop, pad.PaddingBottom = UDim.new(0, 8), UDim.new(0, 10)
			pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 12), UDim.new(0, 12)
			pad.Parent = info
			local lay = Instance.new("UIListLayout")
			lay.SortOrder = Enum.SortOrder.LayoutOrder
			lay.Padding = UDim.new(0, 8)
			lay.Parent = info
			local body = Instance.new("TextLabel")
			body.LayoutOrder = 1
			body.Size = UDim2.new(1, 0, 0, 0)
			body.AutomaticSize = Enum.AutomaticSize.Y
			body.BackgroundTransparency = 1
			body.Font = UiTheme.BODY_FONT
			body.TextSize = 15
			body.LineHeight = 1.12
			body.RichText = true
			body.TextWrapped = true
			body.TextXAlignment = Enum.TextXAlignment.Left
			body.TextYAlignment = Enum.TextYAlignment.Top
			body.TextColor3 = Color3.fromRGB(214, 220, 234)
			local ok, cardText = pcall(TechInfo.card, id, { title = false })
			if not ok then
				Diag.fail("research", "tech information", cardText)
				cardText = ""
			end
			body.Text = cardText
			body.Parent = info
			local go = Instance.new("TextButton")
			go.LayoutOrder = 2
			go.Size = UDim2.new(1, 0, 0, 38)
			go.TextSize = 17
			go.Text = isCurrent and "Being researched now" or ("Research " .. name.Text)
			go.Parent = info
			UiTheme.apply(go, { color = isCurrent and "neutral" or "go", radius = 10 })
			go.Activated:Connect(function()
				if not isCurrent then
					pickAndClose(id)
				end
			end)
		end
	end
	fitCanvas()
end

local function setOpen(open)
	gui.Enabled = open
	if open then
		ClientState.panelOpened("research") -- runI item 18: closes the city view
		refresh()
	end
end

closeBtn.Activated:Connect(function()
	setOpen(false)
end)

ClientState.onResearchOpen(function()
	setOpen(not gui.Enabled)
end)

-- auto-open ONCE each time research goes unset on your turn (the browser's
-- "choose new research" prompt); picking a tech re-arms it via the reset
local autoShown = false
ClientState.onView(function(view)
	local m = me()
	if m ~= nil and m.researching ~= nil then
		autoShown = false
	elseif m ~= nil and ClientState.myTurn() and not autoShown then
		autoShown = true
		setOpen(true)
	end
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
	-- plain T = picker; Shift+T = the tech tree (TechTree.client), so ignore the
	-- shifted chord here
	if input.KeyCode == Enum.KeyCode.T
		and not (UserInputService:IsKeyDown(Enum.KeyCode.LeftShift)
			or UserInputService:IsKeyDown(Enum.KeyCode.RightShift)) then
		setOpen(not gui.Enabled)
	end
end)

-- R7b (11): discovery splash — name + what it unlocks, all from the baked
-- rulesets (facts only, never wiki prose). The Research button blinking
-- until the next pick lives in ActionBar (it owns the button).
local splash = Instance.new("TextLabel")
splash.Size = UDim2.new(0, 520, 0, 54)
splash.Position = UDim2.new(0.5, -260, 0.3, 0)
splash.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
splash.BackgroundTransparency = 0.15
splash.TextColor3 = Color3.fromRGB(150, 230, 255)
splash.Font = Enum.Font.SourceSansBold
splash.TextSize = 20
splash.TextWrapped = true
splash.Visible = false
splash.Parent = gui.Parent:WaitForChild("RMCHud") -- HUD gui stays enabled; this panel's gui toggles

local function unlocksOf(techId, rs)
	local names = {}
	for _, group in ipairs({ rs.units, rs.buildings, rs.wonders }) do
		for _, def in pairs(group) do
			if def.tech == techId then
				table.insert(names, def.name)
			end
		end
	end
	table.sort(names)
	return names
end

ClientState.onEvents(function(events, view)
	for _, e in ipairs(events) do
		if e.type == "techDiscovered" and e.playerId == view.you then
			local rs = ClientState.rulesets()
			local def = rs.techs[e.tech]
			local unlocks = unlocksOf(e.tech, rs)
			splash.Text = ("%s discovered!%s"):format(def and def.name or e.tech,
				#unlocks > 0 and ("  Unlocks: " .. table.concat(unlocks, ", ")) or "")
			splash.Visible = true
			task.delay(5, function()
				splash.Visible = false
			end)
		end
	end
end)

print("[Research] research picker up (T toggles; rate steppers live in Government now)")
