-- check.sh gate 44: headless (lune) pins for the tech-tree graph layout,
-- run over the real ruleset (data/techs.json).
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local L = require("../src/client/TechTreeLayout")

local raw = serde.decode("json", fs.readFile("data/techs.json"))
local techs = raw.techs or raw

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local g = L.layout(techs)
local count = 0
for id, def in pairs(techs) do
	count += 1
	local n = g.nodes[id]
	check("placed " .. id, n ~= nil)
	check("column = level " .. id, n.col == def.level)
	check("inside the canvas " .. id, n.x >= 0 and n.y >= 0 and n.x + L.BOX_W <= g.width and n.y + L.BOX_H <= g.height)
	for _, p in ipairs(def.prereqs or {}) do
		check("prerequisite is to the left " .. id, g.nodes[p].x + L.BOX_W < n.x)
	end
end
check("all 68 techs", count == 68, count)

-- no two boxes overlap
local seen = {}
for id, n in pairs(g.nodes) do
	local key = n.col .. ":" .. n.y
	check("one box per slot " .. id, seen[key] == nil, key)
	seen[key] = true
end
for id, a in pairs(g.nodes) do
	for id2, b in pairs(g.nodes) do
		if id < id2 and a.col == b.col then
			check("rows apart " .. id .. "/" .. id2, math.abs(a.y - b.y) >= L.BOX_H + 4, math.abs(a.y - b.y))
		end
	end
end

-- one edge per prerequisite link; the vertical run sits in the gap before the target
local want = 0
for _, def in pairs(techs) do
	want += #(def.prereqs or {})
end
check("edge per link", #g.edges == want, #g.edges)
for _, e in ipairs(g.edges) do
	local a, b = g.nodes[e.from], g.nodes[e.to]
	check("leaves the source's right edge", e.x1 == a.x + L.BOX_W and e.y1 == a.y + L.BOX_H / 2)
	check("enters the target's left edge", e.x2 == b.x and e.y2 > b.y and e.y2 < b.y + L.BOX_H)
	local prevRight = b.x - L.COL_PITCH + L.BOX_W
	check("vertical run in the gap " .. e.from .. ">" .. e.to, e.mid > prevRight and e.mid < b.x, e.mid - prevRight)
end

-- deterministic
local g2 = L.layout(techs)
for id, n in pairs(g.nodes) do
	check("deterministic " .. id, g2.nodes[id].x == n.x and g2.nodes[id].y == n.y)
end
check("same edge order", (function()
	for i, e in ipairs(g.edges) do
		if g2.edges[i].from ~= e.from or g2.edges[i].to ~= e.to or g2.edges[i].mid ~= e.mid then
			return false
		end
	end
	return true
end)())

if fails > 0 then
	error(("%d techtree-layout check(s) failed"):format(fails))
end
print(("techtree-layout: %d columns x %d rows, canvas %dx%d, %d edges, ALL PASS"):format(g.cols, g.rows, g.width, g.height, #g.edges))
