-- Civilization gallery (run-S shot15, user): a centred overlay to look
-- through the civilizations with left / right arrows and choose one before
-- the game starts. The first card is RANDOM (the default: drawn at start).
-- Presentation + one callback; the server owns the pick (GameServer
-- `pickCiv`: one player per civ) and echoes it in the lobby payload.
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local UiTheme = require(script.Parent:WaitForChild("UiTheme"))
local Diag = require(script.Parent:WaitForChild("Diag"))

local M = {}

local gui = Instance.new("ScreenGui")
gui.Name = "RMCCivGallery"
gui.ResetOnSpawn = false
gui.DisplayOrder = 30 -- over the host setup panel
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local W, H = 660, 430
local frame = Instance.new("Frame")
frame.Size = UDim2.new(0, W, 0, H)
frame.Position = UDim2.new(0.5, -W / 2, 0.5, -H / 2)
frame.BackgroundColor3 = Color3.fromRGB(20, 23, 32)
frame.BorderSizePixel = 0
frame.Visible = false
frame.Parent = gui

local function text(parent, name, x, y, w, h, size, font, color)
	local l = Instance.new("TextLabel")
	l.Name = name
	l.Position = UDim2.new(0, x, 0, y)
	l.Size = UDim2.new(0, w, 0, h)
	l.BackgroundTransparency = 1
	l.Font = font or UiTheme.BODY_FONT
	l.TextSize = size
	l.TextColor3 = color or Color3.fromRGB(226, 231, 242)
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.TextYAlignment = Enum.TextYAlignment.Top
	l.TextWrapped = true
	l.Text = ""
	l.Parent = parent
	return l
end

local heading = text(frame, "Heading", 16, 10, W - 80, 30, 24, UiTheme.FONT, Color3.fromRGB(240, 242, 248))
heading.Text = "Choose your civilization"
heading.TextYAlignment = Enum.TextYAlignment.Center

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 34, 0, 34)
closeBtn.Position = UDim2.new(1, -44, 0, 8)
closeBtn.TextSize = 18
closeBtn.Text = "X"
closeBtn.Parent = frame
UiTheme.apply(closeBtn, { color = "danger", radius = 8 })

local function arrow(label, x)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, 56, 0, 150)
	b.Position = UDim2.new(0, x, 0, 120)
	b.TextSize = 34
	b.Text = label
	b.Parent = frame
	UiTheme.apply(b, { color = "primary", radius = 12 })
	return b
end
local prevBtn = arrow("<", 14)
local nextBtn = arrow(">", W - 70)

-- the card between the arrows
local CX, CW = 84, W - 168
local card = Instance.new("Frame")
card.Name = "Card"
card.Position = UDim2.new(0, CX, 0, 52)
card.Size = UDim2.new(0, CW, 0, 286)
card.BackgroundColor3 = Color3.fromRGB(30, 35, 48)
card.BorderSizePixel = 0
card.Parent = frame
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 12)
	c.Parent = card
end
local banner = Instance.new("Frame") -- the civ's own colours
banner.Size = UDim2.new(1, 0, 0, 84)
banner.BorderSizePixel = 0
banner.Parent = card
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 12)
	c.Parent = banner
end
local trim = Instance.new("Frame")
trim.Size = UDim2.new(1, -24, 0, 6)
trim.Position = UDim2.new(0, 12, 1, -12)
trim.BorderSizePixel = 0
trim.Parent = banner
local civName = text(banner, "CivName", 16, 8, CW - 32, 44, 38, UiTheme.FONT, Color3.new(1, 1, 1))
civName.TextYAlignment = Enum.TextYAlignment.Center
civName.TextStrokeTransparency = 0.5
local leader = text(banner, "Leader", 18, 50, CW - 36, 20, 16, Enum.Font.GothamBold, Color3.new(1, 1, 1))
leader.TextStrokeTransparency = 0.6
local strengthCap = text(card, "StrengthCap", 16, 96, CW - 32, 16, 14, Enum.Font.GothamBold, Color3.fromRGB(143, 155, 179))
local strength = text(card, "Strength", 16, 114, CW - 32, 44, 18)
local temperCap = text(card, "TemperCap", 16, 162, CW - 32, 16, 14, Enum.Font.GothamBold, Color3.fromRGB(143, 155, 179))
local temper = text(card, "Temper", 16, 180, CW - 32, 22, 17)
local citiesCap = text(card, "CitiesCap", 16, 208, CW - 32, 16, 14, Enum.Font.GothamBold, Color3.fromRGB(143, 155, 179))
local cities = text(card, "Cities", 16, 226, CW - 32, 50, 16)

local counter = text(frame, "Counter", CX, 344, CW, 18, 14, UiTheme.BODY_FONT, Color3.fromRGB(143, 155, 179))
counter.TextXAlignment = Enum.TextXAlignment.Center

local chooseBtn = Instance.new("TextButton")
chooseBtn.Size = UDim2.new(0, CW, 0, 48)
chooseBtn.Position = UDim2.new(0, CX, 0, 368)
chooseBtn.TextSize = 22
chooseBtn.Text = "Choose"
chooseBtn.Parent = frame
UiTheme.apply(chooseBtn, { color = "go", radius = 12 })

local entries = nil -- { "random", civ ids sorted by name }
local index = 1
local current = nil -- the server-confirmed pick (nil = random)
local taken = {} -- civ id -> holder name
local onChoose = nil

local function hex(s, fallback)
	local ok, c = pcall(Color3.fromHex, s)
	return ok and c or fallback
end

local TEMPER = {
	{ key = "aggression", word = "aggressive" }, { key = "science", word = "scholarly" },
	{ key = "growth", word = "expansionist" }, { key = "defense", word = "defensive" },
}

local function ensureEntries()
	if entries ~= nil then
		return
	end
	local civs = ClientState.rulesets().civs
	local ids = {}
	for id in pairs(civs) do
		ids[#ids + 1] = id
	end
	table.sort(ids, function(a, b)
		return civs[a].name < civs[b].name
	end)
	entries = { "random" }
	for _, id in ipairs(ids) do
		entries[#entries + 1] = id
	end
end

local function paint()
	ensureEntries()
	local civs = ClientState.rulesets().civs
	local id = entries[index]
	counter.Text = ("%d of %d   -   arrow keys or the side buttons"):format(index, #entries)
	local isCurrent = (id == "random" and current == nil) or id == current
	if id == "random" then
		banner.BackgroundColor3 = Color3.fromRGB(70, 78, 104)
		trim.BackgroundColor3 = Color3.fromRGB(255, 225, 130)
		civName.Text = "Random"
		leader.Text = "any of the " .. (#entries - 1) .. " civilizations"
		strengthCap.Text = "HOW IT WORKS"
		strength.Text = "A civilization is drawn for you when the game starts. This is the default."
		temperCap.Text, temper.Text, citiesCap.Text, cities.Text = "", "", "", ""
		chooseBtn.Text = isCurrent and "Random - your current choice" or "Play a random civilization"
		chooseBtn.Active = true
		chooseBtn.BackgroundTransparency = 0
		return
	end
	local c = civs[id]
	local v = c.visual or {}
	banner.BackgroundColor3 = hex(v.primary or c.color, Color3.fromRGB(70, 78, 104))
	trim.BackgroundColor3 = hex(v.secondary or c.color, Color3.new(1, 1, 1))
	civName.Text = c.name
	leader.Text = c.leader ~= nil and ("Leader: " .. c.leader) or ""
	strengthCap.Text = "SPECIAL STRENGTH"
	strength.Text = (c.specialty ~= nil and c.specialty.blurb) or "No special strength."
	local p, best = c.personality or {}, nil
	for _, t in ipairs(TEMPER) do
		if best == nil or (p[t.key] or 0) > (p[best.key] or 0) then
			best = t
		end
	end
	temperCap.Text = "WHEN THE COMPUTER PLAYS THEM"
	temper.Text = best ~= nil and ("Mostly " .. best.word) or ""
	citiesCap.Text = "FIRST CITIES"
	local names = {}
	for i = 1, math.min(5, #(c.cities or {})) do
		names[i] = c.cities[i]
	end
	cities.Text = table.concat(names, ", ")
	if taken[id] ~= nil and not isCurrent then
		chooseBtn.Text = "Taken by " .. taken[id]
		chooseBtn.Active = false
		chooseBtn.BackgroundTransparency = 0.5
	else
		chooseBtn.Text = isCurrent and (c.name .. " - your current choice") or ("Play as the " .. c.name)
		chooseBtn.Active = true
		chooseBtn.BackgroundTransparency = 0
	end
end

local function step(d)
	ensureEntries()
	index = (index - 1 + d) % #entries + 1
	paint()
end

function M.isOpen()
	return frame.Visible
end

function M.close()
	frame.Visible = false
end

-- yourCiv = the confirmed pick (nil = random); takenBy = civ id -> player name
function M.update(yourCiv, takenBy)
	current, taken = yourCiv, takenBy or {}
	if frame.Visible then
		local ok, err = pcall(paint)
		if not ok then
			Diag.fail("civgallery", "paint", err)
		end
	end
end

function M.open(chooseFn)
	onChoose = chooseFn
	local ok, err = pcall(function()
		ensureEntries()
		index = current ~= nil and (table.find(entries, current) or 1) or 1
		paint()
	end)
	if not ok then
		Diag.fail("civgallery", "open (gallery stays closed)", err)
		return
	end
	frame.Visible = true
end

prevBtn.Activated:Connect(function()
	step(-1)
end)
nextBtn.Activated:Connect(function()
	step(1)
end)
closeBtn.Activated:Connect(M.close)
chooseBtn.Activated:Connect(function()
	if not chooseBtn.Active or entries == nil then
		return
	end
	if onChoose ~= nil then
		onChoose(entries[index])
	end
	M.close()
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if not frame.Visible or processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if input.KeyCode == Enum.KeyCode.Left then
		step(-1)
	elseif input.KeyCode == Enum.KeyCode.Right then
		step(1)
	end
end)

return M
