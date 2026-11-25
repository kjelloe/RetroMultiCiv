-- Encyclopedia search (info-04, plan R2.2; the browser's pedia.js doSearch):
-- a name match across every category, each hit carrying its category so a
-- click opens the right entry. Pure; roblox/selftest/pedia-search.luau, gate 70.
local M = {}

M.MAX_HITS = 60

function M.normalize(q)
	return string.lower((tostring(q or ""):gsub("^%s+", ""):gsub("%s+$", "")))
end

-- groups = { { key, label, entries = { { id, name } } } } in category order
-- -> { { cat = group index, id, name, label } } in category then list order;
-- an empty query -> nil (show the current category instead)
function M.find(groups, query)
	local q = M.normalize(query)
	if q == "" then
		return nil
	end
	local hits = {}
	for gi, g in ipairs(groups) do
		for _, e in ipairs(g.entries) do
			if string.find(string.lower(tostring(e.name)), q, 1, true) ~= nil then
				hits[#hits + 1] = { cat = gi, id = e.id, name = e.name, label = g.label }
				if #hits >= M.MAX_HITS then
					return hits
				end
			end
		end
	end
	return hits
end

return M
