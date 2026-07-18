-- CP8 (catalog row; browser C3 twin, client/ui/build-queue.js): the per-city
-- BUILD QUEUE — an ordered CLIENT-SIDE list of build targets; when
-- production completes in an own city, the head is issued as an ordinary
-- setProduction (a logged command, replay-exact by construction; A54's
-- off-turn whitelist makes it land immediately on the completion event).
-- SESSION-LOCAL storage: Roblox has no localStorage — a rejoin drops the
-- queues (convenience, not rules — the browser spec's sentry clause).
-- A rejected head (obsoleted unit, built building, wonder built elsewhere)
-- is dropped and the next tried, correlated by commandId.

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local M = {}

local queues = {} -- cityId -> array of { kind, id }
local pending = {} -- commandId -> cityId (rejection advances to the next item)
local changedCbs = {}

local COMPLETION = { unitBuilt = true, buildingBuilt = true, wonderBuilt = true, ssPartBuilt = true }

function M.onChanged(cb)
	table.insert(changedCbs, cb)
end

local function fireChanged()
	for _, cb in ipairs(changedCbs) do
		cb()
	end
end

function M.get(cityId)
	return queues[cityId] or {}
end

function M.add(cityId, kind, id)
	local q = queues[cityId] or {}
	table.insert(q, { kind = kind, id = id })
	queues[cityId] = q
	fireChanged()
end

function M.removeAt(cityId, idx)
	local q = queues[cityId]
	if q ~= nil and q[idx] ~= nil then
		table.remove(q, idx)
		if #q == 0 then
			queues[cityId] = nil
		end
		fireChanged()
	end
end

local function advance(cityId)
	local q = queues[cityId]
	local view = ClientState.view
	if q == nil or #q == 0 or view == nil then
		return
	end
	local city = view.cities[cityId]
	if city == nil or city.owner ~= view.you then
		queues[cityId] = nil -- lost/razed city: the queue dies with it
		fireChanged()
		return
	end
	local head = q[1]
	M.removeAt(cityId, 1)
	local cmdId = ClientState.send({ type = "setProduction", cityId = cityId,
		item = { kind = head.kind, id = head.id } })
	pending[cmdId] = cityId
	print(("[BuildQueue] %s: queue starts %s %s"):format(city.name or cityId, head.kind, head.id))
end

ClientState.onEvents(function(events, view)
	for _, e in ipairs(events) do
		if COMPLETION[e.type] == true and e.cityId ~= nil then
			local city = view ~= nil and view.cities[e.cityId] or nil
			if city ~= nil and city.owner == view.you and #M.get(e.cityId) > 0 then
				advance(e.cityId)
			end
		end
	end
end)

ClientState.onRejected(function(code, commandId)
	local cityId = commandId ~= nil and pending[commandId] or nil
	if cityId ~= nil then
		pending[commandId] = nil
		print("[BuildQueue] queued item rejected (" .. code .. ") - trying the next")
		advance(cityId)
	end
end)

print("[BuildQueue] CP8 per-city build queue up (Q+ on catalog rows)")

return M
