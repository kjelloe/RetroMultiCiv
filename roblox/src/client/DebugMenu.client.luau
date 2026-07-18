-- R17 (marker-0057, task @5d4cdd5d): the deck DEBUG MENU — a THIN CLIENT
-- over the engine's debug{action} family. Every button issues an ORDINARY
-- command (grantGold / grantTech / revealMap / spawnUnit); nothing mutates
-- locally, the server + engine judge (debugEnabled-gated — Studio games
-- only here). HONESTY: the first use taints the game PERMANENTLY
-- (state.debugUsed rides the hash); the menu says so before use and the
-- HUD shows a red DEBUG chip once tainted (Hud reads ClientState.debugUsed).
-- Surface gated to Studio: live servers never show the button.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local techModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("tech"))

if not RunService:IsStudio() then
	print("[DebugMenu] R17 dormant (not Studio)")
	return
end

local gui = Instance.new("ScreenGui")
gui.Name = "RMCDebugMenu"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local toggle = Instance.new("TextButton")
toggle.Size = UDim2.new(0, 190, 0, 40)
toggle.Position = UDim2.new(0, 8, 1, -120) -- above Legend
toggle.BackgroundColor3 = Color3.fromRGB(70, 40, 40)
toggle.BackgroundTransparency = 0.25
toggle.TextColor3 = Color3.fromRGB(255, 200, 200)
toggle.Font = Enum.Font.Code
toggle.TextSize = 18
toggle.TextXAlignment = Enum.TextXAlignment.Left
toggle.Text = "  Debug (Studio)"
toggle.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = toggle
end

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 250, 0, 246)
panel.Position = UDim2.new(0, 8, 1, -372)
panel.BackgroundColor3 = Color3.fromRGB(34, 22, 22)
panel.BackgroundTransparency = 0.06
panel.BorderSizePixel = 0
panel.Visible = false
panel.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = panel
end

local warn = Instance.new("TextLabel")
warn.Size = UDim2.new(1, -12, 0, 40)
warn.Position = UDim2.new(0, 6, 0, 4)
warn.BackgroundTransparency = 1
warn.TextColor3 = Color3.fromRGB(255, 170, 150)
warn.Font = Enum.Font.Code
warn.TextSize = 12
warn.TextWrapped = true
warn.TextXAlignment = Enum.TextXAlignment.Left
warn.Text = "First use marks this game DEBUG permanently (hash watermark - the chip never comes off)."
warn.Parent = panel

-- the avatar's (or selected unit's) tile: the spawn target
local function targetTile()
	local view = ClientState.view
	if view == nil then
		return nil, nil
	end
	local sel = ClientState.selectedUnitId ~= nil and view.units[ClientState.selectedUnitId] or nil
	if sel ~= nil and sel.owner == view.you then
		return sel.x, sel.y
	end
	local character = Players.LocalPlayer.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if root ~= nil and root.Position.Y < 60 then
		local tx = math.clamp(math.floor(root.Position.X / ClientState.TILE + 0.5), 0, view.map.width - 1)
		local ty = math.clamp(math.floor(root.Position.Z / ClientState.TILE + 0.5), 0, view.map.height - 1)
		return tx, ty
	end
	return nil, nil
end

local function row(y, text, onClick)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(1, -12, 0, 24)
	b.Position = UDim2.new(0, 6, 0, y)
	b.BackgroundColor3 = Color3.fromRGB(66, 40, 40)
	b.TextColor3 = Color3.fromRGB(240, 220, 220)
	b.Font = Enum.Font.Code
	b.TextSize = 13
	b.TextXAlignment = Enum.TextXAlignment.Left
	b.Text = "  " .. text
	b.Parent = panel
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 6)
	c.Parent = b
	b.Activated:Connect(function()
		if ClientState.view ~= nil then
			onClick()
		end
	end)
end

row(48, "+100 gold", function()
	print("[DebugMenu] debug grantGold 100")
	ClientState.send({ type = "debug", action = "grantGold", amount = 100 })
end)
row(76, "Grant next available tech", function()
	local view = ClientState.view
	local me = view.players[view.you]
	local ok, avail = pcall(techModule.availableTechs,
		{ players = { [view.you] = me } }, view.you, ClientState.rulesets())
	if ok and avail[1] ~= nil then
		print("[DebugMenu] debug grantTech " .. avail[1])
		ClientState.send({ type = "debug", action = "grantTech", tech = avail[1] })
	end
end)
row(104, "Reveal map", function()
	print("[DebugMenu] debug revealMap")
	ClientState.send({ type = "debug", action = "revealMap" })
end)
local SPAWNS = { "militia", "legion", "settlers", "catapult" }
for i, unitType in ipairs(SPAWNS) do
	row(132 + (i - 1) * 28, "Spawn " .. unitType .. " (here)", function()
		local tx, ty = targetTile()
		if tx == nil then
			print("[DebugMenu] no target tile (select a unit or stand on the map)")
			return
		end
		print(("[DebugMenu] debug spawnUnit %s (%d,%d)"):format(unitType, tx, ty))
		ClientState.send({ type = "debug", action = "spawnUnit",
			unitType = unitType, x = tx, y = ty })
	end)
end

toggle.Activated:Connect(function()
	panel.Visible = not panel.Visible
end)

print("[DebugMenu] R17 thin client up (Studio only; commands taint permanently)")
