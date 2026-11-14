-- Client diagnostics (specs/roblox-native-look.md §D): every load / render /
-- show failure lands in the Output as ONE tagged line, so the Studio log file
-- (roblox/tools/studio-log.js reads it straight off disk) is a complete record
-- of what did not draw. Pure: no services at require time, lune-pinned by
-- roblox/selftest/diag.luau (check.sh gate 38).
--
--   Diag.fail(area, what, err)  a thing fell back or did not show (warn; the
--                               first of each area/what prints, repeats count)
--   Diag.note(area, msg)        a positive fact worth having in the log
--   Diag.try(area, what, f, …)  pcall with a traceback, failure -> Diag.fail
--   Diag.count(area, key, n)    a tally the audit prints
local M = {}

M.TAG = "[RMC-DIAG]"

local fails = {} -- key -> { area, what, err, n }
local failOrder = {}
local counts = {} -- "area.key" -> n
local countOrder = {}

M.sink = { warn = warn or print, print = print } -- the selftest swaps these
-- run-R ruling 4: with quiet set nothing prints; failures and tallies are
-- still recorded, so a later summary (quiet lifted) carries them
M.quiet = false

function M.line(kind, area, text)
	return ("%s %s %s: %s"):format(M.TAG, kind, area, text)
end

function M.fail(area, what, err)
	local key = area .. "\0" .. what
	local rec = fails[key]
	if rec ~= nil then
		rec.n += 1
		return
	end
	local msg = tostring(err == nil and "(no detail)" or err):gsub("[\r\n]+", " | ")
	fails[key] = { area = area, what = what, err = msg, n = 1 }
	table.insert(failOrder, key)
	if not M.quiet then
		M.sink.warn(M.line("FAIL", area, what .. ": " .. msg))
	end
end

function M.note(area, msg)
	if not M.quiet then
		M.sink.print(M.line("NOTE", area, tostring(msg)))
	end
end

function M.count(area, key, n)
	local k = area .. "." .. key
	if counts[k] == nil then
		counts[k] = 0
		table.insert(countOrder, k)
	end
	counts[k] += (n or 1)
end

local function pack(...)
	return { n = select("#", ...), ... }
end

-- returns ok, results… (like pcall); a failure is recorded with its traceback
function M.try(area, what, fn, ...)
	local res = pack(xpcall(fn, function(e)
		return tostring(e) .. " | " .. debug.traceback("", 2)
	end, ...))
	if not res[1] then
		M.fail(area, what, res[2])
		return false, res[2]
	end
	return table.unpack(res, 1, res.n)
end

-- array of { area, what, err, n } in first-seen order
function M.failures()
	local out = {}
	for i, key in ipairs(failOrder) do
		out[i] = fails[key]
	end
	return out
end

function M.tallies()
	local out = {}
	for i, k in ipairs(countOrder) do
		out[i] = { key = k, n = counts[k] }
	end
	return out
end

-- the audit's closing lines: one per failure with its repeat count, one for
-- the tallies; "0 failures" is printed too (silence is not a status)
function M.summary()
	local lines = {}
	for _, f in ipairs(M.failures()) do
		table.insert(lines, M.line("SUM", f.area, ("%s x%d: %s"):format(f.what, f.n, f.err)))
	end
	local parts = {}
	for _, t in ipairs(M.tallies()) do
		table.insert(parts, ("%s=%d"):format(t.key, t.n))
	end
	table.insert(lines, M.line("SUM", "totals", ("%d failure kind(s); %s"):format(#failOrder,
		#parts > 0 and table.concat(parts, " ") or "no tallies")))
	return lines
end

function M.reset()
	fails, failOrder, counts, countOrder = {}, {}, {}, {}
end

return M
