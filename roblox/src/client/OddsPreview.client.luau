-- R7d (1): combat odds preview (roblox/SPEC.md §3j) — hover an ADJACENT
-- enemy-held tile with an attack-capable unit selected and a Billboard shows
-- the browser's exact preview string (client/ui/input.js:26 is the spec):
--   "Favorable 67% - Legion 300 vs Militia 150 (mountains +200%, fortified +50%)"
-- Same math, READ-ONLY: attackStrength/defenseStrength/bestDefender come from
-- luau/combat.luau on a view shim; the server judges the real attack.
-- Coordinate note: GetMouseLocation returns VIEWPORT coords, so the ray is
-- ViewportPointToRay here — the inverse pairing of Select's trap-2 fix
-- (InputObject positions are GUI-inset and need ScreenPointToRay).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local combat = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("combat"))
local citiesModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("cities"))

local TILE = ClientState.TILE
local camera = workspace.CurrentCamera
local world = workspace:WaitForChild("ClientWorld")

local anchor = Instance.new("Part")
anchor.Name = "OddsAnchor"
anchor.Anchored = true
anchor.Transparency = 1
anchor.CanCollide = false
anchor.CanQuery = false
anchor.Size = Vector3.new(0.2, 0.2, 0.2)
anchor.Parent = world

local bb = Instance.new("BillboardGui")
bb.Size = UDim2.new(0, 340, 0, 40)
bb.StudsOffset = Vector3.new(0, 6, 0)
bb.AlwaysOnTop = true
bb.Enabled = false
bb.Adornee = anchor
bb.Parent = anchor
local text = Instance.new("TextLabel")
text.Size = UDim2.new(1, 0, 1, 0)
text.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
text.BackgroundTransparency = 0.2
text.TextColor3 = Color3.fromRGB(240, 220, 160)
text.Font = Enum.Font.Code
text.TextSize = 12
text.TextWrapped = true
text.Parent = bb

local DIR_OK = {
	["0,-1"] = true, ["1,-1"] = true, ["1,0"] = true, ["1,1"] = true,
	["0,1"] = true, ["-1,1"] = true, ["-1,0"] = true, ["-1,-1"] = true,
}

local function adjacent(view, u, tx, ty)
	local dx = tx - u.x
	if view.map.wrapX then
		local w = view.map.width
		if dx > w / 2 then
			dx -= w
		end
		if dx < -w / 2 then
			dx += w
		end
	end
	return DIR_OK[dx .. "," .. (ty - u.y)] == true
end

-- the input.js:26 string, minus the emoji (Code font): word pct - A a vs D d (parts)
local function previewText(view, attacker, tx, ty)
	local rs = ClientState.rulesets()
	if (rs.units[attacker.type] or {}).attack <= 0 then
		return nil
	end
	local shim = { map = view.map, units = view.units, cities = view.cities,
		wonders = view.wonders, players = view.players, cityOrder = view.cityOrder }
	local defender = combat.bestDefender(shim, tx, ty, rs)
	if defender == nil or defender.owner == view.you then
		return nil
	end
	local att = combat.attackStrength(attacker, rs)
	local def = combat.defenseStrength(shim, defender, rs)
	local pct = math.floor(att * 100 / (att + def) + 0.5)
	local word = if pct >= 75 then "Strong"
		elseif pct >= 55 then "Favorable"
		elseif pct >= 45 then "Even"
		elseif pct >= 25 then "Risky"
		else "Desperate"
	local parts = {}
	local tile = view.map.tiles[ty * view.map.width + tx + 1]
	local terrainBonus = (rs.terrain.terrains[tile.t] or {}).defenseBonus or 0
	if terrainBonus > 0 then
		table.insert(parts, ("%s +%d%%"):format(tile.t, terrainBonus))
	end
	if tile.river == true then
		table.insert(parts, ("river +%d%%"):format(rs.terrain.riverModifier.defenseBonus))
	end
	if defender.fortified == true then
		table.insert(parts, "fortified +50%")
	end
	if attacker.veteran == true then
		table.insert(parts, "veteran attacker +50%")
	end
	local city = combat.cityAt(shim, tx, ty)
	if city ~= nil then
		local walls = table.find(city.buildings or {}, "city-walls") ~= nil
		if not walls and view.wonders ~= nil and view.wonders["great-wall"] ~= nil then
			local home = view.cities[view.wonders["great-wall"]]
			local okActive, active = pcall(citiesModule.wonderActive, shim, "great-wall", rs)
			walls = okActive and active == true and home ~= nil and home.owner == city.owner
		end
		if walls then
			table.insert(parts, "city walls x3")
		end
	elseif tile.fortress == true then
		table.insert(parts, "fortress x2")
	end
	return ("%s %d%% - %s %g vs %s %g%s"):format(word, pct,
		rs.units[attacker.type].name, att / 100,
		rs.units[defender.type].name, def / 100,
		#parts > 0 and (" (" .. table.concat(parts, ", ") .. ")") or "")
end

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude

local lastShown = nil
local acc = 0
RunService.Heartbeat:Connect(function(dt)
	acc += dt
	if acc < 0.15 then
		return
	end
	acc = 0
	local view = ClientState.view
	local u = ClientState.selectedUnitId and view and view.units[ClientState.selectedUnitId]
	if view == nil or u == nil or u.owner ~= view.you or u.moves <= 0 or not ClientState.myTurn() then
		if bb.Enabled then
			bb.Enabled = false
			lastShown = nil
		end
		return
	end
	local m = UserInputService:GetMouseLocation()
	local ray = camera:ViewportPointToRay(m.X, m.Y)
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 1000, rayParams)
	local show = nil
	if hit ~= nil then
		local p = hit.Position - hit.Normal * 0.05
		local tx = math.clamp(math.floor(p.X / TILE + 0.5), 0, view.map.width - 1)
		local ty = math.clamp(math.floor(p.Z / TILE + 0.5), 0, view.map.height - 1)
		if adjacent(view, u, tx, ty) then
			local ok, line = pcall(previewText, view, u, tx, ty)
			if ok and line ~= nil then
				show = { tx = tx, ty = ty, line = line }
			end
		end
	end
	if show == nil then
		if bb.Enabled then
			bb.Enabled = false
			lastShown = nil
		end
		return
	end
	local key = show.tx .. "," .. show.ty .. show.line
	if key ~= lastShown then
		lastShown = key
		local part = world.Terrain:FindFirstChild(("Tile_%d_%d"):format(show.tx, show.ty))
		local top = part and (part.Position.Y + part.Size.Y / 2) or 0
		anchor.Position = Vector3.new(show.tx * TILE, top, show.ty * TILE)
		text.Text = show.line
		bb.Enabled = true
		print("[Odds] " .. show.line)
	end
end)

print("[Odds] R7d combat odds preview up (hover an adjacent enemy)")
