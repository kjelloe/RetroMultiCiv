-- R4: client-side session state (roblox/SPEC.md §3e). One module owns the
-- RemoteEvent channel and the latest VIEW — every client script reads from
-- here. The view is all the client ever knows (the visibility law): it comes
-- from the server's filterView and nothing else.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local remote = ReplicatedStorage:WaitForChild("RMC")

local M = {
	view = nil, -- filterView table: you/turn/year/activePlayer/map/units/cities/players
	playerId = nil,
	gameOver = false,
	selectedUnitId = nil,
	possessedUnitId = nil, -- R5: unit the avatar is riding (Possess.client.luau)
	followAvatar = false,
	TILE = 4, -- studs per tile edge (must match ViewRenderer)
	-- R7a (5)(7): Roblox flips both defaults ON for new users (docs/13
	-- run2 block — accepted divergence from the browser's opt-in)
	-- R16: browser-parity options (hideFuture wires into the city catalog
	-- when it unfreezes; clock = "off"|"elapsed"|"time"; voidArt drives
	-- VoidCover; ridePad nil = auto-detect, RidePad wires post-sweep)
	options = { autoNextUnit = true, autoEndTurn = true,
		hideFuture = false, hideNoMovesHint = false,
		clock = "off", voidArt = "frame", ridePad = nil,
		look = "retro", -- visual-fidelity toggle (#1100): retro|enhanced
		-- session-E: pick research after 2 idle turns (Options acts on it)
		autoResearch = true,
		discoveryCards = true, -- SO3: the tech-discovery card toggle
		adviceCards = true }, -- SO5: first-timer advice nudges
}

local viewCallbacks = {}
local cityOpenCallbacks = {}
local eventCallbacks = {} -- R6: filtered round events riding view pushes
local researchOpenCallbacks = {} -- R6: research picker open/toggle channel
local governmentOpenCallbacks = {} -- R12 (2): government panel open/toggle channel
local cityListToggleCallbacks = {} -- session-E round 18: the Cities button
local rejectedCallbacks = {} -- round 21: visible reject feedback (Hud)
local pediaOpenCallbacks = {} -- SO3: discovery-card deep links into Pedia
local endscreenCallbacks = {} -- SO7: the server's gameOver scoreboard frame
local historianCallbacks = {} -- SO9: age-change standings interstitial
local statsCallbacks = {} -- SO8: pulled score series replies
local possessCallbacks = {} -- R7a (9): ride-to-unit requests (Possess mounts)
local nextCommandId = 1

-- lazy client-side ruleset tables (R5 city panel): same baked JSON, same
-- json2lua parser as the server — read-only display data, never game logic
local rulesetCache = nil
function M.rulesets()
	if rulesetCache == nil then
		local json2lua = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("json2lua"))
		local folder = ReplicatedStorage:WaitForChild("GameData"):WaitForChild("rulesets")
		rulesetCache = {}
		for _, name in ipairs({ "units", "buildings", "wonders", "techs", "rules", "terrain", "governments" }) do
			rulesetCache[name] = json2lua.parse(require(folder:WaitForChild(name)))
		end
	end
	return rulesetCache
end

function M.onCityOpen(cb)
	table.insert(cityOpenCallbacks, cb)
end

function M.openCity(cityId)
	for _, cb in ipairs(cityOpenCallbacks) do
		cb(cityId)
	end
end

function M.onEvents(cb)
	table.insert(eventCallbacks, cb)
end

function M.onPossessRequest(cb)
	table.insert(possessCallbacks, cb)
end

-- R7d: camera focus-jump channel (city list rows etc. -> Camera listens)
local cameraFocusCallbacks = {}
function M.onCameraFocus(cb)
	table.insert(cameraFocusCallbacks, cb)
end

function M.focusCamera(x, y)
	for _, cb in ipairs(cameraFocusCallbacks) do
		cb(x, y)
	end
end

function M.requestPossess(unitId)
	for _, cb in ipairs(possessCallbacks) do
		cb(unitId)
	end
end

-- wrap-aware Chebyshev tile distance (client-side pick order only)
function M.wrapDist(x1, y1, x2, y2)
	local view = M.view
	local dx = math.abs(x1 - x2)
	if view ~= nil and view.map.wrapX and dx > view.map.width / 2 then
		dx = view.map.width - dx
	end
	return math.max(dx, math.abs(y1 - y2))
end

-- R7a (12)(15): next own idle unit — input.js:255 semantics: skip fortified
-- and working units (they stay reachable by hand-click), NEAREST first from
-- the anchor unit so the camera glides instead of teleporting
-- session-E round 19 (user): a unit standing in an OWN CITY is a garrison —
-- it never auto-cycles (N / auto-next) and never blocks End Turn ("N can
-- move!"); an explicit click (or ride) still selects it as before.
function M.isGarrisoned(u)
	local view = M.view
	if view == nil or u == nil then
		return false
	end
	for _, c in pairs(view.cities) do
		if c.owner == M.playerId and c.x == u.x and c.y == u.y then
			return true
		end
	end
	return false
end

function M.nextOwnUnit(excludeId)
	local view = M.view
	if view == nil then
		return nil
	end
	local movable = {}
	for id, u in pairs(view.units) do
		if u.owner == view.you and u.moves > 0 and u.fortified ~= true
			and u.working == nil and id ~= excludeId
			and not M.isGarrisoned(u) then -- round 19: garrisons sit out
			table.insert(movable, u)
		end
	end
	if #movable == 0 then
		-- session-E round 10 (user bug report): if the ONLY movable unit is
		-- the current one, return it — otherwise N reports "no units with
		-- moves left" while End Turn correctly warns "1 can move"
		local cur = excludeId ~= nil and view.units[excludeId] or nil
		if cur ~= nil and cur.owner == view.you and cur.moves > 0
			and cur.fortified ~= true and cur.working == nil
			and not M.isGarrisoned(cur) then
			return excludeId
		end
		return nil
	end
	table.sort(movable, function(a, b)
		return a.id < b.id
	end)
	local anchorId = M.possessedUnitId or M.selectedUnitId
	local anchor = anchorId and view.units[anchorId]
	local pick = movable[1]
	if anchor ~= nil then
		local best = math.huge
		for _, u in ipairs(movable) do
			local d = M.wrapDist(u.x, u.y, anchor.x, anchor.y)
			if d < best then
				best = d
				pick = u
			end
		end
	end
	return pick.id
end

function M.onResearchOpen(cb)
	table.insert(researchOpenCallbacks, cb)
end

function M.openResearch()
	for _, cb in ipairs(researchOpenCallbacks) do
		cb()
	end
end

function M.onRejected(cb)
	table.insert(rejectedCallbacks, cb)
end

function M.onStats(cb)
	table.insert(statsCallbacks, cb)
end

function M.requestStats()
	remote:FireServer({ t = "stats" }) -- SO8: pull-only by ruling
end

function M.onHistorian(cb)
	table.insert(historianCallbacks, cb)
end

function M.onEndscreen(cb)
	table.insert(endscreenCallbacks, cb)
	if M.endscreen ~= nil then
		cb(M.endscreen)
	end
end

function M.onPediaOpen(cb)
	table.insert(pediaOpenCallbacks, cb)
end

function M.openPedia(cat, id)
	for _, cb in ipairs(pediaOpenCallbacks) do
		cb(cat, id)
	end
end

function M.onCityListToggle(cb)
	table.insert(cityListToggleCallbacks, cb)
end

function M.toggleCityList()
	for _, cb in ipairs(cityListToggleCallbacks) do
		cb()
	end
end

function M.onGovernmentOpen(cb)
	table.insert(governmentOpenCallbacks, cb)
end

function M.openGovernment()
	for _, cb in ipairs(governmentOpenCallbacks) do
		cb()
	end
end

function M.onView(cb)
	table.insert(viewCallbacks, cb)
	if M.view ~= nil then
		cb(M.view)
	end
end

function M.send(cmdTable)
	local id = nextCommandId
	nextCommandId += 1
	M.lastActivity = os.clock() -- R22: any command counts as activity
	remote:FireServer({ t = "cmd", commandId = id, cmd = cmdTable })
	return id
end

-- R22: AI-regency away state. Server-authoritative — M.away flips only on
-- the server's ack; Hud owns the toggle icon + idle countdown.
M.away = false
M.maxIdleMin = 1
M.lastActivity = os.clock()

function M.setAway(on)
	remote:FireServer({ t = "away", on = on == true })
end

function M.myTurn()
	return M.view ~= nil and M.view.activePlayer == M.playerId
end

-- own unit standing on tile (x, y), if any — reads the VIEW only
function M.ownUnitAt(x, y)
	if M.view == nil then
		return nil
	end
	for id, u in pairs(M.view.units) do
		if u.x == x and u.y == y and u.owner == M.playerId then
			return u
		end
	end
	return nil
end

remote.OnClientEvent:Connect(function(msg)
	if typeof(msg) ~= "table" then
		return
	end
	if msg.t == "joined" then
		M.playerId = msg.playerId
		print(("[Client] joined as %s (turn %d, %s active)"):format(msg.playerId, msg.turn, msg.activePlayer))
	end
	if msg.t == "stats" then
		for _, cb in ipairs(statsCallbacks) do
			cb(msg.series or {})
		end
	end
	if msg.t == "historian" then
		for _, cb in ipairs(historianCallbacks) do
			cb(msg)
		end
	end
	if msg.t == "endscreen" then
		-- SO7: server-computed scoreboard (full state; post-game = public)
		M.endscreen = msg
		for _, cb in ipairs(endscreenCallbacks) do
			cb(msg)
		end
	end
	if msg.t == "saved" then
		-- R23: rolling autosave landed; Hud shows the latest resumable code
		M.lastSave = { code = msg.code, turn = msg.turn }
		print(("[Client] autosaved at turn %d - resume code %s"):format(msg.turn, msg.code))
	end
	if msg.t == "away" then
		-- R22: server ack for regency hand-over/reclaim; reset the idle clock
		-- so a fresh countdown never fires the moment a seat is taken back
		M.away = msg.on == true
		M.lastActivity = os.clock()
		print("[Client] AI regency " .. (M.away and "ON (regent plays your seat)" or "OFF (your seat)"))
	end
	if msg.t == "joined" or msg.t == "view" then
		M.view = msg.view
		M.gameOver = msg.gameOver == true
		if msg.code ~= nil then
			M.code = msg.code -- R7d: the docs/07 game verification code
		end
		if msg.maxIdleMin ~= nil then
			M.maxIdleMin = msg.maxIdleMin -- R22: host knob rides the push
		end
		if msg.away ~= nil then
			M.away = msg.away == true
		end
		M.debugUsed = msg.debugUsed == true -- R17 taint chip
		if M.selectedUnitId ~= nil and M.view.units[M.selectedUnitId] == nil then
			M.selectedUnitId = nil -- unit died or left our sight
		end
		if M.possessedUnitId ~= nil and M.view.units[M.possessedUnitId] == nil then
			M.possessedUnitId = nil -- ridden unit died; Possess handles the dismount
		end
		for _, cb in ipairs(viewCallbacks) do
			cb(M.view)
		end
		if msg.events ~= nil and #msg.events > 0 then
			for _, cb in ipairs(eventCallbacks) do
				cb(msg.events, M.view)
			end
		end
	elseif msg.t == "rejected" then
		print(("[Client] rejected (commandId %s): %s"):format(tostring(msg.commandId), tostring(msg.code)))
		for _, cb in ipairs(rejectedCallbacks) do
			-- round 21: Hud shows the red banner; CP8: BuildQueue correlates
			-- its own pending commandId to try the next queued item
			cb(tostring(msg.code), msg.commandId)
		end
	end
end)

remote:FireServer({ t = "join" })

return M
