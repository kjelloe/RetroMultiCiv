-- R15: pure catalog TEXT — the TWIN of client/ui/catalog-text.js (A58a),
-- which was extracted exactly so "a future Roblox help surface" consumes the
-- SAME renderer. Structured ruleset effect fields -> human strings; DATA ->
-- STRING ONLY (no Instances, no engine requires). Keep byte-shaped with the
-- JS: new effect keys land there first, then mirror here.

local M = {}

function M.make(ruleset)
	local techs = ruleset.techs

	-- plain-language lines for the structured effect fields (tools/mapdata.js overlays)
	local EFFECT_TEXT = {
		halvesGrowthFood = function()
			return "keeps half the food box when the city grows"
		end,
		growthPast10 = function()
			return "lets the city grow beyond population 10"
		end,
		veteranUnits = function()
			return "new units here start as veterans"
		end,
		defenseMultiplier = function(v)
			return ("defenders x%d against attacks"):format(v)
		end,
		taxBonus = function(v)
			return ("+%d%% gold in this city"):format(v)
		end,
		sciBonus = function(v)
			return ("+%d%% science in this city"):format(v)
		end,
		luxBonus = function(v)
			return ("+%d%% luxuries in this city"):format(v)
		end,
		contentBonus = function(v)
			return ("calms %d unhappy citizen%s"):format(v, v > 1 and "s" or "")
		end,
		contentDoubleTech = function(v)
			return ("doubled once you know %s"):format(techs[v].name)
		end,
		corruptionReduction = function(v)
			return ("-%d%% corruption in this city"):format(v)
		end,
		shieldBonus = function(v)
			return ("+%d%% shields in this city"):format(v)
		end,
		boostsFactory = function()
			return "doubles the Factory bonus here"
		end,
		isPalace = function()
			return "your capital - no corruption at the seat of power"
		end,
		contentEverywhere = function(v)
			return ("%d content citizen%s in every city"):format(v, v > 1 and "s" or "")
		end,
		happyEverywhere = function(v)
			return ("%d happy citizen%s in every city"):format(v, v > 1 and "s" or "")
		end,
		allContentInCity = function()
			return "everyone in this city stays content"
		end,
		doublesTemple = function()
			return "your Temples work twice as hard"
		end,
		cityTradeBonus = function()
			return "+1 trade on every trade tile here"
		end,
		wallsEverywhere = function()
			return "city walls in all your cities"
		end,
	}

	local function effectText(def)
		local parts = {}
		for key, value in pairs(def.effect or {}) do
			local render = EFFECT_TEXT[key]
			if render ~= nil then
				table.insert(parts, render(value))
			end
		end
		table.sort(parts) -- pairs() order is unstable; sorted = repaint-stable
		if def.obsoleteBy ~= nil and def.obsoleteBy ~= "" then
			table.insert(parts, ("obsolete with %s"):format(techs[def.obsoleteBy].name))
		end
		return table.concat(parts, " - ")
	end

	-- tech id -> what it unlocks / which techs need it (R19 pedia sublines;
	-- byte-shaped with catalog-text.js — wonderMark omitted: Roblox text
	-- stays emoji-free, the one flagged divergence)
	local techUnlocks = {}
	local techLeadsTo = {}
	local function add(map, key, name)
		if map[key] == nil then
			map[key] = {}
		end
		table.insert(map[key], name)
	end
	for id, def in pairs(ruleset.units) do
		if def.tech ~= nil and def.tech ~= "" then
			add(techUnlocks, def.tech, def.name)
		end
	end
	for id, def in pairs(ruleset.buildings) do
		if def.tech ~= nil and def.tech ~= "" then
			add(techUnlocks, def.tech, def.name)
		end
	end
	for id, def in pairs(ruleset.wonders) do
		if def.tech ~= nil and def.tech ~= "" then
			add(techUnlocks, def.tech, def.name)
		end
	end
	for id, def in pairs(techs) do
		for _, p in ipairs(def.prereqs or {}) do
			add(techLeadsTo, p, def.name)
		end
	end
	for _, map in ipairs({ techUnlocks, techLeadsTo }) do
		for _, list in pairs(map) do
			table.sort(list) -- pairs() order is unstable; sorted = stable text
		end
	end

	return { effectText = effectText, EFFECT_TEXT = EFFECT_TEXT,
		techUnlocks = techUnlocks, techLeadsTo = techLeadsTo }
end

return M
