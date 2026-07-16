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

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCOptions"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local function toggleButton(y, text)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, 190, 0, 22)
	b.Position = UDim2.new(1, -198, 0, y)
	b.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
	b.BackgroundTransparency = 0.25
	b.TextColor3 = Color3.fromRGB(235, 235, 235)
	b.Font = Enum.Font.Code
	b.TextSize = 13
	b.TextXAlignment = Enum.TextXAlignment.Left
	b.Text = text
	b.Parent = gui
	return b
end

local autoNextBtn = toggleButton(8, "")
local autoEndBtn = toggleButton(32, "")

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

local function paint()
	local o = ClientState.options
	autoNextBtn.Text = ("  auto next unit: %s"):format(o.autoNextUnit and "ON" or "off")
	autoEndBtn.Text = ("  auto end turn: %s"):format(o.autoEndTurn and "ON" or "off")
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

local lastAutoEndTurn = -1
local lastHintTurn = -1

local function allUnitsDone(view)
	local haveAny = false
	for _, u in pairs(view.units) do
		if u.owner == view.you then
			haveAny = true
			if u.moves > 0 and u.fortified ~= true and u.working == nil then
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
					print("[Options] auto next: selected " .. nextId)
					ClientState.selectedUnitId = nextId
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
		elseif lastHintTurn ~= view.turn then
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

print("[Options] R7a play-flow options up (auto next unit ON, auto end turn ON)")
