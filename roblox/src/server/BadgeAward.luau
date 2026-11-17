-- Turns earned badge keys (BadgeTrack) into BadgeService awards. Every key
-- is logged as [RMC-BADGE]; the service is called only for a key with an id
-- in BadgeIds, only outside Studio, once per user per server. Calls run in
-- their own thread: a slow or failing badge service never holds a turn.
local BadgeService = game:GetService("BadgeService")
local RunService = game:GetService("RunService")
local Ids = require(script.Parent:WaitForChild("BadgeIds"))

local M = {}
local granted = {} -- userId -> key -> true

local function award(userId, key, id)
	local okHas, has = pcall(BadgeService.UserHasBadgeAsync, BadgeService, userId, id)
	if okHas and has == true then
		return
	end
	local ok, res = pcall(BadgeService.AwardBadge, BadgeService, userId, id)
	if not ok or res ~= true then
		warn(("[RMC-DIAG] FAIL badge %s user=%d id=%d: %s"):format(key, userId, id, tostring(res)))
	end
end

function M.grant(list)
	for _, g in ipairs(list) do
		local mine = granted[g.userId]
		if mine == nil then
			mine = {}
			granted[g.userId] = mine
		end
		if not mine[g.key] then
			mine[g.key] = true
			local id = Ids[g.key] or 0
			print(("[RMC-BADGE] earned %s user=%d id=%d"):format(g.key, g.userId, id))
			if id ~= 0 and not RunService:IsStudio() then
				task.spawn(award, g.userId, g.key, id)
			end
		end
	end
end

return M
