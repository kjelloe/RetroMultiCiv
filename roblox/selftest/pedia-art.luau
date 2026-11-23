-- check.sh gate 66: encyclopedia pictures (PediaArt): what each entry of the
-- real rulesets resolves to, the list still without art, the detail-pane
-- layout across widths, the terrain patch, the shared tile height rule.
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local A = require("../src/client/PediaArt")
local S = require("../src/client/StructureModels")
local G = require("../src/client/GlyphData")
local H = require("../src/client/TileHeight")
local CONCEPTS = require("../src/client/PediaConcepts")

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
local recipes = serde.decode("json", fs.readFile("data/assets/asset-recipes.json"))
local terrains = load("terrain").terrains
local have = { units = recipes.unitSilhouette, structures = S.MODELS, glyphs = G.GLYPH, terrain = terrains }

local CATS = { units = load("units"), buildings = load("buildings"), wonders = load("wonders"),
	techs = load("techs"), governments = load("governments"), terrain = terrains }
local entries, count = {}, {}
local function expect(catKey, kind)
	local n = 0
	for id in pairs(CATS[catKey]) do
		n += 1
		entries[#entries + 1] = { catKey, id }
		if kind ~= nil then
			check(("%s/%s is a %s"):format(catKey, id, kind), A.resolve(catKey, id, have).kind == kind, A.resolve(catKey, id, have).kind)
		end
	end
	count[catKey] = n
end
expect("units", "unit")
expect("techs", "plate")
expect("terrain", "terrain")
expect("buildings", nil)
expect("wonders", nil)
expect("governments", nil)
for _, c in ipairs(CONCEPTS) do
	entries[#entries + 1] = { "concepts", c.id }
end
check("entry counts", count.units == 29 and count.techs == 68 and count.terrain == 11 and count.buildings == 21
	and count.wonders == 22 and count.governments == 6 and #CONCEPTS == 29, #entries)

-- a structure shows as soon as its model exists, and only then
for _, cat in ipairs({ "buildings", "wonders" }) do
	for id in pairs(CATS[cat]) do
		local kind = A.resolve(cat, id, have).kind
		check(("%s/%s follows StructureModels.MODELS"):format(cat, id), kind == (S.MODELS[id] ~= nil and "structure" or "none"), kind)
	end
end
for id in pairs(S.MODELS) do
	check("model id is a building or a wonder: " .. id, CATS.buildings[id] ~= nil or CATS.wonders[id] ~= nil)
end
check("a made-up model shows", A.resolve("wonders", "x", { structures = { x = {} } }).kind == "structure")
check("unknown category", A.resolve("nonsense", "x", have).kind == "none")

-- the list still to draw: every structure without a model, governments, concepts
local nModels = 0
for _ in pairs(S.MODELS) do
	nModels += 1
end
local missing = A.missing(entries, have)
check("missing count", #missing == 21 + 22 - nModels + 6 + 29, #missing)
check("missing is sorted and named cat/id", missing[1] < missing[#missing] and missing[1]:find("/", 1, true) ~= nil)

-- layout: the box and the text never overlap; no picture -> no box
for _, w in ipairs({ 240, 300, 359, 360, 444, 600, 900 }) do
	for _, kind in ipairs({ "unit", "structure", "plate", "terrain" }) do
		local l = A.layout(w, kind)
		check(("box height at %d"):format(w), l.box.h == (w < 360 and 150 or 240), l.box.h)
		check(("box inside the pane at %d"):format(w), l.box.x >= 0 and l.box.x + l.box.w <= w and l.box.w > 0)
		check(("text below the box at %d"):format(w), l.textY >= l.box.y + l.box.h + A.PAD)
		check(("plate fits the box at %d"):format(w), l.plate > 40 and l.plate <= l.box.h and l.plate <= l.box.w)
	end
	local none = A.layout(w, "none")
	check(("no picture, no box at %d"):format(w), none.box.h == 0 and none.textY == 6)
end
for kind, c in pairs(A.CAMERA) do
	check("camera " .. kind, c.pitch >= 5 and c.pitch <= 60 and c.fit >= 1.5 and c.fit <= 4 and c.turn > 0 and c.turn <= 40)
end

-- terrain patch
for id, def in pairs(terrains) do
	local map = A.terrainPatch(id, def.special ~= nil)
	check("patch is 3 x 3 " .. id, map.width == 3 and map.height == 3 and #map.tiles == 9)
	check("patch centre is the terrain " .. id, map.tiles[5].t == id and map.tiles[5].visible == true)
	check("patch special on the centre " .. id, (map.tiles[5].special == true) == (def.special ~= nil))
	local own = 0
	for _, t in ipairs(map.tiles) do
		check("patch tile is a real terrain " .. id, terrains[t.t] ~= nil, t.t)
		own += t.t == id and 1 or 0
	end
	check("patch is mostly the terrain " .. id, own >= 8, own)
end

-- the shared tile height rule (ViewRenderer and the terrain picture)
local pal = { grassland = { base = 0.05, peak = 0 }, hills = { base = 0.2, peak = 0.1 }, mountains = { base = 0.8, peak = 0.45 } }
local full = (0.8 + 0.45 * 0.5) * H.HEIGHT
check("flat tile", math.abs(H.top(pal, "grassland") - 0.05 * 6) < 1e-9)
check("mountain block is the shoulder", math.abs(H.top(pal, "mountains") - full * 0.6) < 1e-9)
check("hill is a quarter of the mountain", math.abs(H.top(pal, "hills") - full * 0.25) < 1e-9)
check("unknown id falls back to grassland", H.top(pal, "nope") == H.top(pal, "grassland"))

if fails > 0 then
	error(("pedia-art: %d failure(s)"):format(fails))
end
print(("pedia-art: ok (%d entries, %d without a picture)"):format(#entries, #missing))
