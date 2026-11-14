-- check.sh gate 40: every Luau source under roblox/src compiles (lune's
-- luau.compile). `rojo build` does not parse scripts, so without this a
-- syntax slip is first seen as a dead panel in Studio.
local fs = require("@lune/fs")
local luau = require("@lune/luau")

local bad, n = 0, 0
local function walk(dir)
	for _, name in ipairs(fs.readDir(dir)) do
		local p = dir .. "/" .. name
		if fs.isDir(p) then
			walk(p)
		elseif name:match("%.luau$") then
			n += 1
			local ok, err = pcall(luau.compile, fs.readFile(p))
			if not ok then
				bad += 1
				print(("ERR %s: %s"):format(p, tostring(err)))
			end
		end
	end
end
walk("roblox/src")
if bad > 0 then
	error(("%d of %d file(s) do not compile"):format(bad, n))
end
print(("syntax: %d files compile"):format(n))
