-- R6: movement affordance (roblox/SPEC.md §3g, docs/13 Tier-1 row) — the
-- browser's A19 hover hints, reshaped for click-to-move: while an own unit
-- with moves is selected, its eight neighbors get a marker — green where a
-- step is legal (known tile, domain match, no enemy), red where an enemy
-- stands on an otherwise-enterable tile (the attack ring). PURE display:
-- mirrors client/ui/move-hints.js legality (domain match only), never cost
-- math — cost/ZOC stay the engine's verdict at click time. Reads the
-- filtered view, so fog is respected by construction.

local RunService = game:GetService("RunService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local TILE = ClientState.TILE
local world = workspace:WaitForChild("ClientWorld")

local folder = Instance.new("Folder")
folder.Name = "MoveHints"
folder.Parent = world

local DELTAS = {
	{ 0, -1 }, { 1, -1 }, { 1, 0 }, { 1, 1 },
	{ 0, 1 }, { -1, 1 }, { -1, 0 }, { -1, -1 },
}

local GREEN = Color3.fromRGB(110, 220, 120)
local RED = Color3.fromRGB(230, 90, 80)

local markers = {}
for i = 1, 8 do
	local m = Instance.new("Part")
	m.Name = "Hint" .. i
	m.Anchored = true
	m.CanCollide = false
	m.CanQuery = false -- Select's raycast must pick the tile, not the hint
	m.Size = Vector3.new(TILE - 0.6, 0.2, TILE - 0.6)
	m.Material = Enum.Material.Neon
	m.Transparency = 0.6
	m.Parent = folder
	markers[i] = m
	m.Position = Vector3.new(0, -50, 0) -- parked underground until used
end

local function tileTopY(x, y)
	local part = world.Terrain:FindFirstChild(("Tile_%d_%d"):format(x, y))
	return part and (part.Position.Y + part.Size.Y / 2) or 0
end

local function enemyAt(view, x, y)
	for _, u in pairs(view.units) do
		if u.x == x and u.y == y and u.owner ~= view.you then
			return true
		end
	end
	return false
end

local function hideAll()
	for _, m in ipairs(markers) do
		m.Position = Vector3.new(0, -50, 0)
	end
end

local function showHints(view, unit)
	local rs = ClientState.rulesets()
	local domain = rs.units[unit.type] and rs.units[unit.type].domain
	local map = view.map
	local n = 0
	for _, d in ipairs(DELTAS) do
		local nx, ny = unit.x + d[1], unit.y + d[2]
		if map.wrapX then
			nx = nx % map.width
		end
		if nx >= 0 and nx < map.width and ny >= 0 and ny < map.height then
			local tile = map.tiles[ny * map.width + nx + 1]
			local terr = tile and rs.terrain.terrains[tile.t]
			if terr ~= nil and terr.domain == domain then -- known + walkable
				n += 1
				local m = markers[n]
				m.Color = enemyAt(view, nx, ny) and RED or GREEN
				m.Position = Vector3.new(nx * TILE, tileTopY(nx, ny) + 0.15, ny * TILE)
			end
		end
	end
	for i = n + 1, 8 do
		markers[i].Position = Vector3.new(0, -50, 0)
	end
end

-- selection isn't evented (Select writes ClientState.selectedUnitId
-- directly), so recompute on a cheap per-frame key compare
local lastKey = nil
RunService.Heartbeat:Connect(function()
	local view = ClientState.view
	local id = ClientState.selectedUnitId
	local u = view and id and view.units[id]
	if u == nil or u.owner ~= view.you or u.moves <= 0 or not ClientState.myTurn() then
		if lastKey ~= nil then
			lastKey = nil
			hideAll()
		end
		return
	end
	local key = ("%s|%d|%d|%d|%d"):format(id, u.x, u.y, u.moves, view.turn)
	if key == lastKey then
		return
	end
	lastKey = key
	showHints(view, u)
end)

print("[MoveHints] R6 move hints up")
