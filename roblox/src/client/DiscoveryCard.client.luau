-- SO3 (catalog row; browser twin: client/ui/discovery-card.js): the
-- TECH-DISCOVERY CARD — a transient card on techDiscovered for the OWN
-- viewpoint: tech name + era, the original blurb (empty-tolerant until the
-- ally's authored lines land as shared data), the unlock list as PEDIA deep
-- links, and the choose-research prompt folded in. One at a time, queued;
-- click-through or 6 s auto-dismiss; options.discoveryCards mutes it.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local techModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("tech"))

-- CONTENT RULES (license boundary, CLAUDE.md): original prose only — never
-- wiki sentences. EMPTY-TOLERANT like the browser's tech-blurbs.js (the one
-- source); when the ally's 68 authored lines land there, port them HERE as
-- pure data in the same sync pass (flagged in the done-mail).
local TECH_BLURBS = {}

local AUTO_S = 6

local gui = Instance.new("ScreenGui")
gui.Name = "RMCDiscoveryCard"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local queue = {}
local card = nil
local cardGen = 0

local function unlocksOf(rs, techId)
	local out = {}
	for _, pair in ipairs({ { "units", rs.units }, { "buildings", rs.buildings }, { "wonders", rs.wonders } }) do
		local cat, tbl = pair[1], pair[2]
		local ids = {}
		for id in pairs(tbl) do
			table.insert(ids, id)
		end
		table.sort(ids)
		for _, id in ipairs(ids) do
			if tbl[id].tech == techId then
				table.insert(out, { cat = cat, id = id, name = tbl[id].name or id })
			end
		end
	end
	return out
end

local pump -- forward: close() pumps the queue

local function close()
	cardGen += 1
	if card ~= nil then
		card:Destroy()
		card = nil
	end
	pump()
end

local function show(techId)
	local view = ClientState.view
	local rs = ClientState.rulesets()
	local def = rs.techs[techId]
	if view == nil or def == nil then
		pump()
		return
	end
	local blurb = TECH_BLURBS[techId]
	local unlocks = unlocksOf(rs, techId)
	local me = view.players[view.you]
	local wantsResearch = false
	if me ~= nil and (me.researching == "" or me.researching == nil) then
		local ok, avail = pcall(techModule.availableTechs,
			{ players = { [view.you] = me } }, view.you, rs)
		wantsResearch = ok and #avail > 0
	end

	local shownUnlocks = math.min(#unlocks, 3)
	local height = 34 + (blurb ~= nil and 36 or 0) + shownUnlocks * 26
		+ (#unlocks > shownUnlocks and 18 or 0) + (wantsResearch and 20 or 0) + 18

	card = Instance.new("TextButton") -- whole card click = dismiss
	card.Size = UDim2.new(0, 440, 0, height)
	card.Position = UDim2.new(0.5, -220, 0.12, 0)
	card.BackgroundColor3 = Color3.fromRGB(26, 30, 44)
	card.BackgroundTransparency = 0.05
	card.Text = ""
	card.AutoButtonColor = false
	card.Parent = gui
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 10)
	corner.Parent = card
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(120, 180, 255)
	stroke.Transparency = 0.5
	stroke.Thickness = 2
	stroke.Parent = card

	local y = 4
	local head = Instance.new("TextLabel")
	head.Size = UDim2.new(1, -16, 0, 26)
	head.Position = UDim2.new(0, 8, 0, y)
	head.BackgroundTransparency = 1
	head.RichText = true
	head.TextColor3 = Color3.fromRGB(150, 205, 255)
	head.Font = Enum.Font.SourceSansBold
	head.TextSize = 20
	head.TextXAlignment = Enum.TextXAlignment.Left
	head.Text = ("%s  <font size=\"14\" color=\"#9db2c8\">%s</font>"):format(def.name or techId, def.era or "")
	head.Parent = card
	y += 30

	if blurb ~= nil then
		local b = Instance.new("TextLabel")
		b.Size = UDim2.new(1, -16, 0, 32)
		b.Position = UDim2.new(0, 8, 0, y)
		b.BackgroundTransparency = 1
		b.TextColor3 = Color3.fromRGB(220, 226, 238)
		b.Font = Enum.Font.Code
		b.TextSize = 14
		b.TextWrapped = true
		b.TextXAlignment = Enum.TextXAlignment.Left
		b.Text = blurb
		b.Parent = card
		y += 36
	end

	for i = 1, shownUnlocks do
		local u = unlocks[i]
		local link = Instance.new("TextButton")
		link.Size = UDim2.new(1, -16, 0, 22)
		link.Position = UDim2.new(0, 8, 0, y)
		link.BackgroundColor3 = Color3.fromRGB(40, 52, 70)
		link.TextColor3 = Color3.fromRGB(180, 220, 255)
		link.Font = Enum.Font.Code
		link.TextSize = 14
		link.TextXAlignment = Enum.TextXAlignment.Left
		link.Text = "  unlocks: " .. u.name .. "  (pedia)"
		link.Parent = card
		local lc = Instance.new("UICorner")
		lc.CornerRadius = UDim.new(0, 6)
		lc.Parent = link
		link.Activated:Connect(function()
			close()
			ClientState.openPedia(u.cat, u.id)
		end)
		y += 26
	end
	if #unlocks > shownUnlocks then
		local more = Instance.new("TextLabel")
		more.Size = UDim2.new(1, -16, 0, 16)
		more.Position = UDim2.new(0, 8, 0, y)
		more.BackgroundTransparency = 1
		more.TextColor3 = Color3.fromRGB(150, 160, 175)
		more.Font = Enum.Font.Code
		more.TextSize = 12
		more.TextXAlignment = Enum.TextXAlignment.Left
		more.Text = ("  +%d more in the Pedia"):format(#unlocks - shownUnlocks)
		more.Parent = card
		y += 18
	end
	if wantsResearch then
		local r = Instance.new("TextLabel")
		r.Size = UDim2.new(1, -16, 0, 18)
		r.Position = UDim2.new(0, 8, 0, y)
		r.BackgroundTransparency = 1
		r.TextColor3 = Color3.fromRGB(255, 220, 120)
		r.Font = Enum.Font.SourceSansBold
		r.TextSize = 14
		r.TextXAlignment = Enum.TextXAlignment.Left
		r.Text = "Choose new research - press T or the Research button"
		r.Parent = card
		y += 20
	end
	local hint = Instance.new("TextLabel")
	hint.Size = UDim2.new(1, -16, 0, 14)
	hint.Position = UDim2.new(0, 8, 0, y)
	hint.BackgroundTransparency = 1
	hint.TextColor3 = Color3.fromRGB(130, 140, 155)
	hint.Font = Enum.Font.Code
	hint.TextSize = 11
	hint.TextXAlignment = Enum.TextXAlignment.Left
	hint.Text = "click to dismiss"
	hint.Parent = card

	card.Activated:Connect(close)
	cardGen += 1
	local gen = cardGen
	task.delay(AUTO_S, function()
		if gen == cardGen and card ~= nil then
			close()
		end
	end)
end

pump = function()
	if card ~= nil or #queue == 0 then
		return
	end
	show(table.remove(queue, 1))
end

ClientState.onEvents(function(events, view)
	if ClientState.options.discoveryCards == false or view == nil then
		return
	end
	for _, e in ipairs(events) do
		if e.type == "techDiscovered" and e.playerId == view.you and e.tech ~= nil then
			table.insert(queue, e.tech)
		end
	end
	pump()
end)

print("[DiscoveryCard] SO3 tech-discovery card up (options.discoveryCards mutes)")
