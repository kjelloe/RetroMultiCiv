-- R7d (3): city list (roblox/SPEC.md §3j). Own cities from the view — name,
-- pop, production with progress — tap a row to jump the camera there AND
-- open the city panel. C toggles (chat-guarded). View-only + channels.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCCityList"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 280, 0, 300)
panel.Position = UDim2.new(0, 316, 0, 44)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.08
panel.BorderSizePixel = 0
panel.Parent = gui

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -16, 0, 22)
title.Position = UDim2.new(0, 8, 0, 4)
title.BackgroundTransparency = 1
title.TextColor3 = Color3.fromRGB(235, 235, 235)
title.Font = Enum.Font.Code
title.TextSize = 18
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = "Cities (C)"
title.Parent = panel

local list = Instance.new("ScrollingFrame")
list.Size = UDim2.new(1, -16, 1, -36)
list.Position = UDim2.new(0, 8, 0, 30)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 6
list.Parent = panel
local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 2)
layout.Parent = list

local function refresh()
	local view = ClientState.view
	if view == nil then
		return
	end
	local rs = ClientState.rulesets()
	for _, child in ipairs(list:GetChildren()) do
		if child:IsA("TextButton") then
			child:Destroy()
		end
	end
	local order = 0
	for _, cid in ipairs(view.cityOrder or {}) do
		local c = view.cities[cid]
		if c ~= nil and c.owner == view.you and c.pop ~= nil then
			order += 1
			local prodDef = c.producing and (rs[c.producing.kind .. "s"] or {})[c.producing.id]
			local row = Instance.new("TextButton")
			row.Size = UDim2.new(1, -8, 0, 22)
			row.LayoutOrder = order
			row.BackgroundColor3 = Color3.fromRGB(50, 66, 92)
			row.TextColor3 = Color3.fromRGB(235, 235, 235)
			row.Font = Enum.Font.Code
			row.TextSize = 13
			row.TextXAlignment = Enum.TextXAlignment.Left
			row.TextTruncate = Enum.TextTruncate.AtEnd
			row.Text = ("  %s (pop %d) - %s %d/%d"):format(c.name, c.pop,
				prodDef and prodDef.name or (c.producing and c.producing.id or "?"),
				c.shields or 0, prodDef and prodDef.cost or 0)
			row.Parent = list
			row.Activated:Connect(function()
				print(("[CityList] jump to %s (%d,%d)"):format(c.name, c.x, c.y))
				ClientState.focusCamera(c.x, c.y)
				ClientState.openCity(cid)
			end)
		end
	end
	title.Text = ("Cities (C) - %d"):format(order)
	list.CanvasSize = UDim2.new(0, 0, 0, order * 24)
end

local function setOpen(open)
	gui.Enabled = open
	if open then
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

print("[CityList] R7d city list up (C toggles, Cities button)")
