-- What a technology is, in reading form: era and state, description, what
-- it needs, what it leads to, what it lets you build. ONE builder for the
-- tech tree's hover card and the research picker's expanding panel (user,
-- run-S shot16: "same information as in the tech tree"). Read-only; state
-- comes from the VIEWER's own techs (fog-honest).
local ClientState = require(script.Parent:WaitForChild("ClientState"))
local TechGlyphs = require(script.Parent:WaitForChild("TechGlyphs"))

local M = {}

function M.knownSet()
	local view = ClientState.view
	local out = {}
	if view ~= nil then
		local me = view.players[view.you]
		for _, t in ipairs((me ~= nil and me.techs) or {}) do
			out[t] = true
		end
	end
	return out
end

function M.stateOf(techs, id, known)
	if known[id] then
		return "known"
	end
	for _, p in ipairs(techs[id].prereqs or {}) do
		if not known[p] then
			return "locked"
		end
	end
	return "avail"
end

local function caption(t)
	return ('<font size="14" color="#8f9bb3">%s</font>'):format(t)
end

-- opts.title = false leaves the name line out (the picker row already shows it)
function M.card(id, opts)
	local rs = ClientState.rulesets()
	local techs = rs.techs
	local def = techs[id]
	local col = TechGlyphs.ERA[def.era] or TechGlyphs.ERA.ancient
	local known = M.knownSet()
	local st = M.stateOf(techs, id, known)
	local view = ClientState.view
	local me = view ~= nil and view.players[view.you] or nil
	local status = st == "known" and "You know this."
		or (me ~= nil and me.researching == id and "You are researching this now.")
		or (st == "avail" and "Available to research.")
		or "Locked - its prerequisites come first."
	local lines = {}
	if opts == nil or opts.title ~= false then
		lines[#lines + 1] = ('<font face="FredokaOne" size="22" color="#%s">%s</font>'):format(col.edge:ToHex(), def.name)
	end
	lines[#lines + 1] = caption((TechGlyphs.ERA_NAME[def.era] or "") .. " ERA  -  " .. status)
	local blurb = ClientState.techBlurbs ~= nil and ClientState.techBlurbs[id] or nil
	if blurb ~= nil and blurb ~= "" then
		lines[#lines + 1] = blurb
	end
	lines[#lines + 1] = caption("NEEDS")
	local needs = {}
	for _, p in ipairs(def.prereqs or {}) do
		needs[#needs + 1] = (techs[p] and techs[p].name or p) .. (known[p] and "" or " (not known yet)")
	end
	lines[#lines + 1] = #needs > 0 and table.concat(needs, ", ") or "nothing - a starting technology"
	local after = {}
	for other, d in pairs(techs) do
		if table.find(d.prereqs or {}, id) ~= nil then
			after[#after + 1] = d.name or other
		end
	end
	table.sort(after)
	lines[#lines + 1] = caption("LEADS TO")
	lines[#lines + 1] = #after > 0 and table.concat(after, ", ") or "nothing further"
	local unlocks = ClientState.techUnlocks ~= nil and ClientState.techUnlocks(rs, id) or {}
	local govs = {}
	for gid, g in pairs(rs.governments or {}) do
		if g.tech == id then
			govs[#govs + 1] = g.name or gid
		end
	end
	table.sort(govs)
	if #unlocks > 0 or #govs > 0 then
		local by = { units = {}, buildings = {}, wonders = {} }
		for _, u in ipairs(unlocks) do
			table.insert(by[u.cat], u.name)
		end
		lines[#lines + 1] = caption("LETS YOU BUILD")
		for _, cat in ipairs({ { "units", "Units", "#ffb38a" }, { "buildings", "Buildings", "#9fd0ff" }, { "wonders", "Wonders", "#ffe182" } }) do
			if #by[cat[1]] > 0 then
				lines[#lines + 1] = ('<font color="%s">%s:</font> %s'):format(cat[3], cat[2], table.concat(by[cat[1]], ", "))
			end
		end
		if #govs > 0 then
			lines[#lines + 1] = ('<font color="#c9a8ff">Government:</font> %s'):format(table.concat(govs, ", "))
		end
	end
	return table.concat(lines, "\n"), "card"
end

return M
