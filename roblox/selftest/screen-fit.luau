-- check.sh gate 78, design D (plan R5.1): where the always-on controls stand
-- for a screen size, from the planners the scripts use (TopRowPlan,
-- DockLayout, BarFit) and the corner sizes the scripts build (pinned by greps
-- in the gate), placed at 667, 844, 1280 and 1920 px; any shared pixel fails.
local fs = require("@lune/fs")
local TopRowPlan = require("../src/client/TopRowPlan")
local DockLayout = require("../src/client/DockLayout")
local BarFit = require("../src/client/BarFit")
local UiText = require("../src/client/UiText")
-- LeftStack builds Instances; its phone row rule (SIZE 44, GAP 6, MARGIN 8, BOTTOM 8)
local LeftStack = { SIZE = 44, GAP = 6, MARGIN = 8, BOTTOM = 8 }
function LeftStack.slotX(order)
	return LeftStack.MARGIN + (order - 1) * (LeftStack.SIZE + LeftStack.GAP)
end

local M = {}

-- the corner sizes as built (Hud, TurnLog, Legend, Overlays, Diplomacy, Minimap)
M.END_TURN = { w = 150, h = 44, right = 8, bottom = 8 }
M.AI = { w = 44, h = 44, right = 166, bottom = 8 }
M.TOGGLE = { w = 190, h = 40, x = 8, bottoms = { 8, 52, 96, 140 } } -- Turn log, Legend, Map overlays, Diplomacy
M.MINIMAP = { w = 200, h = 125, right = 8, bottom = 116 } -- a 40 x 25 map at 5 px a cell
M.BAR_H = 50
M.TURN_CHIP = { x = 8, y = 8, w = TopRowPlan.LEFT - 16, h = 46 }

-- natural = the action bar's unscaled width; phone = UiText.isPhone
-- -> list of { id, x, y, w, h }
function M.rects(vw, vh, natural, phone)
	local out = {}
	local function add(id, x, y, w, h)
		out[#out + 1] = { id = id, x = x, y = y, w = w, h = h }
	end
	add("turn-chip", M.TURN_CHIP.x, M.TURN_CHIP.y, M.TURN_CHIP.w, M.TURN_CHIP.h)
	local row = TopRowPlan.plan(vw)
	add("top-row", row.x, 4 + row.row * TopRowPlan.ROW_STEP, row.w, TopRowPlan.ROW_H)

	-- the menu dock: top-right on a desktop, above End Turn on a phone
	local h = phone and DockLayout.H_TOUCH or DockLayout.H_DESKTOP
	-- the menu dock as registered with HudDock (widths as gate 39 pins them);
	-- on a phone the clock keeps its own place top-right
	local items = {
		{ id = "options", order = 1, w = 117, compactW = h + 4 },
		{ id = "pedia", order = 2, w = 167, compactW = h + 4 },
		{ id = "ship", order = 3, w = 87, compactW = h + 4 },
		{ id = "strategic", order = 4, w = h + 4 },
		{ id = "techtree", order = 5, w = h + 4 },
	}
	-- the clock (Options): under the menu row, top-right corner on a phone
	add("clock", vw - 158, phone and 12 or 56, 150, 18)
	local dock = DockLayout.plan(vw, items, { h = h, forceCompact = phone,
		fromBottom = phone and DockLayout.PHONE_BOTTOM or nil,
		maxShare = phone and 0.9 or math.max(0.2, 0.5 - 260 / vw) })
	for id, p in pairs(dock.places) do
		local y = p.bottom ~= nil and (vh - p.bottom - p.h) or p.y
		add(id, vw - p.right - p.w, y, p.w, p.h)
	end

	add("end-turn", vw - M.END_TURN.right - M.END_TURN.w, vh - M.END_TURN.bottom - M.END_TURN.h, M.END_TURN.w, M.END_TURN.h)
	add("ai", vw - M.AI.right - M.AI.w, vh - M.AI.bottom - M.AI.h, M.AI.w, M.AI.h)
	local mb = phone and (DockLayout.PHONE_BOTTOM + DockLayout.H_TOUCH + 6) or M.MINIMAP.bottom
	add("minimap", vw - M.MINIMAP.right - M.MINIMAP.w, vh - mb - M.MINIMAP.h, M.MINIMAP.w, M.MINIMAP.h)
	if phone then
		for i = 1, 4 do
			add("toggle" .. i, LeftStack.slotX(i), vh - LeftStack.BOTTOM - LeftStack.SIZE, LeftStack.SIZE, LeftStack.SIZE)
		end
	else
		for i, b in ipairs(M.TOGGLE.bottoms) do
			add("toggle" .. i, M.TOGGLE.x, vh - b - M.TOGGLE.h, M.TOGGLE.w, M.TOGGLE.h)
		end
	end

	local plan = BarFit.plan(vw, natural, phone)
	local l, r = BarFit.span(vw, natural, plan)
	local bh = M.BAR_H * plan.scale
	add("bar", math.floor(l), math.floor(vh - BarFit.BOTTOM - plan.lift - bh), math.ceil(r - l), math.ceil(bh))
	return out
end

-- -> list of "a x b" for every pair sharing a pixel, and anything off screen
function M.faults(rects, vw, vh)
	local out = {}
	for i, a in ipairs(rects) do
		if a.x < 0 or a.y < 0 or a.x + a.w > vw or a.y + a.h > vh then
			out[#out + 1] = a.id .. " off screen"
		end
		for j = i + 1, #rects do
			local b = rects[j]
			if a.x < b.x + b.w and b.x < a.x + a.w and a.y < b.y + b.h and b.y < a.y + a.h then
				out[#out + 1] = a.id .. " x " .. b.id
			end
		end
	end
	table.sort(out)
	return out
end


local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

-- the action bar's natural width: every always-present order button as
-- addButton sizes it (width x 1.3, + 26 with an icon), 4 px apart
local bar = fs.readFile("roblox/src/client/ActionBar.client.luau")
local natural, n = 0, 0
for order, w, icon in bar:gmatch('addButton%((%d+), "[^"]*", (%d+), ([^%)]+)%)') do
	order = tonumber(order)
	if order ~= 12 and order <= 14 then -- Help Wonder, the priority and Missions buttons stand only when they apply
		natural += math.floor(tonumber(w) * 1.3) + (icon ~= "nil" and 26 or 0)
		n += 1
	end
end
natural += (n - 1) * 4
check("the bar's buttons were read", n >= 13, n)

-- a phone shows only the orders that apply (UiTheme.phone hides greyed ones):
-- a Settlers unit, the widest everyday set (Found, Fortify, Wait, GoTo,
-- Disband, Irr, Mine, Road, Ride)
local phoneNatural, pn = 0, 0
for order, w, icon in bar:gmatch('addButton%((%d+), "[^"]*", (%d+), ([^%)]+)%)') do
	if ({ [1] = 1, [2] = 1, [3] = 1, [4] = 1, [5] = 1, [6] = 1, [7] = 1, [8] = 1, [14] = 1 })[tonumber(order)] then
		phoneNatural += math.floor(tonumber(w) * 1.3) + (icon ~= "nil" and 26 or 0)
		pn += 1
	end
end
phoneNatural += (pn - 1) * 4

local SCREENS = { { 667, 375, true }, { 844, 390, true }, { 1280, 720, false }, { 1920, 1080, false }, { 2208, 969, false } }
local report = {}
for _, s in ipairs(SCREENS) do
	local vw, vh = s[1], s[2]
	local phone = UiText.isPhone(s[3], vw, vh)
	local faults = M.faults(M.rects(vw, vh, phone and phoneNatural or natural, phone), vw, vh)
	for _, f in ipairs(faults) do
		check(("%dx%d%s: %s"):format(vw, vh, phone and " phone" or "", f), false)
	end
	report[#report + 1] = ("%d%s %s"):format(vw, phone and "p" or "", #faults == 0 and "ok" or (#faults .. " fault(s)"))
end
check("a shared pixel is found", #M.faults({ { id = "a", x = 0, y = 0, w = 10, h = 10 }, { id = "b", x = 9, y = 9, w = 5, h = 5 } }, 100, 100) == 1)
check("touching edges are not shared", #M.faults({ { id = "a", x = 0, y = 0, w = 10, h = 10 }, { id = "b", x = 10, y = 0, w = 5, h = 5 } }, 100, 100) == 0)

if fails > 0 then
	error(("screen-fit: %d failure(s) (bar natural %d px)"):format(fails, natural))
end
print(("screen-fit: bar natural %d px; %s"):format(natural, table.concat(report, ", ")))
