--!strict
-- Twin of shared/state-string.js (fe-R13, A116): client-supplied text that can reach
-- game state must obey statehash's string rule (every byte in 32..126), or the
-- first hash of that state throws. The Roblox GameServer checks at the door
-- (workitems-roblox item 6). foldToAscii stays browser-side (a client nicety).
--
-- onlyStateValues twins the JS command rule: a value must be a string, a
-- boolean, an integer, or a table of those. It also rejects what JSON never
-- carries but a RemoteEvent can (NaN, Roblox datatypes). The looser JS
-- onlyStateStrings (lobby options) has no Roblox caller and is not twinned.

local function isStateString(s: any, maxLen: number): boolean
	if type(s) ~= "string" or #s > maxLen then
		return false
	end
	for i = 1, #s do
		local c = string.byte(s, i)
		if c < 32 or c > 126 then
			return false
		end
	end
	return true
end

local function isStateInteger(n: any): boolean
	return type(n) == "number" and n == n and n == math.floor(n) and math.abs(n) <= 2 ^ 53
end

-- every string anywhere inside a client payload (keys included) passes the rule
local function onlyStateValues(value: any, depth: number?): boolean
	local d = depth or 0
	if d > 8 then
		return false
	end
	local t = type(value)
	if t == "string" then
		return isStateString(value, 4096)
	end
	if t == "boolean" then
		return true
	end
	if t == "number" then
		return isStateInteger(value)
	end
	if t ~= "table" then
		return false
	end
	for k, v in pairs(value) do
		if type(k) == "string" then
			if not isStateString(k, 64) then
				return false
			end
		elseif not (isStateInteger(k) and k >= 1) then
			return false
		end
		if not onlyStateValues(v, d + 1) then
			return false
		end
	end
	return true
end

return {
	isStateString = isStateString,
	onlyStateValues = onlyStateValues,
}
