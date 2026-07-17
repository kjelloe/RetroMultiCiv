-- Run-4 item 2 (user live ruling: ONE COMMON PLATE): the action pads are
-- flush tiles ON THE DECK (Deck.luau builds them server-side alongside the
-- spawn plate — same horizontal plane). This client binds Touched on those
-- shared tiles: stepping on a pad fires the action for YOUR selected unit
-- (same commands the menus send; the server judges). Pads that don't apply
-- to your current selection dim CLIENT-SIDE via LocalTransparencyModifier.
-- Menus stay for now; pads are the primary model (removal = user call).

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local deckFolder = workspace:WaitForChild("ObservationDeck")
local padsFolder = deckFolder:WaitForChild("ActionPads")

local function ownCityCount(view)
	local n = 0
	for _, c in pairs(view.cities) do
		if c.owner == view.you then
			n += 1
		end
	end
	return n
end

local function selectedUnit()
	local view = ClientState.view
	local id = ClientState.selectedUnitId
	local u = view ~= nil and id ~= nil and view.units[id] or nil
	if u ~= nil and u.owner == view.you then
		return u
	end
	return nil
end

-- applicability mirrors ActionBar's view-side prechecks, minimal form
local function applies(name)
	if not ClientState.myTurn() then
		return false
	end
	if name == "endturn" then
		return true
	end
	local u = selectedUnit()
	if u == nil then
		return false
	end
	if name == "fortify" or name == "wait" then
		return u.moves > 0 and u.fortified ~= true
	end
	-- settlers jobs
	if u.type ~= "settlers" or u.moves <= 0 then
		return false
	end
	return true -- found / irrigate / mine / road (server judges terrain)
end

local lastFire = 0
local function fire(name)
	if os.clock() - lastFire < 0.6 then
		return -- stride debounce: one pad per step
	end
	lastFire = os.clock()
	if not applies(name) then
		return
	end
	if name == "endturn" then
		print("[ActionPads] end turn (pad)")
		ClientState.send({ type = "endTurn" })
		return
	end
	local u = selectedUnit()
	if name == "found" then
		local cityName = "Colony " .. (ownCityCount(ClientState.view) + 1)
		print(("[ActionPads] found '%s' via pad (%s)"):format(cityName, u.id))
		ClientState.send({ type = "foundCity", unitId = u.id, name = cityName })
	elseif name == "fortify" or name == "wait" then
		print(("[ActionPads] %s via pad (%s)"):format(name, u.id))
		ClientState.send({ type = name, unitId = u.id })
	else -- irrigate / mine / road
		print(("[ActionPads] startWork %s via pad (%s)"):format(name, u.id))
		ClientState.send({ type = "startWork", unitId = u.id, work = name })
	end
end

for _, tile in ipairs(padsFolder:GetChildren()) do
	if tile:IsA("BasePart") then
		local name = tile.Name:gsub("^Pad_", "")
		tile.Touched:Connect(function(hit)
			local character = Players.LocalPlayer.Character
			if character ~= nil and hit:IsDescendantOf(character) then
				fire(name)
			end
		end)
	end
end

-- dim pads that don't apply to your selection (client-side only)
local lastKey = nil
RunService.Heartbeat:Connect(function()
	local u = selectedUnit()
	local key = tostring(u and u.id) .. "|" .. tostring(u and u.moves) .. "|"
		.. tostring(u and u.type) .. "|" .. tostring(ClientState.myTurn())
	if key == lastKey then
		return
	end
	lastKey = key
	for _, tile in ipairs(padsFolder:GetChildren()) do
		if tile:IsA("BasePart") then
			local name = tile.Name:gsub("^Pad_", "")
			tile.LocalTransparencyModifier = applies(name) and 0 or 0.75
		end
	end
end)

print("[ActionPads] deck action strip bound (step on a pad to act on the selected unit)")
