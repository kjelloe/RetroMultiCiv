-- R19: the Encyclopedia (docs/13 Tier-2; the browser A58b panel's Roblox
-- twin). Three panes: category buttons / entry list / detail. All display
-- text comes from the baked rulesets + CatalogText (effect lines, unlock
-- maps) + PediaConcepts (the 14 original concept entries) — facts and
-- original prose only, never wiki sentences. Cross-references render as
-- plain names in v1 (tap-to-jump = v2, flagged). PEDIA button top-right
-- toggles; pure presentation, nothing here acts on the game.

local Players = game:GetService("Players")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local CatalogText = require(script.Parent:WaitForChild("CatalogText"))
local CONCEPTS = require(script.Parent:WaitForChild("PediaConcepts"))
local PediaBlurbs = require(script.Parent:WaitForChild("PediaBlurbs")) -- run-F #9
local PediaArt = require(script.Parent:WaitForChild("PediaArt"))
local PediaPicture = require(script.Parent:WaitForChild("PediaPicture"))
local TechGlyphs = require(script.Parent:WaitForChild("TechGlyphs"))
local WonderScene = require(script.Parent:WaitForChild("WonderScene"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCPedia"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

-- session-E: top-right button row beside Options (its panel opens below,
-- so this button must not sit in that column)
local openBtn = Instance.new("TextButton")
openBtn.Size = UDim2.new(0, 118, 0, 36)
openBtn.Position = UDim2.new(1, -284, 0, 8)
openBtn.BackgroundColor3 = Color3.fromRGB(52, 64, 52)
openBtn.TextColor3 = Color3.fromRGB(220, 240, 220)
openBtn.Font = Enum.Font.SourceSansBold
openBtn.TextSize = 18
openBtn.Text = "Encyclopedia"
openBtn.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = openBtn
end
require(script.Parent:WaitForChild("UiTheme")).apply(openBtn, { color = "menu", icon = "pedia" }) -- U1: chunky game-style dress
require(script.Parent:WaitForChild("HudDock")).register(openBtn, { id = "pedia", order = 2 }) -- U3: one planned top row

local frame = Instance.new("Frame")
-- run-R (user, shot7): reading faces and sizes, a 44 px header, wider panes;
-- PanelDress scales the whole panel per screen
frame.Size = UDim2.new(0, 880, 0, 520)
frame.Position = UDim2.new(0.5, -440, 0.5, -260)
frame.BackgroundColor3 = Color3.fromRGB(20, 24, 32)
frame.BackgroundTransparency = 0.04
frame.BorderSizePixel = 0
frame.Visible = false
frame.Parent = gui

local UiThemeMod = require(script.Parent:WaitForChild("UiTheme"))
local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -60, 0, 40)
title.Position = UDim2.new(0, 14, 0, 4)
title.BackgroundTransparency = 1
title.TextColor3 = Color3.fromRGB(240, 242, 248)
title.Font = UiThemeMod.FONT
title.TextSize = 24
title.TextXAlignment = Enum.TextXAlignment.Left
title.TextTruncate = Enum.TextTruncate.AtEnd
title.Text = "Encyclopedia"
title.Parent = frame

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 34, 0, 34)
closeBtn.Position = UDim2.new(1, -42, 0, 7)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
closeBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
closeBtn.Font = Enum.Font.SourceSansBold
closeBtn.TextSize = 18
closeBtn.Text = "X"
closeBtn.Parent = frame
require(script.Parent:WaitForChild("UiTheme")).apply(closeBtn, { color = "danger", radius = 8 }) -- U2 dress

local catBar = Instance.new("Frame")
catBar.Size = UDim2.new(0, 160, 1, -58)
catBar.Position = UDim2.new(0, 10, 0, 50)
catBar.BackgroundTransparency = 1
catBar.Parent = frame
local catLayout = Instance.new("UIListLayout")
catLayout.SortOrder = Enum.SortOrder.LayoutOrder
catLayout.Padding = UDim.new(0, 6)
catLayout.Parent = catBar

local listPane = Instance.new("ScrollingFrame")
listPane.Size = UDim2.new(0, 240, 1, -58)
listPane.Position = UDim2.new(0, 178, 0, 50)
listPane.BackgroundColor3 = Color3.fromRGB(26, 30, 40)
listPane.BorderSizePixel = 0
listPane.ScrollBarThickness = 6
listPane.Parent = frame
local listLayout = Instance.new("UIListLayout")
listLayout.SortOrder = Enum.SortOrder.LayoutOrder
listLayout.Padding = UDim.new(0, 2)
listLayout.Parent = listPane

local detail = Instance.new("ScrollingFrame")
detail.Size = UDim2.new(1, -436, 1, -58)
detail.Position = UDim2.new(0, 426, 0, 50)
detail.BackgroundColor3 = Color3.fromRGB(26, 30, 40)
detail.BorderSizePixel = 0
detail.ScrollBarThickness = 6
detail.Parent = frame
local detailText = Instance.new("TextLabel")
detailText.Size = UDim2.new(1, -16, 0, 0)
detailText.Position = UDim2.new(0, 8, 0, 6)
detailText.AutomaticSize = Enum.AutomaticSize.Y
detailText.BackgroundTransparency = 1
detailText.RichText = true
detailText.TextColor3 = Color3.fromRGB(225, 230, 238)
detailText.Font = UiThemeMod.BODY_FONT
detailText.TextSize = UiThemeMod.TEXT.body
detailText.TextWrapped = true
detailText.TextXAlignment = Enum.TextXAlignment.Left
detailText.TextYAlignment = Enum.TextYAlignment.Top
detailText.Text = ""
detailText.Parent = detail
-- specs/roblox-pedia-art.md P1: the entry's picture, above the text
local artBox = Instance.new("Frame")
artBox.Name = "ArtBox"
artBox.BackgroundTransparency = 1
artBox.BorderSizePixel = 0
artBox.Visible = false
artBox.Parent = detail
local artCaption = Instance.new("TextLabel") -- cost and requirement, or the era
artCaption.Name = "ArtCaption"
artCaption.BackgroundTransparency = 1
artCaption.Font = Enum.Font.GothamBold
artCaption.TextSize = 15
artCaption.TextColor3 = Color3.fromRGB(240, 198, 60)
artCaption.TextXAlignment = Enum.TextXAlignment.Left
artCaption.TextTruncate = Enum.TextTruncate.AtEnd
artCaption.Visible = false
artCaption.Parent = detail

local function fmtYields(y)
	if y == nil then
		return "0 / 0 / 0"
	end
	return ("%d / %d / %d"):format(y.food or 0, y.shields or 0, y.trade or 0)
end

local function stat(label, value)
	return ('<font color="#9db2c8">%s:</font> <b>%s</b>\n'):format(label, tostring(value))
end

local function techName(rs, id)
	local def = rs.techs[id]
	return def ~= nil and def.name or id
end

-- per-category: list() -> { {id, def} sorted by name }, render(id, def) -> text
local function makeCats(rs, cat)
	local function sorted(t)
		local out = {}
		for id, def in pairs(t) do
			table.insert(out, { id, def })
		end
		table.sort(out, function(a, b)
			return (a[2].name or a[1]) < (b[2].name or b[1])
		end)
		return out
	end
	local function reqLine(def)
		if def.tech ~= nil and def.tech ~= "" then
			return "\nRequires " .. techName(rs, def.tech)
		end
		return "\nAvailable from the start"
	end
	return {
		{ key = "units", label = "Units", list = function()
			return sorted(rs.units)
		end, render = function(id, u)
			-- run-F #9: the ally flavor blurb leads, then the stats
			local blurb = PediaBlurbs.UNIT_BLURBS[id]
			return (blurb ~= nil and blurb .. "\n\n" or "")
				.. stat("Attack", u.attack or 0) .. stat("Defense", u.defense or 0)
				.. stat("Moves", u.moves or 0) .. stat("Cost", (u.cost or 0) .. " shields")
				.. stat("Domain", u.domain or "land") .. reqLine(u)
		end },
		{ key = "buildings", label = "Buildings", list = function()
			return sorted(rs.buildings)
		end, render = function(id, b)
			local blurb = PediaBlurbs.BUILDING_BLURBS[id] -- run-F #9
			return (blurb ~= nil and blurb .. "\n\n" or "")
				.. stat("Cost", (b.cost or 0) .. " shields")
				.. stat("Upkeep", (b.maintenance or 0) .. " gold/turn")
				.. "\n" .. (cat.effectText(b) ~= "" and cat.effectText(b) or "a civic improvement")
				.. reqLine(b)
		end },
		{ key = "wonders", label = "Wonders", list = function()
			return sorted(rs.wonders)
		end, render = function(id, w)
			local blurb = WonderScene.BLURB[id] -- the completion card shows the same line
			return (blurb ~= nil and blurb .. "\n\n" or "")
				.. stat("Cost", (w.cost or 0) .. " shields")
				.. "\n" .. (cat.effectText(w) ~= "" and cat.effectText(w) or "a wonder of the world")
				.. reqLine(w)
		end },
		{ key = "techs", label = "Advances", list = function()
			return sorted(rs.techs)
		end, render = function(id, t)
			local out = stat("Era", t.era or "?") .. stat("Tier", t.level or 0)
			if t.prereqs ~= nil and #t.prereqs > 0 then
				local names = {}
				for _, p in ipairs(t.prereqs) do
					table.insert(names, techName(rs, p))
				end
				out ..= "\nNeeds " .. table.concat(names, " + ")
			else
				out ..= "\nA starting advance"
			end
			if cat.techUnlocks[id] ~= nil then
				out ..= "\n\nUnlocks: " .. table.concat(cat.techUnlocks[id], ", ")
			end
			if cat.techLeadsTo[id] ~= nil then
				out ..= "\nLeads to: " .. table.concat(cat.techLeadsTo[id], ", ")
			end
			return out
		end },
		{ key = "governments", label = "Governments", list = function()
			return sorted(rs.governments)
		end, render = function(id, g)
			return stat("Max tax/science rate", (g.maxRate or 0) .. "%")
				.. stat("Trade bonus", g.tradeBonus ~= nil and g.tradeBonus ~= 0
					and ("+" .. g.tradeBonus .. " on trade tiles") or "none")
				.. stat("Corruption", (g.corruptionFactor == 0 or g.corruptionFactor == nil)
					and "none" or ("factor " .. g.corruptionFactor))
				.. stat("Free units/city", g.freeUnitsPerCity or 0)
				.. stat("Martial law", (g.martialLawMax ~= nil and g.martialLawMax > 0)
					and ("up to " .. g.martialLawMax .. " units calm a city") or "none")
				.. stat("War unhappiness", g.warUnhappiness and "yes" or "no")
				.. reqLine(g)
		end },
		{ key = "terrain", label = "Terrain", list = function()
			return sorted(rs.terrain.terrains)
		end, render = function(id, t)
			local out = stat("Yields (F/S/T)", fmtYields(t.yields))
				.. stat("Defense", (t.defenseBonus ~= nil and t.defenseBonus ~= 0)
					and ("+" .. t.defenseBonus .. "%") or "none")
				.. stat("Move cost", t.move or 1)
			if t.special ~= nil and t.special.name ~= nil then
				out ..= ("\nSpecial resource: %s (%s)"):format(t.special.name, fmtYields(t.special.yields))
			end
			return out
		end },
		{ key = "concepts", label = "Concepts", list = function()
			local out = {}
			for _, c in ipairs(CONCEPTS) do
				table.insert(out, { c.id, c })
			end
			return out
		end, render = function(id, c)
			return c.body
		end },
	}
end

local cats = nil
local curCat = 1
local rowOf = {} -- entry id -> its list row
local catButtons = {}
local ROW_IDLE = Color3.fromRGB(40, 50, 66)
local ROW_PICKED = Color3.fromRGB(56, 128, 214) -- UiTheme's menu blue
local CAT_IDLE = Color3.fromRGB(50, 66, 92)

local function showEntry(catDef, id, def)
	title.Text = "Encyclopedia  ·  " .. (def.name or id)
	-- the picked entry stays lit, so the list shows where the detail came from
	for rid, row in pairs(rowOf) do
		row.BackgroundColor3 = rid == id and ROW_PICKED or ROW_IDLE
	end
	detailText.Text = catDef.render(id, def)
	detail.CanvasPosition = Vector2.new(0, 0)
	-- the picture: room from PediaArt.layout, drawing by PediaPicture
	local paneW = frame.Size.X.Offset + detail.Size.X.Offset -- authored px (PanelDress scales the panel)
	local art = PediaArt.resolve(catDef.key, id, PediaPicture.have())
	local lay = PediaArt.layout(paneW, art.kind)
	artBox.Position = UDim2.fromOffset(lay.box.x, lay.box.y)
	artBox.Size = UDim2.new(1, -2 * lay.box.x, 0, lay.box.h)
	artBox.Visible = lay.box.h > 0
	detailText.Position = UDim2.new(0, 8, 0, lay.textY)
	local rs = ClientState.rulesets()
	local caption = PediaArt.caption(catDef.key, def, (def.tech ~= nil and def.tech ~= "") and techName(rs, def.tech) or nil,
		catDef.key == "techs" and TechGlyphs.ERA_NAME[TechGlyphs.eraOf(rs.techs, id)] or nil)
	artCaption.Visible = lay.box.h > 0 and caption ~= ""
	artCaption.Position = UDim2.fromOffset(lay.box.x, lay.captionY)
	artCaption.Size = UDim2.new(1, -2 * lay.box.x, 0, PediaArt.CAPTION_H)
	artCaption.Text = caption
	local shown = PediaPicture.show(artBox, catDef.key, id, lay, ClientState.rulesets())
	print(("[Pedia] picture %s/%s kind=%s box=%dx%d"):format(catDef.key, id, shown, lay.box.w, lay.box.h))
end

local function renderList()
	for _, child in ipairs(listPane:GetChildren()) do
		if child:IsA("TextButton") then
			child:Destroy()
		end
	end
	local catDef = cats[curCat]
	local entries = catDef.list()
	rowOf = {}
	for i, pair in ipairs(entries) do
		local row = Instance.new("TextButton")
		row.Size = UDim2.new(1, -10, 0, 30)
		row.LayoutOrder = i
		row.BackgroundColor3 = ROW_IDLE
		row.AutoButtonColor = false
		row.BorderSizePixel = 0
		row.TextColor3 = Color3.fromRGB(230, 234, 242)
		row.Font = UiThemeMod.BODY_FONT
		row.TextSize = 16
		row.TextXAlignment = Enum.TextXAlignment.Left
		row.TextTruncate = Enum.TextTruncate.AtEnd
		row.Text = "   " .. (pair[2].name or pair[1])
		row.Parent = listPane
		local rcorner = Instance.new("UICorner")
		rcorner.CornerRadius = UDim.new(0, 6)
		rcorner.Parent = row
		rowOf[pair[1]] = row
		row.Activated:Connect(function()
			showEntry(catDef, pair[1], pair[2])
		end)
	end
	listPane.CanvasSize = UDim2.new(0, 0, 0, #entries * 32)
	for ci, b in ipairs(catButtons) do
		b.BackgroundColor3 = ci == curCat and ROW_PICKED or CAT_IDLE
	end
	if entries[1] ~= nil then
		showEntry(catDef, entries[1][1], entries[1][2])
	end
end

local function buildCatButtons()
	for i, catDef in ipairs(cats) do
		local b = Instance.new("TextButton")
		b.Size = UDim2.new(1, 0, 0, 38)
		b.LayoutOrder = i
		b.BackgroundColor3 = CAT_IDLE
		b.AutoButtonColor = false
		b.BorderSizePixel = 0
		b.TextColor3 = Color3.fromRGB(240, 242, 248)
		b.Font = UiThemeMod.FONT
		b.TextSize = 17
		b.Text = catDef.label
		b.Parent = catBar
		local bcorner = Instance.new("UICorner")
		bcorner.CornerRadius = UDim.new(0, 8)
		bcorner.Parent = b
		catButtons[i] = b
		b.Activated:Connect(function()
			curCat = i
			renderList()
		end)
	end
end

local function toggle()
	if not frame.Visible then
		if cats == nil then
			local rs = ClientState.rulesets()
			cats = makeCats(rs, CatalogText.make(rs))
			buildCatButtons()
			renderList()
		end
		frame.Visible = true
		ClientState.panelOpened("pedia") -- runI item 18: closes the city view
	else
		frame.Visible = false
	end
end

openBtn.Activated:Connect(toggle)
closeBtn.Activated:Connect(function()
	frame.Visible = false
end)

-- SO3: discovery-card deep link — open straight to a catalog entry
ClientState.onPediaOpen(function(catKey, id)
	if cats == nil then
		local rs = ClientState.rulesets()
		cats = makeCats(rs, CatalogText.make(rs))
		buildCatButtons()
		renderList()
	end
	for i, catDef in ipairs(cats) do
		if string.lower(catDef.label) == string.lower(tostring(catKey)) then
			curCat = i
			renderList()
			for _, pair in ipairs(catDef.list()) do
				if pair[1] == id then
					showEntry(catDef, pair[1], pair[2])
					break
				end
			end
			break
		end
	end
	frame.Visible = true
end)

-- UI tour (specs/roblox-parity-plan.md step 0): open / close without a click
ClientState.registerPanel("pedia", frame, function()
	if not frame.Visible then
		toggle()
	end
end, function()
	frame.Visible = false
end)

print("[Pedia] R19 Encyclopedia up (PEDIA button, top right)")
