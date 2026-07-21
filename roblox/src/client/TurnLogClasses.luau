-- SO6: the turn-log filter-class mapping — a 1:1 port of client/ui/turnlog-classes.js
-- (A39). Pure event → class id, kept logic-only so gate 22 pins it against the
-- browser. Classes mirror the filter strip: combat · cities · research · rival ·
-- saves · regent — plus 'world', which has NO toggle by design (rare +
-- load-bearing: wonders, eliminations, barbarian uprisings, war/peace always
-- show). nil = the log does not narrate this event type as a filterable row
-- (the Roblox log renders it under 'world' so nothing narrated is ever hidden).
local M = {}

M.LOG_CLASSES = {
	{ id = "combat", label = "⚔ combat" },
	{ id = "cities", label = "🏛 cities" },
	{ id = "research", label = "🔬 research" },
	{ id = "rival", label = "👀 rivals" },
	{ id = "saves", label = "💾 saves" },
	{ id = "regent", label = "🤖 regent" },
}

-- viewer: the viewpoint pid; cityOwner(cityId) -> pid|nil resolves city events
-- (a plain lookup the caller provides, so this stays pure).
function M.classifyEvent(e, viewer, cityOwner)
	local t = e.type
	if t == "combatResolved" then
		return (e.attackerOwner == viewer or e.defenderOwner == viewer) and "combat" or "rival"
	elseif t == "cityCaptured" then
		return (e.from == viewer or e.to == viewer) and "cities" or "rival"
	elseif t == "cityFounded" or t == "cityGrew" or t == "cityStarved"
		or t == "unitBuilt" or t == "buildingBuilt"
		or t == "cityDisorder" or t == "cityOrderRestored" then
		return cityOwner(e.cityId) == viewer and "cities" or "rival"
	elseif t == "improvementBuilt" then
		return e.owner == viewer and "cities" or "rival"
	elseif t == "buildingSold" then
		return e.playerId == viewer and "cities" or nil
	elseif t == "wonderHelped" then
		return e.playerId == viewer and "cities" or nil
	elseif t == "unitLoaded" or t == "unitUnloaded" or t == "cargoLost"
		or t == "airCrashed" or t == "unitConsumed" then
		return e.owner == viewer and "combat" or nil
	elseif t == "revolutionStarted" or t == "governmentChanged" then
		return e.playerId == viewer and "cities" or "rival"
	elseif t == "techDiscovered" then
		return e.playerId == viewer and "research" or nil
	elseif t == "ssPartBuilt" then
		return e.playerId == viewer and "cities" or nil
	elseif t == "tradeRouteEstablished" then
		return e.playerId == viewer and "cities" or nil
	elseif t == "unitUpgraded" then
		return e.playerId == viewer and "cities" or nil
	elseif t == "debugCommand" then
		return "world"
	elseif t == "hutEntered" then
		return e.playerId == viewer and "cities" or nil
	elseif t == "ransomPaid" then
		return e.playerId == viewer and "combat" or nil
	elseif t == "playerDefeated" or t == "wonderBuilt" or t == "wonderLost"
		or t == "barbariansSpawned" or t == "gameOver" or t == "ageChanged"
		or t == "shipLaunched" or t == "shipDestroyed" or t == "spaceVictory"
		or t == "WAR_DECLARED" or t == "PEACE_TREATY_SIGNED" or t == "TREATY_BROKEN"
		or t == "FIRST_CONTACT" then
		return "world"
	elseif t == "saveCode" then
		return "saves"
	elseif t == "regentTurn" then
		return "regent"
	end
	return nil
end

return M
