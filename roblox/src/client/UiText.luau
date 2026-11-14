-- Button-label helpers, pure (lune-pinned by roblox/selftest/ui-dock.luau,
-- check.sh gate 39). Ruling 2026-11-14: hotkey hints like "Research (T)"
-- stay on desktop and are dropped on a touch-only device.
local M = {}

-- "Found (B)" -> "Found", "Wait (Spc)" -> "Wait"; a parenthesis that is not a
-- 1-3 character key name ("Debug (Studio)") is part of the label and stays
function M.stripHint(text)
	local head = text:match("^(.-)%s*%(%w%w?%w?%)%s*$")
	if head ~= nil and head:match("%S") ~= nil then
		return head
	end
	return text
end

-- touchOnly: a device with a touch screen and no keyboard
function M.label(text, touchOnly)
	if touchOnly then
		return M.stripHint(text)
	end
	return text
end

return M
