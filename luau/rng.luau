--!strict
-- Luau twin of engine/rng.js — xorshift32, bit-identical (phase 5, P5-1).
-- JS `(x ^ (x << n)) >>> 0` maps to bit32.bxor/lshift, which already
-- truncate to unsigned 32-bit. NEVER Random.new — determinism is sacred.
-- Gate: the golden sequence for seed 123456789 (test/rng.test.js).
-- EXPORTS (public API, stable): seedRng(seed), nextRng(rngState),
-- rollRange(rngState, maxExclusive) -> { rngState, value }.

-- 0 is a fixed point of xorshift; map any seed onto [1, 2^32).
local function seedRng(seed: number): number
	local s = math.floor(math.abs(seed)) % 4294967296
	if s == 0 then
		return 2463534242
	end
	return s
end

local function nextRng(rngState: number): number
	local x = rngState
	x = bit32.bxor(x, bit32.lshift(x, 13))
	x = bit32.bxor(x, bit32.rshift(x, 17))
	x = bit32.bxor(x, bit32.lshift(x, 5))
	return x
end

-- Roll an integer in [0, maxExclusive). Returns the new rng state and the
-- value; the caller stores rngState back into the game state. Field names
-- match the JS twin exactly (rngState/value).
local function rollRange(rngState: number, maxExclusive: number): { rngState: number, value: number }
	local next = nextRng(rngState)
	-- both operands non-negative, so Lua's floored % equals JS remainder here
	return { rngState = next, value = next % maxExclusive }
end

return {
	seedRng = seedRng,
	nextRng = nextRng,
	rollRange = rollRange,
}
