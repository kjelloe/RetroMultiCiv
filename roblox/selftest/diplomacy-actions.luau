-- check.sh gate 63: treaty actions (DiplomacyView) against the engine: every
-- command the panel builds is accepted or refused as its button state says,
-- read from the player's own filtered view; offer wording; reason coverage.
local fs = require("@lune/fs")
local json2lua = require("../../luau/json2lua")
local index = require("../../luau/index")
local statehash = require("../../luau/statehash")
local visibility = require("../../luau/visibility")
local D = require("../src/client/DiplomacyView")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local rs = {}
for _, f in ipairs({ "terrain", "units", "techs", "buildings", "wonders", "governments", "civs", "rules" }) do
	rs[f] = json2lua.parse(fs.readFile("data/" .. f .. ".json"))
end
local players = setmetatable({}, statehash.ARRAY_MT)
for i, id in ipairs({ "romans", "babylonians", "germans" }) do
	table.insert(players, { id = "p" .. i, name = rs.civs[id].name, civ = id, color = rs.civs[id].color, human = i <= 2 })
end
local engine = index.createEngine(rs)
local state = engine.createGame({ seed = 20260718,
	options = { width = 40, height = 25, players = players, mapType = "continents" } })

local function viewOf(pid)
	return visibility.filterView(state, pid, rs)
end
-- send what the panel would send, as `pid` on their turn
local function send(pid, cmd)
	state.activePlayer = pid
	cmd.playerId = pid
	local r = engine.applyCommand(state, cmd)
	if r.ok then
		state = r.state
	end
	return r
end

-- unmet: a nameless row without buttons, and the engine refuses
local rows = D.rows(viewOf("p1"), "p1", rs)
check("two rival rows", #rows == 2, #rows)
check("unmet row hides the name", rows[1].met == false and rows[1].name == "unknown civilization" and rows[1].actions == nil)
check("unmet: engine refuses", send("p1", D.parleyCommand("p2", "peace")).reason == "notMet")

state.relations = state.relations or {}
state.relations["p1|p2"] = { state = "war", met = true }

-- at war: offer open, declare closed
local a = D.treatyActions(viewOf("p1"), "p1", "p2")
check("war: offer open, declare closed", a.canOffer and not a.canDeclare and not a.canAccept and not a.offerSent)
check("war: engine refuses declare", send("p1", D.parleyCommand("p2", "declare")).reason == "alreadyWar")
check("no offer: engine refuses accept", send("p1", D.parleyCommand("p2", "accept")).reason == "noSuchOffer")

-- peace offer -> the other side sees it and can accept
check("offer peace accepted by the engine", send("p1", D.parleyCommand("p2", "peace")).ok)
check("sender: offer sent", D.treatyActions(viewOf("p1"), "p1", "p2").offerSent)
local v2 = viewOf("p2")
local inc = D.incomingOffers(v2, "p2", rs)
check("receiver: one incoming offer", #inc == 1 and inc[1].pid == "p1", #inc)
check("peace wording", inc[1].text == "The Romans propose a lasting peace treaty.", inc[1].text)
check("receiver: accept open", D.treatyActions(v2, "p2", "p1").canAccept and D.rows(v2, "p2", rs)[1].offerText == inc[1].text)
check("sender has no incoming", #D.incomingOffers(viewOf("p1"), "p1", rs) == 0)
check("accept", send("p2", D.parleyCommand("p1", "accept")).ok)
a = D.treatyActions(viewOf("p1"), "p1", "p2")
check("peace: declare open, offer closed", a.canDeclare and not a.canOffer and not a.canAccept)
check("peace label", D.rows(viewOf("p1"), "p1", rs)[1].label:find("at peace since turn", 1, true) ~= nil)

-- declare war breaks the treaty: reputation band appears
check("declare", send("p1", D.parleyCommand("p2", "declare")).ok)
check("war again", D.relationOf(viewOf("p2"), "p2", "p1") == "war")
-- filterView does not carry a rival's reputation (2026-11-16; luau/ lane), so
-- the band is checked on the engine state: it lights up on its own the day
-- the view carries the field
local band = D.rows(state, "p2", rs)[1].repBand
check("treaty breaker shows a band", band ~= nil and table.find(D.REP_BANDS, band) ~= nil, band)

-- tribute: the acceptor pays
state.players.p2.gold = 80
local before = state.players.p1.gold
check("demand tribute", send("p1", D.parleyCommand("p2", "tribute", { gold = 30.7 })).ok)
inc = D.incomingOffers(viewOf("p2"), "p2", rs)
check("tribute wording", inc[1].text == "The Romans demand a tribute of 30 gold.", inc[1] and inc[1].text)
check("pay tribute", send("p2", D.parleyCommand("p1", "accept")).ok)
check("gold moved", state.players.p2.gold == 50 and state.players.p1.gold == before + 30)

-- tech swap: lists and the exchange
table.insert(state.players.p1.techs, "alphabet")
table.insert(state.players.p2.techs, "pottery")
local sw = D.swapChoices(viewOf("p1"), "p1", rs)
local function has(list, id)
	for _, it in ipairs(list) do
		if it.id == id then
			return true
		end
	end
	return false
end
check("give lists what I know", has(sw.give, "alphabet") and not has(sw.give, "pottery"))
check("want lists what I do not", has(sw.want, "pottery") and not has(sw.want, "alphabet"))
local total = 0
for _ in pairs(rs.techs) do
	total += 1
end
check("give + want = every tech", #sw.give + #sw.want == total)
check("offer swap", send("p1", D.parleyCommand("p2", "techswap", { giveTech = "alphabet", wantTech = "pottery" })).ok)
inc = D.incomingOffers(viewOf("p2"), "p2", rs)
check("swap wording", inc[1].text == ("The Romans offer %s in exchange for your %s."):format(rs.techs.alphabet.name, rs.techs.pottery.name), inc[1] and inc[1].text)
check("accept swap", send("p2", D.parleyCommand("p1", "accept")).ok)
check("techs exchanged", table.find(state.players.p2.techs, "alphabet") ~= nil and table.find(state.players.p1.techs, "pottery") ~= nil)

-- reject clears the offer
check("gift offer", send("p1", D.parleyCommand("p2", "techswap", { giveTech = "alphabet" })).ok)
check("gift wording", D.incomingOffers(viewOf("p2"), "p2", rs)[1].text == ("The Romans offer %s as a gift."):format(rs.techs.alphabet.name))
check("reject", send("p2", D.parleyCommand("p1", "reject")).ok)
check("offer gone", #D.incomingOffers(viewOf("p2"), "p2", rs) == 0 and D.pendingOfferFor(viewOf("p1"), "p1", "p2") == nil)

-- command shapes
local c = D.parleyCommand("p2", "techswap", { giveTech = "x", wantTech = "" })
check("gift carries no want", c.kind == "offer" and c.terms.kind == "techExchange" and c.terms.wantTechId == nil)
check("tribute is whole and not negative", D.parleyCommand("p2", "tribute", { gold = -5 }).terms.gold == 0)
check("tribute stepper", D.tributeStep(50, 1) == 60 and D.tributeStep(5, -1) == 0)

-- every refusal the engine's diplomacy command can give has a line
local src = fs.readFile("luau/diplomacy.luau")
local from = src:find("local function diplomacyCommand", 1, true)
local to = src:find("local function contactPass", 1, true)
local seen = 0
for reason in src:sub(from, to):gmatch('reason = "(%w+)"') do
	if reason ~= "border_pressure" then
		seen += 1
		check("reason has a line: " .. reason, D.REASON[reason] ~= nil)
	end
end
check("engine reasons were read", seen >= 8, seen)
check("unknown reason falls back to the code", D.reasonText("zzz") == "zzz")

-- wording fallbacks, bands, confirm
check("describe default", D.describeParley({ term = "?" }) == "They propose terms.")
check("timed peace", D.describeParley({ term = "peace", duration = 20 }, { name = "X" }) == "X propose a 20-turn peace treaty.")
check("bands", D.repBand(0) == nil and D.repBand(1) == "Reliable" and D.repBand(9) == "Treacherous")
check("confirm", D.confirmPress(nil, nil, "p2", 10) == "arm" and D.confirmPress("p2", 10, "p2", 12) == "send"
	and D.confirmPress("p2", 10, "p2", 14) == "arm" and D.confirmPress("p3", 10, "p2", 11) == "arm")

print("diplomacy-actions: treaty buttons vs the engine, wording, reasons")
if fails > 0 then
	error(("%d diplomacy-actions check(s) failed"):format(fails))
end
