-- SO5 (catalog row; browser A78/A99 twin, client/ui/advice.js): first-timer
-- ADVICE cards — short contextual nudges the first time a player meets a
-- system. Prose is the browser's own ORIGINAL lines (license-clean), with
-- Roblox key/UI references adapted (G fortify, the AI button). Each card
-- shows ONCE PER SESSION (no localStorage on Roblox — the convenience-not-
-- rules cut); "No thanks" silences them all (options.adviceCards, also an
-- Options row). Never blocks input; one card at a time.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local ADVICE = {
	["unit-selected"] = { title = "Moving units", text = "Click a unit to select it, then click an adjacent tile to move. The action bar along the bottom holds its orders - fortify, wait, and GoTo for longer journeys. Or ride it: press P and steer with WASD." },
	["settler"] = { title = "Founding a city", text = "Settlers build your empire. Move one onto good ground - grassland near water is ideal - and use the Found City action (B) to plant a city there." },
	["city-view"] = { title = "Running a city", text = "Open a city to choose what it builds and where its citizens work. When it finishes, pick something new or it falls back to building militia." },
	["disorder"] = { title = "Civil disorder", text = "A city where unhappy citizens outnumber happy ones stops making shields and taxes. Raise the luxuries rate, turn citizens into entertainers, or build a Temple." },
	["tech-choice"] = { title = "Choosing research", text = "When your beakers fill you pick the next advance. Techs unlock units, buildings, and wonders - beeline the ones your strategy needs, or broaden for score." },
	["save-code"] = { title = "Your game code", text = "The saved code is this game's fingerprint AND your resume key. Note it before you leave - typing it into the lobby's resume box restores the game." },
	["regent"] = { title = "The AI regent", text = "You have handed your seat to the AI regent - it plays your civ under the same rules. Any command (or the AI button) takes back control." },
	["first-contact"] = { title = "Meeting your neighbours", text = "You have spotted another civilization's unit. Contact can bring trade or trouble - watch your borders, and keep a defender in the cities nearest them." },
	["low-treasury"] = { title = "Watch the treasury", text = "Your gold is running low against your upkeep. Nudge the tax rate up in the Government panel - an empty treasury forces your cities to sell off buildings." },
	["fortify-garrison"] = { title = "Defend your cities", text = "A city with no military unit is easy to capture. Move a defender in and Fortify it (G) - a fortified unit behind city walls is far harder to dislodge." },
}

local gui = Instance.new("ScreenGui")
gui.Name = "RMCAdvice"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local seen = {} -- id -> true (once per session)
local queue = {}
local card = nil

local function enabled()
	return ClientState.options.adviceCards ~= false
end

local pump

local function dismiss()
	if card ~= nil then
		card:Destroy()
		card = nil
	end
	pump()
end

local function show(id)
	local def = ADVICE[id]
	if def == nil then
		pump()
		return
	end
	card = Instance.new("Frame")
	card.Size = UDim2.new(0, 340, 0, 150)
	card.Position = UDim2.new(0, 8, 0.5, -180)
	card.BackgroundColor3 = Color3.fromRGB(24, 30, 26)
	card.BackgroundTransparency = 0.05
	card.Parent = gui
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 10)
	c.Parent = card
	local s = Instance.new("UIStroke")
	s.Color = Color3.fromRGB(120, 200, 140)
	s.Transparency = 0.5
	s.Parent = card
	local title = Instance.new("TextLabel")
	title.Size = UDim2.new(1, -16, 0, 24)
	title.Position = UDim2.new(0, 8, 0, 4)
	title.BackgroundTransparency = 1
	title.TextColor3 = Color3.fromRGB(160, 230, 175)
	title.Font = Enum.Font.SourceSansBold
	title.TextSize = 18
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.Text = def.title
	title.Parent = card
	local body = Instance.new("TextLabel")
	body.Size = UDim2.new(1, -16, 0, 84)
	body.Position = UDim2.new(0, 8, 0, 28)
	body.BackgroundTransparency = 1
	body.TextColor3 = Color3.fromRGB(222, 228, 222)
	body.Font = Enum.Font.Code
	body.TextSize = 13
	body.TextWrapped = true
	body.TextXAlignment = Enum.TextXAlignment.Left
	body.TextYAlignment = Enum.TextYAlignment.Top
	body.Text = def.text
	body.Parent = card
	local ok = Instance.new("TextButton")
	ok.Size = UDim2.new(0, 110, 0, 26)
	ok.Position = UDim2.new(0, 8, 1, -32)
	ok.BackgroundColor3 = Color3.fromRGB(56, 96, 66)
	ok.TextColor3 = Color3.fromRGB(235, 245, 238)
	ok.Font = Enum.Font.SourceSansBold
	ok.TextSize = 15
	ok.Text = "OK, got it"
	ok.Parent = card
	local okc = Instance.new("UICorner")
	okc.CornerRadius = UDim.new(0, 6)
	okc.Parent = ok
	ok.Activated:Connect(dismiss)
	local no = Instance.new("TextButton")
	no.Size = UDim2.new(0, 110, 0, 26)
	no.Position = UDim2.new(0, 126, 1, -32)
	no.BackgroundColor3 = Color3.fromRGB(52, 52, 58)
	no.TextColor3 = Color3.fromRGB(200, 200, 205)
	no.Font = Enum.Font.SourceSansBold
	no.TextSize = 15
	no.Text = "No thanks"
	no.Parent = card
	local noc = Instance.new("UICorner")
	noc.CornerRadius = UDim.new(0, 6)
	noc.Parent = no
	no.Activated:Connect(function()
		ClientState.options.adviceCards = false -- Options row re-enables
		dismiss()
	end)
end

pump = function()
	if card ~= nil or #queue == 0 then
		return
	end
	show(table.remove(queue, 1))
end

local function offer(id)
	if not enabled() or seen[id] == true then
		return
	end
	seen[id] = true
	table.insert(queue, id)
	pump()
end

-- ---- triggers (channels where they exist, cheap view scans where not) ------
ClientState.onCityOpen(function()
	offer("city-view")
end)
ClientState.onResearchOpen(function()
	offer("tech-choice")
end)

RunService.Heartbeat:Connect(function()
	local view = ClientState.view
	if view == nil or not enabled() then
		return
	end
	if ClientState.selectedUnitId ~= nil then
		offer("unit-selected")
		local u = view.units[ClientState.selectedUnitId]
		if u ~= nil and u.type == "settlers" and u.owner == view.you then
			offer("settler")
		end
	end
	if ClientState.lastSave ~= nil then
		offer("save-code")
	end
	if ClientState.away then
		offer("regent")
	end
end)

-- A99 state predicates on every view push (already fog-filtered for us)
ClientState.onView(function(view)
	if not enabled() then
		return
	end
	local contact = false
	for _, u in pairs(view.units) do
		if u.owner ~= view.you then
			contact = true
			break
		end
	end
	if contact then
		offer("first-contact")
	end
	local me = view.players[view.you]
	local cities = 0
	for _, c in pairs(view.cities) do
		if c.owner == view.you then
			cities += 1
			if c.disorder == true then
				offer("disorder")
			end
		end
	end
	if me ~= nil and cities > 0 and (me.gold or 0) < cities * 3 then
		offer("low-treasury")
	end
	if contact then
		for _, c in pairs(view.cities) do
			if c.owner == view.you then
				local garrisoned = false
				for _, u in pairs(view.units) do
					if u.owner == view.you and u.x == c.x and u.y == c.y then
						garrisoned = true
						break
					end
				end
				if not garrisoned then
					offer("fortify-garrison")
					break
				end
			end
		end
	end
end)

print("[Advice] SO5 first-timer advice up (once per session; No thanks mutes)")
