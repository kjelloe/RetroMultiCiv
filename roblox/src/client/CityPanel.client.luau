-- R5: city view + production picker (roblox/SPEC.md §3f, docs/13 T0 row).
-- Opens when Select clicks an own city. Everything shown comes from the
-- FILTERED view (own cities arrive whole) plus the baked ruleset tables for
-- display data (names, costs, tech locks) — browser catalog rules: buildable
-- shown, locked greyed with the reason. Actions are commands only:
-- setProduction {item} and buy, through the same dispatcher path.

local Players = game:GetService("Players")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCCityPanel"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 320, 0, 420)
panel.Position = UDim2.new(1, -328, 0, 48)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.08
panel.BorderSizePixel = 0
panel.Parent = gui

local function label(name, y, size, text)
	local l = Instance.new("TextLabel")
	l.Name = name
	l.Size = UDim2.new(1, -16, 0, size)
	l.Position = UDim2.new(0, 8, 0, y)
	l.BackgroundTransparency = 1
	l.TextColor3 = Color3.fromRGB(235, 235, 235)
	l.Font = Enum.Font.Code
	l.TextSize = size - 2
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.Text = text
	l.Parent = panel
	return l
end

local title = label("Title", 6, 22, "")
local stats = label("Stats", 30, 16, "")
local producing = label("Producing", 50, 16, "")

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 24, 0, 24)
closeBtn.Position = UDim2.new(1, -28, 0, 4)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
closeBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
closeBtn.Font = Enum.Font.SourceSansBold
closeBtn.TextSize = 16
closeBtn.Text = "X"
closeBtn.Parent = panel

local buyBtn = Instance.new("TextButton")
buyBtn.Size = UDim2.new(0, 120, 0, 26)
buyBtn.Position = UDim2.new(0, 8, 0, 70)
buyBtn.BackgroundColor3 = Color3.fromRGB(148, 108, 46)
buyBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
buyBtn.Font = Enum.Font.SourceSansBold
buyBtn.TextSize = 16
buyBtn.Text = "Buy"
buyBtn.Parent = panel

local list = Instance.new("ScrollingFrame")
list.Size = UDim2.new(1, -16, 1, -110)
list.Position = UDim2.new(0, 8, 0, 102)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 6
list.Parent = panel
local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 2)
layout.Parent = list

local openCityId = nil

local function sortedIds(t)
	local ids = {}
	for id in pairs(t) do
		table.insert(ids, id)
	end
	table.sort(ids)
	return ids
end

-- one catalog row: buildable = white button that sends setProduction;
-- locked = greyed label carrying the lock reason (browser catalog rule)
local function addRow(order, kind, id, def, lockReason)
	local row = Instance.new("TextButton")
	row.Size = UDim2.new(1, -8, 0, 22)
	row.LayoutOrder = order
	row.BackgroundColor3 = lockReason and Color3.fromRGB(38, 40, 48) or Color3.fromRGB(50, 66, 92)
	row.TextColor3 = lockReason and Color3.fromRGB(130, 130, 136) or Color3.fromRGB(235, 235, 235)
	row.Font = Enum.Font.Code
	row.TextSize = 14
	row.TextXAlignment = Enum.TextXAlignment.Left
	row.Text = ("  %s %s (%d)%s"):format(kind, def.name or id, def.cost or 0,
		lockReason and ("  — " .. lockReason) or "")
	row.Parent = list
	if not lockReason then
		row.Activated:Connect(function()
			print(("[CityPanel] setProduction %s -> %s %s"):format(openCityId, kind, id))
			ClientState.send({ type = "setProduction", cityId = openCityId, item = { kind = kind, id = id } })
		end)
	end
end

local function refresh()
	local view = ClientState.view
	if openCityId == nil or view == nil then
		return
	end
	local city = view.cities[openCityId]
	if city == nil or city.owner ~= view.you or city.pop == nil then
		gui.Enabled = false -- lost, razed, or only a rival shell in view
		openCityId = nil
		return
	end
	local rs = ClientState.rulesets()
	local me = view.players[view.you]
	local myTechs = {}
	for _, t in ipairs(me.techs or {}) do
		myTechs[t] = true
	end

	title.Text = ("%s  (pop %d)"):format(city.name, city.pop)
	stats.Text = ("food %d · shields %d · gold %d"):format(city.food or 0, city.shields or 0, me.gold or 0)
	local prodDef = (rs[city.producing.kind .. "s"] or {})[city.producing.id]
	producing.Text = ("producing: %s %s (%d/%d)"):format(city.producing.kind,
		prodDef and prodDef.name or city.producing.id, city.shields or 0,
		prodDef and prodDef.cost or 0)

	for _, child in ipairs(list:GetChildren()) do
		if child:IsA("TextButton") then
			child:Destroy()
		end
	end
	local built = {}
	for _, b in ipairs(city.buildings or {}) do
		built[b] = true
	end
	-- R7a (1): one-tech-lookahead filter — a tech is "reachable" when every
	-- prereq is already known (the availableTechs rule, inlined). Entries
	-- beyond that horizon are HIDDEN, not greyed (accepted divergence from
	-- the browser's locked-with-reasons: Studio screen space, docs/13)
	local function techReachable(techId)
		local def = rs.techs[techId]
		if def == nil then
			return false
		end
		for _, p in ipairs(def.prereqs or {}) do
			if not myTechs[p] then
				return false
			end
		end
		return true
	end
	local order = 0
	local HIDE = "\0hide"
	local function lockFor(kind, id, def)
		if def.tech ~= nil and def.tech ~= "" and not myTechs[def.tech] then
			if not techReachable(def.tech) then
				return HIDE
			end
			local techDef = rs.techs[def.tech]
			return "needs " .. (techDef and techDef.name or def.tech)
		end
		if kind == "building" and built[id] then
			return "built"
		end
		if kind == "wonder" and view.wonders ~= nil and view.wonders[id] ~= nil then
			return "taken"
		end
		return nil
	end
	for _, group in ipairs({ { "unit", rs.units }, { "building", rs.buildings }, { "wonder", rs.wonders } }) do
		for _, id in ipairs(sortedIds(group[2])) do
			local lock = lockFor(group[1], id, group[2][id])
			if lock ~= HIDE then
				order += 1
				addRow(order, group[1], id, group[2][id], lock)
			end
		end
	end
	list.CanvasSize = UDim2.new(0, 0, 0, order * 24)
end

ClientState.onCityOpen(function(cityId)
	openCityId = cityId
	gui.Enabled = true
	refresh()
end)

ClientState.onView(refresh)

closeBtn.Activated:Connect(function()
	gui.Enabled = false
	openCityId = nil
end)

buyBtn.Activated:Connect(function()
	if openCityId ~= nil then
		print("[CityPanel] buy in " .. openCityId)
		ClientState.send({ type = "buy", cityId = openCityId })
	end
end)

print("[CityPanel] R5 city panel up")
