-- The bottom-left toggle stack (Turn log, Legend, Map overlays, Diplomacy).
-- Desktop: each owner's own offsets, a labelled 190 px column. Phone (ruling:
-- bottom bar only): the four become 44 px icon squares in ONE row in the
-- bottom-left corner, level with End Turn — 4 x 44 + 3 x 6 = 194 px, inside
-- the 206 px the action bar leaves free at each corner. Owners register
-- their button; a failure leaves every button at its built offsets.
local UiTheme = require(script.Parent:WaitForChild("UiTheme"))
local Diag = require(script.Parent:WaitForChild("Diag"))

local M = {}

M.SIZE = 44
M.GAP = 6
M.MARGIN = 8
M.BOTTOM = 8

-- pure: slot (1 = leftmost) -> x offset from the left edge
function M.slotX(order)
	return M.MARGIN + (order - 1) * (M.SIZE + M.GAP)
end

function M.rowWidth(count)
	return count * M.SIZE + math.max(0, count - 1) * M.GAP
end

local members = {} -- obj -> { order, home = { pos, size } }
local lastPhone = nil

local function layout()
	local phone = UiTheme.phone()
	if phone == lastPhone then
		return
	end
	lastPhone = phone
	for obj, m in pairs(members) do
		if phone then
			obj.Size = UDim2.new(0, M.SIZE, 0, M.SIZE)
			obj.Position = UDim2.new(0, M.slotX(m.order), 1, -(M.BOTTOM + M.SIZE))
		else
			obj.Size = m.home.size
			obj.Position = m.home.pos
		end
		UiTheme.setCompact(obj, phone)
	end
	Diag.note("leftstack", phone and "phone layout: one row of icon squares, bottom-left" or "desktop layout: labelled column")
end

local function relayout()
	local ok, err = pcall(layout)
	if not ok then
		for obj, m in pairs(members) do
			obj.Size = m.home.size
			obj.Position = m.home.pos
		end
		Diag.fail("leftstack", "bottom-left stack layout (buttons back at their built offsets)", err)
	end
end

-- order: 1 = leftmost on a phone (the desktop column keeps its own order)
function M.register(obj, order)
	members[obj] = { order = order, home = { pos = obj.Position, size = obj.Size } }
	lastPhone = nil
	task.defer(relayout)
end

task.spawn(function()
	local cam = workspace.CurrentCamera
	while cam == nil do
		task.wait(0.2)
		cam = workspace.CurrentCamera
	end
	cam:GetPropertyChangedSignal("ViewportSize"):Connect(function()
		task.defer(relayout)
	end)
end)

return M
