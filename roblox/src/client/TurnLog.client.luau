-- R6: the turn log (roblox/SPEC.md §3g, docs/13 Tier-1 row). Client half of
-- the two-part item: the server now collects every round event (the
-- eventsOut=nil fix) and pushes them fog-filtered; this narrates them. All
-- text is display-only, built from the view and the baked ruleset tables —
-- events arrive pre-filtered, so fog is respected by construction.
-- Collapsible bottom-left panel; L toggles it (chat-focus guarded).

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local MAX_ROWS = 150

local gui = Instance.new("ScreenGui")
gui.Name = "RMCTurnLog"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local toggle = Instance.new("TextButton")
toggle.Name = "Toggle"
toggle.Size = UDim2.new(0, 190, 0, 40)
toggle.Position = UDim2.new(0, 8, 1, -32)
toggle.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
toggle.BackgroundTransparency = 0.25
toggle.TextColor3 = Color3.fromRGB(235, 235, 235)
toggle.Font = Enum.Font.Code
toggle.TextSize = 18
toggle.TextXAlignment = Enum.TextXAlignment.Left
toggle.Text = "  Turn log (L)"
toggle.Parent = gui
do -- session-E: big rounded buttons (CLOSE CITY VIEW as the template)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = toggle
end

local panel = Instance.new("Frame")
panel.Name = "Panel"
panel.Size = UDim2.new(0, 400, 0, 220)
panel.Position = UDim2.new(0, 8, 1, -260)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.15
panel.BorderSizePixel = 0
panel.Visible = false
panel.Parent = gui

local list = Instance.new("ScrollingFrame")
list.Size = UDim2.new(1, -8, 1, -8)
list.Position = UDim2.new(0, 4, 0, 4)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 6
list.Parent = panel
local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 1)
layout.Parent = list

local COLORS = {
	win = Color3.fromRGB(150, 230, 150),
	loss = Color3.fromRGB(235, 140, 130),
	rival = Color3.fromRGB(160, 170, 190),
	world = Color3.fromRGB(230, 210, 140),
	[""] = Color3.fromRGB(225, 225, 225),
}

local rowCount = 0
local unseen = 0

local function put(turn, text, cls)
	rowCount += 1
	local row = Instance.new("TextLabel")
	row.Size = UDim2.new(1, -8, 0, 16)
	row.LayoutOrder = rowCount
	row.BackgroundTransparency = 1
	row.TextColor3 = COLORS[cls or ""] or COLORS[""]
	row.Font = Enum.Font.Code
	row.TextSize = 13
	row.TextXAlignment = Enum.TextXAlignment.Left
	row.TextTruncate = Enum.TextTruncate.AtEnd
	row.Text = ("T%d %s"):format(turn, text)
	row.Parent = list
	local kids = list:GetChildren()
	if #kids > MAX_ROWS + 1 then -- +1: the UIListLayout
		for _, child in ipairs(kids) do
			if child:IsA("TextLabel") then
				child:Destroy()
				break
			end
		end
	end
	list.CanvasSize = UDim2.new(0, 0, 0, math.min(rowCount, MAX_ROWS) * 17)
	list.CanvasPosition = Vector2.new(0, math.max(0, list.CanvasSize.Y.Offset - list.AbsoluteSize.Y))
	if not panel.Visible then
		unseen += 1
		toggle.Text = ("  Turn log (L) — %d new"):format(unseen)
	end
end

local function playerName(view, pid)
	local p = view.players[pid]
	return p and p.name or tostring(pid)
end

local function cityName(view, cityId)
	local c = view.cities[cityId]
	return c and c.name or nil
end

local function ownCity(view, cityId)
	local c = view.cities[cityId]
	return c ~= nil and c.owner == view.you
end

-- one event -> zero or one log line (the browser turnlog.js narration,
-- reduced to the view's vocabulary; nil = not narrated)
local function narrate(view, e, rs)
	local you = view.you
	if e.type == "combatResolved" then
		local att = ("%s %s"):format(playerName(view, e.attackerOwner), rs.units[e.attackerType].name)
		local def = ("%s %s"):format(playerName(view, e.defenderOwner), rs.units[e.defenderType].name)
		local mine = e.attackerOwner == you or e.defenderOwner == you
		if not mine then
			local text = e.winner == "attacker" and (att .. " defeated " .. def) or (def .. " repelled " .. att)
			return ("[rival] %s at (%d,%d)"):format(text, e.x, e.y), "rival"
		end
		if e.winner == "attacker" then
			local extra = (e.unitsLost or 1) > 1 and (" - whole stack lost (%d)"):format(e.unitsLost) or ""
			return ("[war] %s defeated %s at (%d,%d)%s"):format(att, def, e.x, e.y, extra),
				e.attackerOwner == you and "win" or "loss"
		end
		return ("[war] %s repelled %s at (%d,%d)"):format(def, att, e.x, e.y),
			e.defenderOwner == you and "win" or "loss"
	elseif e.type == "cityCaptured" then
		local name = cityName(view, e.cityId) or e.cityId
		if e.from == you or e.to == you then
			return ("[city] %s captured by %s (+%d gold plundered)"):format(name, playerName(view, e.to), e.plunder or 0),
				e.to == you and "win" or "loss"
		end
		return ("[rival] %s captured %s"):format(playerName(view, e.to), name), "rival"
	elseif e.type == "playerDefeated" then
		return ("[world] %s eliminated"):format(playerName(view, e.playerId)), e.playerId == you and "loss" or "win"
	elseif e.type == "barbariansSpawned" then
		return "[world] barbarian uprising reported in the wilds", "world"
	elseif e.type == "ageChanged" then
		return ("[world] the world enters a new age: %s"):format(e.age), "world"
	elseif e.type == "cityFounded" then
		local c = view.cities[e.cityId]
		if c == nil then
			return nil
		end
		if c.owner == you then
			return ("[city] %s founded"):format(c.name), "win"
		end
		return ("[rival] %s founded %s"):format(playerName(view, c.owner), c.name), "rival"
	elseif e.type == "cityGrew" and ownCity(view, e.cityId) then
		return ("[city] %s grows to population %d"):format(cityName(view, e.cityId), e.pop), "win"
	elseif e.type == "cityStarved" and ownCity(view, e.cityId) then
		return ("[city] famine in %s - population %d"):format(cityName(view, e.cityId), e.pop), "loss"
	elseif e.type == "unitBuilt" and ownCity(view, e.cityId) then
		return ("[city] %s completed %s"):format(cityName(view, e.cityId), rs.units[e.unitType].name), ""
	elseif e.type == "buildingBuilt" and ownCity(view, e.cityId) then
		return ("[city] %s completed %s"):format(cityName(view, e.cityId), rs.buildings[e.building].name), ""
	elseif e.type == "wonderBuilt" then
		local mine = ownCity(view, e.cityId)
		local c = view.cities[e.cityId]
		local where = mine and c.name or (c and ("a %s city"):format(playerName(view, c.owner)) or "a distant city")
		return ("[world] %s completed in %s"):format(rs.wonders[e.wonder].name, where), mine and "win" or "loss"
	elseif e.type == "wonderLost" and ownCity(view, e.cityId) then
		return ("[city] %s lost the race for %s (shields kept)"):format(cityName(view, e.cityId), rs.wonders[e.wonder].name), "loss"
	elseif e.type == "improvementBuilt" and e.owner == you then
		local label = e.transformedTo ~= nil and ("terrain worked into " .. e.transformedTo)
			or ((e.work == "irrigate" and "irrigation" or e.work) .. " completed")
		return ("[work] %s at (%d,%d)"):format(label, e.x, e.y), "win"
	elseif e.type == "cityDisorder" and ownCity(view, e.cityId) then
		return ("[city] civil disorder in %s!"):format(cityName(view, e.cityId)), "loss"
	elseif e.type == "cityOrderRestored" and ownCity(view, e.cityId) then
		return ("[city] order restored in %s"):format(cityName(view, e.cityId)), "win"
	elseif e.type == "revolutionStarted" and e.playerId == you then
		local g = rs.governments[e.government]
		return ("[gov] revolution! anarchy until %s takes hold"):format(g and g.name or e.government), ""
	elseif e.type == "governmentChanged" and e.playerId == you then
		local g = rs.governments[e.government]
		return ("[gov] new government: %s"):format(g and g.name or e.government), "win"
	elseif e.type == "techDiscovered" and e.playerId == you then
		return ("[tech] %s discovered - press T to choose new research"):format(rs.techs[e.tech].name), "win"
	end
	return nil
end

ClientState.onEvents(function(events, view)
	local rs = ClientState.rulesets()
	for _, e in ipairs(events) do
		local ok, text, cls = pcall(narrate, view, e, rs)
		if ok and text ~= nil then
			put(view.turn, text, cls)
		elseif not ok then
			-- an unexpected event shape must never kill the log loop
			put(view.turn, "[?] " .. tostring(e.type), "rival")
		end
	end
end)

local function setOpen(open)
	panel.Visible = open
	if open then
		unseen = 0
		toggle.Text = "  Turn log (L)"
	end
end

toggle.Activated:Connect(function()
	setOpen(not panel.Visible)
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil then
		return
	end
	if input.KeyCode == Enum.KeyCode.L then
		setOpen(not panel.Visible)
	end
end)

print("[TurnLog] R6 turn log up (L toggles)")
