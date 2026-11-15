-- Military overview content (pure: no Instances) - the client/ui/
-- military-overview.js twin (XIV §41): every own unit as one row (type,
-- attack / defense / moves, the home city that supports it, where it is),
-- plus a count per unit type. Reads the seat's own view only.
-- roblox/selftest/military-view.luau.
local M = {}

local function cityAt(view, x, y)
	for _, c in pairs(view.cities or {}) do
		if c.x == x and c.y == y then
			return c
		end
	end
	return nil
end

-- nearest own city by wrapped manhattan distance (the seam is not a wall);
-- ties go to the lower city id so the row text is stable
local function nearestOwn(view, x, y)
	local best, bestD, bestId = nil, math.huge, nil
	for cid, c in pairs(view.cities or {}) do
		if c.owner == view.you and c.x ~= nil then
			local dx = math.abs(c.x - x)
			if view.map ~= nil and view.map.wrapX == true and view.map.width - dx < dx then
				dx = view.map.width - dx
			end
			local d = dx + math.abs(c.y - y)
			if d < bestD or (d == bestD and tostring(cid) < tostring(bestId)) then
				best, bestD, bestId = c, d, cid
			end
		end
	end
	return best
end

function M.whereOf(view, u)
	local here = cityAt(view, u.x, u.y)
	if here ~= nil then
		return "in " .. here.name
	end
	local near = nearestOwn(view, u.x, u.y)
	return near ~= nil and ("near " .. near.name) or "in the field"
end

-- { { id, name, veteran, attack, defense, moves, home, where, x, y, kind } }
-- sorted by unit name, then id (numeric part first, so u9 precedes u10)
function M.rows(view, rs)
	local out = {}
	for uid, u in pairs(view.units or {}) do
		if u.owner == view.you then
			local def = rs.units[u.type] or {}
			local home = u.home ~= nil and view.cities ~= nil and view.cities[u.home] or nil
			out[#out + 1] = {
				id = uid, name = def.name or u.type, veteran = u.veteran == true,
				attack = def.attack or 0, defense = def.defense or 0, moves = def.moves or 0,
				home = home ~= nil and home.name or nil, -- nil = unsupported (costs no city shields)
				where = M.whereOf(view, u), x = u.x, y = u.y,
				kind = (def.attack or 0) > 0 and "combat" or "civil",
			}
		end
	end
	local function num(id)
		return tonumber(tostring(id):match("%d+")) or 0
	end
	table.sort(out, function(a, b)
		if a.name ~= b.name then
			return a.name < b.name
		end
		if num(a.id) ~= num(b.id) then
			return num(a.id) < num(b.id)
		end
		return tostring(a.id) < tostring(b.id)
	end)
	return out
end

-- { total, veterans, combat, civil, byType = { { name, count } } } (byType: most numerous first)
function M.summary(rows)
	local s = { total = #rows, veterans = 0, combat = 0, civil = 0, byType = {} }
	local index = {}
	for _, r in ipairs(rows) do
		if r.veteran then
			s.veterans += 1
		end
		s[r.kind] += 1
		if index[r.name] == nil then
			index[r.name] = { name = r.name, count = 0 }
			s.byType[#s.byType + 1] = index[r.name]
		end
		index[r.name].count += 1
	end
	table.sort(s.byType, function(a, b)
		if a.count ~= b.count then
			return a.count > b.count
		end
		return a.name < b.name
	end)
	return s
end

M.W = 560
M.ROW_H = 40
M.ROW_GAP = 4
M.HEAD_H = 96 -- heading, summary line, type chips
M.BODY_MAX = 420

function M.panelHeight(nRows)
	local content = math.max(1, nRows) * (M.ROW_H + M.ROW_GAP)
	return M.HEAD_H + math.min(content, M.BODY_MAX) + 8, content
end

return M
