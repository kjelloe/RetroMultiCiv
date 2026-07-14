--!strict
-- P5-1 anchor harness: prints the three cross-language gate values.
-- Run under lune (`lune run luau/anchors.luau`); test/luau-twins.test.js
-- asserts every line. The roblox-helper's R1 prints the same values inside
-- Studio — if lune passes and Studio diverges, that is a VM delta for the
-- docs/09 trap list, not automatically a twin bug.

local rng = require("./rng")
local statehash = require("./statehash")
local gamecode = require("./gamecode")

-- Gate 1: xorshift32 golden sequence, seed 123456789 (test/rng.test.js)
local seq = {}
local s = rng.seedRng(123456789)
for _ = 1, 4 do
	s = rng.nextRng(s)
	table.insert(seq, string.format("%d", s))
end
print("rng: " .. table.concat(seq, ","))

-- Gate 2: the statehash anchor object {b:2, a:[1,"x",true]}
local ANCHOR = { b = 2, a = { 1, "x", true } }
print("canon: " .. statehash.canonicalize(ANCHOR))
print("statehash: " .. statehash.hashState(ANCHOR))

-- Gate 3: the A11 game-code anchors (same object)
local canon = statehash.canonicalize(ANCHOR)
print("codehi: " .. string.format("0x%08x", gamecode.fnv32(canon, true)))
print("gamecode: " .. gamecode.gameCode(ANCHOR))

-- convention check: an EMPTY array needs the marker to serialize as []
local empty = setmetatable({}, statehash.ARRAY_MT)
print("emptyarray: " .. statehash.canonicalize({ a = empty, b = {} }))
