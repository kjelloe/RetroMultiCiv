-- City catalog rules (pure: no Instances). Which rows the production list
-- may offer, and the hover card each row shows (the encyclopedia's entry in
-- card form). The availability rules MIRROR the engine's setProduction
-- rejections (luau/cities.luau) so the list never offers what the server
-- refuses. roblox/selftest/catalog-info.luau.
local M = {}

M.HIDE = "\0hide"

-- luau/cities.luau unitObsolete twin: the obsoleting tech is known
function M.unitObsolete(def, techSet)
	return def.obsoletedBy ~= nil and def.obsoletedBy ~= "" and techSet[def.obsoletedBy] == true
end

-- ctx: techs (set), reachable(techId) -> bool, techName(techId) -> string,
-- hideFuture, built (set), wondersTaken (set), coastal, nukes
-- -> nil = can be built now; M.HIDE = not listed; else the lock reason shown
function M.availability(kind, id, def, ctx)
	if kind == "unit" then
		if def.barbOnly == true then
			return M.HIDE -- N13: the barbarian leader is never a civ's to build
		end
		if M.unitObsolete(def, ctx.techs) then
			return M.HIDE -- B13a: left the catalog
		end
	end
	if def.tech ~= nil and def.tech ~= "" and not ctx.techs[def.tech] then
		if not ctx.reachable(def.tech) or ctx.hideFuture then
			return M.HIDE -- beyond the one-tech lookahead (or R16 hideFuture)
		end
		return "needs " .. ctx.techName(def.tech)
	end
	if kind == "unit" then
		if def.domain == "sea" and not ctx.coastal then
			return "needs a coastal city" -- XVII §5
		end
		if def.nuclearBlast == true and not ctx.nukes then
			return "needs the Manhattan Project"
		end
	elseif kind == "building" and ctx.built[id] then
		return "built"
	elseif kind == "wonder" and ctx.wondersTaken[id] then
		return "taken"
	end
	return nil
end

function M.escape(s)
	return (tostring(s):gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"))
end

local function stat(label, value)
	return ('<font color="#8f9bb3">%s</font>  <b>%s</b>'):format(label, M.escape(value))
end

local KIND_WORD = { unit = "Unit", building = "Building", wonder = "Wonder" }
local KIND_COLOR = { unit = "#ffa06e", building = "#78beff", wonder = "#ffe182" }

-- opts: blurb (encyclopedia prose or nil), effects (plain-language effect
-- line or ""), techName(techId), lock (availability's reason or nil)
function M.card(kind, id, def, opts)
	local lines = {}
	lines[#lines + 1] = ('<font size="19"><b>%s</b></font>   <font color="%s">%s</font>'):format(
		M.escape(def.name or id), KIND_COLOR[kind], KIND_WORD[kind])
	if opts.blurb ~= nil and opts.blurb ~= "" then
		lines[#lines + 1] = M.escape(opts.blurb)
	end
	if opts.effects ~= nil and opts.effects ~= "" then
		lines[#lines + 1] = ('<font color="#9db2c8">%s</font>'):format(M.escape(opts.effects))
	end
	local stats = {}
	if kind == "unit" then
		stats[#stats + 1] = stat("Attack", def.attack or 0)
		stats[#stats + 1] = stat("Defense", def.defense or 0)
		stats[#stats + 1] = stat("Moves", def.moves or 0)
	end
	stats[#stats + 1] = stat("Cost", (def.cost or 0) .. " shields")
	if kind == "unit" then
		stats[#stats + 1] = stat("Moves on", def.domain or "land")
	elseif kind == "building" then
		stats[#stats + 1] = stat("Upkeep", (def.maintenance or 0) .. " gold a turn")
	end
	lines[#lines + 1] = table.concat(stats, "    ")
	local req = (def.tech ~= nil and def.tech ~= "") and ("Requires " .. opts.techName(def.tech)) or "Available from the start"
	if kind == "unit" and def.obsoletedBy ~= nil and def.obsoletedBy ~= "" then
		req ..= "  -  obsolete with " .. opts.techName(def.obsoletedBy)
	end
	lines[#lines + 1] = ('<font color="#8f9bb3">%s</font>'):format(M.escape(req))
	if opts.lock ~= nil then
		lines[#lines + 1] = ('<font color="#f0846c"><b>Not available here: %s</b></font>'):format(M.escape(opts.lock))
	end
	return table.concat(lines, "\n")
end

return M
