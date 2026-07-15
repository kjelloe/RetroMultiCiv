-- R4: tile selection + the minimal action surface (roblox/SPEC.md §3e).
-- Picking stays LOGICAL (A28: hit POSITION rounded to tile, never the hit
-- body; 0.05 normal nudge; 5px click-vs-drag threshold shares LMB with the
-- camera). Everything printed or acted on comes from ClientState.view — the
-- filtered view is all this script can see, so fog is respected by
-- construction. Actions: click own unit = select; click adjacent tile with a
-- selection = moveUnit (dir-based, wrap-aware); B = found city (settlers);
-- Return = end turn.

local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local TILE = ClientState.TILE
local camera = workspace.CurrentCamera
local world = workspace:WaitForChild("ClientWorld")

local DIR_BY_DELTA = {
	["0,-1"] = "N", ["1,-1"] = "NE", ["1,0"] = "E", ["1,1"] = "SE",
	["0,1"] = "S", ["-1,1"] = "SW", ["-1,0"] = "W", ["-1,-1"] = "NW",
}

local cursor = Instance.new("Part")
cursor.Name = "TileCursor"
cursor.Anchored = true
cursor.CanCollide = false
cursor.CanQuery = false
cursor.Size = Vector3.new(TILE, 0.4, TILE)
cursor.Material = Enum.Material.Neon
cursor.Color = Color3.fromRGB(255, 220, 60)
cursor.Transparency = 0.45
cursor.Parent = world

local function tileTopY(x, y)
	local part = world.Terrain:FindFirstChild(("Tile_%d_%d"):format(x, y))
	return part and (part.Position.Y + part.Size.Y / 2) or 0
end

local function moveCursor(x, y, selected)
	cursor.Position = Vector3.new(x * TILE, tileTopY(x, y) + 0.25, y * TILE)
	cursor.Color = selected and Color3.fromRGB(80, 220, 255) or Color3.fromRGB(255, 220, 60)
end

local function contentsAt(view, x, y)
	local found = {}
	for id, u in pairs(view.units) do
		if u.x == x and u.y == y then
			table.insert(found, ("unit %s (%s, %s)"):format(id, u.type, u.owner))
		end
	end
	for id, c in pairs(view.cities) do
		if c.x == x and c.y == y then
			table.insert(found, ("city %s (%s, pop %d)"):format(c.name, c.owner, c.pop or 1))
		end
	end
	table.sort(found)
	return #found > 0 and (" — " .. table.concat(found, ", ")) or ""
end

-- wrap-aware step from the selected unit to (tx,ty): a single king-move
local function dirTo(view, u, tx, ty)
	local dx = tx - u.x
	if view.map.wrapX then
		local w = view.map.width
		if dx > w / 2 then dx -= w end
		if dx < -w / 2 then dx += w end
	end
	local dy = ty - u.y
	return DIR_BY_DELTA[dx .. "," .. dy]
end

local function ownCityCount(view)
	local n = 0
	for _, c in pairs(view.cities) do
		if c.owner == ClientState.playerId then
			n += 1
		end
	end
	return n
end

local function handlePick(tx, ty)
	local view = ClientState.view
	if view == nil then
		return
	end
	local tile = view.map.tiles[ty * view.map.width + tx + 1]
	local own = ClientState.ownUnitAt(tx, ty)
	local selected = ClientState.selectedUnitId and view.units[ClientState.selectedUnitId]

	if own ~= nil and (selected == nil or own.id ~= selected.id) then
		ClientState.selectedUnitId = own.id
		moveCursor(tx, ty, true)
		print(("[Select] selected %s (%s) at (%d,%d), moves %d"):format(own.id, own.type, tx, ty, own.moves))
		return
	end

	-- own city (and no fresh unit pick): open the city panel (R5). A
	-- garrisoned city takes two clicks — first selects the unit, second opens.
	for id, c in pairs(view.cities) do
		if c.x == tx and c.y == ty and c.owner == view.you then
			moveCursor(tx, ty, false)
			print(("[Select] open city %s (%s)"):format(c.name, id))
			ClientState.openCity(id)
			return
		end
	end

	if selected ~= nil then
		local dir = dirTo(view, selected, tx, ty)
		if dir ~= nil then
			print(("[Select] move %s %s -> (%d,%d)"):format(selected.id, dir, tx, ty))
			ClientState.send({ type = "moveUnit", unitId = selected.id, dir = dir })
			return
		end
	end

	ClientState.selectedUnitId = nil
	moveCursor(tx, ty, false)
	print(("[Select] tile (%d,%d) %s%s"):format(tx, ty, tile.t, contentsAt(view, tx, ty)))
end

-- ---- raycast pick (A28 logical-tile rule, unchanged from R3) ---------------
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude
local function refreshFilter()
	local character = Players.LocalPlayer.Character
	rayParams.FilterDescendantsInstances = character and { cursor, character } or { cursor }
end

local DRAG_EPS = 5
local pressAt = nil

UserInputService.InputBegan:Connect(function(input, processed)
	if not processed and input.UserInputType == Enum.UserInputType.MouseButton1 then
		pressAt = Vector2.new(input.Position.X, input.Position.Y)
	end
end)

UserInputService.InputEnded:Connect(function(input)
	if input.UserInputType ~= Enum.UserInputType.MouseButton1 or not pressAt then
		return
	end
	local releaseAt = Vector2.new(input.Position.X, input.Position.Y)
	local moved = (releaseAt - pressAt).Magnitude
	pressAt = nil
	if moved > DRAG_EPS or ClientState.view == nil then
		return
	end
	-- ScreenPointToRay, NOT ViewportPointToRay: InputObject positions are in
	-- GUI-inset space; the viewport variant is offset by the topbar (~36px),
	-- which at shallow angles walks the pick most of a tile (R4 user finding)
	local ray = camera:ScreenPointToRay(releaseAt.X, releaseAt.Y)
	refreshFilter()
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 1000, rayParams)
	if not hit then
		return
	end
	local p = hit.Position - hit.Normal * 0.05
	local map = ClientState.view.map
	local tx = math.clamp(math.floor(p.X / TILE + 0.5), 0, map.width - 1)
	local ty = math.clamp(math.floor(p.Z / TILE + 0.5), 0, map.height - 1)
	handlePick(tx, ty)
end)

-- ---- keys: B found city, Return end turn -----------------------------------
UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	local view = ClientState.view
	if view == nil then
		return
	end
	if input.KeyCode == Enum.KeyCode.B then
		local u = ClientState.selectedUnitId and view.units[ClientState.selectedUnitId]
		if u ~= nil and u.type == "settlers" then
			local name = "Colony " .. (ownCityCount(view) + 1)
			print(("[Select] found city '%s' with %s at (%d,%d)"):format(name, u.id, u.x, u.y))
			ClientState.send({ type = "foundCity", unitId = u.id, name = name })
		else
			print("[Select] found city: select a settlers unit first")
		end
	elseif input.KeyCode == Enum.KeyCode.Return then
		if ClientState.myTurn() then
			print("[Select] end turn " .. view.turn)
			ClientState.send({ type = "endTurn" })
		else
			print("[Select] not your turn (" .. tostring(view.activePlayer) .. " active)")
		end
	end
end)

print("[Select] R4 actions up: click select/move, B found city, Return end turn")
