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

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local citiesModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("cities"))

local TILE = ClientState.TILE
local world = workspace:WaitForChild("ClientWorld")

local M = {}

local folder = Instance.new("Folder")
folder.Name = "WorkedTiles"
folder.Parent = workspace

local openCityId = nil

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

local function quad(c, worked, isCenter, onClick)
	local part = Instance.new("Part")
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.Size = Vector3.new(TILE * 0.9, 0.2, TILE * 0.9)
	part.CFrame = CFrame.new(c.x * TILE, tileTopY(c.x, c.y) + 0.35, c.y * TILE)
	part.Material = Enum.Material.Neon
	part.Transparency = worked and 0.45 or 0.8
	part.Color = isCenter and Color3.fromRGB(220, 190, 90)
		or (worked and Color3.fromRGB(80, 190, 170) or Color3.fromRGB(70, 90, 110))
	part.Parent = folder

	if worked and not isCenter then -- citizen marker
		local marker = Instance.new("Part")
		marker.Anchored = true
		marker.CanCollide = false
		marker.CanQuery = false
		marker.Shape = Enum.PartType.Ball
		marker.Size = Vector3.new(0.7, 0.7, 0.7)
		marker.CFrame = part.CFrame * CFrame.new(TILE * 0.32, 0.6, TILE * 0.32)
		marker.Color = Color3.fromRGB(240, 230, 200)
		marker.Material = Enum.Material.Neon
		marker.Parent = folder
	end

	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.new(0, 64, 0, 30)
	bb.StudsOffset = Vector3.new(0, 1.4, 0)
	bb.AlwaysOnTop = true
	bb.Adornee = part
	local btn = Instance.new("TextButton")
	btn.Size = UDim2.new(1, 0, 1, 0)
	btn.BackgroundColor3 = Color3.fromRGB(20, 24, 32)
	btn.BackgroundTransparency = isCenter and 0.1 or 0.45
	btn.RichText = true
	btn.TextColor3 = Color3.fromRGB(235, 235, 235)
	btn.Font = Enum.Font.Code
	btn.TextSize = 13
	btn.Text = isCenter and "AUTO" or yieldLine(c.yields)
	btn.Parent = bb
	bb.Parent = part
	btn.Activated:Connect(onClick)
end

local function rebuild()
	folder:ClearAllChildren()
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

	-- the toggle: build the manual workers list from the EFFECTIVE set ± the
	-- clicked tile (auto mode materializes into manual on first touch, the
	-- browser's semantics), then let the server judge
	local function toggle(idx)
		local next_ = {}
		for i in pairs(workedIdx) do
			if i ~= idx then
				table.insert(next_, i)
			end
		end
		if workedIdx[idx] ~= true then
			table.insert(next_, idx)
		end
		table.sort(next_)
		print(("[WorkedTiles] setWorkers %s (%d tiles)"):format(openCityId, #next_))
		ClientState.send({ type = "setWorkers", cityId = openCityId, workers = next_ })
	end

	-- center quad = the AUTO reset (Civ 1: center always works for free)
	local centerYields = worked[1] ~= nil and worked[1].yields or { food = 0, shields = 0, trade = 0 }
	quad({ x = city.x, y = city.y, yields = centerYields }, true, true, function()
		print("[WorkedTiles] setWorkers auto " .. openCityId)
		ClientState.send({ type = "setWorkers", cityId = openCityId, auto = true })
	end)

	for _, c in ipairs(candidates) do
		quad(c, workedIdx[c.idx] == true, false, function()
			toggle(c.idx)
		end)
	end
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
end

function M.refresh()
	if openCityId ~= nil then
		rebuild()
	end
end

print("[WorkedTiles] R7c-3 worked-tile overlay ready (CityPanel drives it)")

return M
