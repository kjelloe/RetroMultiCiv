-- check.sh gate 47: turn log presentation (TurnLogView). Filter chips never
-- collide at any strip width, every filter class has a chip, every tag the
-- narrator writes has a shown word, and row text is safe RichText.
local fs = require("@lune/fs")
local V = require("../src/client/TurnLogView")
local C = require("../src/client/TurnLogClasses")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local ids = {}
for _, c in ipairs(C.LOG_CLASSES) do
	ids[#ids + 1] = c.id
	check("chip for class " .. c.id, V.CHIP[c.id] ~= nil and #V.CHIP[c.id].label > 0)
end
for _, width in ipairs({ 120, 200, 300, 384, 544, 900 }) do
	local lay = V.chipLayout(ids, width)
	check("every class placed @" .. width, #lay.chips == #ids)
	for i, a in ipairs(lay.chips) do
		check(("chip inside the strip @%d %s"):format(width, a.id), a.x >= 0 and (a.x + a.w <= width or a.x == 0), a.x + a.w)
		check("chip inside the height @" .. width, a.y + V.CHIP_H <= lay.height)
		check("chip holds its label " .. a.id, a.w >= #V.CHIP[a.id].label * V.CHAR_W + V.CHIP_DOT)
		for j = i + 1, #lay.chips do
			local b = lay.chips[j]
			local apart = a.y ~= b.y or a.x + a.w + V.CHIP_GAP <= b.x or b.x + b.w + V.CHIP_GAP <= a.x
			check(("chips apart @%d %s x %s"):format(width, a.id, b.id), apart)
		end
	end
end
check("one row at the panel width", V.chipLayout(ids, 544).height == V.CHIP_H, V.chipLayout(ids, 544).height)
check("wraps when narrow", V.chipLayout(ids, 200).height > V.CHIP_H)

-- every bracket tag in the narrator has a shown word
local src = fs.readFile("roblox/src/client/TurnLog.client.luau")
local nTags = 0
for tag in src:gmatch('"%[([%l%?]+)%] ') do
	nTags += 1
	check("tag [" .. tag .. "] has a word", V.TAG[tag] ~= nil)
end
check("the scan found the narrator's tags", nTags >= 20, nTags)

local tag, body = V.split("[city] Ur founded")
check("split tag", tag == "city" and body == "Ur founded", tostring(tag) .. "|" .. tostring(body))
tag, body = V.split("🤖 regent played your turn (nothing to do)")
check("no tag: text kept", tag == nil and body == "🤖 regent played your turn (nothing to do)")
tag, body = V.split("[unknown] x")
check("unknown tag: text kept", tag == nil and body == "[unknown] x")
tag, body = V.split("[?] oddEvent")
check("fallback tag", tag == "?" and body == "oddEvent")
check("escape", V.escape("a<b>&c") == "a&lt;b&gt;&amp;c")
local row = V.rowText(12, "[war] <Rome> Legion defeated A&B")
check("row has the turn", row:find("T12", 1, true) ~= nil)
check("row has the word", row:find("<b>War</b>", 1, true) ~= nil)
check("row body is escaped", row:find("&lt;Rome&gt; Legion defeated A&amp;B", 1, true) ~= nil)
check("row drops the bracket", row:find("[war]", 1, true) == nil)

if fails > 0 then
	error(fails .. " turn log view pin(s) failed")
end
print(("turnlog-view: %d chips, %d narrator tags"):format(#ids, nTags))
