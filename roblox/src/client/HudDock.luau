-- U3: applies DockLayout's plan to the top-row menu buttons. Each owner
-- script still builds its own button and registers it here; the dock sets
-- Position/Size (and icon-only mode through UiTheme) on every change of the
-- viewport or of a member's visibility. A plan failure restores every member
-- to the offsets its owner gave it and leaves one Diag line.
local UiTheme = require(script.Parent:WaitForChild("UiTheme"))
local DockLayout = require(script.Parent:WaitForChild("DockLayout"))
local Diag = require(script.Parent:WaitForChild("Diag"))

local M = {}

local members = {} -- id -> { obj, order, chars, iconOnly, fixedW, home = { pos, size } }
local queued = false
local lastPhone = nil

local function viewportWidth()
	local cam = workspace.CurrentCamera
	return cam ~= nil and cam.ViewportSize.X or 0
end

local function layout()
	local vw = viewportWidth()
	if vw <= 0 then
		return
	end
	-- U3b (ruling: bottom bar on a phone): the menu row drops to the slot above
	-- End Turn as 44 px icon squares; members with no icon-only form (the
	-- clock) keep the place their owner gave them
	local phone = UiTheme.phone()
	local h = (phone or UiTheme.touchOnly()) and DockLayout.H_TOUCH or DockLayout.H_DESKTOP
	local items = {}
	for id, m in pairs(members) do
		if phone and m.fixedW ~= nil then
			m.obj.Position = m.home.pos
			m.obj.Size = m.home.size
			continue
		end
		local hasIcon = m.obj:FindFirstChild("ThemeIcon") ~= nil
		local w, compactW
		if m.fixedW ~= nil then
			w = m.fixedW
		elseif m.iconOnly then
			w = h + 4
		else
			w = DockLayout.widthFor(m.chars, h) - (hasIcon and 0 or (h - 12))
			compactW = hasIcon and (h + 4) or nil
		end
		table.insert(items, { id = id, order = m.order, w = w, compactW = compactW, visible = m.obj.Visible })
	end
	local plan = DockLayout.plan(vw, items, { h = h, forceCompact = phone,
		fromBottom = phone and DockLayout.PHONE_BOTTOM or nil, maxShare = phone and 0.9 or nil })
	if phone ~= lastPhone then
		lastPhone = phone
		Diag.note("dock", phone and "phone layout: menu row above End Turn" or "desktop layout: menu row top-right")
	end
	for id, place in pairs(plan.places) do
		local m = members[id]
		local oh = m.fixedH or place.h
		if place.bottom ~= nil then
			m.obj.Position = UDim2.new(1, -(place.right + place.w), 1, -(place.bottom + oh))
		else
			m.obj.Position = UDim2.new(1, -(place.right + place.w), 0, place.y + math.floor((place.h - oh) / 2))
		end
		m.obj.Size = UDim2.new(0, place.w, 0, oh)
		if m.fixedW == nil and not m.iconOnly then
			UiTheme.setCompact(m.obj, place.compact)
		end
	end
	Diag.count("dock", "layouts")
end

local function relayout()
	local ok, err = pcall(layout)
	if not ok then
		for _, m in pairs(members) do
			m.obj.Position = m.home.pos
			m.obj.Size = m.home.size
		end
		Diag.fail("dock", "top-row layout (buttons back at their built offsets)", err)
	end
end

local function request()
	if queued then
		return
	end
	queued = true
	task.defer(function()
		queued = false
		relayout()
	end)
end

-- opts: id, order (1 = rightmost), chars (label length for the full width),
-- iconOnly (always a square), fixedW/fixedH (a non-button member, e.g. the clock)
function M.register(obj, opts)
	members[opts.id] = {
		obj = obj, order = opts.order, chars = opts.chars or #obj.Text,
		iconOnly = opts.iconOnly == true, fixedW = opts.fixedW, fixedH = opts.fixedH,
		home = { pos = obj.Position, size = obj.Size },
	}
	obj:GetPropertyChangedSignal("Visible"):Connect(request)
	request()
end

-- run-M (screenshot): the Roblox player list opens over the top-right menu
-- row. The lobby panel already lists the seats, so the core list is off.
task.spawn(function()
	for _ = 1, 10 do
		local ok = pcall(function()
			game:GetService("StarterGui"):SetCoreGuiEnabled(Enum.CoreGuiType.PlayerList, false)
		end)
		if ok then
			return
		end
		task.wait(0.5)
	end
	Diag.fail("dock", "player list still on (it covers the menu row)", "SetCoreGuiEnabled refused 10 times")
end)

task.spawn(function()
	local cam = workspace.CurrentCamera
	while cam == nil do
		task.wait(0.2)
		cam = workspace.CurrentCamera
	end
	cam:GetPropertyChangedSignal("ViewportSize"):Connect(request)
	request()
end)

return M
