-- SO14 (catalog row; browser palette.js twin, ruled @38e36677: port now):
-- the accessibility civ-color palette — a DISPLAY-TIME remap of the stored
-- civ colors. Colors live in GAME STATE (player.color), so the data never
-- changes; displayColor(hex) sits at every seam where a civ color reaches
-- rendering. Identity by default: option off or unknown hex = passthrough.
-- The tables are the browser's EXACT curated pairs (test/palette.test.js
-- pins the simulated-space floor on the JS side; this is the same data).
-- The visual.primary half is carried for parity but has no Roblox consumer
-- yet (unit discs are a browser surface) — noted in the catalog row.

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local M = {}

M.PALETTES = {
	["deuteranopia-safe"] = {
		-- civ colors (player.color)
		["#4b6bd8"] = "#1c2f8a", -- americans: navy
		["#6db3f2"] = "#c9e6ff", -- french: near-white blue
		["#d84a3b"] = "#66101f", -- russians: deep crimson
		["#3bd875"] = "#0c5c38", -- greeks: dark green
		["#d8b13b"] = "#8a6b1c", -- egyptians: dark bronze
		["#8a949e"] = "#6b7480", -- germans: darker slate
		["#d83b8a"] = "#0f8a8a", -- english: teal
		["#b0632f"] = "#4a3120", -- zulus: dark brown
		["#3b7dd8"] = "#3b7dd8", -- romans (identity)
		["#3bc9d8"] = "#3bc9d8", -- aztecs (identity)
		["#b13bd8"] = "#b13bd8", -- babylonians (identity)
		["#d8d83b"] = "#d8d83b", -- chinese (identity)
		["#d88fd8"] = "#d88fd8", -- indians (identity)
		["#d8703b"] = "#d8703b", -- mongols (identity)
		-- visual primaries (civs.json visual.primary; no Roblox consumer yet)
		["#218C8C"] = "#116363",
		["#C9822B"] = "#e6a63b",
		["#6B4BB3"] = "#fafa96",
		["#2F6FB3"] = "#4a8fd0",
		["#5F6872"] = "#8f99a3",
		["#1F4F99"] = "#0c2347",
		["#758A35"] = "#5c7a14",
		["#66AFC2"] = "#8fd0e0",
		["#8E2F45"] = "#66101f",
		["#7A4B2A"] = "#8a5c33",
		["#3F8F4A"] = "#3F8F4A",
		["#F0E6C8"] = "#F0E6C8",
		["#C24C7A"] = "#C24C7A",
		["#B83C3C"] = "#B83C3C",
	},
}

function M.mode()
	local m = ClientState.options.civPalette
	if m ~= nil and M.PALETTES[m] ~= nil then
		return m
	end
	return "default"
end

function M.displayColor(hex)
	local table_ = M.PALETTES[M.mode()]
	if table_ ~= nil and table_[hex] ~= nil then
		return table_[hex]
	end
	return hex
end

return M
