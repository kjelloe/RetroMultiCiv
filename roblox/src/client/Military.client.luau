-- Military overview (the browser's XIV §41 panel): every own unit on one
-- row; a click goes to the unit and selects it. What a row says is decided in
-- MilitaryView (pure, gate 50); this file only draws. View-only: sends nothing.

local Players = game:GetService("Players")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local UiTheme = require(script.Parent:WaitForChild("UiTheme"))
local MilitaryView = require(script.Parent:WaitForChild("MilitaryView"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCMilitary"
gui.ResetOnSpawn = false
gui.Enabled = false
gui:SetAttribute("CloseByEnabled", true) -- PanelDress adds the X: this panel opens by gui.Enabled
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local W = MilitaryView.W
local INK = Color3.fromRGB(226, 231, 242)
local MUTED = Color3.fromRGB(143, 155, 179)

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, W, 0, MilitaryView.panelHeight(1))
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

local heading = text(panel, 14, 8, W - 70, 28, 22, UiTheme.FONT, Color3.fromRGB(240, 242, 248))
heading.Name = "Heading"
heading.Text = "Military"
local summary = text(panel, 14, 38, W - 28, 20, 15)
summary.RichText = true
local types = text(panel, 14, 62, W - 28, 20, 14, nil, MUTED)

local list = Instance.new("ScrollingFrame")
list.Name = "Units"
list.Position = UDim2.new(0, 8, 0, MilitaryView.HEAD_H - 6)
list.Size = UDim2.new(1, -16, 0, 60)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 8
list.Parent = panel
local INNER = W - 16 - 12
local KIND_COLOR = { combat = Color3.fromRGB(240, 132, 108), civil = Color3.fromRGB(140, 196, 255) }

local function drawRow(y, r)
	local row = Instance.new("TextButton")
	row.Name = "Unit"
	row.Position = UDim2.new(0, 0, 0, y)
	row.Size = UDim2.new(0, INNER, 0, MilitaryView.ROW_H)
	row.BackgroundColor3 = Color3.fromRGB(40, 48, 66)
	row.Text = ""
	row.Parent = list
	UiTheme.row(row)
	local stripe = Instance.new("Frame")
	stripe.Size = UDim2.new(0, 4, 1, 0)
	stripe.BackgroundColor3 = KIND_COLOR[r.kind]
	stripe.BorderSizePixel = 0
	stripe.Parent = row
	local name = text(row, 14, 2, 190, 20, 16, Enum.Font.GothamBold)
	name.Text = r.name
	if r.veteran then
		local vet = text(row, 14, 20, 80, 18, 14, Enum.Font.GothamBold, Color3.fromRGB(255, 225, 130))
		vet.Text = "Veteran"
	end
	local stats = text(row, 210, 2, 150, 20, 14)
	stats.RichText = true
	stats.Text = ('<font color="#f0846c"><b>%d</b></font> attack   <font color="#8cc4ff"><b>%d</b></font> defense'):format(r.attack, r.defense)
	local moves = text(row, 210, 20, 150, 18, 14, nil, MUTED)
	moves.Text = ("%d %s a turn"):format(r.moves, r.moves == 1 and "move" or "moves")
	local where = text(row, 366, 2, INNER - 374, 20, 14)
	where.Text = ("%s (%d,%d)"):format(r.where, r.x, r.y)
	local home = text(row, 366, 20, INNER - 374, 18, 14, nil, r.home ~= nil and MUTED or Color3.fromRGB(143, 209, 122))
	home.Text = r.home ~= nil and ("supported by " .. r.home) or "no upkeep city"
	row.Activated:Connect(function()
		print(("[Military] go to %s %s (%d,%d)"):format(r.name, tostring(r.id), r.x, r.y))
		gui.Enabled = false
		ClientState.focusCamera(r.x, r.y)
		ClientState.selectedUnitId = r.id
	end)
end

local function refresh()
	local view = ClientState.view
	if view == nil then
		return
	end
	local rows = MilitaryView.rows(view, ClientState.rulesets())
	local s = MilitaryView.summary(rows)
	for _, child in ipairs(list:GetChildren()) do
		child:Destroy()
	end
	if s.total == 0 then
		summary.Text = "You have no units."
		types.Text = ""
	else
		summary.Text = ('<b>%d</b> %s    <font color="#f0846c"><b>%d</b></font> combat    <font color="#8cc4ff"><b>%d</b></font> civil    <font color="#ffe182"><b>%d</b></font> veteran')
			:format(s.total, s.total == 1 and "unit" or "units", s.combat, s.civil, s.veterans)
		local bits = {}
		for _, t in ipairs(s.byType) do
			bits[#bits + 1] = ("%d %s"):format(t.count, t.name)
		end
		types.Text = table.concat(bits, "  -  ")
	end
	for i, r in ipairs(rows) do
		drawRow((i - 1) * (MilitaryView.ROW_H + MilitaryView.ROW_GAP), r)
	end
	local h, content = MilitaryView.panelHeight(#rows)
	panel.Size = UDim2.new(0, W, 0, h)
	list.Size = UDim2.new(1, -16, 0, h - MilitaryView.HEAD_H - 2)
	list.CanvasSize = UDim2.new(0, 0, 0, content)
end

ClientState.onMilitaryToggle(function()
	gui.Enabled = not gui.Enabled
	if gui.Enabled then
		ClientState.panelOpened("military")
		refresh()
	end
end)
ClientState.onPanelOpen(function(id)
	if id ~= "military" then
		gui.Enabled = false
	end
end)
ClientState.onView(function()
	if gui.Enabled then
		refresh()
	end
end)

-- UI tour (specs/roblox-parity-plan.md step 0): open / close without a click
ClientState.registerPanel("military", panel, function()
	gui.Enabled = true
	ClientState.panelOpened("military")
	refresh()
end, function()
	gui.Enabled = false
end)

print("[Military] military overview up (Military button)")
