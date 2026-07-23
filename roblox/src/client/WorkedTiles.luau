-- R7c-3 (user un-gated 2026-07-17 — FULL BUILD, shape per proposal @e87d97d8):
-- the 3D worked-tile city view. While the city panel is open on an OWN city,
-- the fat cross renders in-world: one translucent quad per candidate tile
-- with its yield line (food/shields/trade, RichText-colored), worked tiles
-- bright + a citizen marker, the CITY CENTER quad doubles as the AUTO reset
-- button. Clicking a quad TOGGLES that tile as a setWorkers command — no
-- local logic, the server judges (pop cap, candidate validity). All math
-- comes from the read-only luau cities module on a view shim (architect
-- ruling @b81f92dd: presentational only). ModuleScript driven by CityPanel
-- (show/hide/refresh) — ClientState is frozen tonight, so no new channels.
-- NOTE-FOR-REVIEW (night order): built ahead of the user's shape look.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local citiesModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("cities"))

local TILE = ClientState.TILE
local world = workspace:WaitForChild("ClientWorld")

local M = {}

local folder = Instance.new("Folder")
folder.Name = "WorkedTiles"
folder.Parent = workspace

-- session-E fix: BillboardGui BUTTONS only receive clicks when the gui is
-- a descendant of PlayerGui (workspace-parented billboards render but are
-- dead to input — the 'CLOSE does nothing' finding). Adornee still points
-- at the world part; the gui itself lives here.
local bbHome = Instance.new("Folder")
bbHome.Name = "WorkedTilesBB"
bbHome.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local openCityId = nil
local lastClick = nil -- session-E: double-click detection for the swap

-- run-4 live request: a PROMINENT close button in the view itself (the
-- production panel's small X was the only way out). CityPanel registers the
-- actual close here (it owns the gui; requiring back would cycle).
local closeRequest = nil
function M.onCloseRequest(cb)
	closeRequest = cb
end

local function tileTopY(x, y)
	local part = world:WaitForChild("Terrain"):FindFirstChild(("Tile_%d_%d"):format(x, y))
	return part and (part.Position.Y + part.Size.Y / 2) or 0
end

local function shim(view)
	return { map = view.map, players = view.players, cities = view.cities,
		cityOrder = view.cityOrder, units = view.units, wonders = view.wonders }
end

local function yieldLine(y)
	return ('<font color="#7fd08a">%d</font> <font color="#c8c8c8">%d</font> <font color="#e0c060">%d</font>')
		:format(y.food or 0, y.shields or 0, y.trade or 0)
end

-- run-4 live request: WORKED must read unmistakably — bright solid green
-- with a raised frame + citizen ball; unworked is dark and quiet
local function quad(c, worked, isCenter, onClick)
	local part = Instance.new("Part")
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.Size = Vector3.new(TILE * 0.9, worked and 0.5 or 0.2, TILE * 0.9)
	part.CFrame = CFrame.new(c.x * TILE, tileTopY(c.x, c.y) + (worked and 0.5 or 0.35), c.y * TILE)
	part.Material = Enum.Material.Neon
	part.Transparency = worked and 0.2 or 0.85
	part.Color = isCenter and Color3.fromRGB(230, 195, 80)
		or (worked and Color3.fromRGB(70, 220, 120) or Color3.fromRGB(45, 55, 70))
	part.Parent = folder

	if worked and not isCenter then -- citizen marker: one ball per worker
		local marker = Instance.new("Part")
		marker.Anchored = true
		marker.CanCollide = false
		marker.CanQuery = false
		marker.Shape = Enum.PartType.Ball
		marker.Size = Vector3.new(1.1, 1.1, 1.1)
		marker.CFrame = part.CFrame * CFrame.new(TILE * 0.3, 0.9, TILE * 0.3)
		marker.Color = Color3.fromRGB(255, 245, 210)
		marker.Material = Enum.Material.Neon
		marker.Parent = folder
	end

	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.new(0, 64, 0, 30)
	bb.StudsOffset = Vector3.new(0, 1.4, 0)
	bb.AlwaysOnTop = true
	bb.Active = true -- session-E round 8: WITHOUT this, billboard buttons never
	-- sink input even from PlayerGui — clicks fell through to Select's raycast
	bb.Adornee = part
	local btn = Instance.new("TextButton")
	btn.Size = UDim2.new(1, 0, 1, 0)
	btn.BackgroundColor3 = worked and Color3.fromRGB(20, 60, 35) or Color3.fromRGB(20, 24, 32)
	btn.BackgroundTransparency = isCenter and 0.1 or (worked and 0.25 or 0.55)
	btn.RichText = true
	btn.TextColor3 = Color3.fromRGB(235, 235, 235)
	btn.Font = Enum.Font.Code
	btn.TextSize = 13
	btn.Text = isCenter and "AUTO" or yieldLine(c.yields)
	btn.Parent = bb
	bb.Parent = bbHome
	btn.Activated:Connect(onClick)
end

-- the worker-budget board: workers placed/placeable + specialists, floating
-- over the city — recomputed on every rebuild (every server-confirmed change)
local function summaryBoard(city, workersPlaced)
	local pop = city.pop or 1
	local taxmen = city.taxmen or 0
	local scientists = city.scientists or 0
	local entertainers = pop - workersPlaced - taxmen - scientists
	local anchor = Instance.new("Part")
	anchor.Anchored = true
	anchor.Transparency = 1
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.Size = Vector3.new(0.2, 0.2, 0.2)
	anchor.CFrame = CFrame.new(city.x * TILE, tileTopY(city.x, city.y) + 7, city.y * TILE)
	anchor.Parent = folder
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.new(0, 340, 0, 44)
	bb.AlwaysOnTop = true
	bb.Adornee = anchor
	local t = Instance.new("TextLabel")
	t.Size = UDim2.new(1, 0, 1, 0)
	t.BackgroundColor3 = Color3.fromRGB(20, 24, 32)
	t.BackgroundTransparency = 0.15
	t.RichText = true
	t.TextColor3 = Color3.fromRGB(235, 235, 235)
	t.Font = Enum.Font.Code
	t.TextSize = 16
	t.Text = ('<font color="#7fd08a">workers %d/%d placed</font>  ·  specialists %d'
		.. '<font size="13" color="#9db2c8"> (ent %d · tax %d · sci %d)</font>')
		:format(workersPlaced, pop, pop - workersPlaced,
			math.max(0, entertainers), taxmen, scientists)
	t.Parent = bb
	bb.Parent = bbHome
end

local function rebuild()
	folder:ClearAllChildren()
	bbHome:ClearAllChildren()
	local view = ClientState.view
	if openCityId == nil or view == nil then
		return
	end
	local city = view.cities[openCityId]
	if city == nil or city.owner ~= view.you then
		return
	end
	local rs = ClientState.rulesets()
	local s = shim(view)
	local okC, candidates = pcall(citiesModule.candidateTiles, s, city, rs)
	local okW, worked = pcall(citiesModule.workedTiles, s, city, rs)
	if not okC or not okW then
		print("[WorkedTiles] view shim came up short (fog?) — overlay skipped")
		return
	end
	local workedIdx = {}
	for _, w in ipairs(worked) do
		if w.center ~= true then
			workedIdx[w.y * view.map.width + w.x] = true
		end
	end

	-- session-E interaction spec (user): click a WORKED tile = remove its
	-- worker; click an unworked tile = place a worker (when a citizen is
	-- free); DOUBLE-CLICK an unworked tile = force it by dropping the LEAST
	-- FAVORABLE currently-worked tile (lowest candidate score). The server
	-- still judges everything.
	local workersPlacedNow = 0
	for _ in pairs(workedIdx) do
		workersPlacedNow += 1
	end
	local budget = (city.pop or 1) - (city.taxmen or 0) - (city.scientists or 0)

	local function sendWorkers(set)
		local next_ = {}
		for i in pairs(set) do
			table.insert(next_, i)
		end
		table.sort(next_)
		print(("[WorkedTiles] setWorkers %s (%d tiles)"):format(openCityId, #next_))
		ClientState.send({ type = "setWorkers", cityId = openCityId, workers = next_ })
	end

	local function applySwap(idx)
		local worst, worstScore = nil, math.huge
		for _, c in ipairs(candidates) do
			if workedIdx[c.idx] == true and (c.score or 0) < worstScore then
				worst, worstScore = c.idx, c.score or 0
			end
		end
		if worst == nil then
			return
		end
		local set = table.clone(workedIdx)
		set[worst] = nil
		set[idx] = true
		print("[WorkedTiles] double-click swap: weakest tile released")
		sendWorkers(set)
	end

	-- runI item 20: EVERY worker change is a DOUBLE-CLICK; a single click only
	-- arms it + prints the hint. A single click used to fire immediately, so a
	-- double-click on a worked tile removed then re-placed it (net nothing) and
	-- a double-click on an unworked tile placed then removed it — both read as
	-- dead. Double-click a worked tile = remove; an unworked tile = place when
	-- a citizen is free, else swap out the weakest worked tile.
	local function toggle(idx)
		local now = os.clock()
		local isDouble = lastClick ~= nil and lastClick.idx == idx and now - lastClick.t < 0.6
		if not isDouble then
			lastClick = { idx = idx, t = now }
			if workedIdx[idx] == true then
				print("[WorkedTiles] double-click to remove this worker")
			elseif workersPlacedNow < budget then
				print("[WorkedTiles] double-click to work this tile")
			else
				print("[WorkedTiles] all citizens busy - double-click to swap with the weakest tile")
			end
			return
		end
		lastClick = nil
		if workedIdx[idx] == true then -- double-click an active tile: remove
			local set = table.clone(workedIdx)
			set[idx] = nil
			sendWorkers(set)
		elseif workersPlacedNow < budget then -- a citizen is free: place them
			local set = table.clone(workedIdx)
			set[idx] = true
			sendWorkers(set)
		else -- capped: swap out the weakest worked tile
			applySwap(idx)
		end
	end

	-- center quad = the AUTO reset (Civ 1: center always works for free)
	local centerYields = worked[1] ~= nil and worked[1].yields or { food = 0, shields = 0, trade = 0 }
	quad({ x = city.x, y = city.y, yields = centerYields }, true, true, function()
		print("[WorkedTiles] setWorkers auto " .. openCityId)
		ClientState.send({ type = "setWorkers", cityId = openCityId, auto = true })
	end)

	local workersPlaced = 0
	for _, c in ipairs(candidates) do
		local isWorked = workedIdx[c.idx] == true
		if isWorked then
			workersPlaced += 1
		end
		quad(c, isWorked, false, function()
			toggle(c.idx)
		end)
	end
	summaryBoard(city, workersPlaced)

	-- the big CLOSE button, just below the fat cross
	local closeAnchor = Instance.new("Part")
	closeAnchor.Anchored = true
	closeAnchor.Transparency = 1
	closeAnchor.CanCollide = false
	closeAnchor.CanQuery = false
	closeAnchor.Size = Vector3.new(0.2, 0.2, 0.2)
	closeAnchor.CFrame = CFrame.new(city.x * TILE,
		tileTopY(city.x, city.y) + 2, (city.y + 4.2) * TILE) -- session-E: a bit further down
	closeAnchor.Parent = folder
	local closeBB = Instance.new("BillboardGui")
	closeBB.Size = UDim2.new(0, 220, 0, 40)
	closeBB.AlwaysOnTop = true
	closeBB.Active = true -- round 8: required for the button to receive clicks
	closeBB.Adornee = closeAnchor
	local closeBtn = Instance.new("TextButton")
	closeBtn.Size = UDim2.new(1, 0, 1, 0)
	closeBtn.BackgroundColor3 = Color3.fromRGB(130, 55, 50)
	closeBtn.BackgroundTransparency = 0.1
	closeBtn.TextColor3 = Color3.fromRGB(255, 230, 225)
	closeBtn.Font = Enum.Font.SourceSansBold
	closeBtn.TextSize = 20
	closeBtn.Text = "CLOSE CITY VIEW"
	closeBtn.Parent = closeBB
	closeBB.Parent = bbHome
	closeBtn.Activated:Connect(function()
		if closeRequest ~= nil then
			closeRequest()
		else
			M.hide()
		end
	end)
end

function M.show(cityId)
	openCityId = cityId
	local view = ClientState.view
	local city = view ~= nil and view.cities[cityId] or nil
	if city ~= nil then
		ClientState.focusCamera(city.x, city.y)
	end
	rebuild()
end

function M.hide()
	openCityId = nil
	folder:ClearAllChildren()
	bbHome:ClearAllChildren()
end

function M.refresh()
	if openCityId ~= nil then
		rebuild()
	end
end

-- session-E: N (next unit) closes the city view first — Possess calls this
function M.closeIfOpen()
	if openCityId == nil then
		return
	end
	if closeRequest ~= nil then
		closeRequest()
	else
		M.hide()
	end
end

-- session-E: walking OUT of the fat-cross area auto-closes the city view.
-- Round 8 (user): NOT while mounted and sitting still — a rider parked on a
-- unit outside the cross must be able to keep assigning workers; only actual
-- movement (the ridden unit stepping, or walking afoot) can close it.
-- Round 22 (run-E log): only close on an INSIDE->OUTSIDE transition — a
-- player opening a city while standing far away (city click across the map,
-- city-list jump) got the view slammed shut the same frame, 12x in the log.
local lastRootPos = nil
local wasInside = false
local watchedCity = nil
RunService.Heartbeat:Connect(function()
	if openCityId == nil then
		lastRootPos = nil
		wasInside = false
		watchedCity = nil
		return
	end
	if openCityId ~= watchedCity then
		watchedCity = openCityId -- city switched without closing: fresh gate
		wasInside = false
	end
	local view = ClientState.view
	local city = view ~= nil and view.cities[openCityId] or nil
	local character = Players.LocalPlayer.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if city == nil or root == nil then
		return
	end
	local moved = lastRootPos ~= nil and (root.Position - lastRootPos).Magnitude > 0.5
	lastRootPos = root.Position
	if ClientState.possessedUnitId ~= nil and not moved then
		return -- mounted and stationary: never auto-close
	end
	local dx = math.abs(root.Position.X - city.x * TILE)
	local dz = math.abs(root.Position.Z - city.y * TILE)
	local inside = math.max(dx, dz) <= TILE * 3.5 and root.Position.Y < 60
	if inside then
		wasInside = true
	end
	if not wasInside then
		return -- opened from afar: remote management, never auto-close
	end
	-- the cross spans +-2 tiles; half a tile of grace, and only count MAP
	-- walking (the deck sits high — standing up there never closes the view)
	if math.max(dx, dz) > TILE * 3.5 and root.Position.Y < 60 then
		print("[WorkedTiles] walked out of the city area - view closed")
		if closeRequest ~= nil then
			closeRequest()
		else
			M.hide()
		end
	end
end)

print("[WorkedTiles] R7c-3 worked-tile overlay ready (CityPanel drives it)")

return M
