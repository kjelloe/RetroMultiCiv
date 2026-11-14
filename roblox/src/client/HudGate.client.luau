-- run-R (shot5 / shot9): the in-game HUD (action bar, research cluster, the
-- bottom-left toggles, minimap) showed on the lobby deck before any game
-- existed, under and over the lobby panels. Those ScreenGuis are on only
-- while the client has a game view. End Turn / the turn chip (RMCHud) and the
-- top-right menus stay: Options and the Encyclopedia work without a game.
local Players = game:GetService("Players")
local ClientState = require(script.Parent:WaitForChild("ClientState"))

local GAME_ONLY = { "RMCActionBar", "RMCTurnLog", "RMCLegend", "RMCOverlays", "RMCDiplomacy", "RMCMinimap" }
local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")

local function apply()
	local on = ClientState.view ~= nil
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
