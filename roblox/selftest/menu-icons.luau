-- check.sh gate 35: headless (lune) contract for the U1 menu icons —
-- MenuIcons.ICONS uses only known primitive kinds with coordinates inside the
-- 0..100 box, the kinds are all drawable by EditableGlyph, and every icon id a
-- client script hands to UiTheme / addButton exists.
local fs = require("@lune/fs")
local M = require("../src/client/MenuIcons")

local fails = 0
local function fail(msg)
	fails += 1
	print("FAIL " .. msg)
end
local function inBox(v)
	return type(v) == "number" and v >= 0 and v <= 100
end

local count = 0
for id, prims in pairs(M.ICONS) do
	count += 1
	if #prims == 0 then
		fail(id .. ": empty")
	end
	for i, pr in ipairs(prims) do
		local tag = ("%s[%d]"):format(id, i)
		if M.KINDS[pr.p] ~= true then
			fail(tag .. ": unknown kind " .. tostring(pr.p))
		end
		if pr.pts ~= nil then
			for _, p in ipairs(pr.pts) do
				if not (inBox(p[1]) and inBox(p[2])) then
					fail(tag .. ": point outside the box")
				end
			end
		else
			local rx = pr.r or pr.rx or (pr.w or 0) / 2
			local ry = pr.r or pr.ry or (pr.h or 0) / 2
			if pr.p == "bar" then
				rx, ry = pr.w / 2, pr.h / 2
			end
			if not (inBox(pr.x - rx) and inBox(pr.x + rx) and inBox(pr.y - ry) and inBox(pr.y + ry)) then
				if pr.rot == nil or pr.rot == 0 then
					fail(tag .. ": extent outside the box")
				end
			end
		end
	end
end

-- every kind must be one EditableGlyph.drawPrim dispatches
local glyphSrc = fs.readFile("roblox/src/client/EditableGlyph.luau")
for kind in pairs(M.KINDS) do
	if not glyphSrc:find('k == "' .. kind .. '"', 1, true) then
		fail("EditableGlyph has no branch for kind " .. kind)
	end
end

-- every EditableImage Draw* call passes the REQUIRED combineType (5th arg);
-- a 4-arg call errors at runtime and every glyph silently falls back to text
local draws = 0
for line in glyphSrc:gmatch("[^\n]+") do
	if line:find("img:Draw%u%l+%(") then
		draws += 1
		if not line:find("COMBINE%)") then
			fail("Draw call without COMBINE: " .. line:gsub("^%s+", ""))
		end
	end
end
if draws < 4 then
	fail("only " .. draws .. " Draw calls found — the scan pattern drifted")
end

-- every icon id asked for in client code exists
local used = 0
for _, name in ipairs(fs.readDir("roblox/src/client")) do
	local src = fs.readFile("roblox/src/client/" .. name)
	for id in src:gmatch('icon = "(%w+)"') do
		used += 1
		if M.ICONS[id] == nil then
			fail(name .. ": unknown icon id " .. id)
		end
	end
	for id in src:gmatch('addButton%(%d+, "[^"]*", %d+, "(%l+)"%)') do
		used += 1
		if M.ICONS[id] == nil then
			fail(name .. ": unknown addButton icon id " .. id)
		end
	end
end
if used < 12 then
	fail("only " .. used .. " icon uses found — the scan pattern drifted")
end

if fails > 0 then
	error(("%d menu-icon check(s) failed"):format(fails))
end
print(("menu-icons: %d icons, %d uses, ALL PASS"):format(count, used))
