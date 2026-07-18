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
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 460, 0, 200)
panel.Position = UDim2.new(0.5, -230, 0, 42)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.08
panel.BorderSizePixel = 0
panel.Parent = gui

local rows = Instance.new("Frame")
rows.Size = UDim2.new(1, -16, 1, -12)
rows.Position = UDim2.new(0, 8, 0, 6)
rows.BackgroundTransparency = 1
rows.Parent = panel
local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 2)
layout.Parent = rows

local function hexColor(hex)
	local n = tonumber(string.sub(hex, 2), 16) or 0
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
end

local function addRow(order, text, color, bold)
	local holder = Instance.new("Frame")
	holder.Size = UDim2.new(1, 0, 0, 18)
	holder.LayoutOrder = order
	holder.BackgroundTransparency = 1
	holder.Parent = rows
	if color ~= nil then
		local chip = Instance.new("Frame")
		chip.Size = UDim2.new(0, 12, 0, 12)
		chip.Position = UDim2.new(0, 2, 0, 3)
		chip.BorderSizePixel = 0
		chip.BackgroundColor3 = color
		chip.Parent = holder
	end
	local label = Instance.new("TextLabel")
	label.Size = UDim2.new(1, -20, 1, 0)
	label.Position = UDim2.new(0, 20, 0, 0)
	label.BackgroundTransparency = 1
	label.TextColor3 = Color3.fromRGB(235, 235, 235)
	label.Font = bold and Enum.Font.SourceSansBold or Enum.Font.Code
	label.TextSize = bold and 15 or 13
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.TextTruncate = Enum.TextTruncate.AtEnd
	label.Text = text
	label.Parent = holder
end

local function refresh()
	local view = ClientState.view
	if view == nil then
		return
	end
	local rs = ClientState.rulesets()
	for _, child in ipairs(rows:GetChildren()) do
		if child:IsA("Frame") then
			child:Destroy()
		end
	end
	addRow(0, "Statistics (J)  -  what your envoys can see", nil, true)
	local order = 0
	for _, pid in ipairs(view.playerOrder or {}) do
		local p = view.players[pid]
		if p ~= nil then
			order += 1
			local cities, units = 0, 0
			for _, c in pairs(view.cities) do
				if c.owner == pid then
					cities += 1
				end
			end
			for _, u in pairs(view.units) do
				if u.owner == pid then
					units += 1
				end
			end
			-- R21 (unblocked by marker-0045: filterView passes stance for ALL
			-- players — intentionally public, Civ1 showed leader personalities
			-- openly): same authentic trait name the Lobby seat rows use
			local stanceTag = p.stance == "builder" and " [Perfectionist]" or ""
			local text
			if pid == view.you then
				-- engine default: unset government = despotism (run-4 fix)
				local gov = rs.governments[p.government or "despotism"]
				text = ("%s (you)%s - %d cities, %d units, gold %d, techs %d, %s%s"):format(
					p.name, stanceTag, cities, units, p.gold or 0, #(p.techs or {}),
					gov and gov.name or "?",
					p.researching ~= nil
						and (", researching " .. ((rs.techs[p.researching] or {}).name or p.researching))
						or ", research UNSET")
			else
				text = ("%s%s - %d cities seen, %d units in sight%s"):format(
					p.name, stanceTag, cities, units, p.human == true and " (human)" or "")
			end
			addRow(order, text, hexColor(Palette.displayColor(p.color or "#888888")))
		end
	end
	panel.Size = UDim2.new(0, 460, 0, 40 + order * 20)
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
	if input.KeyCode == Enum.KeyCode.J then
		gui.Enabled = not gui.Enabled
		if gui.Enabled then
			refresh()
		end
	end
end)

print("[Stats] R7d statistics up (J toggles)")
