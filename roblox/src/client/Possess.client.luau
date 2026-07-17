-- R5: morph-into-unit avatar mode (roblox/SPEC.md §3f — the user's idea,
-- docs/13's Roblox-native exemplar). "Possess" a selected unit: the avatar
-- rides it (character pinned to the unit's tile, camera follows), WASD/arrow
-- keys step it ONE TILE PER PRESS via engine moveUnit commands — every rule
-- applies, there is no free movement; the avatar is a costume, the engine is
-- still the only mover. Keys are MAP-ABSOLUTE (W=N always): camera-relative
-- would make identical recordings depend on where the camera pointed.
--   P            TOGGLE: possess the selected own unit / dismount (R12 6)
--   N            next own unit with moves left — mounted: ride it;
--                dismounted: selection+camera ONLY, never the avatar (R12 7)
--   WASD/arrows  step N/W/S/E (one engine command per press)
--   F            release to free cam (Esc is menu-reserved)

local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local StepLegality = require(script.Parent:WaitForChild("StepLegality")) -- runD step gate

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
		-- deck-resident: dismounting returns HOME to the deck (staying on
		-- the map would strand the avatar on the diorama, off the pads)
		local home = deckSpawnCFrame()
		if home ~= nil then
			root.CFrame = home
		end
	end
	if controls then
		controls:Enable()
	end
	print("[Possess] released (" .. reason .. ") - back on the deck")
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

-- DECK-RESIDENT model (architect PROVISIONAL ruling @f4b54119, user to
-- confirm on retest): the avatar LIVES on the observation deck — action
-- pads there, the map as the diorama below. The R12 spawn-on-settler
-- teleport is REMOVED (it disconnected the avatar from the deck pads);
-- possession pins the character to the ridden unit, and dismounting
-- returns to the deck (below). The deck SpawnLocation + catch floor own
-- every other spawn/fall path.
local function deckSpawnCFrame()
	local deckFolder = workspace:FindFirstChild("ObservationDeck")
	local spawnPlate = deckFolder and deckFolder:FindFirstChild("DeckSpawn")
	return spawnPlate ~= nil and (spawnPlate.CFrame + Vector3.new(0, 4, 0)) or nil
end

-- next own idle unit — R7a (12)(15): nearest-first, skips fortified/working
-- (input.js:255 semantics); the shared picker lives in ClientState
local function nextUnit()
	local current = ClientState.possessedUnitId or ClientState.selectedUnitId
	return ClientState.nextOwnUnit(current)
end

-- R7a (9): Select requests a ride (double-click on an own unit while
-- mounted); auto-next while mounted arrives the same way. R12 (6): a nil
-- request is the dismount half of the toggle (ActionBar's button surrogate).
ClientState.onPossessRequest(function(unitId)
	if unitId == nil then
		release("dismount")
	else
		possess(unitId)
	end
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
		-- R12 (6): P is a ride/dismount TOGGLE
		if ClientState.possessedUnitId ~= nil then
			release("dismount")
		elseif ClientState.selectedUnitId ~= nil then
			possess(ClientState.selectedUnitId)
		else
			print("[Possess] select one of your units first (or press N)")
		end
	elseif input.KeyCode == Enum.KeyCode.N then
		local id = nextUnit()
		if id == nil then
			print("[Possess] no units with moves left")
		elseif ClientState.possessedUnitId ~= nil then
			possess(id) -- mounted: jump the ride
		else
			-- R12 (7): dismounted Next moves selection + camera ONLY — the
			-- avatar stays where it stands, never teleports
			local u = ClientState.view.units[id]
			ClientState.selectedUnitId = id
			if u ~= nil then
				ClientState.focusCamera(u.x, u.y)
			end
			print("[Possess] next unit selected: " .. id)
		end
	elseif ClientState.possessedUnitId ~= nil then
		-- Esc is platform-reserved (Roblox menu) — F alone dismounts (SPEC §4 gate 6)
		if input.KeyCode == Enum.KeyCode.F then
			release("dismount")
		else
			local dir = KEY_DIR[input.KeyCode]
			if dir ~= nil then
				-- runD fix: swallow KNOWN-hopeless steps client-side (the log
				-- carried hundreds of doomed impassable/noMovesLeft sends).
				-- Fog and enemy tiles still send — engine judges those.
				local u = view.units[ClientState.possessedUnitId]
				if u == nil then
					return
				end
				if u.moves <= 0 then
					print("[Possess] no moves left this turn (auto-next or End Turn)")
					return
				end
				local rs = ClientState.rulesets()
				local domain = rs.units[u.type] and rs.units[u.type].domain
				local DIR_VEC = { N = { 0, -1 }, S = { 0, 1 }, W = { -1, 0 }, E = { 1, 0 } }
				local v = DIR_VEC[dir]
				local ok, why = StepLegality.canAttempt(view, rs, domain, u.x + v[1], u.y + v[2])
				if not ok then
					print(("[Possess] can't step %s: %s"):format(dir, why))
					return
				end
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

print("[Possess] possession up: P ride/dismount toggle, N next unit (select-only afoot), WASD/arrows step, F dismount")
