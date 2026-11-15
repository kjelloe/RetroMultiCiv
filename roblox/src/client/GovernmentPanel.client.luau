-- R12 (2): the government panel (roblox/SPEC.md §3l) — opened by the
-- ActionBar's top-center Government button. Hosts the tax/lux/sci rate
-- steppers (MOVED here from the research picker, user runC ruling), the
-- current government line, AND (CP13) government SWITCHING — a button per
-- known government issues setGovernment (a revolution: a few turns of Anarchy
-- first, unless the Pyramids grant an instant switch — the engine judges).
-- 1:1 of client/ui/panels.js's gov-row: skip anarchy + current, tech-gate the
-- rest. Steppers, not sliders (docs/13 review: sliders fight LMB-orbit). Acting
-- stays commands through the dispatcher: setRates {tax,sci,lux} / setGovernment
-- {government}; the server judges caps, tech, and revolution state. Read the
-- own-seat view fields (government/revolutionTurns/pendingGovernment/techs —
-- filterView surfaces them for pid==you). Golden-neutral (logged commands only).

local Players = game:GetService("Players")

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local governmentModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("government"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCGovernment"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local UiTheme = require(script.Parent:WaitForChild("UiTheme"))

-- run-S shot16 (user): the panel was monospace lines and bare steppers. Now:
-- the current government as a coloured card with what it means, the three
-- rates as coloured bars with their steppers, and the governments you can
-- switch to as buttons (the ones you cannot yet reach say what they need).
local W = 380
local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, W, 0, 476)
panel.Position = UDim2.new(0.5, -190, 0, 44)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.05
panel.BorderSizePixel = 0
panel.Parent = gui

local MUTED = Color3.fromRGB(143, 155, 179)
local function text(parent, x, y, w, h, size, font, color)
	local l = Instance.new("TextLabel")
	l.Position = UDim2.new(0, x, 0, y)
	l.Size = UDim2.new(0, w, 0, h)
	l.BackgroundTransparency = 1
	l.Font = font or UiTheme.BODY_FONT
	l.TextSize = size
	l.TextColor3 = color or Color3.fromRGB(226, 231, 242)
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.TextWrapped = true
	l.Text = ""
	l.Parent = parent
	return l
end
local function round(inst, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r)
	c.Parent = inst
end

local title = text(panel, 14, 8, W - 70, 28, 22, UiTheme.FONT, Color3.fromRGB(240, 242, 248))
title.Name = "Heading"
title.Text = "Government"

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 30, 0, 28)
closeBtn.Position = UDim2.new(1, -38, 0, 8)
closeBtn.TextSize = 16
closeBtn.Text = "X"
closeBtn.Parent = panel
UiTheme.apply(closeBtn, { color = "danger", radius = 8 })

-- the current government
local GOV_COLOR = {
	anarchy = Color3.fromRGB(226, 130, 60), despotism = Color3.fromRGB(150, 128, 96),
	monarchy = Color3.fromRGB(150, 110, 210), communism = Color3.fromRGB(214, 78, 70),
	republic = Color3.fromRGB(80, 150, 230), democracy = Color3.fromRGB(64, 190, 170),
}
local card = Instance.new("Frame")
card.Position = UDim2.new(0, 10, 0, 44)
card.Size = UDim2.new(0, W - 20, 0, 82)
card.BackgroundColor3 = Color3.fromRGB(36, 42, 58)
card.BorderSizePixel = 0
card.Parent = panel
round(card, 10)
local band = Instance.new("Frame")
band.Position = UDim2.new(0, 8, 0, 8)
band.Size = UDim2.new(0, 8, 1, -16)
band.BorderSizePixel = 0
band.Parent = card
round(band, 4)
local govName = text(card, 26, 6, W - 60, 26, 21, Enum.Font.GothamBold)
local govTraits = text(card, 26, 34, W - 60, 42, 14, nil, Color3.fromRGB(200, 208, 224))
govTraits.TextYAlignment = Enum.TextYAlignment.Top

local function traitsOf(gov)
	local t = { ("rates up to %d%%"):format(gov.maxRate or 0) }
	if (gov.freeUnitsPerCity or 0) >= 99 then
		t[#t + 1] = "units cost no upkeep"
	else
		t[#t + 1] = ("%d free units per city, then %d shield each"):format(gov.freeUnitsPerCity or 0, gov.upkeepShields or 0)
	end
	if gov.tilePenalty == true then
		t[#t + 1] = "rich tiles yield 1 less"
	end
	if (gov.tradeBonus or 0) > 0 then
		t[#t + 1] = ("+%d trade on trading tiles"):format(gov.tradeBonus)
	end
	if (gov.warUnhappiness or 0) > 0 then
		t[#t + 1] = "units abroad cause unrest"
	end
	return table.concat(t, "  -  ")
end

-- the three rates
text(panel, 14, 134, W - 28, 18, 14, Enum.Font.GothamBold, MUTED).Text = "WHERE YOUR TRADE GOES"
local RATES = {
	{ key = "tax", label = "Taxes", note = "gold", color = Color3.fromRGB(240, 200, 80), y = 156 },
	{ key = "sci", label = "Science", note = "research", color = Color3.fromRGB(110, 180, 255), y = 196 },
	{ key = "lux", label = "Luxury", note = "content people", color = Color3.fromRGB(240, 130, 190), y = 236 },
}
local rateUi = {}
local function stepButton(x, y, label)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, 34, 0, 30)
	b.Position = UDim2.new(0, x, 0, y)
	b.TextSize = 20
	b.Text = label
	b.Parent = panel
	UiTheme.apply(b, { color = "primary", radius = 8 })
	return b
end
for _, r in ipairs(RATES) do
	local name = text(panel, 14, r.y, 76, 18, 16, Enum.Font.GothamBold)
	name.Text = r.label
	local note = text(panel, 14, r.y + 18, 96, 16, 14, nil, MUTED)
	note.Text = r.note
	local track = Instance.new("Frame")
	track.Position = UDim2.new(0, 104, 0, r.y + 6)
	track.Size = UDim2.new(0, 128, 0, 18)
	track.BackgroundColor3 = Color3.fromRGB(18, 22, 32)
	track.BorderSizePixel = 0
	track.Parent = panel
	round(track, 9)
	local fill = Instance.new("Frame")
	fill.Size = UDim2.new(0, 0, 1, 0)
	fill.BackgroundColor3 = r.color
	fill.BorderSizePixel = 0
	fill.Parent = track
	round(fill, 9)
	local value = text(panel, 240, r.y + 2, 52, 26, 18, Enum.Font.GothamBold, r.color)
	local ui = { fill = fill, value = value }
	if r.key ~= "sci" then
		ui.down = stepButton(296, r.y, "-")
		ui.up = stepButton(334, r.y, "+")
	else
		local rest = text(panel, 296, r.y + 4, 76, 22, 14, nil, MUTED)
		rest.Text = "what is left"
	end
	rateUi[r.key] = ui
end
local capLine = text(panel, 14, 274, W - 28, 18, 14, nil, MUTED)

local function me()
	local view = ClientState.view
	return view and view.players[view.you]
end

local function rates()
	local m = me()
	local tax = (m and m.taxRate) or 50
	local lux = (m and m.luxRate) or 0
	local sci = 100 - tax - lux
	return tax, sci, lux
end

-- a stepper click: move 10% between the stepped rate and science, then let
-- the SERVER be the judge (gov cap, bounds) - display clamps only to 0..100
local function sendRates(tax, lux)
	local sci = 100 - tax - lux
	if tax < 0 or lux < 0 or sci < 0 or tax > 100 or lux > 100 then
		return
	end
	print(("[Government] setRates tax=%d sci=%d lux=%d"):format(tax, sci, lux))
	ClientState.send({ type = "setRates", tax = tax, sci = sci, lux = lux })
end

rateUi.tax.down.Activated:Connect(function()
	local tax, _, lux = rates()
	sendRates(tax - 10, lux)
end)
rateUi.tax.up.Activated:Connect(function()
	local tax, _, lux = rates()
	sendRates(tax + 10, lux)
end)
rateUi.lux.down.Activated:Connect(function()
	local tax, _, lux = rates()
	sendRates(tax, lux - 10)
end)
rateUi.lux.up.Activated:Connect(function()
	local tax, _, lux = rates()
	sendRates(tax, lux + 10)
end)

-- CP13 government switching: a button per government (1:1 of
-- client/ui/panels.js gov-row for what is offered: anarchy + the current one
-- are skipped, the rest are tech-gated - the gated ones show here as locked)
local switchCap = text(panel, 14, 300, W - 28, 18, 14, Enum.Font.GothamBold, MUTED)
local switchRow = Instance.new("Frame")
switchRow.Position = UDim2.new(0, 10, 0, 322)
switchRow.Size = UDim2.new(1, -20, 0, 146)
switchRow.BackgroundTransparency = 1
switchRow.Parent = panel
do
	local lay = Instance.new("UIGridLayout")
	lay.CellSize = UDim2.new(0, 176, 0, 44)
	lay.CellPadding = UDim2.new(0, 8, 0, 6)
	lay.SortOrder = Enum.SortOrder.LayoutOrder
	lay.Parent = switchRow
end

local DISPLAY_ORDER = { "despotism", "monarchy", "communism", "republic", "democracy" }

local function govButton(gov, order, lockedBy)
	local b = Instance.new("TextButton")
	b.LayoutOrder = order
	b.TextSize = 15
	b.RichText = true
	b.Parent = switchRow
	if lockedBy ~= nil then
		b.Text = ('%s\n<font size="14">needs %s</font>'):format(gov.name, lockedBy)
		b.BackgroundColor3 = Color3.fromRGB(40, 44, 56)
		b.TextColor3 = Color3.fromRGB(130, 136, 150)
		b.Font = UiTheme.BODY_FONT
		b.AutoButtonColor = false
		b.Active = false
		b.BorderSizePixel = 0
		round(b, 10)
		return b
	end
	b.Text = ('%s\n<font size="14">rates to %d%%</font>'):format(gov.name, gov.maxRate or 0)
	UiTheme.apply(b, { color = "primary", radius = 10 })
	local stripe = Instance.new("Frame") -- the government's colour
	stripe.Size = UDim2.new(0, 6, 1, -14)
	stripe.Position = UDim2.new(0, 6, 0, 7)
	stripe.BackgroundColor3 = GOV_COLOR[gov.id] or Color3.new(1, 1, 1)
	stripe.BorderSizePixel = 0
	stripe.Parent = b
	round(stripe, 3)
	b.Activated:Connect(function()
		print("[Government] setGovernment " .. gov.id)
		ClientState.send({ type = "setGovernment", government = gov.id })
	end)
	return b
end

local function rebuildSwitch(m, rs)
	for _, c in ipairs(switchRow:GetChildren()) do
		if c:IsA("TextButton") then
			c:Destroy()
		end
	end
	-- mid-revolution: no options (the card shows the anarchy countdown)
	if m.revolutionTurns ~= nil then
		switchCap.Text = "REVOLUTION UNDER WAY"
		return
	end
	switchCap.Text = "CHANGE GOVERNMENT  -  a revolution brings a few turns of anarchy"
	local governments = rs.governments
	local current = m.government or "despotism"
	local techs = m.techs or {}
	local function hasTech(t)
		return t == "" or table.find(techs, t) ~= nil
	end
	for order, id in ipairs(DISPLAY_ORDER) do
		local gov = governments[id]
		-- skip anarchy (never a target) + the current gov; a tech-gated one
		-- is shown locked with what it needs (it sends nothing)
		if gov ~= nil and id ~= "anarchy" and id ~= current then
			govButton(gov, order, (not hasTech(gov.tech)) and (rs.techs[gov.tech] and rs.techs[gov.tech].name or gov.tech) or nil)
		end
	end
end

local function refresh()
	local m = me()
	if m == nil then
		return
	end
	local rs = ClientState.rulesets()
	-- run-4 fix: the ENGINE's default is despotism when the field is unset -
	-- read it through the real governmentOf (read-only shim), never guess
	local view = ClientState.view
	local gov = governmentModule.governmentOf({ players = view.players }, view.you, rs)
	if m.revolutionTurns ~= nil then
		local pend = m.pendingGovernment ~= nil and rs.governments[m.pendingGovernment] or nil
		band.BackgroundColor3 = GOV_COLOR.anarchy
		govName.Text = "Anarchy"
		govTraits.Text = ("%d turn%s until %s. No taxes or science until then."):format(
			m.revolutionTurns, m.revolutionTurns > 1 and "s" or "", pend and pend.name or "the new government")
	else
		band.BackgroundColor3 = gov and GOV_COLOR[gov.id] or Color3.fromRGB(150, 156, 170)
		govName.Text = gov and gov.name or "?"
		govTraits.Text = gov and traitsOf(gov) or ""
	end
	local tax, sci, lux = rates()
	local now = { tax = tax, sci = sci, lux = lux }
	for key, ui in pairs(rateUi) do
		ui.fill.Size = UDim2.new(math.clamp(now[key] / 100, 0, 1), 0, 1, 0)
		ui.value.Text = now[key] .. "%"
	end
	capLine.Text = gov and ("No rate may pass %d%% under %s."):format(gov.maxRate, gov.name) or ""
	rebuildSwitch(m, rs)
end

local function setOpen(open)
	gui.Enabled = open
	if open then
		ClientState.panelOpened("government") -- runI item 18: closes the city view
		refresh()
	end
end

closeBtn.Activated:Connect(function()
	setOpen(false)
end)

ClientState.onGovernmentOpen(function()
	setOpen(not gui.Enabled)
end)

ClientState.onView(function()
	if gui.Enabled then
		refresh()
	end
end)

-- UI tour (specs/roblox-parity-plan.md step 0): open / close without a click
ClientState.registerPanel("government", panel, function()
	setOpen(true)
end, function()
	setOpen(false)
end)

print("[Government] R12 government panel up (rate steppers + CP13 government switching)")
