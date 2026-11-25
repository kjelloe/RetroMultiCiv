-- Sound level rules for Options (opt-11 volume, opt-12 effects switch; the
-- browser's sound.js vol()). Pure; roblox/selftest/sound-level.luau, gate 71.
local M = {}

M.STEP = 10 -- the browser's range input steps by 10
M.DEFAULT = 100 -- the uploaded mix was approved at full level

function M.volume(options)
	local v = options ~= nil and tonumber(options.soundVolume) or nil
	if v == nil then
		return M.DEFAULT
	end
	return math.clamp(math.floor(v / M.STEP + 0.5) * M.STEP, 0, 100)
end

-- the factor every effect's own volume is multiplied by: 0 when switched off
function M.master(options)
	if options ~= nil and options.sound == false then
		return 0
	end
	return M.volume(options) / 100
end

-- dir = -1 | 1 -> the new volume, clamped to 0..100
function M.step(options, dir)
	return math.clamp(M.volume(options) + dir * M.STEP, 0, 100)
end

return M
