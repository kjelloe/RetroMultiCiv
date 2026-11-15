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
local tradeModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("trade")) -- CP17 report
local happinessModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("happiness")) -- mood row
local governmentModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("government"))
local BuildQueue = require(script.Parent:WaitForChild("BuildQueue")) -- CP8
local Tooltip = require(script.Parent:WaitForChild("Tooltip")) -- SO2
local CatalogInfo = require(script.Parent:WaitForChild("CatalogInfo")) -- which rows, and their hover card
local PediaBlurbs = require(script.Parent:WaitForChild("PediaBlurbs"))
local CityView = require(script.Parent:WaitForChild("CityView")) -- plan step 1: food, specialists, capital, routes, cycling

local gui = Instance.new("ScreenGui")
gui.Name = "RMCCityPanel"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local UiTheme = require(script.Parent:WaitForChild("UiTheme"))

-- run-S item 20: the city panel in the card style (Cities list pattern) — a
-- population badge and name, coloured yield figures, a production card with a
-- progress bar and the Buy button, then the catalog in sections with a colour
-- stripe per kind.
local W = 360
local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, W, 0, 540)
panel.Position = UDim2.new(1, -(W + 8), 0, 48)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.05
panel.BorderSizePixel = 0
panel.Parent = gui

local INK = Color3.fromRGB(226, 231, 242)
local MUTED = Color3.fromRGB(143, 155, 179)
local KIND_COLOR = { unit = Color3.fromRGB(255, 160, 110), building = Color3.fromRGB(120, 190, 255),
	wonder = Color3.fromRGB(255, 225, 130) }

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
local function popColor(pop)
	return pop >= 13 and Color3.fromRGB(232, 190, 70) or pop >= 8 and Color3.fromRGB(60, 170, 190)
		or pop >= 4 and Color3.fromRGB(70, 170, 100) or Color3.fromRGB(110, 140, 110)
end

local badge = text(panel, 10, 8, 40, 40, 19, Enum.Font.GothamBold, Color3.fromRGB(16, 20, 26))
badge.BackgroundTransparency = 0
badge.TextXAlignment = Enum.TextXAlignment.Center
round(badge, 20)
local title = text(panel, 58, 7, W - 164, 24, 20, Enum.Font.GothamBold)
title.Name = "Title"
local subtitle = text(panel, 58, 30, W - 70, 18, 14, nil, MUTED)
local stats = text(panel, 12, 54, W - 24, 20, 15)
stats.Name = "Stats"
stats.RichText = true
stats.Active = true -- SO2: tooltip target (attached below openCityId's decl)
-- mood row (browser panels.js city-mood-row twin)
-- plan step 1.3: what the city makes and eats, and when it grows or starves
local foodLine = text(panel, 12, 76, W - 24, 20, 15)
foodLine.Name = "Food"
foodLine.RichText = true
foodLine.Active = true
local moodLabel = text(panel, 12, 98, W - 24, 20, 15)
moodLabel.Name = "Mood"
moodLabel.Active = true
-- plan step 1.1: specialists - turn an entertainer into a tax collector or a
-- scientist, or send them all back (the engine's setWorkers; size 5 and up)
local specLabel = text(panel, 12, 122, 150, 20, 14, nil, MUTED)
specLabel.Name = "Specialists"
specLabel.Active = true
local function specButton(x, w, label, color)
	local b = Instance.new("TextButton")
	b.Position = UDim2.new(0, x, 0, 120)
	b.Size = UDim2.new(0, w, 0, 24)
	b.BackgroundColor3 = color
	b.TextColor3 = Color3.fromRGB(18, 20, 28)
	b.Font = Enum.Font.GothamBold
	b.TextSize = 14
	b.Text = label
	b.Parent = panel
	round(b, 8)
	return b
end
local taxBtn = specButton(166, 64, "+ Tax", Color3.fromRGB(255, 225, 130))
local sciBtn = specButton(234, 64, "+ Sci", Color3.fromRGB(140, 196, 255))
local clearBtn = specButton(302, 50, "Reset", Color3.fromRGB(170, 178, 196))
-- plan step 1.2: previous / next city, beside the close button
local function navButton(x, label)
	local b = Instance.new("TextButton")
	b.Position = UDim2.new(1, x, 0, 6)
	b.Size = UDim2.new(0, 28, 0, 26)
	b.BackgroundColor3 = Color3.fromRGB(52, 64, 90)
	b.TextColor3 = INK
	b.Font = Enum.Font.GothamBold
	b.TextSize = 16
	b.Text = label
	b.Parent = panel
	round(b, 8)
	return b
end
local prevBtn = navButton(-98, "<")
local nextBtn = navButton(-66, ">")

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 26, 0, 26)
closeBtn.Position = UDim2.new(1, -32, 0, 6)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
closeBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
closeBtn.Font = Enum.Font.GothamBold
closeBtn.TextSize = 16
closeBtn.Text = "X"
closeBtn.Parent = panel
UiTheme.apply(closeBtn, { color = "danger", radius = 8 }) -- U2 dress

-- the production card: what the city builds, how far along, and Buy
local prodCard = Instance.new("Frame")
prodCard.Name = "Production"
prodCard.Position = UDim2.new(0, 8, 0, 150)
prodCard.Size = UDim2.new(1, -16, 0, 62)
prodCard.BackgroundColor3 = Color3.fromRGB(40, 48, 66)
prodCard.BorderSizePixel = 0
prodCard.Parent = panel
round(prodCard, 8)
local prodDot = Instance.new("Frame")
prodDot.Position = UDim2.new(0, 10, 0, 12)
prodDot.Size = UDim2.new(0, 10, 0, 10)
prodDot.BorderSizePixel = 0
prodDot.Parent = prodCard
round(prodDot, 5)
local producing = text(prodCard, 26, 6, W - 16 - 26 - 108, 22, 16, Enum.Font.GothamBold)
producing.Name = "Producing"
local prodTrack = Instance.new("Frame")
prodTrack.Position = UDim2.new(0, 10, 0, 38)
prodTrack.Size = UDim2.new(1, -100, 0, 12)
prodTrack.BackgroundColor3 = Color3.fromRGB(22, 26, 36)
prodTrack.BorderSizePixel = 0
prodTrack.Parent = prodCard
round(prodTrack, 6)
local prodFill = Instance.new("Frame")
prodFill.Size = UDim2.new(0, 0, 1, 0)
prodFill.BorderSizePixel = 0
prodFill.Parent = prodTrack
round(prodFill, 6)
local prodNum = text(prodCard, 0, 33, 76, 22, 14, Enum.Font.GothamBold)
prodNum.Position = UDim2.new(1, -84, 0, 33)
prodNum.TextXAlignment = Enum.TextXAlignment.Right

local buyBtn = Instance.new("TextButton")
buyBtn.Size = UDim2.new(0, 92, 0, 26)
buyBtn.Position = UDim2.new(1, -100, 0, 5)
buyBtn.BackgroundColor3 = Color3.fromRGB(148, 108, 46)
buyBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
buyBtn.Font = Enum.Font.GothamBold
buyBtn.TextSize = 16
buyBtn.Text = "Buy"
buyBtn.Parent = prodCard
UiTheme.apply(buyBtn, { color = "go", radius = 8 }) -- U2 dress

-- session-E round 13 (user): rush-buy asks first — an inline confirmation
-- stating the exact engine price (itemCost + buyGoldPerShield math, the
-- same numbers buyProduction will charge; the server still judges)
local buyConfirm = Instance.new("Frame")
buyConfirm.Size = UDim2.new(1, -16, 0, 62)
buyConfirm.Position = UDim2.new(0, 8, 0, 216)
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
buyLabel.Font = Enum.Font.GothamBold
buyLabel.TextSize = 15
buyLabel.TextTruncate = Enum.TextTruncate.AtEnd
buyLabel.TextXAlignment = Enum.TextXAlignment.Left
buyLabel.ZIndex = 5
buyLabel.Parent = buyConfirm
local function confirmBtn(x, text, color)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, 72, 0, 26)
	b.Position = UDim2.new(0, x, 0, 31)
	b.BackgroundColor3 = color
	b.TextColor3 = Color3.fromRGB(240, 240, 240)
	b.Font = Enum.Font.GothamBold
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
local buyNo = confirmBtn(86, "No", Color3.fromRGB(60, 60, 66))

local openCityId = nil -- declared before paintQueue: it was read as a global there (always nil)

-- CP8: the queue strip along the panel bottom — click trims the LAST item
-- (v1 divergence from the browser: no per-item remove/reorder yet)
local queueStrip = Instance.new("TextButton")
queueStrip.Size = UDim2.new(1, -16, 0, 24)
queueStrip.Position = UDim2.new(0, 8, 1, -30)
queueStrip.BackgroundColor3 = Color3.fromRGB(30, 40, 32)
queueStrip.BackgroundTransparency = 0.05
queueStrip.TextColor3 = Color3.fromRGB(190, 225, 190)
queueStrip.Font = Enum.Font.GothamMedium
queueStrip.TextSize = 14
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
	queueStrip.Text = ("  Queue: %s  (click removes the last)"):format(table.concat(names, " > "))
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
list.Size = UDim2.new(1, -16, 1, -226)
list.Position = UDim2.new(0, 8, 0, 218)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 8
list.Parent = panel
local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 4)
layout.Parent = list

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
	local routes = ""
	if city.tradeRoutes ~= nil and #city.tradeRoutes > 0 then
		-- CP17 (marker-0054): the engine's own tradeRouteReport — arrows per
		-- route, top-cap routes marked (counted); pure derived read
		local okR, report = pcall(tradeModule.tradeRouteReport, shim, city, rs)
		if okR and report ~= nil then
			local lines = {}
			for _, r in ipairs(report) do
				local partner = view.cities[r.partnerCityId]
				table.insert(lines, ("  %s +%d trade%s"):format(
					partner ~= nil and partner.name or r.partnerCityId,
					r.arrows or 0, r.counted and "" or " (over cap)"))
			end
			routes = "\ntrade routes:\n" .. table.concat(lines, "\n")
		end
	end
	return ("worked-tile totals\n  food %d  shields %d  trade %d\npop %d - specialists: tax %d sci %d%s\n(city tile always works free)")
		:format(y.food or 0, y.shields or 0, y.trade or 0, city.pop or 1,
			city.taxmen or 0, city.scientists or 0, routes)
end)

-- mood row: the engine's own cityMood on a read-only shim of the view (the
-- view carries difficulty, so contentCitizens resolves like the engine)
local MOOD_WONDER_EFFECTS = { "happyEverywhere", "contentEverywhere", "allContentInCity", "doublesTemple", "warUnhappyReduce" }

local function moodShim(view)
	return { map = view.map, players = view.players, cities = view.cities,
		cityOrder = view.cityOrder, units = view.units, wonders = view.wonders,
		playerOrder = view.playerOrder, difficulty = view.difficulty }
end

local function moodOf(view, city)
	local ok, mood = pcall(happinessModule.cityMood, moodShim(view), city, ClientState.rulesets())
	return ok and mood or nil
end

local function moodFaces(mood)
	return ("😊%d 😐%d 😠%d · 🎭%d 💰%d 🔬%d"):format(mood.happy, mood.content, mood.unhappy,
		mood.entertainers, mood.taxmen, mood.scientists)
end

local function moodTip(view, city, mood)
	local rs = ClientState.rulesets()
	local shim = moodShim(view)
	local me = view.players[city.owner]
	local d = rs.rules.difficulties ~= nil and view.difficulty ~= nil and rs.rules.difficulties[view.difficulty] or nil
	local contentN = d ~= nil and d.contentCitizens or rs.rules.contentCitizens
	local luxRate = me.luxRate or 0
	local okY, y = pcall(citiesModule.cityYields, shim, city, rs)
	local lux = okY and y ~= nil and (y.trade * luxRate) // 100 or 0
	lux += (lux * citiesModule.effectPct(city, rs, "luxBonus")) // 100
	lux += mood.entertainers * rs.rules.specialistOutput
	local oracleMine = false
	if citiesModule.wonderActive(shim, "oracle", rs) then
		local home = view.cities[view.wonders["oracle"]]
		oracleMine = home ~= nil and home.owner == city.owner
	end
	local bldgs = {}
	for _, b in ipairs(city.buildings or {}) do
		local eff = rs.buildings[b].effect
		if eff.contentBonus ~= nil then
			local v = eff.contentBonus
			if eff.contentDoubleTech ~= nil and table.find(me.techs or {}, eff.contentDoubleTech) ~= nil then
				v *= 2
			end
			if b == "temple" and oracleMine then
				v *= 2
			end
			table.insert(bldgs, ("%s +%d"):format(rs.buildings[b].name, v))
		end
	end
	local wids = {}
	for wid in pairs(view.wonders or {}) do
		table.insert(wids, wid)
	end
	table.sort(wids)
	local wonders = {}
	for _, wid in ipairs(wids) do
		local home = view.cities[view.wonders[wid]]
		if home ~= nil and home.owner == city.owner and citiesModule.wonderActive(shim, wid, rs) then
			local e = rs.wonders[wid].effect or {}
			for _, k in ipairs(MOOD_WONDER_EFFECTS) do
				if e[k] ~= nil then
					table.insert(wonders, rs.wonders[wid].name)
					break
				end
			end
		end
	end
	local lines = { "mood factors (the engine computes the faces):",
		("first %d workers are born content, the rest unhappy"):format(contentN),
		("luxuries %d (%d%% of trade + entertainers): one citizen up per %d"):format(lux, luxRate, rs.rules.luxPerStep) }
	if #bldgs > 0 then
		table.insert(lines, "content from buildings: " .. table.concat(bldgs, ", "))
	end
	if #wonders > 0 then
		table.insert(lines, "mood wonders: " .. table.concat(wonders, ", "))
	end
	local gov = governmentModule.governmentOf(shim, city.owner, rs)
	if gov ~= nil and (gov.warUnhappiness or 0) > 0 then
		table.insert(lines, ("%s: each military unit abroad upsets %d citizen(s)"):format(gov.name, gov.warUnhappiness))
	end
	return table.concat(lines, "\n")
end

Tooltip.attach(moodLabel, function()
	local view = ClientState.view
	local city = view ~= nil and openCityId ~= nil and view.cities[openCityId] or nil
	if city == nil then
		return ""
	end
	local mood = moodOf(view, city)
	if mood == nil then
		return ""
	end
	return moodTip(view, city, mood)
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
local function addSection(order, label, color)
	local h = text(list, 0, 0, 0, 22, 14, Enum.Font.GothamBold, color)
	h.Size = UDim2.new(1, -10, 0, 22)
	h.LayoutOrder = order
	h.Text = " " .. label
	return 26
end

local function addRow(order, kind, id, def, lockReason, effects, current, cardText)
	local twoLine = effects ~= nil and effects ~= ""
	local h = twoLine and 46 or 28
	local row = Instance.new("TextButton")
	row.Size = UDim2.new(1, -10, 0, h)
	row.LayoutOrder = order
	row.BackgroundColor3 = lockReason and Color3.fromRGB(34, 37, 46)
		or current and Color3.fromRGB(44, 78, 62) or Color3.fromRGB(46, 58, 82)
	row.Text = ""
	row.ClipsDescendants = true
	row.Parent = list
	UiTheme.row(row, { locked = lockReason ~= nil }) -- U5
	Tooltip.attach(row, function() -- shot19 (user): the encyclopedia entry on hover
		return cardText, "card"
	end)
	local stripe = Instance.new("Frame")
	stripe.Size = UDim2.new(0, 4, 1, 0)
	stripe.BackgroundColor3 = KIND_COLOR[kind]
	stripe.BackgroundTransparency = lockReason and 0.6 or 0
	stripe.BorderSizePixel = 0
	stripe.Parent = row
	-- right side: the lock reason, or the cost and the Q+ chip
	local rightW = lockReason and 150 or 86
	local name = text(row, 12, 4, W - 26 - 12 - rightW - 6, 20, 15, Enum.Font.GothamBold,
		lockReason and Color3.fromRGB(130, 134, 146) or INK)
	name.Text = def.name or id
	local right = text(row, 0, 4, rightW, 20, 14, lockReason and UiTheme.BODY_FONT or Enum.Font.GothamBold,
		lockReason and Color3.fromRGB(150, 140, 120) or Color3.fromRGB(255, 190, 140))
	right.TextXAlignment = Enum.TextXAlignment.Right
	if lockReason then
		right.Position = UDim2.new(1, -(rightW + 8), 0, 4)
		right.Text = lockReason
	else
		right.Position = UDim2.new(1, -(rightW + 42), 0, 4)
		right.Text = current and ("building  %d"):format(def.cost or 0) or tostring(def.cost or 0)
	end
	if twoLine then
		local sub = text(row, 12, 24, W - 26 - 24, 18, 14, nil, Color3.fromRGB(157, 178, 200))
		sub.Text = effects
	end
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
		qBtn.Size = UDim2.new(0, 34, 0, 20)
		qBtn.Position = UDim2.new(1, -40, 0, 4)
		qBtn.BackgroundColor3 = Color3.fromRGB(60, 84, 60)
		qBtn.TextColor3 = Color3.fromRGB(210, 240, 210)
		qBtn.Font = Enum.Font.GothamBold
		qBtn.TextSize = 14
		qBtn.Text = "Q+"
		qBtn.Parent = row
		round(qBtn, 6)
		qBtn.Activated:Connect(function()
			if openCityId ~= nil then
				BuildQueue.add(openCityId, kind, id)
				print(("[CityPanel] queued %s %s for %s"):format(kind, id, openCityId))
			end
		end)
	end
	return h + 4
end

-- R13 (A97/A86 twin): the built-buildings strip with per-row SELL — price =
-- cost x sellPriceRatio, two-step confirm (armed 3s), one sale/city/turn
-- (soldThisTurn greys the strip), the Palace never sells. Server judges all.
local sellConfirm = { key = nil, until_ = 0 }

local function addBuildingRow(order, id, def, price, sold, cardText)
	local row = Instance.new("Frame")
	row.Size = UDim2.new(1, -10, 0, 28)
	row.LayoutOrder = order
	row.BackgroundColor3 = Color3.fromRGB(32, 38, 50)
	row.BorderSizePixel = 0
	row.Parent = list
	round(row, 6)
	row.Active = true
	Tooltip.attach(row, function()
		return cardText, "card"
	end)
	local name = text(row, 12, 4, W - 26 - 12 - 100, 20, 15, nil, Color3.fromRGB(210, 218, 230))
	name.Text = def.name or id
	if def.effect ~= nil and def.effect.isPalace == true then
		return -- the Palace is not sellable (engine rule)
	end
	local sell = Instance.new("TextButton")
	sell.Size = UDim2.new(0, 88, 0, 20)
	sell.Position = UDim2.new(1, -94, 0, 4)
	sell.Font = Enum.Font.GothamBold
	round(sell, 6)
	sell.TextSize = 14
	local armed = sellConfirm.key == openCityId .. ":" .. id and os.clock() <= sellConfirm.until_
	sell.BackgroundColor3 = sold and Color3.fromRGB(38, 40, 48)
		or (armed and Color3.fromRGB(150, 60, 50) or Color3.fromRGB(90, 62, 42))
	sell.TextColor3 = sold and Color3.fromRGB(120, 120, 126) or Color3.fromRGB(240, 225, 210)
	sell.Text = sold and "sold" or (armed and "SURE?" or ("Sell +%d"):format(price))
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

local lastFood, lastSpec = nil, nil -- what the hover cards and the specialist buttons read

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

	title.Text = city.name
	badge.Text = tostring(city.pop)
	badge.BackgroundColor3 = popColor(city.pop)
	-- W4 WLTKD (1.0-close #2): the celebrate line (browser panels.js banner twin;
	-- fog-honest — filterView strips `celebrating` from rival shells)
	local subText, subTone = CityView.subtitle(city, rs) -- capital mark, disorder, celebration
	subtitle.Text = subText
	subtitle.TextColor3 = subTone == "bad" and Color3.fromRGB(240, 110, 96)
		or subTone == "good" and Color3.fromRGB(255, 225, 130) or MUTED
	local mood = moodOf(view, city)
	moodLabel.Text = mood ~= nil and moodFaces(mood) or ""
	-- food and growth (the figures processCities uses)
	local yShim = { map = view.map, players = view.players, cities = view.cities, cityOrder = view.cityOrder,
		units = view.units, wonders = view.wonders, playerOrder = view.playerOrder, difficulty = view.difficulty }
	local okY, yields = pcall(citiesModule.cityYields, yShim, city, rs)
	local okT, threshold = pcall(citiesModule.growthThreshold, yShim, city, rs)
	if okY and yields ~= nil and okT then
		local f = CityView.food(city, yields.food or 0, CityView.settlersHomed(view, openCityId), rs.rules, threshold)
		lastFood = f
		local color = f.state == "growing" and "#8fd17a" or f.state == "starving" and "#f0846c" or "#ffe182"
		foodLine.Text = ('<font color="%s"><b>%+d</b> food a turn</font>   box <b>%d</b>/%d   <font color="%s">%s</font>'):format(
			color, f.surplus, f.box, f.threshold, color, f.line)
	else
		lastFood = nil
		foodLine.Text = ""
	end
	local spec = mood ~= nil and CityView.specialists(city, mood) or nil
	lastSpec = spec
	if spec ~= nil then
		specLabel.Text = ("%d free   %d tax   %d sci"):format(spec.entertainers, spec.taxmen, spec.scientists)
		taxBtn.BackgroundTransparency = spec.canAdd and 0 or 0.7
		sciBtn.BackgroundTransparency = spec.canAdd and 0 or 0.7
		clearBtn.BackgroundTransparency = spec.canClear and 0 or 0.7
	end
	prevBtn.Visible = CityView.neighbour(view, openCityId, -1) ~= nil
	nextBtn.Visible = prevBtn.Visible
	stats.Text = ('<font color="#8fd17a"><b>%d</b></font> food stored    <font color="#ffa06e"><b>%d</b></font> shields    <font color="#ffe182"><b>%d</b></font> gold')
		:format(city.food or 0, city.shields or 0, me.gold or 0)
	local prodDef = (rs[city.producing.kind .. "s"] or {})[city.producing.id]
	local prodCost = prodDef and prodDef.cost or 0
	local share = prodCost > 0 and math.clamp((city.shields or 0) / prodCost, 0, 1) or 0
	local kindColor = KIND_COLOR[city.producing.kind] or MUTED
	producing.Text = prodDef and prodDef.name or city.producing.id
	prodDot.BackgroundColor3 = kindColor
	prodFill.Size = UDim2.new(share, 0, 1, 0)
	prodFill.BackgroundColor3 = share >= 1 and Color3.fromRGB(110, 210, 120) or kindColor
	prodNum.Text = ("%d/%d"):format(city.shields or 0, prodCost)

	Tooltip.hide() -- a card may be up over a row about to be rebuilt
	for _, child in ipairs(list:GetChildren()) do
		if not child:IsA("UIListLayout") then
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
	local HIDE = CatalogInfo.HIDE
	local function techName(techId)
		local techDef = rs.techs[techId]
		return techDef and techDef.name or techId
	end
	-- shot19 (user): the Barbarian Leader was offered. The list now follows
	-- CatalogInfo.availability, the mirror of the engine's setProduction
	-- rejections (barb-only, obsolete, coast, nukes, tech, built, taken).
	local shim = { map = view.map, players = view.players, cities = view.cities,
		cityOrder = view.cityOrder, units = view.units, wonders = view.wonders, playerOrder = view.playerOrder }
	local okCoast, coastal = pcall(citiesModule.cityIsCoastal, shim, city, rs)
	local okNukes, nukes = pcall(citiesModule.nukesEnabled, shim, rs)
	local ctx = { techs = myTechs, reachable = techReachable, techName = techName,
		hideFuture = ClientState.options.hideFuture == true, built = built, wondersTaken = view.wonders or {},
		coastal = not okCoast or coastal == true, nukes = okNukes and nukes == true }
	local function lockFor(kind, id, def)
		return CatalogInfo.availability(kind, id, def, ctx)
	end
	local function cardFor(kind, id, def, effects, lock)
		local blurb = kind == "unit" and PediaBlurbs.UNIT_BLURBS[id] or kind == "building" and PediaBlurbs.BUILDING_BLURBS[id] or nil
		return CatalogInfo.card(kind, id, def, { blurb = blurb, effects = effects, techName = techName, lock = lock })
	end

	-- plan step 1.4: trade routes as their own section
	if city.tradeRoutes ~= nil and #city.tradeRoutes > 0 then
		local okR, report = pcall(tradeModule.tradeRouteReport, shim, city, rs)
		local routes = okR and CityView.routes(report, view) or {}
		if #routes > 0 then
			order += 1
			canvasY += addSection(order, "Trade routes", Color3.fromRGB(255, 225, 130))
			for _, r in ipairs(routes) do
				order += 1
				local line = text(list, 0, 0, 0, 22, 15, nil, r.counted and INK or MUTED)
				line.Size = UDim2.new(1, -10, 0, 22)
				line.LayoutOrder = order
				line.Text = ("   %s   +%d trade%s"):format(r.name, r.arrows, r.counted and "" or "  (over the limit, not counted)")
				canvasY += 26
			end
		end
	end

	-- R13: the built-buildings strip (sell affordance) sits above the catalog
	if #(city.buildings or {}) > 0 then
		local ratio = rs.rules.sellPriceRatio or 1
		order += 1
		canvasY += addSection(order, "Built here", Color3.fromRGB(170, 180, 200))
		for _, id in ipairs(city.buildings) do
			local def = rs.buildings[id]
			if def ~= nil then
				order += 1
				addBuildingRow(order, id, def, (def.cost or 0) * ratio, city.soldThisTurn == true,
					cardFor("building", id, def, catalogText.effectText(def), nil))
				canvasY += 32
			end
		end
	end

	for _, group in ipairs({ { "unit", rs.units, "Units" }, { "building", rs.buildings, "Buildings" },
		{ "wonder", rs.wonders, "Wonders" } }) do
		local headed = false
		for _, id in ipairs(sortedIds(group[2])) do
			local def = group[2][id]
			local lock = lockFor(group[1], id, def)
			if lock ~= HIDE then
				if not headed then
					headed = true
					order += 1
					canvasY += addSection(order, group[3], KIND_COLOR[group[1]])
				end
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
				canvasY += addRow(order, group[1], id, def, lock, effects,
					city.producing.kind == group[1] and city.producing.id == id,
					cardFor(group[1], id, def, effects, lock))
			end
		end
	end
	list.CanvasSize = UDim2.new(0, 0, 0, canvasY)
end

ClientState.onCityOpen(function(cityId)
	openCityId = cityId
	gui.Enabled = true
	ClientState.cityViewOpen = true -- runJ item 3: suppress the map-influence overlay
	ClientState.panelOpened("city") -- runI item 18: opening a city closes other panels
	WorkedTiles.show(cityId) -- R7c-3: fat cross + camera fly-to
	refresh()
end)

-- runI item 18: any OTHER panel opening (a menu button, the left stack) closes
-- the whole city view so it never sits under another panel
ClientState.onPanelOpen(function(id)
	if id ~= "city" and gui.Enabled then
		closePanel()
	end
end)

ClientState.onView(refresh)

-- specialists: the worked tiles stay as they are, one entertainer changes job
local function specialist(action)
	local view = ClientState.view
	local city = view ~= nil and openCityId ~= nil and view.cities[openCityId] or nil
	local mood = city ~= nil and moodOf(view, city) or nil
	if mood == nil then
		return
	end
	local rs = ClientState.rulesets()
	local shim = { map = view.map, players = view.players, cities = view.cities, cityOrder = view.cityOrder,
		units = view.units, wonders = view.wonders, playerOrder = view.playerOrder, difficulty = view.difficulty }
	local ok, worked = pcall(citiesModule.workedTiles, shim, city, rs)
	if not ok then
		return
	end
	local workers = {}
	for _, w in ipairs(worked) do
		if w.center ~= true then
			table.insert(workers, w.y * view.map.width + w.x)
		end
	end
	local cmd = CityView.specialistCommand(city, mood, workers, action)
	if cmd ~= nil then
		print(("[CityPanel] specialists %s in %s -> tax %d sci %d"):format(action, openCityId, cmd.taxmen, cmd.scientists))
		ClientState.send(cmd)
	end
end
taxBtn.Activated:Connect(function()
	specialist("taxman")
end)
sciBtn.Activated:Connect(function()
	specialist("scientist")
end)
clearBtn.Activated:Connect(function()
	specialist("clear")
end)
Tooltip.attach(specLabel, function()
	if lastSpec == nil then
		return ""
	end
	return ("Citizens not working a tile.\n%d free (entertainers: luxuries)\n%d tax collectors (gold)\n%d scientists (research)\n%s")
		:format(lastSpec.entertainers, lastSpec.taxmen, lastSpec.scientists,
			lastSpec.why or "+ Tax / + Sci turn one free citizen into a specialist. Reset sends them all back."), "card"
end)
Tooltip.attach(foodLine, function()
	local f = lastFood
	if f == nil then
		return ""
	end
	local lines = { ("The worked tiles make %d food."):format(f.made), ("%d citizens eat %d."):format(f.eaten / CityView.FOOD_PER_CITIZEN, f.eaten) }
	if f.settlerFood > 0 then
		table.insert(lines, ("%d Settlers supported here eat %d."):format(f.settlers, f.settlerFood))
	end
	table.insert(lines, ("Left over: %+d a turn. The city grows when the box reaches %d."):format(f.surplus, f.threshold))
	if f.warn ~= nil then
		table.insert(lines, f.warn)
	end
	return table.concat(lines, "\n"), "card"
end)
local function cycle(dir)
	local view = ClientState.view
	local to = view ~= nil and openCityId ~= nil and CityView.neighbour(view, openCityId, dir) or nil
	if to ~= nil then
		ClientState.openCity(to)
	end
end
prevBtn.Activated:Connect(function()
	cycle(-1)
end)
nextBtn.Activated:Connect(function()
	cycle(1)
end)

function closePanel() -- assigns the forward declaration above addRow
	gui.Enabled = false
	openCityId = nil
	ClientState.cityViewOpen = false -- runJ item 3: influence overlay may return
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

-- UI tour (specs/roblox-parity-plan.md step 0): open / close without a click
ClientState.registerPanel("city", panel, function()
	local view = ClientState.view
	for _, cid in ipairs(view ~= nil and view.cityOrder or {}) do
		local c = view.cities[cid]
		if c ~= nil and c.owner == view.you and c.pop ~= nil then
			ClientState.openCity(cid)
			return
		end
	end
end, function()
	closePanel()
end)

print("[CityPanel] city panel up (R13 sell strip, R15 effects sublines, hideFuture wired)")
