-- Turn log presentation rules (pure: no Instances). The narrator's strings
-- stay as the browser twin writes them ("[city] Ur founded"); this module
-- decides how a line is SHOWN: the bracket tag becomes a coloured word, the
-- turn a muted prefix, and the filter chips get positions that cannot
-- collide (they wrap to a second row instead). roblox/selftest/turnlog-view.luau.
local M = {}

-- filter chip names: no emoji, the dot carries the colour
M.CHIP = {
	combat = { label = "Combat", color = "#f0846c" },
	cities = { label = "Cities", color = "#8cc4ff" },
	research = { label = "Research", color = "#b79cff" },
	rival = { label = "Rivals", color = "#a0aabe" },
	saves = { label = "Saves", color = "#8fd17a" },
	regent = { label = "Regent", color = "#ffe182" },
}

-- narrator tag -> shown word + colour
M.TAG = {
	war = { word = "War", color = "#f0846c" },
	city = { word = "City", color = "#8cc4ff" },
	rival = { word = "Rival", color = "#a0aabe" },
	world = { word = "World", color = "#ffe182" },
	work = { word = "Work", color = "#8fd17a" },
	gov = { word = "Government", color = "#b79cff" },
	tech = { word = "Science", color = "#b79cff" },
	["?"] = { word = "Other", color = "#a0aabe" },
}

M.CHIP_H = 24
M.CHIP_GAP = 5
M.CHIP_DOT = 10
M.CHIP_PAD = 8
M.CHAR_W = 8.5 -- GothamBold 14

function M.chipWidth(label)
	return M.CHIP_PAD + M.CHIP_DOT + 6 + math.ceil(#label * M.CHAR_W) + M.CHIP_PAD
end

-- ids in strip order, the strip's inner width -> { chips = { { id, x, y, w } }, height }
function M.chipLayout(ids, width)
	local chips = {}
	local x, y = 0, 0
	for _, id in ipairs(ids) do
		local def = M.CHIP[id]
		local w = M.chipWidth(def ~= nil and def.label or id)
		if x > 0 and x + w > width then
			x = 0
			y += M.CHIP_H + M.CHIP_GAP
		end
		chips[#chips + 1] = { id = id, x = x, y = y, w = w }
		x += w + M.CHIP_GAP
	end
	return { chips = chips, height = y + M.CHIP_H }
end

-- "[city] Ur founded" -> "city", "Ur founded"; no known tag -> nil, text
function M.split(text)
	local tag, body = text:match("^%[([%a%?]+)%]%s*(.*)$")
	if tag ~= nil and M.TAG[tag] ~= nil then
		return tag, body
	end
	return nil, text
end

function M.escape(s)
	return (s:gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"))
end

-- the RichText a row shows
function M.rowText(turn, text)
	local tag, body = M.split(text)
	local head = ('<font color="#8f9bb3">T%d</font>  '):format(turn)
	if tag ~= nil then
		local t = M.TAG[tag]
		head ..= ('<font color="%s"><b>%s</b></font>  '):format(t.color, t.word)
	end
	return head .. M.escape(body)
end

return M
