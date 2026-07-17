-- R14: GoTo — target-pick mode + route-as-plan (docs/13's last deferred
-- Tier-1 row; the adopted review rule: GoTo reuses Select's pick machinery
-- with a mode flag). Select owns the O key and hands picks here while armed.
-- The PLAN lives client-side (plans[unitId] = target); every view push the
-- driver re-plans via the luau pathfind twin (fog-honest: canEnter comes
-- from StepLegality — the ONE source MoveHints shares) and issues ONE
-- ordinary moveUnit command — the engine validates every step, replays
-- record plain moves, so GoTo is golden-safe by construction (A65).
-- Reroute falls out of re-planning; blocked/unreachable cancels aloud.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local StepLegality = require(script.Parent:WaitForChild("StepLegality"))
local pathfind = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("pathfind"))

local TILE = ClientState.TILE
local world = workspace:WaitForChild("ClientWorld")

local M = {}
M.armed = false -- Select reads this: while true, the next pick is a target

local plans = {} -- unitId -> { x, y }

local DIR_BY_DELTA = {
	["0,-1"] = "N", ["1,-1"] = "NE", ["1,0"] = "E", ["1,1"] = "SE",
	["0,1"] = "S", ["-1,1"] = "SW", ["-1,0"] = "W", ["-1,-1"] = "NW",
}

-- breadcrumb pool: the picked route shows for a few seconds (the move-hint
-- tint stays the step-legality preview; these show the chosen line)
local crumbs = {}
local crumbFolder = Instance.new("Folder")
crumbFolder.Name = "GoToCrumbs"
crumbFolder.Parent = world
for i = 1, 32 do
	local c = Instance.new("Part")
	c.Anchored = true
	c.CanCollide = false
	c.CanQuery = false
	c.Shape = Enum.PartType.Ball
	c.Size = Vector3.new(0.5, 0.5, 0.5)
	c.Material = Enum.Material.Neon
	c.Color = Color3.fromRGB(170, 120, 235)
	c.Position = Vector3.new(0, -60, 0)
	c.Parent = crumbFolder
	crumbs[i] = c
end
local crumbGen = 0

local function tileTopY(x, y)
	local part = world:WaitForChild("Terrain"):FindFirstChild(("Tile_%d_%d"):format(x, y))
	return part and (part.Position.Y + part.Size.Y / 2) or 0
end

local function showCrumbs(points)
	crumbGen += 1
	local gen = crumbGen
	for i, c in ipairs(crumbs) do
		local p = points[i]
		c.Position = p ~= nil and Vector3.new(p.x * TILE, tileTopY(p.x, p.y) + 1.2, p.y * TILE)
			or Vector3.new(0, -60, 0)
	end
	task.delay(3, function()
		if gen == crumbGen then
			for _, c in ipairs(crumbs) do
				c.Position = Vector3.new(0, -60, 0)
			end
		end
	end)
end

local function planPath(view, u)
	local rs = ClientState.rulesets()
	local domain = rs.units[u.type] and rs.units[u.type].domain
	local target = plans[u.id]
	local shim = { map = view.map }
	local function canEnter(x, y)
		return StepLegality.canEnter(view, rs, domain, x, y)
	end
	local ok, path = pcall(pathfind.findPath, shim, rs, u, target, canEnter)
	return ok and path or nil
end

-- Select calls this with the picked tile while armed. Returns true when the
-- pick was consumed (Select then skips its normal click actions).
function M.pick(tx, ty)
	if not M.armed then
		return false
	end
	M.armed = false
	local view = ClientState.view
	local id = ClientState.selectedUnitId
	local u = view ~= nil and id ~= nil and view.units[id] or nil
	if u == nil or u.owner ~= view.you then
		print("[GoTo] no own unit selected — cancelled")
		return true
	end
	plans[id] = { x = tx, y = ty }
	local path = planPath(view, u)
	if path == nil then
		plans[id] = nil
		print(("[GoTo] (%d,%d): no route through known, legal tiles"):format(tx, ty))
		return true
	end
	showCrumbs(path.points)
	print(("[GoTo] %s -> (%d,%d): %d tiles, cost %d/3 — marching"):format(id, tx, ty, #path.points - 1, path.cost))
	return true
end

function M.arm()
	if ClientState.selectedUnitId == nil then
		print("[GoTo] select one of your units first")
		return
	end
	M.armed = not M.armed
	print(M.armed and "[GoTo] pick a destination (O again cancels)" or "[GoTo] cancelled")
end

function M.cancel(unitId)
	if plans[unitId] ~= nil then
		plans[unitId] = nil
		print("[GoTo] plan dropped for " .. unitId)
	end
end

-- the driver: one step per view push while it is our turn and the unit can
-- move; re-plans every step so fog lifts and blockers reroute (A65 rule)
local lastStep = nil
ClientState.onView(function(view)
	if not ClientState.myTurn() then
		return
	end
	for id, target in pairs(plans) do
		local u = view.units[id]
		if u == nil or u.owner ~= view.you then
			plans[id] = nil
		elseif u.x == target.x and u.y == target.y then
			plans[id] = nil
			print(("[GoTo] %s arrived at (%d,%d)"):format(id, target.x, target.y))
		elseif u.moves > 0 then
			local key = ("%s|%d|%d|%d|%d"):format(id, u.x, u.y, u.moves, view.turn)
			if key ~= lastStep then
				lastStep = key
				local path = planPath(view, u)
				if path == nil or #path.points < 2 then
					plans[id] = nil
					print(("[GoTo] %s: route lost — plan dropped"):format(id))
				else
					local nxt = path.points[2]
					local dx = nxt.x - u.x
					if view.map.wrapX then
						local w = view.map.width
						if dx > w / 2 then
							dx -= w
						end
						if dx < -w / 2 then
							dx += w
						end
					end
					local dir = DIR_BY_DELTA[dx .. "," .. (nxt.y - u.y)]
					if dir ~= nil then
						ClientState.send({ type = "moveUnit", unitId = id, dir = dir })
					end
				end
			end
		end
	end
end)

print("[GoTo] R14 route-as-plan up (O arms target pick on the selected unit)")

return M
