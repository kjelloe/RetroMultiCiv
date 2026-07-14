--!strict
-- Luau twin of shared/gamecode.js — the 64-bit game verification code as
-- 13 Crockford-base32 chars (phase 5, P5-1).
--   codeLo = FNV-1a-32(canon)          identical to statehash.hashState
--   codeHi = FNV-1a-32(canon REVERSED) same standard basis/prime
--   code   = base32(hi * 2^32 + lo)    two 32-bit limbs, never a 64-bit float
-- Gates: codeHi 0xa687b72d, gameCode AD1X-Q5MR-DP7H9 (the A11 anchors).
-- EXPORTS (public API, stable): gameCode(state) -> "XXXX-XXXX-XXXXX",
-- gameCodeRaw(state) -> 13 chars, formatGameCode(raw), fnv32(s, reversed),
-- base32crockford(hi, lo).

local statehash = require("./statehash")

local FNV_OFFSET = 2166136261
local FNV_PRIME = 16777619
-- Crockford base32 — omits I, L, O, U so codes read unambiguously aloud.
local CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

-- FNV-1a-32 over a string; reversed = last char to first. 1-based ITERATION,
-- but the byte sequence visited is exactly the JS twin's (docs/09 trap 1).
local function fnv32(s: string, reversed: boolean): number
	local hash = FNV_OFFSET
	local len = #s
	for k = 1, len do
		local i = if reversed then len + 1 - k else k
		hash = bit32.bxor(hash, string.byte(s, i))
		hash = statehash.mul32(hash, FNV_PRIME)
	end
	return hash
end

-- Long-division by 32 across the two limbs: combined <= 31*2^32 + 2^32 - 1
-- < 2^53, exact in doubles — the 64-bit value is never formed whole.
local function base32crockford(hi: number, lo: number): string
	local digits = {}
	for _ = 1, 13 do
		local combined = (hi % 32) * 4294967296 + lo
		hi = idiv(hi, 32)
		lo = idiv(combined, 32)
		local d = combined % 32
		table.insert(digits, string.sub(CROCKFORD, d + 1, d + 1))
	end
	local out = {}
	for d = 13, 1, -1 do
		table.insert(out, digits[d])
	end
	return table.concat(out)
end

-- The raw 13-char code (no separators) — the canonical form to store/compare.
local function gameCodeRaw(state: any): string
	local canon = statehash.canonicalize(state)
	return base32crockford(fnv32(canon, true), fnv32(canon, false))
end

-- Grouped for display / reading aloud: XXXX-XXXX-XXXXX (docs/07 §1).
local function formatGameCode(raw: string): string
	return string.sub(raw, 1, 4) .. "-" .. string.sub(raw, 5, 8) .. "-" .. string.sub(raw, 9)
end

local function gameCode(state: any): string
	return formatGameCode(gameCodeRaw(state))
end

return {
	gameCode = gameCode,
	gameCodeRaw = gameCodeRaw,
	formatGameCode = formatGameCode,
	fnv32 = fnv32,
	base32crockford = base32crockford,
}
