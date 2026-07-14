-- R1 anchor gate (docs/09 §1, docs/10 §4): requires the bugfixer's luau/
-- port (mapped read-only into ReplicatedStorage.Shared) and prints the
-- cross-language anchors. Expected values are FIXED — a mismatch means the
-- port is wrong, never adjust the expectation here:
--   xorshift32(seed 123456789) -> 2714967881, 2238813396, 1250077441, 3820100336
--   hashState({b=2,a={1,"x",true}}) -> 0x30db1e29
--   gamecode codeHi -> 0xa687b72d, gameCode -> AD1X-Q5MR-DP7H9

local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- luau/ tree layout is the bugfixer's call; find the modules by name
-- anywhere under the mapped folder so this gate survives restructuring.
local function findModule(name)
	local shared = ReplicatedStorage:FindFirstChild("Shared")
	local root = shared or ReplicatedStorage
	if root.Name == name and root:IsA("ModuleScript") then
		return root
	end
	for _, d in ipairs(root:GetDescendants()) do
		if d.Name == name and d:IsA("ModuleScript") then
			return d
		end
	end
	return nil
end

local function gate(label, got, expected)
	local pass = got == expected
	print(("%s: %s"):format(label, tostring(got)))
	print(pass and ("  PASS (%s)"):format(tostring(expected))
		or ("  FAIL expected %s"):format(tostring(expected)))
	return pass
end

print("=== RetroMultiCiv R1 anchor gate ===")

local rngModule = findModule("rng")
local statehashModule = findModule("statehash")
local gamecodeModule = findModule("gamecode")

if not (rngModule and statehashModule and gamecodeModule) then
	print(("PLACEHOLDER: luau/ port not present yet (rng=%s, statehash=%s, gamecode=%s)")
		:format(tostring(rngModule), tostring(statehashModule), tostring(gamecodeModule)))
	print("R1 gate PENDING — rerun once the bugfixer's luau/ modules land.")
	return
end

local rng = require(rngModule)
local statehash = require(statehashModule)
local gamecode = require(gamecodeModule)

local allPass = true

-- 1. xorshift32 golden sequence (test/rng.test.js, seed 123456789)
local expectedSeq = "2714967881, 2238813396, 1250077441, 3820100336"
local s = rng.seedRng(123456789)
local got = {}
for i = 1, 4 do
	s = rng.nextRng(s)
	got[i] = tostring(s)
end
allPass = gate("xorshift32(123456789)", table.concat(got, ", "), expectedSeq) and allPass

-- 2. statehash anchor (shared/statehash.js golden)
local ANCHOR = { b = 2, a = { 1, "x", true } }
allPass = gate('hashState({b=2,a={1,"x",true}})', statehash.hashState(ANCHOR), "0x30db1e29") and allPass

-- 3. game code anchors (test/gamecode.test.js golden vectors)
local canon = statehash.canonicalize(ANCHOR)
local hiHex = ("0x%08x"):format(gamecode.fnv32(canon, true))
allPass = gate("gamecode codeHi", hiHex, "0xa687b72d") and allPass
allPass = gate("gameCode", gamecode.gameCode(ANCHOR), "AD1X-Q5MR-DP7H9") and allPass

print(allPass and "=== R1 anchor gate: ALL PASS ===" or "=== R1 anchor gate: FAILURES — report, do not adjust ===")
