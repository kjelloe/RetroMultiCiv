-- session-E round 18 (user): the LEGEND — a left-edge button opening a
-- panel that explains every keyboard shortcut. The rows live in LegendData
-- (the single place to keep current when a hotkey is added; gate 46 fails
-- when a bound key is missing there).
-- Presentation only: reads nothing, sends nothing.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCLegend"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local toggle = Instance.new("TextButton")
toggle.Size = UDim2.new(0, 190, 0, 40)
toggle.Position = UDim2.new(0, 8, 1, -92) -- above the Turn log toggle
toggle.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
toggle.BackgroundTransparency = 0.25
toggle.TextColor3 = Color3.fromRGB(235, 235, 235)
toggle.Font = Enum.Font.GothamBold
toggle.TextSize = 18
toggle.TextXAlignment = Enum.TextXAlignment.Left
toggle.Text = "  Legend"
toggle.Parent = gui
require(script.Parent:WaitForChild("UiTheme")).apply(toggle, { color = "neutral", icon = "legend" }) -- U2 dress
require(script.Parent:WaitForChild("LeftStack")).register(toggle, 2) -- phone: one icon row, bottom-left
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = toggle
end

local UiTheme = require(script.Parent:WaitForChild("UiTheme"))
local LegendData = require(script.Parent:WaitForChild("LegendData"))

-- shot18 (user): the legend was a monospace sheet under the left column.
-- Now a panel beside the column: sections, each row = key caps + what they do.
local W, H = 480, 500
local panel = Instance.new("Frame")
panel.Name = "Panel"
panel.Size = UDim2.new(0, W, 0, H)
panel.Position = UDim2.new(0, 206, 1, -(H + 56)) -- right of the 190 px button column, above the action bar
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.05
panel.BorderSizePixel = 0
panel.Visible = false
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
heading.Text = "Controls"
text(panel, 14, 36, W - 28, 18, 14, nil, Color3.fromRGB(143, 155, 179)).Text = "Keyboard and mouse. Buttons also work by click or tap."

local list = Instance.new("ScrollingFrame")
list.Name = "Rows"
list.Position = UDim2.new(0, 8, 0, 62)
list.Size = UDim2.new(1, -16, 1, -70)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 8
list.Parent = panel

local ROW_H, HEAD_H, ROW_W = 30, 30, W - 16 - 12
local y = 0
for _, section in ipairs(LegendData.SECTIONS) do
	local head = text(list, 6, y + 6, ROW_W, 20, 15, Enum.Font.GothamBold, Color3.fromHex(section.color))
	head.Text = section.title
	y += HEAD_H
	for n, row in ipairs(section.rows) do
		local line = Instance.new("Frame")
		line.Position = UDim2.new(0, 0, 0, y)
		line.Size = UDim2.new(0, ROW_W, 0, ROW_H - 2)
		line.BackgroundColor3 = Color3.fromRGB(40, 48, 66)
		line.BackgroundTransparency = n % 2 == 1 and 0.35 or 1
		line.BorderSizePixel = 0
		line.Parent = list
		round(line, 6)
		local lay = LegendData.capLayout(row)
		for _, cap in ipairs(lay.caps) do
			local c = text(line, 6 + cap.x, 2, cap.w, LegendData.CAP_H, 14, Enum.Font.GothamBold, Color3.fromRGB(240, 242, 248))
			c.BackgroundTransparency = 0
			c.BackgroundColor3 = Color3.fromRGB(62, 72, 96)
			c.TextXAlignment = Enum.TextXAlignment.Center
			c.Text = cap.label
			round(c, 6)
			local edge = Instance.new("UIStroke")
			edge.Color = Color3.fromRGB(110, 124, 156)
			edge.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
			edge.Parent = c
		end
		for _, j in ipairs(lay.joiners) do
			local t = text(line, 6 + j.x, 2, j.w, LegendData.CAP_H, 14, nil, Color3.fromRGB(143, 155, 179))
			t.TextXAlignment = Enum.TextXAlignment.Center
			t.Text = j.text
		end
		local what = text(line, 6 + LegendData.KEY_COL, 2, ROW_W - LegendData.KEY_COL - 12, LegendData.CAP_H, 15)
		what.TextTruncate = Enum.TextTruncate.AtEnd
		what.Text = row.text
		y += ROW_H
	end
	y += 6
end
list.CanvasSize = UDim2.new(0, 0, 0, y)

toggle.Activated:Connect(function()
	panel.Visible = not panel.Visible
	if panel.Visible then
		ClientState.panelOpened("legend") -- run-F #1: hide Debug / Turn log
	end
end)

ClientState.onPanelOpen(function(id)
	if id ~= "legend" then
		panel.Visible = false
	end
end)

-- UI tour (specs/roblox-parity-plan.md step 0): open / close without a click
ClientState.registerPanel("legend", panel, function()
	panel.Visible = true
	ClientState.panelOpened("legend")
end, function()
	panel.Visible = false
end)

print("[Legend] keyboard legend up (left-edge button)")
