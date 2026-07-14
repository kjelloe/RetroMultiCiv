-- R3: click-to-select resolving to LOGICAL TILES (roblox/SPEC.md §3c).
-- A28's mid-glide lesson, honored the Roblox way: the pick comes from the
-- hit POSITION rounded to tile coords, never from which visual body the ray
-- struck — a unit mid-tile, a city block, or a mountain flank all resolve to
-- the tile they stand on.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")

local gameData = ReplicatedStorage:WaitForChild("GameData")
local MockState = require(gameData:WaitForChild("MockState"))

local TILE = 4 -- must match RenderWorld's scale
local map = MockState.map

local camera = workspace.CurrentCamera
local world = workspace:WaitForChild("World")

-- one reusable neon cursor, hidden until the first pick
local cursor = Instance.new("Part")
cursor.Name = "TileCursor"
cursor.Anchored = true
cursor.CanCollide = false
cursor.CanQuery = false -- the cursor must never swallow the next click
cursor.Size = Vector3.new(TILE, 0.4, TILE)
cursor.Material = Enum.Material.Neon
cursor.Color = Color3.fromRGB(255, 220, 60)
cursor.Transparency = 0.45
cursor.Parent = world

local function terrainAt(x, y) -- stored 0-based coords, +1 only at access
	return map.tiles[y * map.width + x + 1]
end

local function tileTopY(x, y)
	-- read the actual terrain column so the cursor sits on the surface
	local part = world.Terrain:FindFirstChild(("Tile_%d_%d"):format(x, y))
	return part and (part.Position.Y + part.Size.Y / 2) or 0
end

local function contentsAt(x, y)
	local found = {}
	for _, u in ipairs(MockState.units) do
		if u.x == x and u.y == y then
			table.insert(found, ("unit %s (%s, %s)"):format(u.id, u.type, u.owner))
		end
	end
	for _, c in ipairs(MockState.cities) do
		if c.x == x and c.y == y then
			table.insert(found, ("city %s (%s)"):format(c.name, c.owner))
		end
	end
	return #found > 0 and (" — " .. table.concat(found, ", ")) or ""
end

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude
local function refreshFilter()
	local character = Players.LocalPlayer.Character
	rayParams.FilterDescendantsInstances = character and { cursor, character } or { cursor }
end

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.MouseButton1 then
		return
	end
	local ray = camera:ViewportPointToRay(input.Position.X, input.Position.Y)
	refreshFilter()
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 1000, rayParams)
	if not hit then
		return
	end
	-- nudge INTO the surface so flank hits on tall columns round to the
	-- column's own tile, then resolve position -> logical tile, clamped
	local p = hit.Position - hit.Normal * 0.05
	local tx = math.clamp(math.floor(p.X / TILE + 0.5), 0, map.width - 1)
	local ty = math.clamp(math.floor(p.Z / TILE + 0.5), 0, map.height - 1)

	cursor.Position = Vector3.new(tx * TILE, tileTopY(tx, ty) + 0.25, ty * TILE)
	print(("[Select] tile (%d,%d) %s%s"):format(tx, ty, terrainAt(tx, ty), contentsAt(tx, ty)))
end)

print("[Select] R3 tile selection up: LMB picks the logical tile under the cursor")
