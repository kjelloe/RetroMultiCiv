-- check.sh gate 74: city keys (CityKeys, plan R6.2) over the real rulesets.
-- The browser's PRODUCTION_KEYS literal is scanned from client/ui/input.js so
-- a change there fails here.
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local K = require("../src/client/CityKeys")

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
local rs = { buildings = load("buildings"), wonders = load("wonders"), units = load("units") }

local input = fs.readFile("client/ui/input.js")
local literal = input:match("const PRODUCTION_KEYS = (%b{})")
check("browser key table found", literal ~= nil)
if literal ~= nil then
	for n, id in literal:gmatch("(%d+): '([%w%-]+)'") do
		check("key " .. n .. " = " .. id, K.PRODUCTION_KEYS[tonumber(n)] == id, K.PRODUCTION_KEYS[tonumber(n)])
	end
end
for _, id in pairs(K.PRODUCTION_KEYS) do
	check("unit exists " .. id, rs.units[id] ~= nil)
end

-- no advances: only what needs none
local city = { buildings = {}, producing = { kind = "unit", id = "militia" } }
local opts = K.cycleOptions(city, {}, rs, {})
for _, o in ipairs(opts) do
	local def = o.kind == "building" and rs.buildings[o.id] or rs.wonders[o.id]
	check("no advance needed: " .. o.id, def.tech == nil or def.tech == "")
end
local first = K.nextBuild(city, {}, rs, {})
check("from a unit: the first option", first ~= nil and first.id == opts[1].id, first and first.id)

-- every advance: buildings sorted, then wonders
local all = {}
for _, b in pairs(rs.buildings) do
	if b.tech ~= nil and b.tech ~= "" then
		all[#all + 1] = b.tech
	end
end
for _, w in pairs(rs.wonders) do
	if w.tech ~= nil and w.tech ~= "" then
		all[#all + 1] = w.tech
	end
end
opts = K.cycleOptions({ buildings = {} }, all, rs, {})
local nb, nw = 0, 0
for _ in pairs(rs.buildings) do
	nb += 1
end
for _ in pairs(rs.wonders) do
	nw += 1
end
check("every building and wonder offered", #opts == nb + nw, #opts)
check("buildings before wonders", opts[1].kind == "building" and opts[#opts].kind == "wonder")
check("sorted", opts[1].id < opts[2].id)

-- built things drop out; the step wraps
local built = { [opts[1].id] = true }
local c2 = { buildings = { opts[1].id }, producing = { kind = "building", id = opts[2].id } }
local o2 = K.cycleOptions(c2, all, rs, { [opts[#opts].id] = "c9" })
check("a building in the city is not offered", o2[1].id ~= opts[1].id)
check("a wonder built anywhere is not offered", o2[#o2].id ~= opts[#opts].id)
check("C steps to the next", K.nextBuild(c2, all, rs, {}).id == opts[3].id)
local last = { buildings = {}, producing = opts[#opts] }
check("C wraps", K.nextBuild(last, all, rs, {}).id == opts[1].id)
check("nothing to build", K.nextBuild({ buildings = {} }, {}, { buildings = {}, wonders = {} }, {}) == nil)
local _ = built

if fails > 0 then
	error(("city-keys: %d failure(s)"):format(fails))
end
print(("city-keys: %d buildings + %d wonders, keys match input.js"):format(nb, nw))
