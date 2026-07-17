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

-- DECK-RESIDENT model (architect PROVISIONAL ruling @f4b54119, user to
-- confirm on retest): the avatar LIVES on the observation deck — action
-- pads there, the map as the diorama below. The R12 spawn-on-settler
-- teleport is REMOVED (it disconnected the avatar from the deck pads);
-- possession pins the character to the ridden unit, and dismounting
-- returns to the deck. The deck SpawnLocation + catch floor own every
-- other spawn/fall path.
local function deckSpawnCFrame()
	local deckFolder = workspace:FindFirstChild("ObservationDeck")
	local spawnPlate = deckFolder and deckFolder:FindFirstChild("DeckSpawn")
	return spawnPlate ~= nil and (spawnPlate.CFrame + Vector3.new(0, 4, 0)) or nil
end

-- session-E round 16 (user): when the RIDDEN unit dies in battle the avatar
-- lands by CASCADE — the lost tile itself (if it is known land with no
-- enemy on it), else the next own unit, else the nearest own city, else
-- the capital (palace), else the deck. Returns CFrame + a label, or nil
-- for the deck fallback.
local function sparkleBurst(root)
	local sparkles = Instance.new("Sparkles")
	sparkles.SparkleColor = Color3.fromRGB(180, 220, 255)
	sparkles.Parent = root
	task.delay(2.5, function()
		sparkles:Destroy()
	end)
end

local function lostUnitLanding(root)
	local view = ClientState.view
	if view == nil then
		return nil, "deck"
	end
	local rs = ClientState.rulesets()
	local map = view.map
	local tx = math.floor(root.Position.X / TILE + 0.5)
	local ty = math.floor(root.Position.Z / TILE + 0.5)
	if tx >= 0 and tx < map.width and ty >= 0 and ty < map.height then
		local tile = map.tiles[ty * map.width + tx + 1]
		local terr = tile ~= nil and rs.terrain.terrains[tile.t]
		if terr ~= nil and terr.domain == "land" and not StepLegality.enemyAt(view, tx, ty) then
			return CFrame.new(tx * TILE, tileTopY(tx, ty) + 4, ty * TILE), "the lost tile"
		end
	end
	local nextId = ClientState.nextOwnUnit(nil)
	local nu = nextId ~= nil and view.units[nextId] or nil
	if nu ~= nil then
		return CFrame.new(nu.x * TILE, tileTopY(nu.x, nu.y) + 4, nu.y * TILE), "next unit " .. nextId
	end
	local nearest, nearestD, capital = nil, math.huge, nil
	for _, c in pairs(view.cities) do
		if c.owner == view.you then
			local d = ClientState.wrapDist(c.x, c.y, tx, ty)
			if d < nearestD then
				nearest, nearestD = c, d
			end
			if table.find(c.buildings or {}, "palace") ~= nil then
				capital = c
			end
		end
	end
	local target = nearest or capital
	if target ~= nil then
		return CFrame.new(target.x * TILE, tileTopY(target.x, target.y) + 4, target.y * TILE),
			"city " .. (target.name or "?")
	end
	return nil, "deck"
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
		if reason == "unit lost" then
			-- battle loss: land on the map per the cascade, camera follows
			local cf, label = lostUnitLanding(root)
			if cf ~= nil then
				root.CFrame = cf
				ClientState.followAvatar = true
				sparkleBurst(root)
				print("[Possess] ride lost - landed at " .. label)
				if controls then
					controls:Enable()
				end
				return
			end
		end
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

-- Session-E (user ruling, supersedes the deck-resident PROVISIONAL's
-- game-start half): when the game starts, the avatar teleports to a tile
-- NEXT TO their first settler — with a magic sparkle burst (the built-in
-- Sparkles instance; procedural, no assets). The deck stays the lobby and
-- dismount still returns there.
local hadView = false
ClientState.onView(function(view)
	if hadView or view == nil then
		return
	end
	hadView = true
	local settler = nil
	for _, u in pairs(view.units) do
		if u.owner == view.you and (settler == nil or u.type == "settlers") then
			settler = u
		end
	end
	if settler == nil then
		return
	end
	-- pick an adjacent land tile (fallback: stand on the settler's tile edge)
	local rs = ClientState.rulesets()
	local tx, ty = settler.x + 1, settler.y
	for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 }, { 1, 1 }, { -1, -1 } }) do
		local nx, ny = settler.x + d[1], settler.y + d[2]
		if view.map.wrapX then
			nx = nx % view.map.width
		end
		if nx >= 0 and nx < view.map.width and ny >= 0 and ny < view.map.height then
			local tile = view.map.tiles[ny * view.map.width + nx + 1]
			local terr = tile ~= nil and rs.terrain.terrains[tile.t]
			if terr ~= nil and terr.domain == "land" then
				tx, ty = nx, ny
				break
			end
		end
	end
	local character = Players.LocalPlayer.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if root ~= nil then
		root.CFrame = CFrame.new(tx * TILE, tileTopY(tx, ty) + 4, ty * TILE)
		local sparkles = Instance.new("Sparkles")
		sparkles.SparkleColor = Color3.fromRGB(180, 220, 255)
		sparkles.Parent = root
		task.delay(2.5, function()
			sparkles:Destroy()
		end)
		print("[Possess] game start: beside your settler (sparkle arrival)")
	end
end)

-- next own idle unit — R7a (12)(15): nearest-first, skips fortified/working
-- (input.js:255 semantics); the shared picker lives in ClientState
local function nextUnit()
	local current = ClientState.possessedUnitId or ClientState.selectedUnitId
	return ClientState.nextOwnUnit(current)
end

-- session-E: dying/resetting while mounted leaves a fresh unanchored
-- character — clear the possession state so nothing re-pins the corpse's
-- successor (the deck SpawnLocation + Camera's follow reset own the rest)
Players.LocalPlayer.CharacterAdded:Connect(function()
	if ClientState.possessedUnitId ~= nil then
		ClientState.possessedUnitId = nil
		ClientState.followAvatar = true
		if controls then
			controls:Enable()
		end
		print("[Possess] respawn: possession cleared")
	end
end)

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
		-- session-E: N closes an open city view before jumping units
		require(script.Parent:WaitForChild("WorkedTiles")).closeIfOpen()
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
