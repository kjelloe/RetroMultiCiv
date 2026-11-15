-- check.sh gate 49: city catalog rules (CatalogInfo) over the real rulesets.
-- The list offers nothing the engine's setProduction refuses: barb-only and
-- obsolete units are not listed, sea units need a coast, nuclear units need
-- nukes enabled; every listed entry has a well-formed hover card.
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local C = require("../src/client/CatalogInfo")

local function load(name)
	local raw = serde.decode("json", fs.readFile("data/" .. name .. ".json"))
	return raw[name] or raw
end
local units, buildings, wonders, techs = load("units"), load("buildings"), load("wonders"), load("techs")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local function ctx(over)
	local c = { techs = {}, reachable = function() return true end,
		techName = function(id) return (techs[id] or {}).name or id end,
		hideFuture = false, built = {}, wondersTaken = {}, coastal = true, nukes = true }
	for k, v in pairs(over or {}) do
		c[k] = v
	end
	return c
end
local allTechs = {}
for id in pairs(techs) do
	allTechs[id] = true
end

-- the reported bug: a barb-only unit is never listed, whatever the player knows
local barb, sea, nuke, obsoletable = 0, 0, 0, 0
for id, def in pairs(units) do
	if def.barbOnly == true then
		barb += 1
		check("barb-only hidden at the start " .. id, C.availability("unit", id, def, ctx()) == C.HIDE)
		check("barb-only hidden with every tech " .. id, C.availability("unit", id, def, ctx({ techs = allTechs })) == C.HIDE)
	end
end
check("the ruleset has a barb-only unit", barb >= 1, barb)

for id, def in pairs(units) do
	if def.barbOnly ~= true then
		local own = {}
		if def.tech ~= nil and def.tech ~= "" then
			own[def.tech] = true
		end
		-- knows exactly the unit's tech: listed and buildable (coast + nukes granted)
		check("buildable with its tech " .. id, C.availability("unit", id, def, ctx({ techs = own })) == nil,
			C.availability("unit", id, def, ctx({ techs = own })))
		if def.tech ~= nil and def.tech ~= "" then
			check("locked with the reason " .. id, C.availability("unit", id, def, ctx()) == "needs " .. techs[def.tech].name)
			check("hidden beyond the lookahead " .. id,
				C.availability("unit", id, def, ctx({ reachable = function() return false end })) == C.HIDE)
			check("hidden by hideFuture " .. id, C.availability("unit", id, def, ctx({ hideFuture = true })) == C.HIDE)
		end
		if def.obsoletedBy ~= nil and def.obsoletedBy ~= "" then
			obsoletable += 1
			own[def.obsoletedBy] = true
			check("obsolete unit hidden " .. id, C.availability("unit", id, def, ctx({ techs = own })) == C.HIDE)
			own[def.obsoletedBy] = nil
		end
		if def.domain == "sea" then
			sea += 1
			check("sea unit needs a coast " .. id, C.availability("unit", id, def, ctx({ techs = own, coastal = false })) == "needs a coastal city")
		else
			check("land/air unit ignores the coast " .. id, C.availability("unit", id, def, ctx({ techs = own, coastal = false, nukes = true })) == nil)
		end
		if def.nuclearBlast == true then
			nuke += 1
			check("nuclear unit needs nukes " .. id, C.availability("unit", id, def, ctx({ techs = own, nukes = false })) == "needs the Manhattan Project")
		end
	end
end
check("ruleset shape: sea / nuclear / obsoletable units exist", sea >= 3 and nuke >= 1 and obsoletable >= 5, sea .. "/" .. nuke .. "/" .. obsoletable)

for id, def in pairs(buildings) do
	local own = {}
	if def.tech ~= nil and def.tech ~= "" then own[def.tech] = true end
	check("building buildable " .. id, C.availability("building", id, def, ctx({ techs = own })) == nil)
	check("building built " .. id, C.availability("building", id, def, ctx({ techs = own, built = { [id] = true } })) == "built")
end
for id, def in pairs(wonders) do
	local own = {}
	if def.tech ~= nil and def.tech ~= "" then own[def.tech] = true end
	check("wonder buildable " .. id, C.availability("wonder", id, def, ctx({ techs = own })) == nil)
	check("wonder taken " .. id, C.availability("wonder", id, def, ctx({ techs = own, wondersTaken = { [id] = "c7" } })) == "taken")
end

-- hover cards: balanced tags, name first, cost present, no raw markup from data
local function balanced(s)
	local open = select(2, s:gsub("<font", ""))
	local close = select(2, s:gsub("</font>", ""))
	local bo = select(2, s:gsub("<b>", ""))
	local bc = select(2, s:gsub("</b>", ""))
	return open == close and bo == bc
end
local opts = { blurb = "A <test> & blurb.", effects = "does a thing", techName = function(id) return (techs[id] or {}).name or id end }
local n = 0
for kind, table_ in pairs({ unit = units, building = buildings, wonder = wonders }) do
	for id, def in pairs(table_) do
		n += 1
		local card = C.card(kind, id, def, opts)
		check("card tags balanced " .. id, balanced(card))
		check("card leads with the name " .. id, card:find(C.escape(def.name or id), 1, true) ~= nil and card:sub(1, 5) == "<font")
		check("card has the cost " .. id, card:find((def.cost or 0) .. " shields", 1, true) ~= nil)
		check("card escapes prose " .. id, card:find("A &lt;test&gt; &amp; blurb.", 1, true) ~= nil)
		check("card states the requirement " .. id, card:find("Requires ", 1, true) ~= nil or card:find("Available from the start", 1, true) ~= nil)
		if kind == "unit" then
			check("unit card has combat figures " .. id, card:find("Attack", 1, true) ~= nil and card:find("Defense", 1, true) ~= nil and card:find("Moves", 1, true) ~= nil)
		elseif kind == "building" then
			check("building card has upkeep " .. id, card:find("Upkeep", 1, true) ~= nil)
		end
	end
end
check("cards for the whole catalog", n >= 60, n)
local locked = C.card("unit", "trireme", units.trireme or next(units), { techName = opts.techName, lock = "needs a coastal city" })
check("locked card says why", locked:find("Not available here: needs a coastal city", 1, true) ~= nil)
check("card without prose has no empty line", C.card("wonder", "x", { name = "X", cost = 1, tech = "" }, { techName = opts.techName }):find("\n\n", 1, true) == nil)

if fails > 0 then
	error(fails .. " catalog pin(s) failed")
end
print(("catalog-info: %d entries, %d barb-only, %d sea, %d obsoletable"):format(n, barb, sea, obsoletable))
