-- check.sh gate 66: encyclopedia pictures (PediaArt): what each entry of the
-- real rulesets resolves to, the list still without art, the detail-pane
-- layout across widths, the terrain patch, the shared tile height rule.
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local A = require("../src/client/PediaArt")
local S = require("../src/client/StructureModels")
require("../src/client/BuildingModels")(S)
require("../src/client/EmblemModels")(S)
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
local have = { units = recipes.unitSilhouette, structures = S.MODELS, emblems = S.EMBLEMS, glyphs = G.GLYPH, terrain = terrains }

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
expect("buildings", "structure")
expect("wonders", "structure")
expect("governments", "structure")
for _, c in ipairs(CONCEPTS) do
	entries[#entries + 1] = { "concepts", c.id }
	local art = A.resolve("concepts", c.id, have)
	check("concepts/" .. c.id .. " has an emblem", art.kind == "structure" and art.set == "concepts", art.kind)
end
for id in pairs(S.EMBLEMS.concepts) do
	local known = false
	for _, c in ipairs(CONCEPTS) do
		known = known or c.id == id
	end
	check("emblem is a concept: " .. id, known)
end
for id in pairs(S.EMBLEMS.governments) do
	check("emblem is a government: " .. id, CATS.governments[id] ~= nil)
end
check("a government picture names its set", A.resolve("governments", "monarchy", have).set == "governments")
check("no emblem table, no picture", A.resolve("governments", "monarchy", { structures = {} }).kind == "none")
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
check("every entry has a picture", #missing == 0, table.concat(missing, " "))
check("models cover buildings and wonders", nModels == 43, nModels)
local some = A.missing({ { "wonders", "b" }, { "wonders", "a" } }, { structures = {} })
check("missing is sorted and named cat/id", #some == 2 and some[1] == "wonders/a" and some[2] == "wonders/b")

-- the caption line under the picture
check("caption: cost and requirement", A.caption("wonders", { cost = 300 }, "Masonry") == "300 shields - needs Masonry")
check("caption: no requirement", A.caption("units", { cost = 10 }, nil) == "10 shields - available from the start")
check("caption: an advance names its era", A.caption("techs", {}, nil, "ANCIENT") == "ANCIENT ERA")
check("caption: nothing for a concept", A.caption("concepts", {}, nil) == "" and A.caption("terrain", {}, nil) == "")

-- layout: the box and the text never overlap; no picture -> no box
for _, w in ipairs({ 240, 300, 359, 360, 444, 600, 900 }) do
	for _, kind in ipairs({ "unit", "structure", "plate", "terrain" }) do
		local l = A.layout(w, kind)
		check(("box height at %d"):format(w), l.box.h == (w < 360 and 150 or 240), l.box.h)
		check(("box inside the pane at %d"):format(w), l.box.x >= 0 and l.box.x + l.box.w <= w and l.box.w > 0)
		check(("caption below the box at %d"):format(w), l.captionY >= l.box.y + l.box.h + A.PAD)
		check(("text below the caption at %d"):format(w), l.textY >= l.captionY + A.CAPTION_H)
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
