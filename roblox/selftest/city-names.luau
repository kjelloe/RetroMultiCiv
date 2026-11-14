-- check.sh gate 33: headless (lune) pinned verdicts for CityNames — the
-- found-city name suggestion (browser ctx.suggestCityName twin) and the
-- typed-name cleanup the F1 prompt sends.
local M = require("../src/client/CityNames")

local civs = { romans = { cities = { "Rome", "Caesarea", "Carthage" } } }
local function view(cities, civ)
	return { you = "p1", cities = cities, players = { p1 = { civ = civ }, p2 = { civ = "greeks" } } }
end

local fails = 0
local function check(name, got, want)
	if got == want then
		print(("PASS %s"):format(name))
	else
		fails += 1
		print(("FAIL %s: got %s, want %s"):format(name, tostring(got), tostring(want)))
	end
end

check("first roster name", M.suggest(view({}, "romans"), civs), "Rome")
check("skips a taken name", M.suggest(view({ c1 = { name = "Rome", owner = "p1" } }, "romans"), civs), "Caesarea")
check("a rival holding the name also takes it",
	M.suggest(view({ c1 = { name = "Rome", owner = "p2" } }, "romans"), civs), "Caesarea")
check("roster exhausted -> numbered", M.suggest(view({
	c1 = { name = "Rome", owner = "p1" }, c2 = { name = "Caesarea", owner = "p1" },
	c3 = { name = "Carthage", owner = "p1" } }, "romans"), civs), "Colony 4")
check("numbered fallback skips a taken number", M.suggest(view({
	c1 = { name = "Colony 2", owner = "p1" } }, "nociv"), civs), "Colony 3")
check("no civ on the view -> numbered", M.suggest(view({}, nil), civs), "Colony 1")
check("no civs table -> numbered", M.suggest(view({}, "romans"), nil), "Colony 1")

check("clean trims + single-spaces", M.clean("  New   Rome  "), "New Rome")
check("clean drops non-ASCII", M.clean("Sa\195\163o Paulo"), "Sao Paulo")
check("clean caps at 24", M.clean("abcdefghijklmnopqrstuvwxyz0123"), "abcdefghijklmnopqrstuvwx")
check("clean cap leaves no trailing space", M.clean("abcdefghijklmnopqrstuvw yz"), "abcdefghijklmnopqrstuvw")
check("clean empty -> nil", M.clean("   "), nil)
check("clean all non-ASCII -> nil", M.clean("\195\169\195\169"), nil)
check("clean non-string -> nil", M.clean(42), nil)

if fails > 0 then
	error(("%d city-names pin(s) failed"):format(fails))
end
print("city-names: ALL PINS PASS")
