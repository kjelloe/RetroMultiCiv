--!strict
-- Luau twin of shared/civ-shuffle.js — the seed-reproducible civilization
-- shuffle for game SETUP (server boot code, NOT engine game state). Fisher-Yates
-- driven by the engine's xorshift32 (engine/rng.js algorithm, inlined — this is
-- boot code, not the engine's stateful rng), whose full 32-bit output makes
-- `% (i+1)` effectively uniform. Pure + deterministic: the same seed yields the
-- same lineup as the JS twin + tools/bake-age-snapshots.js.
-- EXPORTS (stable): shuffleRoster(roster, seed) -> a shuffled COPY.

local M = {}

function M.shuffleRoster(roster: { string }, seed: number): { string }
	local rng = math.floor(math.abs(seed)) % 4294967296
	if rng == 0 then
		rng = 2463534242 -- 0 is xorshift's fixed point (seedRng)
	end
	local function next_(): number
		local x = rng
		x = bit32.bxor(x, bit32.lshift(x, 13))
		x = bit32.bxor(x, bit32.rshift(x, 17))
		x = bit32.bxor(x, bit32.lshift(x, 5))
		rng = x
		return x
	end
	local out = table.clone(roster)
	-- JS: for (i = len-1; i > 0; i--) j = next() % (i+1) [0-based]. Luau is
	-- 1-based, so index i here == the JS i+1; next_() % i gives [0, i-1] and
	-- +1 lifts it to [1, i] — the SAME swap the JS twin performs each step.
	for i = #out, 2, -1 do
		local j = next_() % i + 1
		out[i], out[j] = out[j], out[i]
	end
	return out
end

return M
