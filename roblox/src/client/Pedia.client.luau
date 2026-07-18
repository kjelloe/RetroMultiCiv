-- R19: the Civilopedia (docs/13 Tier-2; the browser A58b panel's Roblox
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

local gui = Instance.new("ScreenGui")
gui.Name = "RMCPedia"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

-- session-E: top-right button row beside Options (its panel opens below,
-- so this button must not sit in that column)
local openBtn = Instance.new("TextButton")
openBtn.Size = UDim2.new(0, 78, 0, 36)
openBtn.Position = UDim2.new(1, -244, 0, 8)
openBtn.BackgroundColor3 = Color3.fromRGB(52, 64, 52)
openBtn.TextColor3 = Color3.fromRGB(220, 240, 220)
openBtn.Font = Enum.Font.SourceSansBold
openBtn.TextSize = 18
openBtn.Text = "Pedia"
openBtn.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = openBtn
end

local frame = Instance.new("Frame")
frame.Size = UDim2.new(0, 760, 0, 440)
frame.Position = UDim2.new(0.5, -380, 0.5, -220)
frame.BackgroundColor3 = Color3.fromRGB(20, 24, 32)
frame.BackgroundTransparency = 0.04
frame.BorderSizePixel = 0
frame.Visible = false
frame.Parent = gui

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -40, 0, 30)
title.BackgroundTransparency = 1
title.TextColor3 = Color3.fromRGB(235, 235, 235)
title.Font = Enum.Font.SourceSansBold
title.TextSize = 22
title.Text = "Civilopedia"
title.Parent = frame

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 26, 0, 26)
closeBtn.Position = UDim2.new(1, -30, 0, 2)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
closeBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
closeBtn.Font = Enum.Font.SourceSansBold
closeBtn.TextSize = 16
closeBtn.Text = "X"
closeBtn.Parent = frame

local catBar = Instance.new("Frame")
catBar.Size = UDim2.new(0, 120, 1, -40)
catBar.Position = UDim2.new(0, 6, 0, 34)
catBar.BackgroundTransparency = 1
catBar.Parent = frame
local catLayout = Instance.new("UIListLayout")
catLayout.SortOrder = Enum.SortOrder.LayoutOrder
catLayout.Padding = UDim.new(0, 3)
catLayout.Parent = catBar

local listPane = Instance.new("ScrollingFrame")
listPane.Size = UDim2.new(0, 200, 1, -40)
listPane.Position = UDim2.new(0, 132, 0, 34)
listPane.BackgroundColor3 = Color3.fromRGB(26, 30, 40)
listPane.BorderSizePixel = 0
listPane.ScrollBarThickness = 6
listPane.Parent = frame
local listLayout = Instance.new("UIListLayout")
listLayout.SortOrder = Enum.SortOrder.LayoutOrder
listLayout.Padding = UDim.new(0, 2)
listLayout.Parent = listPane

local detail = Instance.new("ScrollingFrame")
detail.Size = UDim2.new(1, -350, 1, -40)
detail.Position = UDim2.new(0, 340, 0, 34)
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
detailText.Font = Enum.Font.Code
detailText.TextSize = 15
detailText.TextWrapped = true
detailText.TextXAlignment = Enum.TextXAlignment.Left
detailText.TextYAlignment = Enum.TextYAlignment.Top
detailText.Text = ""
detailText.Parent = detail

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
			return stat("Attack", u.attack or 0) .. stat("Defense", u.defense or 0)
				.. stat("Moves", u.moves or 0) .. stat("Cost", (u.cost or 0) .. " shields")
				.. stat("Domain", u.domain or "land") .. reqLine(u)
		end },
		{ key = "buildings", label = "Buildings", list = function()
			return sorted(rs.buildings)
		end, render = function(id, b)
			return stat("Cost", (b.cost or 0) .. " shields")
				.. stat("Upkeep", (b.maintenance or 0) .. " gold/turn")
				.. "\n" .. (cat.effectText(b) ~= "" and cat.effectText(b) or "a civic improvement")
				.. reqLine(b)
		end },
		{ key = "wonders", label = "Wonders", list = function()
			return sorted(rs.wonders)
		end, render = function(id, w)
			return stat("Cost", (w.cost or 0) .. " shields")
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

local function showEntry(catDef, id, def)
	title.Text = "Civilopedia - " .. (def.name or id)
	detailText.Text = catDef.render(id, def)
	detail.CanvasPosition = Vector2.new(0, 0)
end

local function renderList()
	for _, child in ipairs(listPane:GetChildren()) do
		if child:IsA("TextButton") then
			child:Destroy()
		end
	end
	local catDef = cats[curCat]
	local entries = catDef.list()
	for i, pair in ipairs(entries) do
		local row = Instance.new("TextButton")
		row.Size = UDim2.new(1, -8, 0, 22)
		row.LayoutOrder = i
		row.BackgroundColor3 = Color3.fromRGB(40, 50, 66)
		row.TextColor3 = Color3.fromRGB(225, 230, 238)
		row.Font = Enum.Font.Code
		row.TextSize = 14
		row.TextXAlignment = Enum.TextXAlignment.Left
		row.Text = "  " .. (pair[2].name or pair[1])
		row.Parent = listPane
		row.Activated:Connect(function()
			showEntry(catDef, pair[1], pair[2])
		end)
	end
	listPane.CanvasSize = UDim2.new(0, 0, 0, #entries * 24)
	if entries[1] ~= nil then
		showEntry(catDef, entries[1][1], entries[1][2])
	end
end

local function buildCatButtons()
	for i, catDef in ipairs(cats) do
		local b = Instance.new("TextButton")
		b.Size = UDim2.new(1, 0, 0, 26)
		b.LayoutOrder = i
		b.BackgroundColor3 = Color3.fromRGB(50, 66, 92)
		b.TextColor3 = Color3.fromRGB(235, 235, 235)
		b.Font = Enum.Font.SourceSansBold
		b.TextSize = 15
		b.Text = catDef.label
		b.Parent = catBar
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

print("[Pedia] R19 Civilopedia up (PEDIA button, top right)")
