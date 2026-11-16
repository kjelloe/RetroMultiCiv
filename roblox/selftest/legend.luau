-- check.sh gate 46: the controls legend (LegendData). Every key the client
-- binds is documented or exempt with a reason, no row documents a key the
-- client does not bind, and every row's caps and text fit their columns.
local fs = require("@lune/fs")
local L = require("../src/client/LegendData")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local bound = {}
for _, name in ipairs(fs.readDir("roblox/src/client")) do
	if name:match("%.luau$") and name ~= "LegendData.luau" then
		for code in fs.readFile("roblox/src/client/" .. name):gmatch("Enum%.KeyCode%.(%w+)") do
			bound[code] = name
		end
	end
end
local documented = L.documentedCodes()
local nBound = 0
for code, file in pairs(bound) do
	nBound += 1
	check("bound key " .. code .. " (" .. file .. ") is in the legend or EXEMPT", documented[code] or L.EXEMPT[code] ~= nil)
end
check("the scan found the bindings", nBound >= 25, nBound)
for code in pairs(documented) do
	check("legend key " .. code .. " is bound in the client", bound[code] ~= nil)
end
for code in pairs(L.EXEMPT) do
	check("exempt key " .. code .. " is still bound", bound[code] ~= nil)
	check("exempt key " .. code .. " is not also documented", not documented[code])
end

local seenText = {}
for _, s in ipairs(L.SECTIONS) do
	check("section title " .. s.title, #s.title > 0 and s.color:match("^#%x%x%x%x%x%x$") ~= nil)
	check("section has rows " .. s.title, #s.rows > 0)
	for _, row in ipairs(s.rows) do
		local id = s.title .. " / " .. row.text
		check("keys present " .. id, #row.keys > 0)
		check("text fits one line " .. id, #row.text > 0 and #row.text <= L.TEXT_MAX, #row.text)
		check("text unique " .. id, not seenText[row.text])
		seenText[row.text] = true
		local lay = L.capLayout(row)
		check("caps end before the description column " .. id, lay.width + 8 <= L.KEY_COL, lay.width)
		check("one cap per key " .. id, #lay.caps == #row.keys)
		local last = -1
		local items = {}
		for _, c in ipairs(lay.caps) do items[#items + 1] = c end
		for _, j in ipairs(lay.joiners) do items[#items + 1] = j end
		table.sort(items, function(a, b) return a.x < b.x end)
		for _, it in ipairs(items) do
			check("caps do not overlap " .. id, it.x > last, it.x)
			last = it.x + it.w
		end
		for _, c in ipairs(lay.caps) do
			check("cap holds its label " .. id, c.w >= L.CAP_MIN and c.w >= #c.label * L.CHAR_W)
		end
	end
end
check("row count", L.rowCount() == 25, L.rowCount())
check("plus rows join with +", L.capLayout({ keys = { "Shift", "T" }, plus = true }).joiners[1].text == "+")
check("alt rows end with or", L.capLayout({ keys = { "WASD" }, alt = "arrows" }).joiners[1].text == "or arrows")

if fails > 0 then
	error(fails .. " legend pin(s) failed")
end
print(("legend: %d rows, %d bound keys covered"):format(L.rowCount(), nBound))
