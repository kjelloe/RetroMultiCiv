-- R4: tile selection + the minimal action surface (roblox/SPEC.md §3e).
-- Picking stays LOGICAL (A28: hit POSITION rounded to tile, never the hit
-- body; 0.05 normal nudge; 5px click-vs-drag threshold shares LMB with the
-- camera). Everything printed or acted on comes from ClientState.view — the
-- filtered view is all this script can see, so fog is respected by
-- construction. Actions: click own unit = select; click adjacent tile with a
-- selection = moveUnit (dir-based, wrap-aware); B = found city (settlers);
-- Return = end turn.

local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ClientState = require(script.Parent:WaitForChild("ClientState"))
local GoToPlan = require(script.Parent:WaitForChild("GoToPlan")) -- R14
local citiesModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("cities")) -- runI item 16: tileYields

local TILE = ClientState.TILE
local camera = workspace.CurrentCamera
local world = workspace:WaitForChild("ClientWorld")

local DIR_BY_DELTA = {
	["0,-1"] = "N", ["1,-1"] = "NE", ["1,0"] = "E", ["1,1"] = "SE",
	["0,1"] = "S", ["-1,1"] = "SW", ["-1,0"] = "W", ["-1,-1"] = "NW",
}

local cursor = Instance.new("Part")
cursor.Name = "TileCursor"
cursor.Anchored = true
cursor.CanCollide = false
cursor.CanQuery = false
cursor.Size = Vector3.new(TILE, 0.4, TILE)
cursor.Material = Enum.Material.Neon
cursor.Color = Color3.fromRGB(255, 220, 60)
cursor.Transparency = 0.45
cursor.Parent = world

-- runI item 16: the tile info card — clicking a KNOWN tile shows a small card
-- ABOVE the unit action bar with terrain, yields as ICONS (item 17 vocabulary),
-- improvements, and the special's name; ENEMY units on the tile stack ABOVE it
-- as unit cards with a RED background. Fog-honest (reads only the filtered
-- view). One card at a time; any other pick, or the ×, dismisses it.
local SPECIAL_NAME = { ocean = "Fish", grassland = "Shield", plains = "Horse",
	forest = "Game", tundra = "Game", arctic = "Seal", desert = "Oasis",
	hills = "Coal", mountains = "Gold", jungle = "Gems", swamp = "Oil" }
local cardGui = Instance.new("ScreenGui")
cardGui.Name = "RMCTileCard"
cardGui.ResetOnSpawn = false
cardGui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")
local cardRoot = Instance.new("Frame")
cardRoot.Size = UDim2.new(0, 330, 0, 0)
cardRoot.AutomaticSize = Enum.AutomaticSize.Y
cardRoot.AnchorPoint = Vector2.new(0.5, 1)
cardRoot.Position = UDim2.new(0.5, 0, 1, -86) -- above the action bar
cardRoot.BackgroundTransparency = 1
cardRoot.Visible = false
cardRoot.Parent = cardGui
do
	local l = Instance.new("UIListLayout")
	l.SortOrder = Enum.SortOrder.LayoutOrder
	l.Padding = UDim.new(0, 4)
	l.HorizontalAlignment = Enum.HorizontalAlignment.Center
	l.Parent = cardRoot
end
local function cardIconRun(n, glyph, color)
	if n == nil or n <= 0 then return "" end
	return ('<font color="%s">%s</font>'):format(color, string.rep(glyph, n))
end
local function hideTileCard()
	cardRoot.Visible = false
	for _, c in ipairs(cardRoot:GetChildren()) do
		if c:IsA("GuiObject") then
			c:Destroy()
		end
	end
end
local function cardPanel(order, height, bg)
	local f = Instance.new("Frame")
	f.Size = UDim2.new(1, 0, 0, height)
	f.BackgroundColor3 = bg
	f.BackgroundTransparency = 0.08
	f.BorderSizePixel = 0
	f.LayoutOrder = order
	f.Parent = cardRoot
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 6)
	c.Parent = f
	local t = Instance.new("TextLabel")
	t.Size = UDim2.new(1, -18, 1, 0)
	t.Position = UDim2.new(0, 10, 0, 0)
	t.BackgroundTransparency = 1
	t.RichText = true
	t.Font = Enum.Font.SourceSansBold
	t.TextSize = 17
	t.TextColor3 = Color3.fromRGB(238, 238, 238)
	t.TextXAlignment = Enum.TextXAlignment.Left
	t.Parent = f
	return t
end
local function showTileCard(view, tx, ty, tile)
	hideTileCard()
	if tile == nil or tile.t == "unknown" then
		return
	end
	local rs = ClientState.rulesets()
	local order = 0
	-- enemy unit cards (red) — only what fog reveals, never unseen stack counts
	for _, u in pairs(view.units) do
		if u.x == tx and u.y == ty and u.owner ~= view.you then
			order += 1
			local vet = u.veteran == true and "  \u{2605}vet" or ""
			local hp = u.hp ~= nil and ("  hp %d"):format(u.hp) or ""
			cardPanel(order, 26, Color3.fromRGB(122, 42, 40)).Text =
				("<b>%s</b>  <font color=\"#ffd0c8\">%s</font>%s%s"):format(u.type, u.owner, vet, hp)
		end
	end
	order += 1
	local ok, y = pcall(citiesModule.tileYields, tile, rs)
	local yields = ok and y ~= nil and (
		cardIconRun(y.food, "\u{25CF}", "#7fd08a") .. " "
		.. cardIconRun(y.shields, "\u{25AE}", "#c8c8c8") .. " "
		.. cardIconRun(y.trade, "\u{25C6}", "#e0c060")) or ""
	local imps = {}
	if tile.road then table.insert(imps, "road") end
	if tile.railroad then table.insert(imps, "rail") end
	if tile.irrigation then table.insert(imps, "irrigation") end
	if tile.mine then table.insert(imps, "mine") end
	if tile.fortress then table.insert(imps, "fortress") end
	local head = tile.t
	if tile.special then
		head = head .. "  \u{00B7} " .. (SPECIAL_NAME[tile.t] or "special")
	end
	local sub = yields
	if #imps > 0 then
		sub = sub .. '   <font color="#9db2c8">' .. table.concat(imps, ", ") .. "</font>"
	end
	cardPanel(order, 50, Color3.fromRGB(28, 34, 46)).Text = ("<b>%s</b>\n%s"):format(head, sub)
	cardRoot.Visible = true
end

local function tileTopY(x, y)
	local part = world.Terrain:FindFirstChild(("Tile_%d_%d"):format(x, y))
	return part and (part.Position.Y + part.Size.Y / 2) or 0
end

local function moveCursor(x, y, selected)
	cursor.Position = Vector3.new(x * TILE, tileTopY(x, y) + 0.25, y * TILE)
	cursor.Color = selected and Color3.fromRGB(80, 220, 255) or Color3.fromRGB(255, 220, 60)
end

local function contentsAt(view, x, y)
	local found = {}
	for id, u in pairs(view.units) do
		if u.x == x and u.y == y then
			table.insert(found, ("unit %s (%s, %s)"):format(id, u.type, u.owner))
		end
	end
	for id, c in pairs(view.cities) do
		if c.x == x and c.y == y then
			table.insert(found, ("city %s (%s, pop %d)"):format(c.name, c.owner, c.pop or 1))
		end
	end
	table.sort(found)
	return #found > 0 and (" — " .. table.concat(found, ", ")) or ""
end

-- wrap-aware step from the selected unit to (tx,ty): a single king-move
local function dirTo(view, u, tx, ty)
	local dx = tx - u.x
	if view.map.wrapX then
		local w = view.map.width
		if dx > w / 2 then dx -= w end
		if dx < -w / 2 then dx += w end
	end
	local dy = ty - u.y
	return DIR_BY_DELTA[dx .. "," .. dy]
end

local function ownCityCount(view)
	local n = 0
	for _, c in pairs(view.cities) do
		if c.owner == ClientState.playerId then
			n += 1
		end
	end
	return n
end

local lastOwnPick = nil -- R7a (9): double-click detection on own units

local function handlePick(tx, ty)
	local view = ClientState.view
	if view == nil then
		return
	end
	hideTileCard() -- runI item 16: any new pick dismisses the tile card first
	if GoToPlan.pick(tx, ty) then
		return -- R14: armed GoTo consumed the pick as its destination
	end
	local tile = view.map.tiles[ty * view.map.width + tx + 1]
	local own = ClientState.ownUnitAt(tx, ty)
	local selected = ClientState.selectedUnitId and view.units[ClientState.selectedUnitId]

	-- R7a (9): while mounted, a double-click on an own unit rides to it
	if own ~= nil then
		local now = os.clock()
		if ClientState.possessedUnitId ~= nil and lastOwnPick ~= nil
			and lastOwnPick.id == own.id and now - lastOwnPick.t < 0.45 then
			lastOwnPick = nil
			print(("[Select] ride to %s (double-click)"):format(own.id))
			ClientState.requestPossess(own.id)
			return
		end
		lastOwnPick = { id = own.id, t = now }
	end

	if own ~= nil and (selected == nil or own.id ~= selected.id) then
		ClientState.selectedUnitId = own.id
		moveCursor(tx, ty, true)
		print(("[Select] selected %s (%s) at (%d,%d), moves %d"):format(own.id, own.type, tx, ty, own.moves))
		return
	end

	-- own city (and no fresh unit pick): open the city panel (R5). A
	-- garrisoned city takes two clicks — first selects the unit, second opens.
	for id, c in pairs(view.cities) do
		if c.x == tx and c.y == ty and c.owner == view.you then
			moveCursor(tx, ty, false)
			print(("[Select] open city %s (%s)"):format(c.name, id))
			ClientState.openCity(id)
			return
		end
	end

	if selected ~= nil then
		local dir = dirTo(view, selected, tx, ty)
		if dir ~= nil then
			-- session-E log finding: click-to-move gets the same gate as the
			-- ride keys — swallow KNOWN-hopeless sends (no moves / known
			-- impassable); fog and enemy tiles still send, the engine judges
			if selected.moves <= 0 then
				print("[Select] no moves left this turn")
				return
			end
			local rs = ClientState.rulesets()
			local domain = rs.units[selected.type] and rs.units[selected.type].domain
			local ok, why = require(script.Parent:WaitForChild("StepLegality"))
				.canAttempt(view, rs, domain, tx, ty)
			if not ok then
				print(("[Select] can't move there: %s"):format(why))
				return
			end
			print(("[Select] move %s %s -> (%d,%d)"):format(selected.id, dir, tx, ty))
			ClientState.send({ type = "moveUnit", unitId = selected.id, dir = dir })
			return
		end
	end

	ClientState.selectedUnitId = nil
	moveCursor(tx, ty, false)
	print(("[Select] tile (%d,%d) %s%s"):format(tx, ty, tile.t, contentsAt(view, tx, ty)))
	showTileCard(view, tx, ty, tile) -- runI item 16
end

-- ---- raycast pick (A28 logical-tile rule, unchanged from R3) ---------------
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude
local function refreshFilter()
	local character = Players.LocalPlayer.Character
	rayParams.FilterDescendantsInstances = character and { cursor, character } or { cursor }
end

local DRAG_EPS = 5
local pressAt = nil

UserInputService.InputBegan:Connect(function(input, processed)
	if not processed and input.UserInputType == Enum.UserInputType.MouseButton1 then
		pressAt = Vector2.new(input.Position.X, input.Position.Y)
	end
end)

UserInputService.InputEnded:Connect(function(input)
	if input.UserInputType ~= Enum.UserInputType.MouseButton1 or not pressAt then
		return
	end
	local releaseAt = Vector2.new(input.Position.X, input.Position.Y)
	local moved = (releaseAt - pressAt).Magnitude
	pressAt = nil
	if moved > DRAG_EPS or ClientState.view == nil then
		return
	end
	-- ScreenPointToRay, NOT ViewportPointToRay: InputObject positions are in
	-- GUI-inset space; the viewport variant is offset by the topbar (~36px),
	-- which at shallow angles walks the pick most of a tile (R4 user finding)
	local ray = camera:ScreenPointToRay(releaseAt.X, releaseAt.Y)
	refreshFilter()
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 1000, rayParams)
	if not hit then
		return
	end
	local p = hit.Position - hit.Normal * 0.05
	local map = ClientState.view.map
	local tx = math.clamp(math.floor(p.X / TILE + 0.5), 0, map.width - 1)
	local ty = math.clamp(math.floor(p.Z / TILE + 0.5), 0, map.height - 1)
	handlePick(tx, ty)
end)

-- ---- keys: B found city, O GoTo, Return end turn ---------------------------
UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil then
		return -- chat/textbox focus: game keys stay dead (house pattern)
	end
	local view = ClientState.view
	if view == nil then
		return
	end
	if input.KeyCode == Enum.KeyCode.B then
		local u = ClientState.selectedUnitId and view.units[ClientState.selectedUnitId]
		if u ~= nil and u.type == "settlers" then
			local name = "Colony " .. (ownCityCount(view) + 1)
			print(("[Select] found city '%s' with %s at (%d,%d)"):format(name, u.id, u.x, u.y))
			ClientState.send({ type = "foundCity", unitId = u.id, name = name })
		else
			print("[Select] found city: select a settlers unit first")
		end
	elseif input.KeyCode == Enum.KeyCode.G then
		-- runI item 23: G arms GoTo target-pick for the selected unit (G again
		-- cancels) — moved off O so GoTo matches the Civ shortcut
		GoToPlan.arm()
	elseif input.KeyCode == Enum.KeyCode.Return then
		if view.gameOver == true then
			ClientState.reshowEndScreen() -- runK item 5: the victory menu returns
		elseif ClientState.myTurn() then
			print("[Select] end turn " .. view.turn)
			ClientState.send({ type = "endTurn" })
		else
			print("[Select] not your turn (" .. tostring(view.activePlayer) .. " active)")
		end
	end
end)

print("[Select] actions up: click select/move, B found city, O GoTo, Return end turn")
