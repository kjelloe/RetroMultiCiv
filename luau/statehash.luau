--!strict
-- Luau twin of shared/statehash.js — canonical serialization + FNV-1a 32
-- (phase 5, P5-1). Byte-identical canonical strings, identical hashes.
-- Gate: {b=2, a={1,"x",true}} -> 0x30db1e29.
--
-- ARRAY vs OBJECT (the one representation question JS never had): a Luau
-- table serializes as an ARRAY when t[1] ~= nil, else as an OBJECT — with
-- one escape hatch for EMPTY arrays (state fields like buildings = {}):
-- mark them with setmetatable({}, statehash.ARRAY_MT). json2lua and the
-- engine twins must use the marker for every empty array they produce.
-- (Trap-list addition proposed in the P5-1 done-mail.)
-- EXPORTS (public API, stable): canonicalize(state) -> string,
-- hashState(state) -> "0x" + 8 hex chars, mul32(a, b), ARRAY_MT (empty-array marker).

local ARRAY_MT = { __isArray = true }

local function isArray(t: { [any]: any }): boolean
	if t[1] ~= nil then
		return true
	end
	if next(t) == nil then
		return getmetatable(t :: any) == ARRAY_MT
	end
	return false
end

-- (a * b) mod 2^32 without exceeding double precision — the same integer
-- formula as JS, math.floor for the truncating division.
local function mul32(a: number, b: number): number
	local aHi = math.floor(a / 65536) % 65536
	local aLo = a % 65536
	return (((aHi * b) % 65536) * 65536 + aLo * b) % 4294967296
end

local function canonical(value: any, out: { string })
	local kind = typeof(value)
	if kind == "number" then
		if value % 1 ~= 0 then
			error("non-integer number in state: " .. tostring(value))
		end
		table.insert(out, string.format("%d", value))
	elseif kind == "string" then
		for i = 1, #value do
			local c = string.byte(value, i)
			if c < 32 or c > 126 then
				error('non-printable-ASCII char in state string: "' .. value .. '"')
			end
		end
		table.insert(out, '"' .. value .. '"')
	elseif kind == "boolean" then
		table.insert(out, if value then "true" else "false")
	elseif kind == "table" then
		if isArray(value) then
			table.insert(out, "[")
			for i = 1, #value do
				if i > 1 then
					table.insert(out, ",")
				end
				canonical(value[i], out)
			end
			table.insert(out, "]")
		else
			local keys = {}
			for k in pairs(value) do
				if typeof(k) ~= "string" then
					error("non-string object key in state: " .. tostring(k))
				end
				table.insert(keys, k)
			end
			table.sort(keys) -- default string order == JS lexicographic sort
			table.insert(out, "{")
			for i = 1, #keys do
				if i > 1 then
					table.insert(out, ",")
				end
				table.insert(out, '"' .. keys[i] .. '":')
				canonical(value[keys[i]], out)
			end
			table.insert(out, "}")
		end
	else
		error("forbidden value in state: " .. tostring(value))
	end
end

local function canonicalize(state: any): string
	local out = {}
	canonical(state, out)
	return table.concat(out)
end

local function hashState(state: any): string
	local s = canonicalize(state)
	local hash = 2166136261 -- FNV offset basis
	for i = 1, #s do
		-- bit32.bxor is already unsigned; no `>>> 0` dance needed
		hash = bit32.bxor(hash, string.byte(s, i))
		hash = mul32(hash, 16777619) -- FNV prime
	end
	return string.format("0x%08x", hash)
end

-- #28 behavior-hash discriminator (twin of shared/statehash.js): hashState EXCLUDING the
-- rulesetHash STAMP field -- the BEHAVIORAL trajectory hash, independent of the ruleset stamp.
local function behaviorHash(state: any): string
	if state.rulesetHash == nil then
		return hashState(state)
	end
	local copy = {}
	for k, v in pairs(state) do
		if k ~= "rulesetHash" then
			copy[k] = v
		end
	end
	return hashState(copy)
end

return {
	canonicalize = canonicalize,
	hashState = hashState,
	behaviorHash = behaviorHash,
	mul32 = mul32,
	ARRAY_MT = ARRAY_MT,
}
