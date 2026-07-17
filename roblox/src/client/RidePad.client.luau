-- R11 (docs/13 R7c-13/14, user design 2026-07-16): the CLICK-ONLY ride-mode
-- movement pad. While mounted, 8 click-targets (4 cardinal + 4 diagonal)
-- surround the ridden unit IN-WORLD — clicking one issues the SAME moveUnit
-- command the WASD keys send (engine DIRS: N/NE/E/SE/S/SW/W/NW). Targets are
-- BillboardGui buttons (GUI clicks arrive gameProcessed, so Select's tile
-- pick never double-fires). A left-edge PAD icon toggles the feature;
-- AUTO-DETECT: non-keyboard clients (touch/gamepad) default the pads ON.
-- View-side presentation only — the server judges every move.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local TILE = ClientState.TILE
local world = workspace:WaitForChild("ClientWorld")

local DIRS = { -- engine/movement.js DIRS, y-down map space
	{ dir = "N", dx = 0, dy = -1, glyph = "^" },
	{ dir = "NE", dx = 1, dy = -1, glyph = "/" },
	{ dir = "E", dx = 1, dy = 0, glyph = ">" },
	{ dir = "SE", dx = 1, dy = 1, glyph = "\\" },
	{ dir = "S", dx = 0, dy = 1, glyph = "v" },
	{ dir = "SW", dx = -1, dy = 1, glyph = "/" },
	{ dir = "W", dx = -1, dy = 0, glyph = "<" },
	{ dir = "NW", dx = -1, dy = -1, glyph = "\\" },
}

-- AUTO-DETECT (user design): keyboardless clients get the pads by default
local padEnabled = not UserInputService.KeyboardEnabled

local function tileTopY(x, y)
	local part = world:WaitForChild("Terrain"):FindFirstChild(("Tile_%d_%d"):format(x, y))
	return part and (part.Position.Y + part.Size.Y / 2) or 0
end

-- 8 pooled anchors, each carrying one billboard button
local folder = Instance.new("Folder")
folder.Name = "RidePads"
folder.Parent = workspace

local pads = {}
for i, d in ipairs(DIRS) do
	local anchor = Instance.new("Part")
	anchor.Anchored = true
	anchor.Transparency = 1
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.Size = Vector3.new(0.4, 0.4, 0.4)
	anchor.Parent = folder
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.new(0, 44, 0, 44)
	bb.AlwaysOnTop = true
	bb.Adornee = anchor
	bb.Enabled = false
	local btn = Instance.new("TextButton")
	btn.Size = UDim2.new(1, 0, 1, 0)
	btn.BackgroundColor3 = Color3.fromRGB(30, 40, 56)
	btn.BackgroundTransparency = 0.35
	btn.TextColor3 = Color3.fromRGB(180, 220, 255)
	btn.Font = Enum.Font.SourceSansBold
	btn.TextSize = 26
	btn.Text = d.glyph
	btn.Parent = bb
	bb.Parent = anchor
	btn.Activated:Connect(function()
		local unitId = ClientState.possessedUnitId
		if unitId ~= nil then
			print(("[RidePad] step %s %s"):format(unitId, d.dir))
			ClientState.send({ type = "moveUnit", unitId = unitId, dir = d.dir })
		end
	end)
	pads[i] = { anchor = anchor, bb = bb, d = d }
end

-- the left-edge toggle icon
local gui = Instance.new("ScreenGui")
gui.Name = "RMCRidePad"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")
local toggleBtn = Instance.new("TextButton")
toggleBtn.Size = UDim2.new(0, 70, 0, 24)
toggleBtn.Position = UDim2.new(0, 8, 0.5, 18)
toggleBtn.TextColor3 = Color3.fromRGB(235, 235, 235)
toggleBtn.Font = Enum.Font.SourceSansBold
toggleBtn.TextSize = 14
toggleBtn.Parent = gui
local function paintToggle()
	toggleBtn.Text = padEnabled and "PAD on" or "PAD off"
	toggleBtn.BackgroundColor3 = padEnabled and Color3.fromRGB(50, 90, 70) or Color3.fromRGB(38, 40, 48)
end
paintToggle()
toggleBtn.Activated:Connect(function()
	padEnabled = not padEnabled
	paintToggle()
end)

-- reposition on any change (Heartbeat key-compare, the MoveHints pattern)
local lastKey = nil
RunService.Heartbeat:Connect(function()
	local view = ClientState.view
	local unitId = ClientState.possessedUnitId
	local u = view ~= nil and unitId ~= nil and view.units[unitId] or nil
	local show = padEnabled and u ~= nil
	local key = tostring(show) .. "|" .. tostring(unitId) .. "|"
		.. tostring(u and u.x) .. "," .. tostring(u and u.y) .. "|" .. tostring(u and u.moves)
	if key == lastKey then
		return
	end
	lastKey = key
	for _, pad in ipairs(pads) do
		if show and u.moves > 0 then
			local nx, ny = u.x + pad.d.dx, u.y + pad.d.dy
			if view.map.wrapX then
				nx = nx % view.map.width
			end
			local inBounds = nx >= 0 and nx < view.map.width and ny >= 0 and ny < view.map.height
			pad.bb.Enabled = inBounds
			if inBounds then
				pad.anchor.CFrame = CFrame.new(nx * TILE, tileTopY(nx, ny) + 2.2, ny * TILE)
			end
		else
			pad.bb.Enabled = false
		end
	end
end)

print(("[RidePad] R11 ride pad up (auto-detect: %s; the PAD button toggles)")
	:format(padEnabled and "ON - no keyboard" or "off - keyboard present"))
