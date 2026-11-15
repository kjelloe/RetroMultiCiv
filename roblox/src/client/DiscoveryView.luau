-- The discovery splash's content and layout (pure: no Instances).
-- User, 2026-11-15: a discovery needs more than a "NN discovered" line - a
-- splash with what was just invented and the encyclopedia's information.
-- DiscoveryCard.client draws what model() returns.
-- roblox/selftest/discovery-view.luau (gate 57).
local M = {}

M.W = 660
M.PAD = 22
M.CHIP_H = 30
M.CHIP_GAP = 6
M.CHIP_PAD = 12
M.CHAR_W = 8.6 -- GothamBold 15
M.AUTO_SECONDS = 7 -- only while the AI regent holds the seat
M.FUTURE = "future-tech"

M.GROUPS = {
	{ cat = "units", label = "Units", color = "#ffa06e" },
	{ cat = "buildings", label = "Buildings", color = "#78beff" },
	{ cat = "wonders", label = "Wonders", color = "#ffe182" },
}

-- everything a tech lets you build: { cat, id, name }, units then buildings
-- then wonders, each by id (the order the encyclopedia lists them)
function M.unlocks(rs, techId)
	local out = {}
	for _, g in ipairs(M.GROUPS) do
		local tbl = rs[g.cat] or {}
		local ids = {}
		for id in pairs(tbl) do
			ids[#ids + 1] = id
		end
		table.sort(ids)
		for _, id in ipairs(ids) do
			-- a barbarian-only unit is nobody's to build
			if tbl[id].tech == techId and tbl[id].barbOnly ~= true then
				out[#out + 1] = { cat = g.cat, id = id, name = tbl[id].name or id }
			end
		end
	end
	return out
end

local function sortedNames(list)
	table.sort(list)
	return list
end

-- me: the viewer's own player row (techs, researching); away: the regent
-- holds the seat. -> the splash's content
function M.model(techId, rs, me, blurb, away)
	local def = rs.techs[techId]
	if def == nil then
		return nil
	end
	local known = {}
	for _, t in ipairs((me ~= nil and me.techs) or {}) do
		known[t] = true
	end
	known[techId] = true
	local m = {
		id = techId, name = def.name or techId, era = def.era or "ancient", future = techId == M.FUTURE,
		blurb = (blurb ~= nil and blurb ~= "") and blurb or nil,
		groups = {}, governments = {}, nowOpen = {}, leadsTo = {},
	}
	local all = M.unlocks(rs, techId)
	for _, g in ipairs(M.GROUPS) do
		local items = {}
		for _, u in ipairs(all) do
			if u.cat == g.cat then
				items[#items + 1] = u
			end
		end
		if #items > 0 then
			m.groups[#m.groups + 1] = { label = g.label, color = g.color, items = items }
		end
	end
	for gid, g in pairs(rs.governments or {}) do
		if g.tech == techId then
			m.governments[#m.governments + 1] = g.name or gid
		end
	end
	sortedNames(m.governments)
	-- what this discovery leads to: "now open" = every prerequisite is known,
	-- so it can be researched next; the rest still need another advance
	for other, d in pairs(rs.techs) do
		if not known[other] and table.find(d.prereqs or {}, techId) ~= nil then
			local open = true
			for _, p in ipairs(d.prereqs or {}) do
				if not known[p] then
					open = false
				end
			end
			table.insert(open and m.nowOpen or m.leadsTo, d.name or other)
		end
	end
	sortedNames(m.nowOpen)
	sortedNames(m.leadsTo)
	-- research is unset and something can be researched: offer the picker
	local researching = me ~= nil and me.researching or nil
	local anyAvailable = false
	for other, d in pairs(rs.techs) do
		if not known[other] and other ~= M.FUTURE then
			local open = true
			for _, p in ipairs(d.prereqs or {}) do
				if not known[p] then
					open = false
				end
			end
			anyAvailable = anyAvailable or open
		end
	end
	m.wantsResearch = (researching == nil or researching == "" or researching == techId) and anyAvailable
	m.auto = away and M.AUTO_SECONDS or nil -- a player at the keyboard dismisses it; it never times out on them
	m.empty = #m.groups == 0 and #m.governments == 0
	return m
end

function M.chipWidth(name)
	return math.ceil(#name * M.CHAR_W) + 2 * M.CHIP_PAD
end

-- names -> { chips = { { i, x, y, w } }, height }: wraps, never overlaps,
-- a chip wider than the row is cut to the row
function M.chipLayout(names, width)
	local chips = {}
	local x, y = 0, 0
	for i, name in ipairs(names) do
		local w = math.min(M.chipWidth(name), width)
		if x > 0 and x + w > width then
			x = 0
			y += M.CHIP_H + M.CHIP_GAP
		end
		chips[#chips + 1] = { i = i, x = x, y = y, w = w }
		x += w + M.CHIP_GAP
	end
	return { chips = chips, height = #names > 0 and (y + M.CHIP_H) or 0 }
end

-- the buttons under the card, left to right
function M.buttons(m)
	local out = {}
	if m.wantsResearch then
		out[#out + 1] = { id = "research", label = "Choose research", color = "go" }
	end
	out[#out + 1] = { id = "pedia", label = "Encyclopedia", color = "menu" }
	out[#out + 1] = { id = "continue", label = "Continue", color = m.wantsResearch and "neutral" or "go" }
	return out
end

return M
