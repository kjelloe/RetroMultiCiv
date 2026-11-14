-- Client self-audit (specs/roblox-native-look.md §D). Prints what actually
-- got built and where it landed, as [RMC-DIAG] lines the Studio log file
-- carries (node roblox/tools/studio-log.js --diag):
--   * uncaught client script errors, tagged (a LocalScript that dies at load
--     takes its whole panel with it — this names it)
--   * every ScreenGui the client is expected to create, present or MISSING
--   * every themed button: gui, text, pixel rect, text fit, icon wanted/drawn,
--     off-screen and overlap findings
--   * world counts (tile blocks, props, skirts, units, cities)
-- Runs once the first view has rendered, again when the viewport or the look
-- changes. Read-only: it never moves or fixes anything.
local Players = game:GetService("Players")
local ScriptContext = game:GetService("ScriptContext")
local UserInputService = game:GetService("UserInputService")
local GuiService = game:GetService("GuiService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local Diag = require(script.Parent:WaitForChild("Diag"))

-- check.sh gate 38 holds this list to the ScreenGui names the client scripts
-- create (a new panel adds its name here)
local EXPECTED_GUIS = {
	"RMCActionBar", "RMCAdvice", "RMCCityList", "RMCCityPanel", "RMCDiplomacy",
	"RMCDiscoveryCard", "RMCEndScreen", "RMCFastForward", "RMCGovernment",
	"RMCHistorian", "RMCHud", "RMCLegend", "RMCLobby", "RMCMinimap", "RMCOptions",
	"RMCOverlays", "RMCPedia", "RMCRegentDialog", "RMCTheater", "RMCResearch",
	"RMCRidePad", "RMCTileCard", "RMCShip", "RMCStats", "RMCStrategic",
	"RMCTechTree", "RMCTooltip", "RMCTurnLog", "RMCWaitStatus", "RMCResume",
}
-- built on first use or Studio-only: listed when present, never reported missing
local LAZY_GUIS = { "RMCFoundCity", "RMCDebugMenu", "RMCDebug", "RMCIntro" }

ScriptContext.Error:Connect(function(message, trace, source)
	local where = source ~= nil and source:GetFullName() or "?"
	Diag.fail("script", where, tostring(message) .. " | " .. tostring(trace))
end)

local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")

local function shownOnScreen(obj)
	local node = obj
	while node ~= nil and node ~= playerGui do
		if node:IsA("GuiObject") and not node.Visible then
			return false
		end
		if node:IsA("ScreenGui") and not node.Enabled then
			return false
		end
		node = node.Parent
	end
	return node == playerGui
end

local function guiOf(obj)
	local sg = obj:FindFirstAncestorWhichIsA("ScreenGui")
	return sg ~= nil and sg.Name or "?"
end

-- %d rejects a fractional number, and Absolute* values can carry one
local function r(n)
	return math.floor(n + 0.5)
end

local function rectText(o)
	local p, s = o.AbsolutePosition, o.AbsoluteSize
	return ("%d,%d %dx%d"):format(r(p.X), r(p.Y), r(s.X), r(s.Y))
end

local function auditGuis()
	local missing, present = {}, 0
	for _, name in ipairs(EXPECTED_GUIS) do
		if playerGui:FindFirstChild(name) ~= nil then
			present += 1
		else
			table.insert(missing, name)
		end
	end
	local lazy = {}
	for _, name in ipairs(LAZY_GUIS) do
		if playerGui:FindFirstChild(name) ~= nil then
			table.insert(lazy, name)
		end
	end
	Diag.note("guis", ("%d/%d expected present; on-demand present: %s"):format(present, #EXPECTED_GUIS,
		#lazy > 0 and table.concat(lazy, ",") or "none"))
	for _, name in ipairs(missing) do
		Diag.fail("guis", name .. " MISSING", "its LocalScript did not reach the ScreenGui build (look for a script FAIL above)")
	end
end

local function auditButtons(viewport)
	local visible = {}
	local hidden, wantIcon, gotIcon = 0, 0, 0
	-- AbsolutePosition is measured from below the top bar; the viewport is not
	local inset = GuiService:GetGuiInset().Y
	for _, d in ipairs(playerGui:GetDescendants()) do
		-- themed buttons anywhere, plus any button placed straight on a ScreenGui
		-- (HUD level: the unthemed Debug toggle sat unseen under Map overlays)
		if d:IsA("TextButton") and (d:GetAttribute("themed") == true or d.Parent:IsA("ScreenGui")) then
			local want = d:GetAttribute("themeIcon")
			local got = d:FindFirstChild("ThemeIcon") ~= nil
			if want ~= nil then
				wantIcon += 1
				if got then
					gotIcon += 1
				end
			end
			if shownOnScreen(d) then
				table.insert(visible, d)
				local p, s = d.AbsolutePosition, d.AbsoluteSize
				local id = ("%s '%s'"):format(guiOf(d), d.Text ~= "" and d.Text or ("icon:" .. tostring(want)))
				Diag.note("btn", ("%s rect=%s icon=%s/%s fits=%s textBounds=%dx%d"):format(id, rectText(d),
					tostring(want), got and "drawn" or "none", tostring(d.TextFits), r(d.TextBounds.X), r(d.TextBounds.Y)))
				if s.X < 1 or s.Y < 1 then
					Diag.fail("btn", id .. " has zero size", rectText(d))
				elseif p.X < 0 or p.Y < -inset or p.X + s.X > viewport.X or p.Y + s.Y > viewport.Y - inset then
					Diag.fail("btn", id .. " is off-screen", ("%s in viewport %dx%d"):format(rectText(d), r(viewport.X), r(viewport.Y)))
				end
				local icon = d:FindFirstChild("ThemeIcon")
				if icon ~= nil and d.Text ~= "" then
					local pad = d:FindFirstChild("ThemePad")
					local left = p.X + (pad ~= nil and pad.PaddingLeft.Offset or 0)
					local right = p.X + s.X - (pad ~= nil and pad.PaddingRight.Offset or 0)
					local textL = d.TextXAlignment == Enum.TextXAlignment.Left and left
						or (left + right) / 2 - d.TextBounds.X / 2
					local iconR = icon.AbsolutePosition.X + icon.AbsoluteSize.X
					if iconR > textL + 1 or icon.AbsolutePosition.X < p.X then
						Diag.fail("btn", id .. " icon over label", ("icon %s, label starts x=%d"):format(rectText(icon), r(textL)))
					end
				end
				if d.Text ~= "" and not d.TextFits then
					Diag.fail("btn", id .. " label clipped", rectText(d))
				end
			else
				hidden += 1
			end
		end
	end
	-- two visible buttons sharing pixels (different panels can stack by design;
	-- only same-layer siblings and the always-on HUD row are a layout fault,
	-- so every pair is listed and the reader judges)
	for i = 1, #visible do
		for j = i + 1, #visible do
			local a, b = visible[i], visible[j]
			local ap, as, bp, bs = a.AbsolutePosition, a.AbsoluteSize, b.AbsolutePosition, b.AbsoluteSize
			local ox = math.min(ap.X + as.X, bp.X + bs.X) - math.max(ap.X, bp.X)
			local oy = math.min(ap.Y + as.Y, bp.Y + bs.Y) - math.max(ap.Y, bp.Y)
			if ox > 2 and oy > 2 and not a:IsDescendantOf(b) and not b:IsDescendantOf(a) then
				Diag.fail("btn", ("overlap %s '%s' x %s '%s'"):format(guiOf(a), a.Text, guiOf(b), b.Text),
					("%dx%d px shared (%s / %s)"):format(r(ox), r(oy), rectText(a), rectText(b)))
			end
		end
	end
	Diag.note("btn", ("%d themed visible, %d hidden; icons drawn %d of %d wanted"):format(#visible, hidden, gotIcon, wantIcon))
	if wantIcon > 0 and gotIcon == 0 then
		Diag.fail("icon", "no icon drawn on any button", "see the icon FAIL line for the cause")
	end
end

-- reading-size floor (UiTheme.TEXT.small): every visible fixed-size text under
-- 14 px is counted and the first few are named, so the log is the work list
-- the on-screen size of a text: its TextSize times every UIScale above it
local function scaleOf(obj)
	local s, node = 1, obj
	while node ~= nil and node ~= playerGui do
		local u = node:FindFirstChildOfClass("UIScale")
		if u ~= nil then
			s *= u.Scale
		end
		node = node.Parent
	end
	return s
end

local function auditText()
	local small, samples = 0, {}
	for _, d in ipairs(playerGui:GetDescendants()) do
		if (d:IsA("TextLabel") or d:IsA("TextButton") or d:IsA("TextBox")) and d.Text ~= ""
			and not d.TextScaled and d.TextSize * scaleOf(d) < 13.5 and shownOnScreen(d) then
			small += 1
			if #samples < 12 then
				table.insert(samples, ("%s/%s %dpx '%s'"):format(guiOf(d), d.Name, r(d.TextSize * scaleOf(d)), (d.Text:sub(1, 24):gsub("[\r\n]+", " "))))
			end
		end
	end
	Diag.note("text", ("%d visible text(s) under 14 px%s"):format(small, small > 0 and (": " .. table.concat(samples, "; ")) or ""))
end

local function auditWorld()
	local world = workspace:FindFirstChild("ClientWorld")
	if world == nil then
		Diag.fail("world", "ClientWorld folder MISSING", "ViewRenderer did not start")
		return
	end
	local parts = {}
	for _, name in ipairs({ "Terrain", "TerrainSkirts", "TerrainCoast", "TileProps", "Units", "Cities" }) do
		local f = world:FindFirstChild(name)
		table.insert(parts, ("%s=%s"):format(name, f ~= nil and tostring(#f:GetChildren()) or "MISSING"))
		if f == nil then
			Diag.fail("world", name .. " folder MISSING", "")
		end
	end
	local view = ClientState.view
	local map = view ~= nil and view.map or nil
	Diag.note("world", ("%s; map=%s look=%s descendants=%d"):format(table.concat(parts, " "),
		map ~= nil and ("%dx%d"):format(map.width, map.height) or "none",
		tostring(ClientState.options.look), #world:GetDescendants()))
	if map ~= nil then
		local terrain = world:FindFirstChild("Terrain")
		if terrain ~= nil and #terrain:GetChildren() == 0 then
			Diag.fail("world", "no tile blocks under a live view", "renderTerrain produced nothing")
		end
	end
end

local audits = 0
local function audit(reason)
	audits += 1
	local cam = workspace.CurrentCamera
	local viewport = cam ~= nil and cam.ViewportSize or Vector2.new(0, 0)
	local inset = GuiService:GetGuiInset()
	Diag.note("audit", ("#%d (%s) viewport=%dx%d inset=%d touch=%s keyboard=%s gamepad=%s"):format(audits, reason,
		r(viewport.X), r(viewport.Y), r(inset.Y), tostring(UserInputService.TouchEnabled),
		tostring(UserInputService.KeyboardEnabled), tostring(UserInputService.GamepadEnabled)))
	local ok, err = pcall(function()
		auditGuis()
		auditButtons(viewport)
		auditText()
		auditWorld()
	end)
	if not ok then
		Diag.fail("audit", "audit pass", err)
	end
	for _, line in ipairs(Diag.summary()) do
		print(line)
	end
end

-- debounce: one audit 2 s after the last trigger
local pending = 0
local function request(reason, delaySec)
	pending += 1
	local mine = pending
	task.delay(delaySec or 2, function()
		if mine == pending then
			audit(reason)
		end
	end)
end

local firstView = false
local lastLook = nil
ClientState.onView(function(view)
	if view ~= nil and not firstView then
		firstView = true
		request("first view", 6)
	end
	local look = tostring(ClientState.options.look)
	if firstView and lastLook ~= nil and look ~= lastLook then
		request("look " .. look)
	end
	lastLook = look
end)

task.spawn(function()
	local cam = workspace.CurrentCamera
	while cam == nil do
		task.wait(0.5)
		cam = workspace.CurrentCamera
	end
	cam:GetPropertyChangedSignal("ViewportSize"):Connect(function()
		if firstView then
			request("viewport")
		end
	end)
end)

-- the lobby is the first screen: an audit there catches a client that never
-- reaches a game view
request("boot", 10)

print("[DiagAudit] up: [RMC-DIAG] lines report load/render/show failures (node roblox/tools/studio-log.js --diag)")
