-- Who may see developer tools (run-R review). One place, so a published
-- place never shows a dev button by accident:
--   studio()  running inside Roblox Studio
--   owner()   the place's creator account, in a published server (a
--             group-owned place has no single owner: false)
--   dev()     either — for tools that are client-only (asset gallery,
--             mid-game replay). Tools whose commands the SERVER judges
--             (debug menu, AI-strategy pull) keep their own server gate; this
--             only decides whether the button shows.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local M = {}

function M.studio()
	return RunService:IsStudio()
end

function M.owner()
	local me = Players.LocalPlayer
	return me ~= nil and game.CreatorType == Enum.CreatorType.User and game.CreatorId ~= 0
		and me.UserId == game.CreatorId
end

function M.dev()
	return M.studio() or M.owner()
end

return M
