--!strict
-- Luau twin of "JSON.parse for our data" (phase 5, P5-2): scenario files,
-- saves, and states parsed into tables honoring the port conventions:
--   * EVERY array carries statehash.ARRAY_MT — the empty-array-vs-object
--     distinction is decided HERE, where [] and {} are still different
--     tokens (docs/09 trap: a marker missed = a hash silently wrong)
--   * integers stay integers (no coercion; assertState rejects floats)
--   * JSON null parses to the NULL sentinel — it may appear in scenario
--     `expect` blocks (where null means "path absent") but NEVER inside a
--     state: call assertState(v) before hashing anything that claims to be
--     game state, and it errors on NULL and non-integer numbers.
-- Pure Luau: no lune/Roblox APIs — Studio consumes this module verbatim
-- (the lune-side harness does the file I/O around it).
-- EXPORTS (public API, stable): parse(text) -> value, NULL (sentinel),
-- assertState(value).

local statehash = require("./statehash")

local NULL = setmetatable({}, { __tostring = function() return "json2lua.NULL" end })

local ESCAPES: { [string]: string } = {
	['"'] = '"', ["\\"] = "\\", ["/"] = "/",
	b = "\b", f = "\f", n = "\n", r = "\r", t = "\t",
}

local function parseError(text: string, pos: number, msg: string): never
	local upto = string.sub(text, math.max(1, pos - 20), pos)
	error(string.format("json2lua: %s at position %d (...%s)", msg, pos, upto))
end

-- returns value, nextPos
local function parseValue(text: string, pos: number): (any, number)
	-- skip whitespace
	local _, wsEnd = string.find(text, "^[ \t\r\n]*", pos)
	pos = (wsEnd :: number) + 1
	local c = string.sub(text, pos, pos)

	if c == "{" then
		local obj = {}
		pos += 1
		local _, w = string.find(text, "^[ \t\r\n]*", pos)
		pos = (w :: number) + 1
		if string.sub(text, pos, pos) == "}" then
			return obj, pos + 1
		end
		while true do
			local key, p = parseValue(text, pos)
			if typeof(key) ~= "string" then
				parseError(text, pos, "object key must be a string")
			end
			local _, w2 = string.find(text, "^[ \t\r\n]*", p)
			p = (w2 :: number) + 1
			if string.sub(text, p, p) ~= ":" then
				parseError(text, p, "expected ':'")
			end
			local value
			value, p = parseValue(text, p + 1)
			obj[key] = value
			local _, w3 = string.find(text, "^[ \t\r\n]*", p)
			p = (w3 :: number) + 1
			local sep = string.sub(text, p, p)
			if sep == "," then
				pos = p + 1
			elseif sep == "}" then
				return obj, p + 1
			else
				parseError(text, p, "expected ',' or '}'")
			end
		end
	end

	if c == "[" then
		-- arrays are marked at birth: [] vs {} is only knowable here
		local arr = setmetatable({}, statehash.ARRAY_MT)
		pos += 1
		local _, w = string.find(text, "^[ \t\r\n]*", pos)
		pos = (w :: number) + 1
		if string.sub(text, pos, pos) == "]" then
			return arr, pos + 1
		end
		local n = 0
		while true do
			local value, p = parseValue(text, pos)
			n += 1
			arr[n] = value
			local _, w2 = string.find(text, "^[ \t\r\n]*", p)
			p = (w2 :: number) + 1
			local sep = string.sub(text, p, p)
			if sep == "," then
				pos = p + 1
			elseif sep == "]" then
				return arr, p + 1
			else
				parseError(text, p, "expected ',' or ']'")
			end
		end
	end

	if c == '"' then
		local pieces = {}
		local p = pos + 1
		while true do
			local ch = string.sub(text, p, p)
			if ch == "" then
				parseError(text, p, "unterminated string")
			elseif ch == '"' then
				return table.concat(pieces), p + 1
			elseif ch == "\\" then
				local esc = string.sub(text, p + 1, p + 1)
				if ESCAPES[esc] ~= nil then
					table.insert(pieces, ESCAPES[esc])
					p += 2
				elseif esc == "u" then
					local hex = string.sub(text, p + 2, p + 5)
					local code = tonumber(hex, 16)
					if code == nil then
						parseError(text, p, "bad \\u escape")
					end
					table.insert(pieces, utf8.char(code :: number))
					p += 6
				else
					parseError(text, p, "bad escape '\\" .. esc .. "'")
				end
			else
				table.insert(pieces, ch)
				p += 1
			end
		end
	end

	if c == "t" and string.sub(text, pos, pos + 3) == "true" then
		return true, pos + 4
	end
	if c == "f" and string.sub(text, pos, pos + 4) == "false" then
		return false, pos + 5
	end
	if c == "n" and string.sub(text, pos, pos + 3) == "null" then
		return NULL, pos + 4
	end

	local numStr = string.match(text, "^-?%d+%.?%d*[eE]?[%+%-]?%d*", pos)
	if numStr ~= nil and numStr ~= "" then
		local num = tonumber(numStr)
		if num == nil then
			parseError(text, pos, "bad number '" .. numStr .. "'")
		end
		return num, pos + #numStr
	end

	parseError(text, pos, "unexpected character '" .. c .. "'")
	error("unreachable")
end

local function parse(text: string): any
	local value, pos = parseValue(text, 1)
	local _, wsEnd = string.find(text, "^[ \t\r\n]*", pos)
	if (wsEnd :: number) < #text then
		parseError(text, pos, "trailing content")
	end
	return value
end

-- The state contract, enforced at the door: no NULL, no floats anywhere.
-- (Strings and structure are re-checked by statehash.canonicalize itself.)
local function assertState(value: any, where: string?)
	local at = where or "state"
	if value == NULL then
		error("json2lua: null inside " .. at .. " — the state contract forbids it")
	end
	local kind = typeof(value)
	if kind == "number" then
		if value % 1 ~= 0 then
			error(string.format("json2lua: non-integer %s in %s", tostring(value), at))
		end
	elseif kind == "table" then
		for k, v in pairs(value) do
			assertState(v, at .. "." .. tostring(k))
		end
	end
end

return {
	parse = parse,
	NULL = NULL,
	assertState = assertState,
}
