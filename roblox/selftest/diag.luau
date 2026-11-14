-- check.sh gate 38: headless (lune) pins for Diag — the tagged failure
-- record every client fallback path reports through.
local M = require("../src/client/Diag")

local out = {}
M.sink = {
	warn = function(s) table.insert(out, "W " .. s) end,
	print = function(s) table.insert(out, "P " .. s) end,
}

local fails = 0
local function check(name, got, want)
	if got == want then
		print(("PASS %s"):format(name))
	else
		fails += 1
		print(("FAIL %s: got %s, want %s"):format(name, tostring(got), tostring(want)))
	end
end

M.fail("icon", "draw", "boom\nline two")
check("fail prints one tagged warning", out[1], "W [RMC-DIAG] FAIL icon: draw: boom | line two")
M.fail("icon", "draw", "boom again")
M.fail("icon", "draw", "and again")
check("a repeat does not print", #out, 1)
check("a repeat is counted", M.failures()[1].n, 3)
check("the first error text is kept", M.failures()[1].err, "boom | line two")
M.fail("icon", "other", nil)
check("a nil error still prints", out[2], "W [RMC-DIAG] FAIL icon: other: (no detail)")
M.note("guis", "30/30 present")
check("note prints tagged", out[3], "P [RMC-DIAG] NOTE guis: 30/30 present")

local ok, a, b = M.try("t", "fine", function(x, y) return x + y, "two" end, 1, 2)
check("try passes results through", ("%s %s %s"):format(tostring(ok), tostring(a), tostring(b)), "true 3 two")
local ok2 = M.try("t", "bad", function() error("kaput") end)
check("try reports failure", ok2, false)
check("try records the failure", M.failures()[3].what, "bad")
check("try keeps the message", M.failures()[3].err:find("kaput", 1, true) ~= nil, true)
check("try's line is one line", out[4]:find("\n", 1, true), nil)

M.count("icon", "rendered")
M.count("icon", "rendered", 4)
M.count("ui", "themed")
local sum = M.summary()
check("summary: one line per failure kind + totals", #sum, 4)
check("summary carries the repeat count", sum[1], "[RMC-DIAG] SUM icon: draw x3: boom | line two")
check("summary totals", sum[4], "[RMC-DIAG] SUM totals: 3 failure kind(s); icon.rendered=5 ui.themed=1")
M.reset()
check("summary with nothing", M.summary()[1], "[RMC-DIAG] SUM totals: 0 failure kind(s); no tallies")

-- quiet (diagnostics off for players): nothing prints, the record is kept
M.quiet = true
local before = #out
M.fail("q", "x", "y")
M.note("q", "z")
check("quiet prints nothing", #out, before)
check("quiet still records the failure", #M.failures(), 1)
M.quiet = false
M.reset()

if fails > 0 then
	error(("%d diag pin(s) failed"):format(fails))
end
print("diag: ALL PINS PASS")
