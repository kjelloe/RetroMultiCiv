-- R5: city view + production picker (roblox/SPEC.md §3f, docs/13 T0 row).
-- Opens when Select clicks an own city. Everything shown comes from the
-- FILTERED view (own cities arrive whole) plus the baked ruleset tables for
-- display data (names, costs, tech locks) — browser catalog rules: buildable
-- shown, locked greyed with the reason. Actions are commands only:
-- setProduction {item}, buy, and sellBuilding, through the same dispatcher.
-- R13: built-buildings strip with per-row sell (A97 two-step confirm, one
-- sale/city/turn, Palace exempt). R15: buildings/wonders carry plain-language
-- effects sublines (CatalogText = the catalog-text.js twin). R16 wire:
-- options.hideFuture hides the one-tech-lookahead rows entirely.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local WorkedTiles = require(script.Parent:WaitForChild("WorkedTiles")) -- R7c-3
local CatalogText = require(script.Parent:WaitForChild("CatalogText")) -- R15
-- session-E round 13: read-only engine math for the rush-buy price preview
local citiesModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("cities"))
local BuildQueue = require(script.Parent:WaitForChild("BuildQueue")) -- CP8
local Tooltip = require(script.Parent:WaitForChild("Tooltip")) -- SO2

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
stats.Active = true -- SO2: tooltip target (attached below openCityId's decl)

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

-- session-E round 13 (user): rush-buy asks first — an inline confirmation
-- stating the exact engine price (itemCost + buyGoldPerShield math, the
-- same numbers buyProduction will charge; the server still judges)
local buyConfirm = Instance.new("Frame")
buyConfirm.Size = UDim2.new(0, 296, 0, 58)
buyConfirm.Position = UDim2.new(0, 8, 0, 98)
buyConfirm.BackgroundColor3 = Color3.fromRGB(46, 38, 22)
buyConfirm.BorderSizePixel = 0
buyConfirm.Visible = false
buyConfirm.ZIndex = 5
buyConfirm.Parent = panel
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = buyConfirm
end
local buyLabel = Instance.new("TextLabel")
buyLabel.Size = UDim2.new(1, -12, 0, 24)
buyLabel.Position = UDim2.new(0, 6, 0, 4)
buyLabel.BackgroundTransparency = 1
buyLabel.TextColor3 = Color3.fromRGB(245, 225, 180)
buyLabel.Font = Enum.Font.SourceSansBold
buyLabel.TextSize = 16
buyLabel.TextXAlignment = Enum.TextXAlignment.Left
buyLabel.ZIndex = 5
buyLabel.Parent = buyConfirm
local function confirmBtn(x, text, color)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, 64, 0, 24)
	b.Position = UDim2.new(0, x, 0, 30)
	b.BackgroundColor3 = color
	b.TextColor3 = Color3.fromRGB(240, 240, 240)
	b.Font = Enum.Font.SourceSansBold
	b.TextSize = 15
	b.Text = text
	b.ZIndex = 5
	b.Parent = buyConfirm
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 6)
	c.Parent = b
	return b
end
local buyYes = confirmBtn(6, "Yes", Color3.fromRGB(148, 108, 46))
local buyNo = confirmBtn(78, "No", Color3.fromRGB(60, 60, 66))

-- CP8: the queue strip along the panel bottom — click trims the LAST item
-- (v1 divergence from the browser: no per-item remove/reorder yet)
local queueStrip = Instance.new("TextButton")
queueStrip.Size = UDim2.new(1, -16, 0, 22)
queueStrip.Position = UDim2.new(0, 8, 1, -26)
queueStrip.BackgroundColor3 = Color3.fromRGB(30, 40, 32)
queueStrip.BackgroundTransparency = 0.3
queueStrip.TextColor3 = Color3.fromRGB(190, 225, 190)
queueStrip.Font = Enum.Font.Code
queueStrip.TextSize = 13
queueStrip.TextXAlignment = Enum.TextXAlignment.Left
queueStrip.TextTruncate = Enum.TextTruncate.AtEnd
queueStrip.Visible = false
queueStrip.Text = ""
queueStrip.Parent = panel

local function paintQueue()
	local q = openCityId ~= nil and BuildQueue.get(openCityId) or {}
	if #q == 0 then
		queueStrip.Visible = false
		return
	end
	local rs = ClientState.rulesets()
	local names = {}
	for _, it in ipairs(q) do
		local table_ = it.kind == "unit" and rs.units
			or it.kind == "wonder" and rs.wonders or rs.buildings
		table.insert(names, (table_[it.id] and table_[it.id].name) or it.id)
	end
	queueStrip.Text = ("  queue: %s  (tap trims last)"):format(table.concat(names, " > "))
	queueStrip.Visible = true
end
BuildQueue.onChanged(paintQueue)
queueStrip.Activated:Connect(function()
	if openCityId ~= nil then
		local q = BuildQueue.get(openCityId)
		BuildQueue.removeAt(openCityId, #q)
	end
end)

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
local closePanel -- forward-declared: addRow's double-click close needs it
local lastProdClick = nil -- session-E round 12: double-click select-and-close

-- SO2 (C2 twin): the city-yields ledger on the stats line — worked-tile
-- totals from the shared cities module (factors, not pipeline)
Tooltip.attach(stats, function()
	local view = ClientState.view
	local city = view ~= nil and openCityId ~= nil and view.cities[openCityId] or nil
	if city == nil then
		return ""
	end
	local rs = ClientState.rulesets()
	local shim = { map = view.map, players = view.players, cities = view.cities,
		cityOrder = view.cityOrder, units = view.units, wonders = view.wonders }
	local ok, y = pcall(citiesModule.cityYields, shim, city, rs)
	if not ok or y == nil then
		return "yield breakdown unavailable (fog)"
	end
	return ("worked-tile totals\n  food %d  shields %d  trade %d\npop %d - specialists: tax %d sci %d\n(city tile always works free)")
		:format(y.food or 0, y.shields or 0, y.trade or 0, city.pop or 1,
			city.taxmen or 0, city.scientists or 0)
end)

local function sortedIds(t)
	local ids = {}
	for id in pairs(t) do
		table.insert(ids, id)
	end
	table.sort(ids)
	return ids
end

-- one catalog row: buildable = white button that sends setProduction;
-- locked = greyed label carrying the lock reason (browser catalog rule).
-- R15: buildings/wonders grow a plain-language effects subline (CatalogText,
-- the catalog-text.js twin); wonders without effects show the prestige line.
local function addRow(order, kind, id, def, lockReason, effects)
	local twoLine = effects ~= nil and effects ~= ""
	local row = Instance.new("TextButton")
	row.Size = UDim2.new(1, -8, 0, twoLine and 36 or 22)
	row.LayoutOrder = order
	row.BackgroundColor3 = lockReason and Color3.fromRGB(38, 40, 48) or Color3.fromRGB(50, 66, 92)
	row.TextColor3 = lockReason and Color3.fromRGB(130, 130, 136) or Color3.fromRGB(235, 235, 235)
	row.Font = Enum.Font.Code
	row.TextSize = 14
	row.TextXAlignment = Enum.TextXAlignment.Left
	row.TextYAlignment = Enum.TextYAlignment.Top
	row.RichText = true
	row.Text = ("  %s %s (%d)%s%s"):format(kind, def.name or id, def.cost or 0,
		lockReason and ("  — " .. lockReason) or "",
		twoLine and ('\n  <font size="12" color="#9db2c8">' .. effects .. "</font>") or "")
	row.Parent = list
	if not lockReason then
		local function pick()
			print(("[CityPanel] setProduction %s -> %s %s"):format(openCityId, kind, id))
			ClientState.send({ type = "setProduction", cityId = openCityId, item = { kind = kind, id = id } })
		end
		row.Activated:Connect(function()
			pick()
			-- session-E round 12 (user): DOUBLE-CLICK selects AND closes
			local now = os.clock()
			local key = kind .. ":" .. id
			if lastProdClick ~= nil and lastProdClick.key == key and now - lastProdClick.t < 0.5 then
				lastProdClick = nil
				closePanel()
				return
			end
			lastProdClick = { key = key, t = now }
		end)
		-- touch: LONG-PRESS (>=0.5s) selects and closes (the double-click twin)
		local touchStart = nil
		row.InputBegan:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.Touch then
				touchStart = os.clock()
			end
		end)
		row.InputEnded:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.Touch and touchStart ~= nil then
				if os.clock() - touchStart >= 0.5 then
					pick()
					closePanel()
				end
				touchStart = nil
			end
		end)
		-- CP8: the Q+ chip enqueues instead of setting (child button sinks
		-- the click, so the row's set-production never double-fires)
		local qBtn = Instance.new("TextButton")
		qBtn.Size = UDim2.new(0, 30, 0, 18)
		qBtn.Position = UDim2.new(1, -34, 0, 2)
		qBtn.BackgroundColor3 = Color3.fromRGB(60, 84, 60)
		qBtn.TextColor3 = Color3.fromRGB(210, 240, 210)
		qBtn.Font = Enum.Font.SourceSansBold
		qBtn.TextSize = 13
		qBtn.Text = "Q+"
		qBtn.Parent = row
		qBtn.Activated:Connect(function()
			if openCityId ~= nil then
				BuildQueue.add(openCityId, kind, id)
				print(("[CityPanel] queued %s %s for %s"):format(kind, id, openCityId))
			end
		end)
	end
	return twoLine and 38 or 24
end

-- R13 (A97/A86 twin): the built-buildings strip with per-row SELL — price =
-- cost x sellPriceRatio, two-step confirm (armed 3s), one sale/city/turn
-- (soldThisTurn greys the strip), the Palace never sells. Server judges all.
local sellConfirm = { key = nil, until_ = 0 }

local function addBuildingRow(order, id, def, price, sold)
	local row = Instance.new("Frame")
	row.Size = UDim2.new(1, -8, 0, 22)
	row.LayoutOrder = order
	row.BackgroundColor3 = Color3.fromRGB(32, 38, 50)
	row.BorderSizePixel = 0
	row.Parent = list
	local name = Instance.new("TextLabel")
	name.Size = UDim2.new(1, -78, 1, 0)
	name.BackgroundTransparency = 1
	name.TextColor3 = Color3.fromRGB(210, 218, 230)
	name.Font = Enum.Font.Code
	name.TextSize = 14
	name.TextXAlignment = Enum.TextXAlignment.Left
	name.Text = "  " .. (def.name or id)
	name.Parent = row
	if def.effect ~= nil and def.effect.isPalace == true then
		return -- the Palace is not sellable (engine rule)
	end
	local sell = Instance.new("TextButton")
	sell.Size = UDim2.new(0, 72, 0, 18)
	sell.Position = UDim2.new(1, -74, 0, 2)
	sell.Font = Enum.Font.SourceSansBold
	sell.TextSize = 13
	local armed = sellConfirm.key == openCityId .. ":" .. id and os.clock() <= sellConfirm.until_
	sell.BackgroundColor3 = sold and Color3.fromRGB(38, 40, 48)
		or (armed and Color3.fromRGB(150, 60, 50) or Color3.fromRGB(90, 62, 42))
	sell.TextColor3 = sold and Color3.fromRGB(120, 120, 126) or Color3.fromRGB(240, 225, 210)
	sell.Text = sold and "sold" or (armed and "SURE?" or ("sell +%dg"):format(price))
	sell.Parent = row
	if not sold then
		sell.Activated:Connect(function()
			local key = openCityId .. ":" .. id
			if sellConfirm.key == key and os.clock() <= sellConfirm.until_ then
				sellConfirm.key = nil
				print(("[CityPanel] sellBuilding %s %s (+%dg)"):format(openCityId, id, price))
				ClientState.send({ type = "sellBuilding", cityId = openCityId, building = id })
			else
				sellConfirm.key = key
				sellConfirm.until_ = os.clock() + 3
				sell.Text = "SURE?"
				sell.BackgroundColor3 = Color3.fromRGB(150, 60, 50)
			end
		end)
	end
end

local function refresh()
	buyConfirm.Visible = false -- any view push may change gold/shields: never
	-- leave a stale price on screen
	paintQueue() -- CP8: the strip follows the open city
	local view = ClientState.view
	if openCityId == nil or view == nil then
		return
	end
	local city = view.cities[openCityId]
	if city == nil or city.owner ~= view.you or city.pop == nil then
		gui.Enabled = false -- lost, razed, or only a rival shell in view
		openCityId = nil
		WorkedTiles.hide()
		return
	end
	WorkedTiles.refresh() -- R7c-3: the in-world fat cross tracks the panel
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
		if child:IsA("TextButton") or child:IsA("Frame") then
			child:Destroy()
		end
	end
	local built = {}
	for _, b in ipairs(city.buildings or {}) do
		built[b] = true
	end
	local catalogText = CatalogText.make(rs) -- R15
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
	local canvasY = 0
	local HIDE = "\0hide"
	local function lockFor(kind, id, def)
		if def.tech ~= nil and def.tech ~= "" and not myTechs[def.tech] then
			if not techReachable(def.tech) then
				return HIDE
			end
			-- R16 wire: hideFuture hides even the one-tech-lookahead rows
			if ClientState.options.hideFuture then
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

	-- R13: the built-buildings strip (sell affordance) sits above the catalog
	if #(city.buildings or {}) > 0 then
		local ratio = rs.rules.sellPriceRatio or 1
		for _, id in ipairs(city.buildings) do
			local def = rs.buildings[id]
			if def ~= nil then
				order += 1
				addBuildingRow(order, id, def, (def.cost or 0) * ratio, city.soldThisTurn == true)
				canvasY += 24
			end
		end
	end

	for _, group in ipairs({ { "unit", rs.units }, { "building", rs.buildings }, { "wonder", rs.wonders } }) do
		for _, id in ipairs(sortedIds(group[2])) do
			local def = group[2][id]
			local lock = lockFor(group[1], id, def)
			if lock ~= HIDE then
				order += 1
				-- R15: plain-language effects (buildings/wonders; wonders
				-- without effects show the browser's prestige line)
				local effects = nil
				if group[1] == "building" or group[1] == "wonder" then
					effects = catalogText.effectText(def)
					if effects == "" and group[1] == "wonder" then
						effects = ("prestige - score +%d"):format(rs.rules.scorePerWonder or 0)
					end
				end
				canvasY += addRow(order, group[1], id, def, lock, effects)
			end
		end
	end
	list.CanvasSize = UDim2.new(0, 0, 0, canvasY)
end

ClientState.onCityOpen(function(cityId)
	openCityId = cityId
	gui.Enabled = true
	WorkedTiles.show(cityId) -- R7c-3: fat cross + camera fly-to
	refresh()
end)

ClientState.onView(refresh)

function closePanel() -- assigns the forward declaration above addRow
	gui.Enabled = false
	openCityId = nil
	WorkedTiles.hide()
end
closeBtn.Activated:Connect(closePanel)
WorkedTiles.onCloseRequest(closePanel) -- the big in-world CLOSE button (run-4)

buyBtn.Activated:Connect(function()
	local view = ClientState.view
	local city = view ~= nil and openCityId ~= nil and view.cities[openCityId] or nil
	local me = view ~= nil and view.players[view.you] or nil
	if city == nil or me == nil or city.producing == nil then
		return
	end
	local rs = ClientState.rulesets()
	local prod = city.producing
	local def = prod.kind == "unit" and rs.units[prod.id]
		or prod.kind == "building" and rs.buildings[prod.id]
		or prod.kind == "wonder" and rs.wonders[prod.id]
	local ok, cost = pcall(function()
		return citiesModule.itemCost(prod.kind, prod.id, def, me, rs)
	end)
	if not ok or def == nil then
		-- price preview failed: fall back to the old direct send, server judges
		print("[CityPanel] buy in " .. openCityId)
		ClientState.send({ type = "buy", cityId = openCityId })
		return
	end
	local missing = cost - (city.shields or 0)
	if missing <= 0 then
		print("[CityPanel] nothing to buy - the box is full, completes at the turn wrap")
		return
	end
	local rate = prod.kind == "wonder" and rs.rules.buyGoldPerShieldWonder or rs.rules.buyGoldPerShield
	local price = missing * rate
	buyLabel.Text = ("Rush buy %s for %d gold? (you have %d)")
		:format(def.name or prod.id, price, me.gold or 0)
	buyConfirm.Visible = true
end)
buyYes.Activated:Connect(function()
	buyConfirm.Visible = false
	if openCityId ~= nil then
		print("[CityPanel] buy in " .. openCityId)
		ClientState.send({ type = "buy", cityId = openCityId })
	end
end)
buyNo.Activated:Connect(function()
	buyConfirm.Visible = false
end)

print("[CityPanel] city panel up (R13 sell strip, R15 effects sublines, hideFuture wired)")
