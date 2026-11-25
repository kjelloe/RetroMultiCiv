-- The civilization card at game start (info-19, plan R6.1; the browser's
-- discovery-card.js showCivIntro): "You lead the ...", the leader and the
-- stance their personality reads as, and the people's strength. Pure;
-- roblox/selftest/civ-intro.luau, gate 77.
local M = {}

M.KICKER = "A NEW WORLD BEGINS"
M.STRENGTH = "YOUR PEOPLE'S STRENGTH"
M.BEGIN = "Begin your reign"
-- the browser's LEADER_STANCE_PHRASE
M.PHRASE = {
	aggressive = "an aggressive leader who favors conquest",
	science = "a scholarly leader who favors research",
	growth = "an expansionist leader who favors growth and settlement",
	defensive = "a cautious leader who favors strong defenses",
	balanced = "a balanced, even-handed leader",
}

-- civ = the civs.json row; stance = leaders.stanceFromPersonality (or nil)
function M.card(civ, stance, units)
	local sp = civ.specialty or {}
	local unit = sp.unit ~= nil and units ~= nil and units[sp.unit] ~= nil and sp.unit or nil
	return {
		kicker = M.KICKER,
		name = "You lead the " .. tostring(civ.name),
		blurb = ("%s - %s."):format(civ.leader or "your ruler", M.PHRASE[stance or "balanced"] or M.PHRASE.balanced),
		strengthHead = M.STRENGTH,
		strength = sp.blurb or "a resourceful people",
		unit = unit,
		unitName = unit ~= nil and units[unit].name or nil,
		color = (civ.visual ~= nil and civ.visual.primary) or civ.color or "#8fa8cc",
		secondary = civ.visual ~= nil and civ.visual.secondary or nil,
	}
end

-- once per game start: turn 0 or 1, game running, the player's own seat
function M.shouldShow(view, shown, away)
	if shown or away or view == nil or view.gameOver == true or (view.turn or 0) > 1 then
		return false
	end
	local me = view.players ~= nil and view.players[view.you] or nil
	return me ~= nil and me.civ ~= nil
end

return M
