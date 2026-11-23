-- run-R (shot5 / shot9): the in-game HUD (action bar, research cluster, the
-- bottom-left toggles, minimap) showed on the lobby deck before any game
-- existed, under and over the lobby panels. Those ScreenGuis are on only
-- while the client has a game view. The top-right menus stay: Options and the
-- Encyclopedia work without a game. RMCHud stays enabled (its banners carry
-- notices on the deck) but its turn chip, End Turn and AI button hide (shot11:
-- "joining…" and a dead End Turn on the deck).
local Players = game:GetService("Players")
local ClientState = require(script.Parent:WaitForChild("ClientState"))

local GAME_ONLY = { "RMCActionBar", "RMCTurnLog", "RMCLegend", "RMCOverlays", "RMCDiplomacy", "RMCMinimap" }
local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")

local HUD_PARTS = { "Status", "EndTurn", "Regency" }
local hidden = {} -- part -> the Visible it had when hidden

local function apply()
	if ClientState.sceneActive then
		return -- the wonder scene holds every gui off and restores them itself
	end
	local on = ClientState.view ~= nil
	local hud = playerGui:FindFirstChild("RMCHud")
	if hud ~= nil then
		for _, name in ipairs(HUD_PARTS) do
			local part = hud:FindFirstChild(name)
			if part ~= nil then
				if not on and hidden[part] == nil then
					hidden[part] = part.Visible
					part.Visible = false
				elseif on and hidden[part] ~= nil then
					part.Visible = hidden[part]
					hidden[part] = nil
				end
			end
		end
	end
	for _, name in ipairs(GAME_ONLY) do
		local gui = playerGui:FindFirstChild(name)
		if gui ~= nil and gui.Enabled ~= on then
			gui.Enabled = on
		end
	end
end

ClientState.onView(apply)
task.spawn(function()
	while true do
		apply() -- the view is also dropped without a view push (return to the deck)
		task.wait(0.5)
	end
end)
