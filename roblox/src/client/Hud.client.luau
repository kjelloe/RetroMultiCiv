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

endTurn.Activated:Connect(function()
	if ClientState.myTurn() then
		print("[Hud] end turn " .. ClientState.view.turn)
		ClientState.send({ type = "endTurn" })
	end
end)

local function refresh(view)
	local mine = ClientState.myTurn()
	local bits = ("  turn %d · %s · active %s%s"):format(
		view.turn,
		view.year < 0 and (-view.year .. " BC") or (view.year .. " AD"),
		view.activePlayer,
		mine and " (YOU)" or " (AI thinking…)")
	if ClientState.gameOver then
		bits ..= "  ·  GAME OVER"
	end
	status.Text = bits
	endTurn.BackgroundColor3 = mine and Color3.fromRGB(46, 88, 148) or Color3.fromRGB(60, 60, 66)
end

ClientState.onView(refresh)

print("[Hud] R4 hud up")
