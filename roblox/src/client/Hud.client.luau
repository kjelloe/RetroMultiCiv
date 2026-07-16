-- R4: minimal HUD (roblox/SPEC.md §3e) — a status line and an End Turn
-- button; the full action bar is R5. Reads ClientState.view only.

local Players = game:GetService("Players")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCHud"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local status = Instance.new("TextLabel")
status.Name = "Status"
status.Size = UDim2.new(0, 560, 0, 28)
status.Position = UDim2.new(0, 8, 0, 8)
status.BackgroundColor3 = Color3.fromRGB(20, 24, 34)
status.BackgroundTransparency = 0.25
status.TextColor3 = Color3.fromRGB(235, 235, 235)
status.Font = Enum.Font.Code
status.TextSize = 16
status.TextXAlignment = Enum.TextXAlignment.Left
status.Text = "  joining…"
status.Parent = gui

local endTurn = Instance.new("TextButton")
endTurn.Name = "EndTurn"
endTurn.Size = UDim2.new(0, 120, 0, 32)
endTurn.Position = UDim2.new(1, -128, 1, -40)
endTurn.BackgroundColor3 = Color3.fromRGB(46, 88, 148)
endTurn.TextColor3 = Color3.fromRGB(240, 240, 240)
endTurn.Font = Enum.Font.SourceSansBold
endTurn.TextSize = 18
endTurn.Text = "End Turn"
endTurn.Parent = gui

-- R7d (5): the docs/07 trust-loop chip — a read-only TextBox so the code is
-- SELECTABLE (Roblox has no clipboard API; selecting for manual copy is the
-- available affordance). Server sends the code with every push.
local codeChip = Instance.new("TextBox")
codeChip.Name = "GameCode"
codeChip.Size = UDim2.new(0, 220, 0, 20)
codeChip.Position = UDim2.new(0, 8, 0, 40)
codeChip.BackgroundColor3 = Color3.fromRGB(20, 24, 34)
codeChip.BackgroundTransparency = 0.35
codeChip.TextColor3 = Color3.fromRGB(160, 200, 160)
codeChip.Font = Enum.Font.Code
codeChip.TextSize = 13
codeChip.TextXAlignment = Enum.TextXAlignment.Left
codeChip.TextEditable = false
codeChip.ClearTextOnFocus = false
codeChip.Text = "  code …"
codeChip.Parent = gui

-- R7d (5): A29 three-state End Turn — grey off-turn, green READY when no
-- movable units remain (fortified/working are standing orders), and a
-- two-press CONFIRM when units still have moves (first press warns, second
-- within 3 s sends anyway).
local READY = Color3.fromRGB(52, 130, 72)
local NORMAL = Color3.fromRGB(46, 88, 148)
local OFF = Color3.fromRGB(60, 60, 66)
local WARN = Color3.fromRGB(170, 120, 40)
local confirmUntil = 0

local function movableCount()
	local view = ClientState.view
	local n = 0
	if view ~= nil then
		for _, u in pairs(view.units) do
			if u.owner == view.you and u.moves > 0 and u.fortified ~= true and u.working == nil then
				n += 1
			end
		end
	end
	return n
end

endTurn.Activated:Connect(function()
	if not ClientState.myTurn() then
		return
	end
	local left = movableCount()
	if left > 0 and os.clock() > confirmUntil then
		confirmUntil = os.clock() + 3
		endTurn.Text = ("%d can move!"):format(left)
		endTurn.BackgroundColor3 = WARN
		task.delay(3, function()
			if os.clock() >= confirmUntil then
				endTurn.Text = "End Turn"
			end
		end)
		return
	end
	confirmUntil = 0
	print("[Hud] end turn " .. ClientState.view.turn)
	ClientState.send({ type = "endTurn" })
end)

local function refresh(view)
	local mine = ClientState.myTurn()
	local me = view.players[view.you]
	local bits = ("  turn %d · %s · gold %d · active %s%s"):format(
		view.turn,
		view.year < 0 and (-view.year .. " BC") or (view.year .. " AD"),
		me and me.gold or 0,
		view.activePlayer,
		mine and " (YOU)" or " (AI thinking…)")
	if ClientState.gameOver then
		bits ..= "  ·  GAME OVER"
	end
	status.Text = bits
	if ClientState.code ~= nil then
		codeChip.Text = "  code " .. ClientState.code
	end
	if os.clock() > confirmUntil then
		endTurn.Text = "End Turn"
	end
	if not mine then
		endTurn.BackgroundColor3 = OFF
	elseif movableCount() == 0 then
		endTurn.BackgroundColor3 = READY -- A29 'ready': green when all moved
	else
		endTurn.BackgroundColor3 = NORMAL
	end
end

ClientState.onView(refresh)

print("[Hud] R7d hud up (three-state End Turn, game-code chip)")
