-- check.sh gate 43: headless (lune) pins for the observation deck plan.
local D = require("../src/server/DeckPlan")

local fails = 0
local function check(name, got, want)
	if got == want then
		print(("PASS %s"):format(name))
	else
		fails += 1
		print(("FAIL %s: got %s, want %s"):format(name, tostring(got), tostring(want)))
	end
end

check("five stations", #D.STATIONS, 5)
local seen, lastX = {}, -math.huge
for _, s in ipairs(D.STATIONS) do
	check(s.id .. " has a title", s.title ~= nil and #s.title > 0, true)
	check(s.id .. " explains itself (40..140 chars)", #s.text >= 40 and #s.text <= 140, true)
	check(s.id .. " pad fits inside the floor", math.abs(s.x) + D.PAD / 2 <= D.FLOOR.w / 2 - 1, true)
	check(s.id .. " clear of its left neighbour", s.x - lastX >= D.PAD + 4, true)
	check(s.id .. " id unique", seen[s.id], nil)
	seen[s.id] = true
	lastX = s.x
end
check("station row inside the floor", math.abs(D.STATION_Z) + D.PAD / 2 < D.FLOOR.d / 2, true)
check("spawn clear of the station row", D.SPAWN_Z - 5 > D.STATION_Z + D.PAD / 2, true)

-- exactly the phases the server sets
for _, phase in ipairs({ "idle", "setup", "starting", "running" }) do
	for _, s in ipairs(D.STATIONS) do
		local open, line = D.status(s.id, phase, true)
		check(("%s/%s has a status line"):format(s.id, phase), type(line) == "string" and #line > 0, true)
		check(("%s/%s open matches live"):format(s.id, phase), open, D.live(phase, true)[s.id] == true)
	end
end
check("idle: only start is open", select(1, D.status("start", "idle")) and not select(1, D.status("join", "idle")), true)
check("setup: join is open", select(1, D.status("join", "setup")), true)
check("running without a free civ: takeover closed", select(1, D.status("takeover", "running", false)), false)
check("running with a free civ: takeover open", select(1, D.status("takeover", "running", true)), true)
check("a closed station says why", select(2, D.status("join", "idle")), "No game yet - start one at the first station.")
check("an unknown phase closes everything", select(1, D.status("start", "nope")), false)

if fails > 0 then
	error(("%d deck-plan pin(s) failed"):format(fails))
end
print("deck-plan: all pins hold")
