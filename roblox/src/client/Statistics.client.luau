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
-- SO8 (ruling @d1ce4920): score-over-time chart drawn from the PULLED
-- world-public series ({t="stats"}); flat 3px dots per civ per column,
-- downsampled to <=88 columns. Requested on every J-expand, never pushed.
local CHART_H = 110
local chart = Instance.new("Frame")
chart.Name = "Chart"
chart.Size = UDim2.new(1, -16, 0, CHART_H)
chart.BackgroundColor3 = Color3.fromRGB(12, 14, 22)
chart.BorderSizePixel = 0
chart.Visible = false
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

-- SO8: the last pulled battles/wonders tallies (world-public); refresh() folds
-- the per-civ battle record into its row + lists the wonders timeline.
local lastBattles = {}
local lastWonders = {}

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
				local b = lastBattles[pid]
				if b ~= nil and (b.won ~= 0 or b.lost ~= 0) then
					text = text .. (" · ⚔ %d-%d"):format(b.won or 0, b.lost or 0)
				end
				addRow(order, text, hexColor(Palette.displayColor(p.color or "#888888")))
		end
	end
	-- SO8: the wonders timeline (last few world-public wonderBuilt, newest last)
	if #lastWonders > 0 then
		order += 1
		addRow(order, "🏛 Wonders", nil, true)
		local startAt = math.max(1, #lastWonders - 7)
		for i = startAt, #lastWonders do
			local w = lastWonders[i]
			order += 1
			local owner = w.owner ~= nil and view.players[w.owner] or nil
			local rs2 = ClientState.rulesets()
			local wname = (rs2.wonders[w.wonder] or {}).name or w.wonder
			addRow(order, ("  T%d  %s — %s"):format(w.turn or 0, owner and owner.name or "?", wname))
		end
	end
	panel.Size = UDim2.new(0, 460, 0, 40 + order * 20 + (chart.Visible and CHART_H + 12 or 0))
	chart.Position = UDim2.new(0, 8, 0, 34 + order * 20)
	chart.Parent = panel
end

local function drawChart(series)
	chart:ClearAllChildren()
	if #series < 2 or ClientState.view == nil then
		chart.Visible = false
		return
	end
	local view = ClientState.view
	local maxScore = 1
	for _, sm in ipairs(series) do
		for _, sc in pairs(sm.scores) do
			if sc > maxScore then
				maxScore = sc
			end
		end
	end
	local cols = math.min(#series, 88)
	local stepIdx = #series / cols
	local w = 444
	for _, pid in ipairs(view.playerOrder or {}) do
		local p = view.players[pid]
		local color = hexColor(Palette.displayColor((p ~= nil and p.color) or "#888888"))
		for c = 1, cols do
			local sm = series[math.max(1, math.floor(c * stepIdx))]
			local sc = sm ~= nil and sm.scores[pid] or nil
			if sc ~= nil then
				local dot = Instance.new("Frame")
				dot.Size = UDim2.new(0, 4, 0, 3)
				dot.Position = UDim2.new(0, math.floor((c - 1) / cols * w),
					0, CHART_H - 4 - math.floor(sc / maxScore * (CHART_H - 8)))
				dot.BorderSizePixel = 0
				dot.BackgroundColor3 = color
				dot.Parent = chart
			end
		end
	end
	chart.Visible = true
	refresh() -- resize the panel around the chart
end
ClientState.onStats(function(series, battles, wonders)
	lastBattles = battles or {}
	lastWonders = wonders or {}
	drawChart(series) -- draws the chart, then refresh() folds in battles/wonders
end)

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
			ClientState.panelOpened("stats") -- runI item 18: closes the city view
			refresh()
			ClientState.requestStats() -- SO8: pull the series on expand
		else
			chart.Visible = false
		end
	end
end)

print("[Stats] R7d statistics up (J toggles; SO8 score chart + battles/wonders)")
