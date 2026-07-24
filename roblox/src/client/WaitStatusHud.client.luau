-- Tier-3 (docs/13) wait-status HUD line — while it is NOT your turn, a small
-- top-center line names who the round is waiting on ("⏳ <civ> is moving · Ns"),
-- the multi-seat / regency clarity cue the browser has (A26). Reads only the
-- filtered view (view.activePlayer / view.you / view.players[].name) and ticks a
-- local clock each Heartbeat via the pure WaitStatus tracker. Presentation only,
-- sends nothing (golden-neutral). Hidden on your own turn / before the first push.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local WaitStatus = require(script.Parent:WaitForChild("WaitStatus"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCWaitStatus"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local label = Instance.new("TextLabel")
label.Name = "Line"
label.AnchorPoint = Vector2.new(0.5, 0)
label.Position = UDim2.new(0.5, 0, 0, 8) -- top-center, clear of the top-right PEDIA button
label.Size = UDim2.new(0, 330, 0, 28)
label.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
label.BackgroundTransparency = 0.3
label.BorderSizePixel = 0
label.TextColor3 = Color3.fromRGB(235, 225, 170)
label.Font = Enum.Font.Code
label.TextSize = 16
label.TextXAlignment = Enum.TextXAlignment.Left
label.Text = ""
label.Visible = false
label.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 6)
	c.Parent = label
end

local tracker = WaitStatus.createWaitTracker()
local lastWho, lastSec = nil, -1

RunService.Heartbeat:Connect(function()
	local view = ClientState.view
	if view == nil then
		label.Visible = false
		return
	end
	local r = tracker.update(view.activePlayer, view.you, os.clock() * 1000, 0)
	if r.waitingFor == nil then
		label.Visible = false
		lastWho = nil
		return
	end
	-- rebuild the text only when the shown second (or the waited-on seat) changes
	if r.waitingFor ~= lastWho or r.elapsedSec ~= lastSec then
		local p = view.players[r.waitingFor]
		local name = (p ~= nil and p.name) or r.waitingFor
		label.Text = "  " .. WaitStatus.formatWait(name, r.elapsedSec)
		lastWho, lastSec = r.waitingFor, r.elapsedSec
	end
	label.Visible = true
end)

print("[WaitStatus] Tier-3 wait-status HUD line up (names who the round waits on)")
