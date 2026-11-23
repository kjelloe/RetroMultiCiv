-- lune: prints the yield icons (YieldIcons.ICONS) as JSON for
-- roblox/tools/icon-preview.js.
local serde = require("@lune/serde")
local Y = require("../src/client/YieldIcons")
local out = {}
for _, k in ipairs(Y.KINDS) do
	out[#out + 1] = { key = k.key, color = k.color, prims = Y.ICONS[k.key] }
end
print(serde.encode("json", { icons = out, sample = Y.layout({ food = 3, shields = 2, trade = 3 }) }))
