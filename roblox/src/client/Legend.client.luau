-- session-E round 18 (user): the LEGEND — a left-edge button opening a
-- panel that explains every keyboard shortcut (for keyboard devices; the
-- list is the single place to keep current when a hotkey is added).
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
toggle.Position = UDim2.new(0, 8, 1, -76) -- above the Turn log toggle
toggle.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
toggle.BackgroundTransparency = 0.25
toggle.TextColor3 = Color3.fromRGB(235, 235, 235)
toggle.Font = Enum.Font.Code
toggle.TextSize = 18
toggle.TextXAlignment = Enum.TextXAlignment.Left
toggle.Text = "  Legend"
toggle.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = toggle
end

local LINES = {
	{ "UNITS", "" },
	{ "N", "next unit with moves (closes city view)" },
	{ "P", "ride / dismount the selected unit" },
	{ "WASD / arrows", "step the ridden unit (one tile)" },
	{ "F", "dismount; afoot: camera follow toggle" },
	{ "O", "GoTo - arm, then click the destination" },
	{ "B", "found city (settlers)" },
	{ "G", "fortify" },
	{ "Space", "wait (skip this unit)" },
	{ "X", "disband" },
	{ "I / M / R", "irrigate / mine / road (settlers)" },
	{ "", "" },
	{ "GAME", "" },
	{ "Return", "end turn" },
	{ "T", "research picker" },
	{ "C", "city list" },
	{ "J", "statistics" },
	{ "L", "turn log" },
	{ "V", "map border art" },
	{ "", "" },
	{ "CAMERA & MOUSE", "" },
	{ "LMB drag / click", "orbit / select tile-unit-city" },
	{ "RMB drag", "pan the map" },
	{ "wheel", "zoom" },
	{ "Q / E", "camera down / up" },
	{ "double-click", "list row: select AND close dialog" },
}

local panel = Instance.new("ScrollingFrame")
panel.Size = UDim2.new(0, 430, 0, 440)
panel.Position = UDim2.new(0, 8, 1, -524)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.08
panel.BorderSizePixel = 0
panel.ScrollBarThickness = 6
panel.CanvasSize = UDim2.new(0, 0, 0, #LINES * 22 + 12)
panel.Visible = false
panel.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = panel
end

for i, line in ipairs(LINES) do
	local row = Instance.new("TextLabel")
	row.Size = UDim2.new(1, -16, 0, 20)
	row.Position = UDim2.new(0, 8, 0, 6 + (i - 1) * 22)
	row.BackgroundTransparency = 1
	row.Font = Enum.Font.Code
	row.TextSize = 14
	row.TextXAlignment = Enum.TextXAlignment.Left
	row.RichText = true
	if line[2] == "" then -- section header
		row.TextColor3 = Color3.fromRGB(255, 220, 90)
		row.Text = line[1]
	else
		row.TextColor3 = Color3.fromRGB(220, 228, 240)
		row.Text = ('<font color="#8fd0ff">%-16s</font> %s'):format(line[1], line[2])
	end
	row.Parent = panel
end

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

print("[Legend] keyboard legend up (left-edge button)")
