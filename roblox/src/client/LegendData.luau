-- The controls legend as data + the key-cap layout (pure: no Instances).
-- One row = the key caps to press and what they do. `codes` names every
-- Enum.KeyCode the row documents; roblox/selftest/legend.luau fails when a
-- key bound in the client sources is in no row (and not in EXEMPT), and
-- when a row's caps would run into the description column.
local M = {}

M.KEY_COL = 156 -- px: descriptions start here; the caps of a row must end before it
M.CAP_H = 24
M.CAP_GAP = 5
M.CAP_PAD = 9 -- text inset each side of a cap
M.CAP_MIN = 28
M.CHAR_W = 8.5 -- GothamBold 14, widest-case average
M.TEXT_MAX = 36 -- characters: one line at GothamMedium 15 in the description column

M.SECTIONS = {
	{ title = "Units", color = "#ffa06e", rows = {
		{ keys = { "N" }, codes = { "N" }, text = "Next unit with moves left" },
		{ keys = { "B" }, codes = { "B" }, text = "Found a city (Settlers)" },
		{ keys = { "G" }, codes = { "G" }, text = "Go to: then click the destination" },
		{ keys = { "O" }, codes = { "O" }, text = "Fortify" },
		{ keys = { "Space" }, codes = { "Space" }, text = "Wait: skip this unit for now" },
		{ keys = { "X" }, codes = { "X" }, text = "Disband" },
		{ keys = { "I", "M", "R" }, codes = { "I", "M", "R" }, text = "Irrigate, mine, road (Settlers)" },
		{ keys = { "P" }, codes = { "P" }, text = "Ride or leave the selected unit" },
		{ keys = { "WASD" }, alt = "arrows", codes = { "W", "A", "S", "D", "Up", "Down", "Left", "Right" },
			text = "Step the ridden unit one tile" },
	} },
	{ title = "Game", color = "#8cc4ff", rows = {
		{ keys = { "Enter" }, codes = { "Return" }, text = "End turn" },
		{ keys = { "T" }, codes = { "T" }, text = "Research" },
		{ keys = { "Shift", "T" }, plus = true, codes = { "LeftShift", "RightShift" }, text = "Technology tree" },
		{ keys = { "C" }, codes = { "C" }, text = "Cities" },
		{ keys = { "J" }, codes = { "J" }, text = "Statistics" },
		{ keys = { "L" }, codes = { "L" }, text = "Turn log" },
		{ keys = { "Y" }, codes = { "Y" }, text = "Diplomacy" },
		{ keys = { "V" }, codes = { "V" }, text = "Change the map border art" },
	} },
	{ title = "Camera and mouse", color = "#8fd17a", rows = {
		{ keys = { "Click" }, codes = {}, text = "Select a tile, unit or city" },
		{ keys = { "Left drag" }, codes = {}, text = "Orbit the camera" },
		{ keys = { "Right drag" }, codes = {}, text = "Pan the map" },
		{ keys = { "Wheel" }, codes = {}, text = "Zoom" },
		{ keys = { "Q", "E" }, codes = { "Q", "E" }, text = "Camera down, up" },
		{ keys = { "F" }, codes = { "F" }, text = "Follow your avatar (on foot)" },
		{ keys = { "Double click" }, codes = {}, text = "In a list: choose and close" },
	} },
}

-- bound in the sources, deliberately not in the player's legend
M.EXEMPT = {
	K = "developer asset gallery (DevAccess only)",
}

function M.capWidth(label)
	return math.max(M.CAP_MIN, math.ceil(#label * M.CHAR_W) + 2 * M.CAP_PAD)
end

-- row -> { caps = { { label, x, w } }, joiners = { { text, x, w } }, width }
-- `plus` rows join their caps with "+", `alt` adds "or <alt>" as plain text.
function M.capLayout(row)
	local caps, joiners = {}, {}
	local x = 0
	for i, label in ipairs(row.keys) do
		if i > 1 and row.plus then
			joiners[#joiners + 1] = { text = "+", x = x, w = 12 }
			x += 12 + M.CAP_GAP
		end
		local w = M.capWidth(label)
		caps[#caps + 1] = { label = label, x = x, w = w }
		x += w + M.CAP_GAP
	end
	if row.alt ~= nil then
		local text = "or " .. row.alt
		local w = math.ceil(#text * 7.5)
		joiners[#joiners + 1] = { text = text, x = x, w = w }
		x += w + M.CAP_GAP
	end
	return { caps = caps, joiners = joiners, width = x - M.CAP_GAP }
end

function M.documentedCodes()
	local set = {}
	for _, s in ipairs(M.SECTIONS) do
		for _, row in ipairs(s.rows) do
			for _, c in ipairs(row.codes) do
				set[c] = true
			end
		end
	end
	return set
end

function M.rowCount()
	local n = 0
	for _, s in ipairs(M.SECTIONS) do
		n += #s.rows
	end
	return n
end

return M
