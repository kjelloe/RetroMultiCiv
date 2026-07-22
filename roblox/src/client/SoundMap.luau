-- SO15 sound design (A77): the pure event -> SOUND-ID map, a 1:1 twin of the
-- browser client/ui/sound-map.js. DECISION only (which cue an event earns, from
-- the viewer's vantage — combat WINS triumphant, LOSSES sad); the Sound.client
-- player turns the id into audio. Kept pure (no Sound/Instance) so it mirrors
-- turnlog-classes.js the same way and gate 27 pins parity. null/nil = silent.
-- `cityOwner(cityId) -> pid|nil` resolves city events (the lookup TurnLog's
-- classifyEvent already provides). SoundIds are curated in Sound.client.
local M = {}

function M.soundForEvent(e, viewer, cityOwner)
	local t = e.type
	if t == "combatResolved" then
		local iWon = (e.winner == "attacker" and e.attackerOwner == viewer)
			or (e.winner == "defender" and e.defenderOwner == viewer)
		local iLost = (e.winner == "attacker" and e.defenderOwner == viewer)
			or (e.winner == "defender" and e.attackerOwner == viewer)
		if iWon then return "combat-win" end
		if iLost then return "combat-loss" end
		return "combat-distant"
	elseif t == "cityCaptured" then
		if e.to == viewer then return "capture-win" end
		if e.from == viewer then return "capture-loss" end
		return "capture-distant"
	elseif t == "cityFounded" then
		return cityOwner(e.cityId) == viewer and "found" or nil
	elseif t == "cityGrew" then
		return cityOwner(e.cityId) == viewer and "grow" or nil
	elseif t == "cityStarved" then
		return cityOwner(e.cityId) == viewer and "starve" or nil
	elseif t == "buildingBuilt" then
		return cityOwner(e.cityId) == viewer and "build" or nil
	elseif t == "cityDisorder" then
		return cityOwner(e.cityId) == viewer and "disorder" or nil
	elseif t == "cityOrderRestored" then
		return cityOwner(e.cityId) == viewer and "order" or nil
	elseif t == "techDiscovered" then
		return e.playerId == viewer and "tech" or nil
	elseif t == "wonderBuilt" then
		return "wonder" -- world news — Civ 1 announces wonders to everyone
	elseif t == "ageChanged" then
		return "age"
	elseif t == "playerDefeated" then
		return e.playerId == viewer and "defeat" or "elimination"
	elseif t == "barbariansSpawned" then
		return "barbarian"
	elseif t == "gameOver" then
		return e.winner == viewer and "victory" or "gameover"
	elseif t == "governmentChanged" then
		return e.playerId == viewer and "government" or nil
	elseif t == "regentTurn" then
		return "regent"
	elseif t == "ssPartBuilt" then
		return e.playerId == viewer and "ship-part" or nil
	elseif t == "shipLaunched" then
		return "ship-launch"
	elseif t == "shipDestroyed" then
		return "ship-down"
	elseif t == "spaceVictory" then
		return nil -- silent by design: the paired gameOver carries the cue
	elseif t == "tradeRouteEstablished" then
		return e.playerId == viewer and "build" or nil
	elseif t == "unitUpgraded" then
		return e.playerId == viewer and "build" or nil
	elseif t == "debugCommand" then
		return nil
	elseif t == "hutEntered" then
		return e.playerId == viewer and "found" or nil
	elseif t == "ransomPaid" then
		return e.playerId == viewer and "combat-win" or nil
	elseif t == "WAR_DECLARED" or t == "PEACE_TREATY_SIGNED"
		or t == "TREATY_BROKEN" or t == "FIRST_CONTACT" then
		return nil -- D2 presentation pass owns these cues (explicit silent)
	end
	return nil -- most events (moves, production set, rates) are silent
end

-- the catalogue of every cue the map can emit — the contract Sound.client must
-- cover and gate 27 pins against sound-map.js SOUND_IDS.
M.SOUND_IDS = {
	"combat-win", "combat-loss", "combat-distant",
	"capture-win", "capture-loss", "capture-distant",
	"found", "grow", "starve", "build", "disorder", "order",
	"tech", "wonder", "wonder-triumph", "age", "defeat", "elimination", "barbarian",
	"victory", "gameover", "government", "regent",
	"ship-part", "ship-launch", "ship-down",
	-- XIV §26: era-specific tech-discovery fanfares (played by the celebration
	-- overlay via the era upgrade, not soundForEvent; catalogued for parity)
	"discovery-ancient", "discovery-classical", "discovery-industrial", "discovery-modern",
}

return M
