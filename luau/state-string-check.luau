--!strict
-- test/state-string-twin.test.js harness: reads a JSON array of payloads (arg 1)
-- and prints one verdict per line from the twin's onlyStateValues, plus the
-- Luau-only cases JSON cannot carry (floats-by-design, NaN, non-data values).
local fs = require("@lune/fs")
local process = require("@lune/process")
local json2lua = require("./json2lua")
local stateString = require("./state-string")

local cases = json2lua.parse(fs.readFile(process.args[1]))
for i, c in ipairs(cases) do
	print(("case %d: %s"):format(i, tostring(stateString.onlyStateValues(c))))
end
print("name-25: " .. tostring(stateString.isStateString(string.rep("a", 25), 24)))
print("float: " .. tostring(stateString.onlyStateValues({ type = "setRates", tax = 0.5 })))
print("nan: " .. tostring(stateString.onlyStateValues({ type = "wait", n = 0 / 0 })))
print("function: " .. tostring(stateString.onlyStateValues({ type = "wait", f = print })))
