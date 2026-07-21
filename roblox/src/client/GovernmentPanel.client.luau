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

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 260, 0, 208)
panel.Position = UDim2.new(0.5, -130, 0, 44)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.08
panel.BorderSizePixel = 0
panel.Parent = gui

local function label(y, size, text)
	local l = Instance.new("TextLabel")
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

local title = label(6, 22, "Government")
local govLine = label(32, 16, "")
local ratesLine = label(52, 16, "")

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 24, 0, 24)
closeBtn.Position = UDim2.new(1, -28, 0, 4)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
closeBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
closeBtn.Font = Enum.Font.SourceSansBold
closeBtn.TextSize = 16
closeBtn.Text = "X"
closeBtn.Parent = panel

local function stepButton(x, text)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, 30, 0, 24)
	b.Position = UDim2.new(0, x, 1, -34)
	b.BackgroundColor3 = Color3.fromRGB(50, 66, 92)
	b.TextColor3 = Color3.fromRGB(235, 235, 235)
	b.Font = Enum.Font.SourceSansBold
	b.TextSize = 16
	b.Text = text
	b.Parent = panel
	return b
end

local taxLabel = label(0, 16, "tax")
taxLabel.Position = UDim2.new(0, 8, 1, -54)
taxLabel.Size = UDim2.new(0, 60, 0, 16)
local taxDown = stepButton(8, "-")
local taxUp = stepButton(42, "+")
local luxLabel = label(0, 16, "lux")
luxLabel.Position = UDim2.new(0, 108, 1, -54)
luxLabel.Size = UDim2.new(0, 60, 0, 16)
local luxDown = stepButton(108, "-")
local luxUp = stepButton(142, "+")

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
-- the SERVER be the judge (gov cap, bounds) — display clamps only to 0..100
local function sendRates(tax, lux)
	local sci = 100 - tax - lux
	if tax < 0 or lux < 0 or sci < 0 or tax > 100 or lux > 100 then
		return
	end
	print(("[Government] setRates tax=%d sci=%d lux=%d"):format(tax, sci, lux))
	ClientState.send({ type = "setRates", tax = tax, sci = sci, lux = lux })
end

taxDown.Activated:Connect(function()
	local tax, _, lux = rates()
	sendRates(tax - 10, lux)
end)
taxUp.Activated:Connect(function()
	local tax, _, lux = rates()
	sendRates(tax + 10, lux)
end)
luxDown.Activated:Connect(function()
	local tax, _, lux = rates()
	sendRates(tax, lux - 10)
end)
luxUp.Activated:Connect(function()
	local tax, _, lux = rates()
	sendRates(tax, lux + 10)
end)

-- CP13 government-switch row: a button per switchable government (1:1 of
-- client/ui/panels.js gov-row). Fixed display order (render-only, not state);
-- anarchy + the current gov are skipped, and each option is tech-gated.
local switchRow = Instance.new("Frame")
switchRow.Position = UDim2.new(0, 8, 0, 74)
switchRow.Size = UDim2.new(1, -16, 0, 58)
switchRow.BackgroundTransparency = 1
switchRow.Parent = panel
do
	local lay = Instance.new("UIListLayout")
	lay.FillDirection = Enum.FillDirection.Horizontal
	lay.Wraps = true
	lay.Padding = UDim.new(0, 4)
	lay.Parent = switchRow
end

local DISPLAY_ORDER = { "despotism", "monarchy", "communism", "republic", "democracy" }

local function govButton(gov)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, 118, 0, 24)
	b.BackgroundColor3 = Color3.fromRGB(50, 66, 92)
	b.TextColor3 = Color3.fromRGB(235, 235, 235)
	b.Font = Enum.Font.SourceSansBold
	b.TextSize = 14
	b.Text = "→ " .. gov.name
	b.Parent = switchRow
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
	-- mid-revolution: no options (the govLine shows the anarchy countdown)
	if m.revolutionTurns ~= nil then
		return
	end
	local governments = rs.governments
	local current = m.government or "despotism"
	local techs = m.techs or {}
	local function hasTech(t)
		if t == "" then
			return true
		end
		for _, x in ipairs(techs) do
			if x == t then
				return true
			end
		end
		return false
	end
	for _, id in ipairs(DISPLAY_ORDER) do
		local gov = governments[id]
		-- skip anarchy (never a target) + the current gov, then tech-gate
		if gov ~= nil and id ~= "anarchy" and id ~= current and hasTech(gov.tech) then
			govButton(gov)
		end
	end
end

local function refresh()
	local m = me()
	if m == nil then
		return
	end
	local rs = ClientState.rulesets()
	-- run-4 fix: the ENGINE's default is despotism when the field is unset —
	-- read it through the real governmentOf (read-only shim), never guess
	local view = ClientState.view
	local gov = governmentModule.governmentOf({ players = view.players }, view.you, rs)
	if m.revolutionTurns ~= nil then
		local pend = m.pendingGovernment ~= nil and rs.governments[m.pendingGovernment] or nil
		govLine.Text = ("⚡ Anarchy — %d turn%s until %s"):format(
			m.revolutionTurns, m.revolutionTurns > 1 and "s" or "", pend and pend.name or "?")
	else
		govLine.Text = "🏛 " .. (gov and gov.name or "?")
	end
	local tax, sci, lux = rates()
	ratesLine.Text = ("rates: tax %d%% sci %d%% lux %d%%%s"):format(tax, sci, lux,
		gov and (" (cap %d%%)"):format(gov.maxRate) or "")
	rebuildSwitch(m, rs)
end

local function setOpen(open)
	gui.Enabled = open
	if open then
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

print("[Government] R12 government panel up (rate steppers + CP13 government switching)")
