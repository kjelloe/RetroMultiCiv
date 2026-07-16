-- R5: morph-into-unit avatar mode (roblox/SPEC.md §3f — the user's idea,
-- docs/13's Roblox-native exemplar). "Possess" a selected unit: the avatar
-- rides it (character pinned to the unit's tile, camera follows), WASD/arrow
-- keys step it ONE TILE PER PRESS via engine moveUnit commands — every rule
-- applies, there is no free movement; the avatar is a costume, the engine is
-- still the only mover. Keys are MAP-ABSOLUTE (W=N always): camera-relative
-- would make identical recordings depend on where the camera pointed.
--   P            possess the selected own unit
--   N            possess the next own unit with moves left (sorted ids)
--   WASD/arrows  step N/W/S/E (one engine command per press)
--   Esc / F      release to free cam

local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local TILE = ClientState.TILE
local world = workspace:WaitForChild("ClientWorld")

local KEY_DIR = {
	[Enum.KeyCode.W] = "N", [Enum.KeyCode.Up] = "N",
	[Enum.KeyCode.S] = "S", [Enum.KeyCode.Down] = "S",
	[Enum.KeyCode.A] = "W", [Enum.KeyCode.Left] = "W",
	[Enum.KeyCode.D] = "E", [Enum.KeyCode.Right] = "E",
}

local controls = nil
task.spawn(function()
	local playerModule = Players.LocalPlayer:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule")
	controls = require(playerModule):GetControls()
end)

local function tileTopY(x, y)
	local part = world.Terrain:FindFirstChild(("Tile_%d_%d"):format(x, y))
	return part and (part.Position.Y + part.Size.Y / 2) or 0
end

local function pinCharacter(u)
	local character = Players.LocalPlayer.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if root then
		root.Anchored = true
		root.CFrame = CFrame.new(u.x * TILE, tileTopY(u.x, u.y) + 4.5, u.y * TILE)
	end
end

local function release(reason)
	if ClientState.possessedUnitId == nil then
		return
	end
	ClientState.possessedUnitId = nil
	ClientState.followAvatar = false
	local character = Players.LocalPlayer.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if root then
		root.Anchored = false
	end
	if controls then
		controls:Enable()
	end
	print("[Possess] released (" .. reason .. ")")
end

local function possess(unitId)
	local view = ClientState.view
	local u = view and view.units[unitId]
	if u == nil or u.owner ~= view.you then
		return
	end
	ClientState.possessedUnitId = unitId
	ClientState.selectedUnitId = unitId
	ClientState.followAvatar = true
	if controls then
		controls:Disable()
	end
	pinCharacter(u)
	print(("[Possess] riding %s (%s) at (%d,%d), moves %d"):format(unitId, u.type, u.x, u.y, u.moves))
end

-- next own idle unit — R7a (12)(15): nearest-first, skips fortified/working
-- (input.js:255 semantics); the shared picker lives in ClientState
local function nextUnit()
	local current = ClientState.possessedUnitId or ClientState.selectedUnitId
	return ClientState.nextOwnUnit(current)
end

-- R7a (9): Select requests a ride (double-click on an own unit while
-- mounted); auto-next while mounted arrives the same way
ClientState.onPossessRequest(function(unitId)
	possess(unitId)
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil then
		return -- chat focus: game keys stay dead while typing
	end
	local view = ClientState.view
	if view == nil then
		return
	end

	if input.KeyCode == Enum.KeyCode.P then
		if ClientState.selectedUnitId ~= nil then
			possess(ClientState.selectedUnitId)
		else
			print("[Possess] select one of your units first (or press N)")
		end
	elseif input.KeyCode == Enum.KeyCode.N then
		local id = nextUnit()
		if id ~= nil then
			possess(id)
		else
			print("[Possess] no units with moves left")
		end
	elseif ClientState.possessedUnitId ~= nil then
		if input.KeyCode == Enum.KeyCode.Escape or input.KeyCode == Enum.KeyCode.F then
			release("dismount")
		else
			local dir = KEY_DIR[input.KeyCode]
			if dir ~= nil then
				print(("[Possess] step %s %s"):format(ClientState.possessedUnitId, dir))
				ClientState.send({ type = "moveUnit", unitId = ClientState.possessedUnitId, dir = dir })
			end
		end
	end
end)

-- every view push: re-pin to the ridden unit's (possibly new) tile, or
-- dismount if it died / left the view (ClientState already cleared the id)
ClientState.onView(function(view)
	local id = ClientState.possessedUnitId
	if id == nil then
		local character = Players.LocalPlayer.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if root and root.Anchored then
			release("unit lost")
		end
		return
	end
	pinCharacter(view.units[id])
end)

print("[Possess] R5 possession up: P possess selected, N next unit, WASD/arrows step, Esc/F release")
