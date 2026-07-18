-- R7a (5)(7): play-flow options (roblox/SPEC.md §3h). Both DEFAULT ON — the
-- accepted docs/13 divergence: the browser opts in, Roblox opts out.
--   auto next unit — when the selected/ridden unit runs out of moves,
--     selection (or the mount) advances to the nearest idle unit
--     (ClientState.nextOwnUnit: skips fortified/working, nearest-first).
--   auto end turn — when no idle units remain, the turn ends by itself
--     (short delay + revalidate, so a rejected command or a fresh view
--     can cancel it); with the option OFF a center-screen hint points at
--     Return/End Turn instead. One auto end per turn number — no runaway.
-- Display/commands only: everything reads the view, acting is send().

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local techModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("tech"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCOptions"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

-- session-E: the option toggles get their own show/hide button (Pedia
-- pattern, user request) — collapsed by default, the clock readout stays
-- outside the panel so hiding the menu never hides the clock
local optionsBtn = Instance.new("TextButton")
optionsBtn.Name = "OptionsToggle"
optionsBtn.Size = UDim2.new(0, 150, 0, 36)
optionsBtn.Position = UDim2.new(1, -158, 0, 8)
optionsBtn.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
optionsBtn.BackgroundTransparency = 0.25
optionsBtn.TextColor3 = Color3.fromRGB(235, 235, 235)
optionsBtn.Font = Enum.Font.SourceSansBold
optionsBtn.TextSize = 18
optionsBtn.Text = "Options"
optionsBtn.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = optionsBtn
end

local panel = Instance.new("Frame")
panel.Name = "Panel"
panel.Size = UDim2.new(0, 200, 0, 252)
panel.Position = UDim2.new(1, -208, 0, 50)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.15
panel.BorderSizePixel = 0
panel.Visible = false
panel.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = panel
end

local function toggleButton(y, text)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(1, -8, 0, 22)
	b.Position = UDim2.new(0, 4, 0, y - 2)
	b.BackgroundColor3 = Color3.fromRGB(34, 40, 54)
	b.BackgroundTransparency = 0.25
	b.TextColor3 = Color3.fromRGB(235, 235, 235)
	b.Font = Enum.Font.Code
	b.TextSize = 13
	b.TextXAlignment = Enum.TextXAlignment.Left
	b.Text = text
	b.Parent = panel
	return b
end

local autoNextBtn = toggleButton(8, "")
local autoEndBtn = toggleButton(32, "")
-- R16: options completion (browser parity where the surface exists)
local hideFutureBtn = toggleButton(56, "")
local hideHintBtn = toggleButton(80, "")
local clockBtn = toggleButton(104, "")
local voidArtBtn = toggleButton(128, "")
local ridePadBtn = toggleButton(152, "")
local lookBtn = toggleButton(176, "")
local autoResearchBtn = toggleButton(200, "") -- session-E round 7
local discoveryBtn = toggleButton(224, "") -- SO3 tech-discovery cards

-- always-visible clock readout, left of the top-right button row
local clockLabel = Instance.new("TextLabel")
clockLabel.Size = UDim2.new(0, 180, 0, 18)
clockLabel.Position = UDim2.new(1, -428, 0, 17)
clockLabel.TextXAlignment = Enum.TextXAlignment.Right
clockLabel.BackgroundTransparency = 1
clockLabel.TextColor3 = Color3.fromRGB(200, 210, 225)
clockLabel.Font = Enum.Font.Code
clockLabel.TextSize = 13
clockLabel.Text = ""
clockLabel.Parent = gui
local bootClock = os.clock()

local hint = Instance.new("TextLabel")
hint.Size = UDim2.new(0, 460, 0, 30)
hint.Position = UDim2.new(0.5, -230, 0.42, 0)
hint.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
hint.BackgroundTransparency = 0.2
hint.TextColor3 = Color3.fromRGB(255, 225, 120)
hint.Font = Enum.Font.SourceSansBold
hint.TextSize = 18
hint.Text = "All units moved - press Return or the End Turn button"
hint.Visible = false
hint.Parent = gui

optionsBtn.Activated:Connect(function()
	panel.Visible = not panel.Visible
end)

local function paint()
	local o = ClientState.options
	autoNextBtn.Text = ("  auto next unit: %s"):format(o.autoNextUnit and "ON" or "off")
	autoEndBtn.Text = ("  auto end turn: %s"):format(o.autoEndTurn and "ON" or "off")
	hideFutureBtn.Text = ("  hide future items: %s"):format(o.hideFuture and "ON" or "off")
	hideHintBtn.Text = ("  hide end-turn hint: %s"):format(o.hideNoMovesHint and "ON" or "off")
	clockBtn.Text = ("  clock: %s"):format(o.clock)
	voidArtBtn.Text = ("  map border: %s"):format(o.voidArt)
	ridePadBtn.Text = ("  ride pads: %s"):format(
		o.ridePad == true and "ON" or (o.ridePad == false and "off" or "auto"))
	lookBtn.Text = ("  world look: %s"):format(o.look or "retro")
	autoResearchBtn.Text = ("  auto-select research: %s"):format(o.autoResearch and "ON" or "off")
	discoveryBtn.Text = ("  discovery cards: %s"):format(o.discoveryCards ~= false and "ON" or "off")
end
paint()

autoNextBtn.Activated:Connect(function()
	ClientState.options.autoNextUnit = not ClientState.options.autoNextUnit
	paint()
end)
autoEndBtn.Activated:Connect(function()
	ClientState.options.autoEndTurn = not ClientState.options.autoEndTurn
	paint()
end)
hideFutureBtn.Activated:Connect(function()
	ClientState.options.hideFuture = not ClientState.options.hideFuture
	paint()
end)
hideHintBtn.Activated:Connect(function()
	ClientState.options.hideNoMovesHint = not ClientState.options.hideNoMovesHint
	paint()
end)
local CLOCKS = { "off", "elapsed", "time" }
clockBtn.Activated:Connect(function()
	local i = table.find(CLOCKS, ClientState.options.clock) or 1
	ClientState.options.clock = CLOCKS[i % #CLOCKS + 1]
	paint()
end)
local ARTS = { "frame", "galaxy", "none" }
voidArtBtn.Activated:Connect(function()
	local i = table.find(ARTS, ClientState.options.voidArt) or 1
	ClientState.options.voidArt = ARTS[i % #ARTS + 1] -- VoidCover watches this
	paint()
end)
ridePadBtn.Activated:Connect(function()
	-- cycle auto -> ON -> off (RidePad watches; auto = keyboard detection)
	local pref = ClientState.options.ridePad
	ClientState.options.ridePad = pref == nil and true or (pref == true and false or nil)
	paint()
end)
lookBtn.Activated:Connect(function()
	-- visual-fidelity side-by-side (#1100): retro (browser-flat) vs enhanced
	-- (Roblox materials); ViewRenderer repaints on the flip
	ClientState.options.look = ClientState.options.look == "enhanced" and "retro" or "enhanced"
	paint()
end)
autoResearchBtn.Activated:Connect(function()
	ClientState.options.autoResearch = not ClientState.options.autoResearch
	paint()
end)
discoveryBtn.Activated:Connect(function()
	ClientState.options.discoveryCards = ClientState.options.discoveryCards == false
	paint()
end)

-- the clock line (browser parity: minutes played / time of day)
task.spawn(function()
	while true do
		local mode = ClientState.options.clock
		if mode == "elapsed" then
			clockLabel.Text = ("  %d min played"):format(math.floor((os.clock() - bootClock) / 60))
		elseif mode == "time" then
			clockLabel.Text = "  " .. os.date("%H:%M")
		else
			clockLabel.Text = ""
		end
		task.wait(5)
	end
end)

-- session-E round 7: auto-select research after TWO of the player's turns
-- pass with nothing being researched. The pick mirrors the engine AI's core
-- heuristic (beeline Monarchy's prereq closure, then lowest level) through
-- the read-only shared tech module, and is sent as a normal setResearch
-- command — the engine still judges it.
local function pickResearch(view, me)
	local rs = ClientState.rulesets()
	local avail = techModule.availableTechs({ players = { [view.you] = me } }, view.you, rs)
	if #avail == 0 then
		return nil
	end
	local path = {}
	local function mark(id)
		if path[id] or rs.techs[id] == nil then
			return
		end
		path[id] = true
		for _, p in ipairs(rs.techs[id].prereqs or {}) do
			mark(p)
		end
	end
	if table.find(me.techs, "monarchy") == nil then
		mark("monarchy")
	end
	local pool = {}
	for _, id in ipairs(avail) do
		if path[id] then
			table.insert(pool, id)
		end
	end
	if #pool == 0 then
		pool = avail
	end
	local best = pool[1]
	for _, id in ipairs(pool) do
		if rs.techs[id].level < rs.techs[best].level then
			best = id
		end
	end
	return best
end

local idleResearchTurns = 0
local lastIdleTurn = -1

local lastAutoEndTurn = -1
local lastHintTurn = -1

local function allUnitsDone(view)
	local haveAny = false
	for _, u in pairs(view.units) do
		if u.owner == view.you then
			haveAny = true
			if u.moves > 0 and u.fortified ~= true and u.working == nil
				and not ClientState.isGarrisoned(u) then -- round 19
				return false
			end
		end
	end
	return haveAny
end

ClientState.onView(function(view)
	if not ClientState.myTurn() or ClientState.gameOver then
		hint.Visible = false
		return
	end

	-- auto-select research: 2 distinct idle turns arms the pick
	local me = view.players[view.you]
	if me ~= nil and me.researching ~= nil then
		idleResearchTurns = 0
	elseif me ~= nil then
		if view.turn ~= lastIdleTurn then
			lastIdleTurn = view.turn
			idleResearchTurns += 1
		end
		if ClientState.options.autoResearch and idleResearchTurns >= 2 then
			local pick = pickResearch(view, me)
			if pick ~= nil then
				idleResearchTurns = 0
				local rs = ClientState.rulesets()
				print("[Options] auto-select research: " .. (rs.techs[pick] and rs.techs[pick].name or pick))
				ClientState.send({ type = "setResearch", tech = pick })
			end
		end
	end

	-- (5) advance on unit exhausted
	if ClientState.options.autoNextUnit then
		local currentId = ClientState.possessedUnitId or ClientState.selectedUnitId
		local current = currentId and view.units[currentId]
		if current ~= nil and current.moves <= 0 then
			local nextId = ClientState.nextOwnUnit(currentId)
			if nextId ~= nil then
				if ClientState.possessedUnitId ~= nil then
					print("[Options] auto next: riding " .. nextId)
					ClientState.requestPossess(nextId)
				else
					-- R12 (7): dismounted advance = selection + camera only,
					-- the avatar never teleports
					print("[Options] auto next: selected " .. nextId)
					ClientState.selectedUnitId = nextId
					local u = view.units[nextId]
					if u ~= nil then
						ClientState.focusCamera(u.x, u.y)
					end
				end
			end
		end
	end

	-- (7) end the turn when nothing is left to move
	if allUnitsDone(view) then
		if ClientState.options.autoEndTurn then
			if lastAutoEndTurn ~= view.turn then
				lastAutoEndTurn = view.turn
				task.delay(1, function()
					local v = ClientState.view
					if v ~= nil and v.turn == lastAutoEndTurn and ClientState.myTurn()
						and ClientState.options.autoEndTurn and allUnitsDone(v) then
						print("[Options] auto end turn " .. v.turn)
						ClientState.send({ type = "endTurn" })
					end
				end)
			end
		elseif lastHintTurn ~= view.turn and not ClientState.options.hideNoMovesHint then
			lastHintTurn = view.turn
			hint.Visible = true
			task.delay(5, function()
				hint.Visible = false
			end)
		end
	else
		hint.Visible = false
	end
end)

print("[Options] options up (collapsible panel; auto-next/auto-end/auto-research ON)")
