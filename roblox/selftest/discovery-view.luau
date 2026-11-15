-- check.sh gate 57: the discovery splash's content rules (DiscoveryView)
-- over the real rulesets.
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local V = require("../src/client/DiscoveryView")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end
local function load(name)
	local raw = serde.decode("json", fs.readFile("data/" .. name .. ".json"))
	return raw[name] or raw
end
local rs = { techs = load("techs"), units = load("units"), buildings = load("buildings"), wonders = load("wonders"),
	governments = load("governments") }

-- every unit / building / wonder with a tech is announced by exactly that tech
local announced, expected = 0, 0
for _, cat in ipairs({ "units", "buildings", "wonders" }) do
	for id, def in pairs(rs[cat]) do
		if def.tech ~= nil and def.tech ~= "" and def.barbOnly ~= true then
			expected += 1
		end
	end
end
local nTech = 0
for id in pairs(rs.techs) do
	nTech += 1
	local list = V.unlocks(rs, id)
	announced += #list
	local last = nil
	for _, u in ipairs(list) do
		check("unlock belongs to the tech " .. u.id, rs[u.cat][u.id].tech == id)
		check("no barbarian-only unit is announced " .. u.id, rs[u.cat][u.id].barbOnly ~= true)
		local rank = (u.cat == "units" and "1" or u.cat == "buildings" and "2" or "3") .. u.id
		check("order: units, buildings, wonders, each by id " .. u.id, last == nil or rank > last)
		last = rank
	end
	local m = V.model(id, rs, { techs = {}, researching = id }, "A blurb.", false)
	check("model " .. id, m ~= nil and m.name == rs.techs[id].name and m.era == rs.techs[id].era)
	local inGroups = 0
	for _, g in ipairs(m.groups) do
		check("no empty group " .. id, #g.items > 0)
		inGroups += #g.items
	end
	check("groups hold every unlock " .. id, inGroups == #list)
	check("empty flag " .. id, m.empty == (#list == 0 and #m.governments == 0))
	for _, n in ipairs(m.nowOpen) do
		check("a tech is not both open and later " .. id, table.find(m.leadsTo, n) == nil)
	end
end
check("every buildable is announced once", announced == expected, announced .. "/" .. expected)
check("unknown tech: no model", V.model("no-such-tech", rs, { techs = {} }, nil, false) == nil)

-- alphabet with nothing else known: Writing needs only Alphabet, Map Making too
local m = V.model("alphabet", rs, { techs = {}, researching = "alphabet" }, "Text.", false)
check("alphabet opens writing", table.find(m.nowOpen, "Writing") ~= nil, table.concat(m.nowOpen, ","))
check("blurb kept", m.blurb == "Text.")
check("no blurb = nil", V.model("alphabet", rs, { techs = {} }, "", false).blurb == nil)
check("at the keyboard: never times out", m.auto == nil)
check("under the regent: times out", V.model("alphabet", rs, { techs = {} }, nil, true).auto == V.AUTO_SECONDS)
check("research unset after the discovery: offer the picker", m.wantsResearch == true)
check("research already chosen: no picker", V.model("alphabet", rs, { techs = {}, researching = "bronze-working" }, nil, false).wantsResearch == false)
-- a tech with two prerequisites: opens only when the other is known
local two, twoId = nil, nil
for id, d in pairs(rs.techs) do
	if #(d.prereqs or {}) == 2 then
		two, twoId = d, id
		break
	end
end
local a, b = two.prereqs[1], two.prereqs[2]
local lone = V.model(a, rs, { techs = {} }, nil, false)
check("second prerequisite missing: listed as later", table.find(lone.leadsTo, two.name) ~= nil and table.find(lone.nowOpen, two.name) == nil)
local both = V.model(a, rs, { techs = { b } }, nil, false)
check("second prerequisite known: now open", table.find(both.nowOpen, two.name) ~= nil)
local done = V.model(a, rs, { techs = { b, twoId } }, nil, false)
check("an advance already known is not listed", table.find(done.nowOpen, two.name) == nil and table.find(done.leadsTo, two.name) == nil)
-- governments
local govTech = nil
for _, g in pairs(rs.governments) do
	if g.tech ~= nil and g.tech ~= "" then
		govTech = g
		break
	end
end
check("a government's tech announces it", table.find(V.model(govTech.tech, rs, { techs = {} }, nil, false).governments, govTech.name) ~= nil)
-- everything known: nothing left to research
local all = {}
for id in pairs(rs.techs) do
	all[#all + 1] = id
end
local last = V.model("future-tech", rs, { techs = all, researching = "" }, nil, false)
check("future tech flag", last.future == true)
check("nothing left: no picker", last.wantsResearch == false)

-- buttons
local function ids(list)
	local out = {}
	for i, x in ipairs(list) do
		out[i] = x.id .. ":" .. x.color
	end
	return table.concat(out, " ")
end
check("buttons with research", ids(V.buttons({ wantsResearch = true })) == "research:go pedia:menu continue:neutral")
check("buttons without", ids(V.buttons({ wantsResearch = false })) == "pedia:menu continue:go")

-- chips
local names = { "Phalanx", "Colossus", "Mechanized Infantry", "Great Library", "Temple", "A", "Hanging Gardens" }
for _, width in ipairs({ 120, 240, 400, V.W - 2 * V.PAD, 2000 }) do
	local lay = V.chipLayout(names, width)
	check("all chips placed @" .. width, #lay.chips == #names)
	for i, c in ipairs(lay.chips) do
		check("chip inside the row @" .. width, c.x >= 0 and c.x + c.w <= width, c.x + c.w)
		check("chip inside the height @" .. width, c.y + V.CHIP_H <= lay.height)
		for j = i + 1, #lay.chips do
			local d = lay.chips[j]
			check("chips apart @" .. width, c.y ~= d.y or c.x + c.w + V.CHIP_GAP <= d.x or d.x + d.w + V.CHIP_GAP <= c.x)
		end
	end
end
check("no chips: no height", V.chipLayout({}, 400).height == 0)
check("one row when wide", V.chipLayout(names, 2000).height == V.CHIP_H)
check("wraps when narrow", V.chipLayout(names, 240).height > V.CHIP_H)

if fails > 0 then
	error(fails .. " discovery pin(s) failed")
end
print(("discovery-view: %d techs, %d buildables announced"):format(nTech, announced))
