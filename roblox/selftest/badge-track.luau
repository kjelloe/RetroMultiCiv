-- check.sh gate 64: badge bookkeeping (BadgeTrack) over a real engine game,
-- the id table (BadgeIds), and the rulings of 2026-11-17: regent turns count
-- for milestones but not for victories, debug games earn nothing, only the
-- winning seat wins.
local fs = require("@lune/fs")
local json2lua = require("../../luau/json2lua")
local index = require("../../luau/index")
local statehash = require("../../luau/statehash")
local ai = require("../../luau/ai")
local Rules = require("../src/server/BadgeRules")
local Track = require("../src/server/BadgeTrack")
local Ids = require("../src/server/BadgeIds")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

-- the id table carries exactly the rule keys
local nIds = 0
for key, id in pairs(Ids) do
	nIds += 1
	check("id row has a badge " .. key, Rules.byKey[key] ~= nil)
	check("id is a whole number " .. key, type(id) == "number" and id >= 0 and id == math.floor(id))
end
check("an id row per badge", nIds == #Rules.BADGES, nIds)

-- a real game, the ruleset in the shape the server hands over
local rs = {}
for _, f in ipairs({ "terrain", "units", "techs", "buildings", "wonders", "governments", "civs", "rules" }) do
	rs[f] = json2lua.parse(fs.readFile("data/" .. f .. ".json"))
end
local players = setmetatable({}, statehash.ARRAY_MT)
for i, id in ipairs({ "romans", "babylonians", "germans" }) do
	table.insert(players, { id = "p" .. i, name = rs.civs[id].name, civ = id, color = rs.civs[id].color, human = false })
end
local engine = index.createEngine(rs)
local state = engine.createGame({ seed = 20260718,
	options = { width = 40, height = 25, players = players, mapType = "continents" } })

local seats = { [101] = "p1", [202] = "p2" }
local t = Track.new(Rules, rs, state.turn)
local earned = { [101] = {}, [202] = {} }
local total = 0
local function take(list)
	for _, g in ipairs(list) do
		check("earned once " .. g.key, not earned[g.userId][g.key])
		check("earned key has an id row " .. g.key, Ids[g.key] ~= nil)
		earned[g.userId][g.key] = true
		total += 1
	end
end
local guard = 80 * 3
while state.turn <= 80 and state.gameOver ~= true and guard > 0 do
	guard -= 1
	local batch = {}
	local pid = state.activePlayer
	state = ai.runAiTurn(engine, state, pid, rs, batch)
	local r = engine.applyCommand(state, { type = "endTurn", playerId = pid })
	check("endTurn ok", r.ok, r.reason)
	state = r.state
	for _, e in ipairs(r.events) do
		batch[#batch + 1] = e
	end
	take(Track.onEvents(t, batch, state, seats))
end
check("the game ran", state.turn > 80, state.turn)
check("both seats founded a city", earned[101]["first-city"] and earned[202]["first-city"])
check("both seats built a unit", earned[101]["first-unit"] and earned[202]["first-unit"])
check("both seats found an advance", earned[101]["first-tech"] and earned[202]["first-tech"])
check("several badges in 80 turns", total >= 8, total)
-- progress is the seat's own: the city count is what that civ founded
local function ownCities(pid)
	local n = 0
	for _, cid in ipairs(state.cityOrder) do
		if state.cities[cid].owner == pid then
			n += 1
		end
	end
	return n
end
local p1 = t.users[101].progress
check("cities founded covers cities held", p1.citiesFounded >= 1 and p1.citiesFounded + (p1.captures or 0) >= ownCities("p1"),
	("%d founded, %d held"):format(p1.citiesFounded or 0, ownCities("p1")))
check("advances counted match the state", p1.techs == #state.players.p1.techs, p1.techs)
check("no victory during play", not earned[101]["win-any"] and t.victory == nil)
check("finish before the end is empty", #Track.finish(t, state, seats, { difficulty = "prince", combat = "bestof3", civs = 3 }) == 0 and not t.done)

-- the end of the game
local over = { turn = 101, gameOver = true, winner = "p1", players = state.players, cities = state.cities }
local setup = { difficulty = "king", combat = "authentic", civs = 7 }
local function keysOf(list, userId)
	local out = {}
	for _, g in ipairs(list) do
		if g.userId == userId then
			out[g.key] = true
		end
	end
	return out
end
local function ended(startTurn, turns, patch)
	local tr = Track.new(Rules, rs, startTurn)
	for _ = 1, turns do
		Track.onTurn(tr, 101, "p1")
		Track.onTurn(tr, 202, "p2")
	end
	local st = table.clone(over)
	for k, v in pairs(patch or {}) do
		st[k] = v
	end
	local got = Track.onEvents(tr, { { type = "gameOver", winner = st.winner, victory = "conquest" } }, st, seats)
	for _, g in ipairs(Track.finish(tr, st, seats, setup)) do
		got[#got + 1] = g
	end
	return got, tr, st
end

local got, tr, st = ended(1, 100)
local mine, theirs = keysOf(got, 101), keysOf(got, 202)
check("the winner in the seat wins", mine["win-any"] and mine["win-conquest"] and mine["win-king"] and mine["win-prince"]
	and mine["win-civs-7"] and mine["win-authentic"])
check("not above the level played", not mine["win-emperor"] and not mine["win-civs-14"] and not mine["win-space"])
check("the other seat does not win", next(theirs) == nil or (not theirs["win-any"] and not theirs["win-king"]))
check("finish answers once", #Track.finish(tr, st, seats, setup) == 0)
check("held share of a full game", Track.heldShare(tr, 101, st) == 1)

got = ended(1, 50)
check("half the turns is enough", keysOf(got, 101)["win-any"])
got, tr, st = ended(1, 49)
check("under half the turns: no victory badge", not keysOf(got, 101)["win-any"], Track.heldShare(tr, 101, st))
got = ended(1, 0)
check("a regent game: no victory badge", not keysOf(got, 101)["win-any"])
got = ended(61, 30)
check("a later-age start counts from its first turn", keysOf(got, 101)["win-any"])
got = ended(1, 100, { debugUsed = true })
check("a debug game earns nothing", #got == 0, #got)
got = ended(1, 100, { winner = "p3" })
check("an AI winner: no user wins", not keysOf(got, 101)["win-any"] and not keysOf(got, 202)["win-any"])

-- debug use during play stops milestones too
local d = Track.new(Rules, rs, 1)
local tainted = table.clone(state)
tainted.debugUsed = true
check("debug game: no milestone", #Track.onEvents(d, { { type = "techDiscovered", playerId = "p1", tech = "alphabet" } }, tainted, seats) == 0)

-- a user who changes seat starts over
local s = Track.new(Rules, rs, 1)
Track.onTurn(s, 101, "p1")
Track.onEvents(s, { { type = "techDiscovered", playerId = "p1", tech = "alphabet" } }, state, { [101] = "p1" })
check("progress on the first seat", s.users[101].progress.techs == 1 and s.users[101].turns == 1)
Track.onEvents(s, {}, state, { [101] = "p3" })
check("a new seat starts over", s.users[101].pid == "p3" and s.users[101].turns == 0 and s.users[101].progress.techs == nil)

if fails > 0 then
	error(("badge-track: %d failure(s)"):format(fails))
end
print("badge-track: ok")
