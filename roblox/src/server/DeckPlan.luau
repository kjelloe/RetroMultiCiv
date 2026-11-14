-- The observation deck's layout and copy as pure data (run-R, user: "stations
-- for the different actions available, with explanations on each"). Deck.luau
-- builds from this; roblox/selftest/deck-plan.luau pins it (check.sh gate 43).
-- No instances here.
local M = {}

M.FLOOR = { w = 76, d = 48 } -- studs; stations along the back edge, spawn at the front
M.STATION_Z = -12
M.SPAWN_Z = 10
M.PAD = 8

-- order = left to right along the back row, in the order a new player needs them
M.STATIONS = {
	{ id = "start", pad = "StartPad", x = -28, color = { 60, 130, 80 },
		title = "START A NEW GAME",
		text = "Become the host. Pick the map, the number of civilizations and the rules, then start the game." },
	{ id = "join", pad = "JoinPad", x = -14, color = { 60, 90, 150 },
		title = "JOIN GAME",
		text = "Take one of the host's player seats while the game is being set up." },
	{ id = "takeover", pad = "TakeoverPad", x = 0, color = { 150, 110, 50 },
		title = "TAKE OVER AI CIV",
		text = "Join a game that is already running: you take command of a computer-played civilization." },
	{ id = "spectate", pad = "SpectatePad", x = 14, color = { 110, 80, 150 },
		title = "SPECTATE",
		text = "Watch the running game from above. You see the whole world and play no seat." },
	{ id = "capitol", pad = "GotoCapitolPad", x = 28, color = { 150, 120, 60 },
		title = "GOTO CAPITOL",
		text = "For seated players: step here to drop from the deck to your own capital city." },
}

-- which stations a walk-on acts on in each lobby phase (the others explain
-- themselves on their sign and by a toast; none is ever switched off)
function M.live(phase, takeoverAvailable)
	if phase == "idle" then
		return { start = true }
	elseif phase == "setup" or phase == "starting" then
		return { join = true }
	elseif phase == "running" then
		return { takeover = takeoverAvailable == true, spectate = true, capitol = true }
	end
	return {}
end

local CLOSED = {
	start = { setup = "A game is being set up - use JOIN GAME.", starting = "A game is starting - use JOIN GAME.",
		running = "A game is running - take over an AI civ or spectate." },
	join = { idle = "No game yet - start one at the first station.",
		running = "The game has started - use TAKE OVER AI CIV." },
	takeover = { idle = "No game is running yet.", setup = "Opens once the game has started.",
		starting = "Opens once the game has started.", running = "No free AI civilization right now." },
	spectate = { idle = "No game is running yet.", setup = "Opens once the game has started.",
		starting = "Opens once the game has started." },
	capitol = { idle = "No game is running yet.", setup = "Opens once the game has started.",
		starting = "Opens once the game has started." },
}

-- -> open (bool), status line for the station's sign
function M.status(id, phase, takeoverAvailable)
	if M.live(phase, takeoverAvailable)[id] == true then
		return true, "OPEN - walk onto the pad"
	end
	local row = CLOSED[id]
	return false, (row ~= nil and row[phase]) or "Not available right now."
end

return M
