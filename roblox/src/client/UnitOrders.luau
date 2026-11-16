-- Unit order rules (plan step 3; pure — roblox/selftest/unit-orders.luau,
-- gate 62): for the selected unit, which orders are open, what each button
-- says on this tile, and why a greyed one is greyed. Display only: the server
-- judges every command. Twin of the action list in client/ui/input.js
-- (workBlocked, helpWonderCityFor, the Clear / Drain / Plant / Railroad labels).
local M = {}

M.CONFIRM_WINDOW = 3 -- seconds a first Disband press stays armed

M.ACTIONS = { "found", "fortify", "wait", "goto", "disband", "irrigate", "mine", "road", "fortress",
	"pillage", "trade", "helpWonder", "upgrade", "possess" }

local SETTLER_JOBS = { found = true, irrigate = true, mine = true, road = true, fortress = true }

local function tileOf(view, u)
	return view.map.tiles[u.y * view.map.width + u.x + 1]
end

local function cityAt(view, x, y)
	for _, cid in ipairs(view.cityOrder or {}) do
		local c = view.cities[cid]
		if c ~= nil and c.x == x and c.y == y then
			return c
		end
	end
	return nil
end

local function knows(view, tech)
	local me = view.players[view.you]
	return tech ~= nil and me ~= nil and table.find(me.techs or {}, tech) ~= nil
end

local function techName(rs, id)
	local def = rs.techs ~= nil and rs.techs[id] or nil
	return def ~= nil and def.name or tostring(id)
end

-- the road button builds rails on a roaded tile once Railroad is known
function M.roadWork(view, u, rs)
	local tile = tileOf(view, u)
	if tile ~= nil and tile.road == true and tile.railroad ~= true and knows(view, rs.rules.railroadTech) then
		return "railroad"
	end
	return "road"
end

-- what the button says on this tile
function M.label(action, view, u, rs)
	local tile = u ~= nil and view ~= nil and tileOf(view, u) or nil
	local terrain = tile ~= nil and rs.terrain.terrains[tile.t] or nil
	if action == "irrigate" then
		local to = terrain ~= nil and terrain.irrigate == nil and terrain.transforms ~= nil and terrain.transforms.irrigate or nil
		return to == nil and "Irr (I)" or (tile.t == "swamp" and "Drain (I)" or "Clear (I)")
	elseif action == "mine" then
		local to = terrain ~= nil and terrain.mine == nil and terrain.transforms ~= nil and terrain.transforms.mine or nil
		return to == nil and "Mine (M)" or (to == "forest" and "Plant (M)" or "Clear (M)")
	elseif action == "road" then
		return u ~= nil and view ~= nil and M.roadWork(view, u, rs) == "railroad" and "Rail (R)" or "Road (R)"
	elseif action == "helpWonder" then
		local def = u ~= nil and rs.units[u.type] or nil
		return def ~= nil and def.helpsWonder == true and ("Help Wonder +%d"):format(def.cost or 0) or "Help Wonder"
	end
	return nil
end

-- why a settlers job can not start here (nil: it can). deps.improvements =
-- the engine module (hasWaterSource)
function M.workBlocked(view, u, work, rs, deps)
	local tile = tileOf(view, u)
	local terrain = tile ~= nil and rs.terrain.terrains[tile.t] or nil
	if terrain == nil or terrain.domain ~= "land" then
		return "Only on land."
	end
	local flag = work == "irrigate" and "irrigation" or work
	if tile[flag] == true then
		return "Already built on this tile."
	end
	if tile.river == true then
		if work == "road" and not knows(view, rs.rules.bridgeTech) then
			return ("A road over a river needs %s."):format(techName(rs, rs.rules.bridgeTech))
		end
		if work == "mine" then
			return "A river tile can not be mined."
		end
	end
	if work == "fortress" then
		if not knows(view, rs.rules.fortressTech) then
			return ("Needs %s."):format(techName(rs, rs.rules.fortressTech))
		end
		if cityAt(view, u.x, u.y) ~= nil then
			return "A city tile needs no fortress."
		end
	elseif work == "railroad" then
		if not knows(view, rs.rules.railroadTech) then
			return ("Needs %s."):format(techName(rs, rs.rules.railroadTech))
		end
		if tile.road ~= true then
			return "Needs a road first."
		end
	elseif work == "irrigate" or work == "mine" then
		local transform = terrain.transforms ~= nil and terrain.transforms[work] ~= nil
		if terrain[work] == nil and not transform then
			return ("%s can not be %s."):format(terrain.name or tile.t, work == "mine" and "mined" or "irrigated")
		end
		if work == "irrigate" and not transform and not deps.improvements.hasWaterSource({ map = view.map }, u.x, u.y) then
			return "Needs water next to it: a river, the ocean or an irrigated tile."
		end
	end
	return nil
end

-- the own city on the unit's tile that is building a wonder, for a unit that
-- can help (nil otherwise)
function M.helpWonderCity(view, u, rs)
	local def = rs.units[u.type]
	if def == nil or def.helpsWonder ~= true then
		return nil
	end
	local c = cityAt(view, u.x, u.y)
	if c ~= nil and c.owner == view.you and c.producing ~= nil and c.producing.kind == "wonder" then
		return c
	end
	return nil
end

-- -> { enabled, reason (when not enabled), label (when the tile changes it),
--      work (settlers jobs: what startWork sends), shown (false: leave the
--      button out for this unit) }
-- ctx: { myTurn, hasPlan (the unit is on a GoTo route), armed (target pick) }
function M.order(action, view, u, rs, ctx, deps)
	local out = { enabled = false, shown = true }
	if action == "helpWonder" then
		out.shown = u ~= nil and rs.units[u.type] ~= nil and rs.units[u.type].helpsWonder == true
	end
	if view == nil then
		out.reason = "No game is running."
		return out
	end
	if not ctx.myTurn then
		out.reason = "Not your turn."
		return out
	end
	if u == nil then
		out.reason = "Select one of your units first."
		return out
	end
	out.label = M.label(action, view, u, rs)
	local def = rs.units[u.type]
	if action == "disband" or action == "possess" then
		out.enabled = true
	elseif action == "goto" then
		if ctx.hasPlan then
			out.enabled = true
			out.label = "Cancel route"
		elseif u.moves <= 0 and not ctx.armed then
			out.reason = "No moves left this turn."
		elseif u.fortified == true and not ctx.armed then
			out.reason = "The unit is fortified. Move it once to wake it."
		else
			out.enabled = true
		end
	elseif action == "fortify" or action == "wait" then
		if u.moves <= 0 then
			out.reason = "No moves left this turn."
		elseif u.fortified == true then
			out.reason = "Already fortified."
		else
			out.enabled = true
		end
	elseif action == "pillage" then
		out.enabled = u.moves > 0
		out.reason = not out.enabled and "No moves left this turn." or nil
	elseif action == "trade" then
		out.enabled = def ~= nil and def.tradeRoutes == true
		out.reason = not out.enabled and "Only a Caravan can set up a trade route." or nil
	elseif action == "helpWonder" then
		if not out.shown then
			out.reason = "Only a Caravan can help build a wonder."
		elseif M.helpWonderCity(view, u, rs) == nil then
			out.reason = "Stand in one of your cities that is building a wonder."
		else
			out.enabled = true
		end
	elseif action == "upgrade" then
		local c = cityAt(view, u.x, u.y)
		if def == nil or def.upgradesTo == nil then
			out.reason = "This unit has no upgrade."
		elseif c == nil or c.owner ~= view.you then
			out.reason = "Upgrades happen inside your own cities."
		else
			out.enabled = true
		end
	elseif SETTLER_JOBS[action] then
		if u.type ~= "settlers" then
			out.reason = "Only Settlers can do that."
		elseif u.moves <= 0 then
			out.reason = "No moves left this turn."
		elseif action == "found" then
			out.enabled = true
		else
			out.work = action == "road" and M.roadWork(view, u, rs) or action
			out.reason = M.workBlocked(view, u, out.work, rs, deps)
			out.enabled = out.reason == nil
		end
	end
	return out
end

-- Disband asks once more: the first press arms it, a second inside the
-- window sends. -> "send" | "arm"
function M.disbandPress(armedUnitId, armedAt, unitId, now)
	if armedUnitId == unitId and armedAt ~= nil and now - armedAt <= M.CONFIRM_WINDOW then
		return "send"
	end
	return "arm"
end

-- the route as at most `max` dots, the destination always among them
function M.routeDots(points, max)
	local n = #points - 1 -- the first point is the unit's own tile
	local out = {}
	if n <= 0 then
		return out
	end
	if n <= max then
		for i = 2, #points do
			out[#out + 1] = points[i]
		end
		return out
	end
	for i = 1, max do
		out[i] = points[1 + math.ceil(i * n / max)]
	end
	return out
end

-- the hover card of an order button
function M.card(title, o)
	if o.enabled or o.reason == nil then
		return title
	end
	return title .. "\n" .. o.reason
end

return M
