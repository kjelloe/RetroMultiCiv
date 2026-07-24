-- R4: renders the VIEW (roblox/SPEC.md §3e) — the R2 static scene's live
-- successor. Input is always ClientState.view (filterView output): unknown
-- tiles render as the void palette, explored-but-not-visible tiles render
-- dimmed, and units/cities exist only if the view carries them. Render-only:
-- no randomness, shade picks stay position-hashed (screenshot-stable).
-- R7b (8): per-unit billboard (name + att/def + move pips) — fog-respecting
-- by construction (rivals are only ever in the view while visible, and the
-- stats shown are ruleset facts by type + the view's own moves field).
-- R7b (10): own settlers carry a site line — legality via the read-only
-- luau ai.goodCitySpot on a view shim (fog-approximate like move hints),
-- stars are a PRESENTATIONAL heuristic (documented in SPEC §3i).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local AssetFactory = require(script.Parent:WaitForChild("AssetFactory"))
local TileProps = require(script.Parent:WaitForChild("TileProps")) -- CP1 tile props
local TerrainPalette = require(ReplicatedStorage:WaitForChild("GameData"):WaitForChild("TerrainPalette"))
local Palette = require(script.Parent:WaitForChild("Palette")) -- SO14 display-time remap
local aiModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("ai"))
local citiesModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("cities"))

local TILE = ClientState.TILE
local HEIGHT = 6 -- studs per 1.0 of TERRAIN base height
local BASIN = 2 -- studs below zero every tile column extends
local DIM = 0.55 -- explored-but-fogged tiles darken toward black by this factor

local world = Instance.new("Folder")
world.Name = "ClientWorld"
local terrainFolder = Instance.new("Folder")
terrainFolder.Name = "Terrain"
terrainFolder.Parent = world
local unitsFolder = Instance.new("Folder")
unitsFolder.Name = "Units"
unitsFolder.Parent = world
local citiesFolder = Instance.new("Folder")
citiesFolder.Name = "Cities"
citiesFolder.Parent = world
world.Parent = workspace

local function hexColor(hex)
	local n = tonumber(string.sub(hex, 2), 16) or 0
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
end

local function block(parent, name, size, position, color, material)
	local part = Instance.new("Part")
	part.Anchored = true
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Name = name
	part.Size = size
	part.Position = position
	part.Color = color
	part.Material = material or Enum.Material.SmoothPlastic
	part.Parent = parent
	return part
end

local function specFor(id)
	return TerrainPalette[id] or TerrainPalette.grassland
end

local function tileTop(id)
	local spec = specFor(id)
	-- runI item 7: mountains should be only 2x as tall as hills (was ~4x). The
	-- generated TerrainPalette mirrors the browser terrain.js source and is
	-- gate-4 locked, so the ratio is corrected render-side: hills sit at half
	-- the mountain top. tileTop also seats units/cities/props, so raising it
	-- here keeps everything on the taller hills.
	if id == "hills" then
		local m = specFor("mountains")
		return (m.base + m.peak * 0.5) * HEIGHT * 0.5
	end
	return (spec.base + spec.peak * 0.5) * HEIGHT
end

-- terrain parts persist and mutate in place (no 1000-part churn per push);
-- cache what each index last showed so only changes touch instances
local tileParts = {}
local tileShown = {} -- [i] = "t|visible|look"

-- Visual-fidelity workstream (#1100): the ENHANCED look is a PRESENTATION
-- LAYER only — per-terrain built-in materials over the SAME shared palette
-- colors and recipe geometry (the source stays unforked; the browser is
-- WebGL1-locked to flat, Roblox is not). options.look = "retro"|"enhanced";
-- the soundboard pattern: both looks live, the user picks by screenshot.
local ENHANCED_MATERIAL = {
	grassland = Enum.Material.Grass, plains = Enum.Material.Grass,
	forest = Enum.Material.LeafyGrass, jungle = Enum.Material.LeafyGrass,
	desert = Enum.Material.Sand, hills = Enum.Material.Ground,
	mountains = Enum.Material.Slate, tundra = Enum.Material.Ground,
	arctic = Enum.Material.Snow, swamp = Enum.Material.Mud,
	ocean = Enum.Material.Glass, river = Enum.Material.Glass,
}

-- XIV §15 "Studded"/brick: bevelled bricks + studs-as-punctuation, hyper-
-- saturated flat colors, LESS terrain relief (ally §2). Studs only on open flat
-- tops (never water — must not compete with ship silhouettes — nor forest/
-- jungle canopy tiles nor mountains). Same shared palette + geometry: the look
-- is a material/saturation/relief LAYER, never a source fork.
local BRICK_MATERIAL = {
	grassland = Enum.Material.Plastic, plains = Enum.Material.Plastic,
	forest = Enum.Material.Plastic, jungle = Enum.Material.Plastic,
	desert = Enum.Material.Plastic, hills = Enum.Material.Plastic,
	mountains = Enum.Material.Slate, tundra = Enum.Material.Plastic,
	arctic = Enum.Material.Plastic, swamp = Enum.Material.Plastic,
	ocean = Enum.Material.SmoothPlastic, river = Enum.Material.SmoothPlastic,
}
local BRICK_STUDS = { -- top-face studs (punctuation): open flats only
	grassland = true, plains = true, desert = true, tundra = true,
	arctic = true, hills = true, swamp = true,
}
local function brickify(c)
	-- saturation bump; VALUE kept so terrain categories still separate under
	-- the desaturation acceptance test (ally readability invariant).
	local h, s, v = c:ToHSV()
	return Color3.fromHSV(h, math.min(1, s * 1.35), v)
end
local function brickTop(id, top)
	-- LESS relief (ally §29), but the flat/hill/mountain HEIGHT hierarchy must
	-- still separate (desaturation readability invariant). Mountains own the
	-- skyline (unchanged); hills = a LOW readable plateau — err low initially
	-- (#1977), kept under the user's "hills ≤25% of mountains" cap; everything
	-- else flattens to broad plates. (The old coarse quantize collapsed hills'
	-- top≈1.9 to 0, which erased the hill tier — fixed here.)
	if id == "mountains" then
		return top
	elseif id == "hills" then
		return top -- runI item 7: tileTop already sets hills to half the mountain top (2x)
	end
	return 0 -- flats: flat plates, no relief
end

local function lookOf()
	local look = ClientState.options.look
	if look == "enhanced" then
		return "enhanced"
	elseif look == "brick" then
		return "brick"
	end
	return "retro"
end

local function renderTerrain(view)
	local map = view.map
	local look = lookOf()
	for i, tile in ipairs(map.tiles) do
		local key = tile.t .. "|" .. tostring(tile.visible) .. "|" .. look
		if tileShown[i] ~= key then
			tileShown[i] = key
			local x = (i - 1) % map.width
			local y = math.floor((i - 1) / map.width)
			local spec = specFor(tile.t)
			local top = tileTop(tile.t)
			local shade = spec.palette[(x * 7 + y * 13) % #spec.palette + 1]
			if look == "brick" then
				top = brickTop(tile.t, top) -- LESS relief, stepped
				shade = brickify(shade) -- saturate BEFORE the fog dim
			end
			if tile.t ~= "unknown" and tile.visible ~= true then
				shade = shade:Lerp(Color3.new(0, 0, 0), DIM)
			end
			local part = tileParts[i]
			if part == nil then
				part = block(terrainFolder, ("Tile_%d_%d"):format(x, y),
					Vector3.new(TILE, top + BASIN, TILE),
					Vector3.new(x * TILE, (top - BASIN) / 2, y * TILE), shade)
				tileParts[i] = part
			else
				part.Size = Vector3.new(TILE, top + BASIN, TILE)
				part.Position = Vector3.new(x * TILE, (top - BASIN) / 2, y * TILE)
				part.Color = shade
			end
			if look == "enhanced" then
				part.Material = ENHANCED_MATERIAL[tile.t] or Enum.Material.SmoothPlastic
				part.Transparency = (tile.t == "ocean" and tile.visible == true) and 0.15 or 0
				part.TopSurface = Enum.SurfaceType.Smooth
			elseif look == "brick" then
				part.Material = BRICK_MATERIAL[tile.t] or Enum.Material.Plastic
				part.Transparency = (tile.t == "ocean" and tile.visible == true) and 0.15 or 0
				-- studs as punctuation: open flat tops only, never water/canopy/peaks
				part.TopSurface = BRICK_STUDS[tile.t] and Enum.SurfaceType.Studs or Enum.SurfaceType.Smooth
			else
				part.Material = Enum.Material.SmoothPlastic
				part.Transparency = 0
				part.TopSurface = Enum.SurfaceType.Smooth
			end
		end
	end
end

-- (the look-change watcher lives at the file bottom — it needs renderCities
-- in scope, which is defined below)

-- (10) site stars, own settlers only. Legality is the engine's own
-- goodCitySpot (read-only require, view shim). Stars on a legal spot are
-- display-only: 1 base, +1 for a strong center tile (grassland/plains/
-- river), +1 when 3+ neighbors are strong too.
local STRONG = { grassland = true, plains = true }
local function siteLine(view, u)
	local shim = { map = view.map, cityOrder = view.cityOrder, cities = view.cities }
	local ok, legal = pcall(aiModule.goodCitySpot, shim, u, ClientState.rulesets())
	if not ok or legal ~= true then
		return "site: x"
	end
	local map = view.map
	local center = map.tiles[u.y * map.width + u.x + 1]
	local stars = 1
	if STRONG[center.t] == true or center.river == true then
		stars += 1
	end
	local strongNear = 0
	for dy = -1, 1 do
		for dx = -1, 1 do
			if dx ~= 0 or dy ~= 0 then
				local nx, ny = u.x + dx, u.y + dy
				if map.wrapX then
					nx = nx % map.width
				end
				if nx >= 0 and nx < map.width and ny >= 0 and ny < map.height then
					local t = map.tiles[ny * map.width + nx + 1]
					if STRONG[t.t] == true or t.river == true then
						strongNear += 1
					end
				end
			end
		end
	end
	if strongNear >= 3 then
		stars += 1
	end
	return "site: " .. string.rep("*", stars)
end

-- (8) the unit billboard: "<Name> a/d" + move pips (own settlers add the
-- site line). Adornee'd to the base disc so it rides the model.
local function unitBillboard(model, adornee, view, u)
	local def = ClientState.rulesets().units[u.type] or {}
	local mine = u.owner == view.you
	local lines = { ("%s %d/%d"):format(def.name or u.type, def.attack or 0, def.defense or 0) }
	if u.moves ~= nil and u.moves > 0 then
		table.insert(lines, string.rep("|", math.min(u.moves, 9)))
	else
		table.insert(lines, "-")
	end
	if mine and u.type == "settlers" then
		table.insert(lines, siteLine(view, u))
	end
	-- R12 (3): 2x size, bold, wider face (SourceSansBold vs the old Code 11)
	local bb = Instance.new("BillboardGui")
	bb.Name = "Label"
	bb.Adornee = adornee
	bb.Size = UDim2.new(0, 200, 0, 24 * #lines)
	bb.StudsOffset = Vector3.new(0, 3.6 + #lines * 0.6, 0)
	bb.MaxDistance = 180
	local text = Instance.new("TextLabel")
	text.Size = UDim2.new(1, 0, 1, 0)
	text.BackgroundTransparency = 1
	text.TextColor3 = mine and Color3.fromRGB(235, 235, 235) or Color3.fromRGB(240, 190, 180)
	text.TextStrokeTransparency = 0.4
	text.Font = Enum.Font.SourceSansBold
	text.TextSize = 22
	text.Text = table.concat(lines, "\n")
	text.Parent = bb
	bb.Parent = model
end

-- R12 (4): always-on city billboard — name + pop + production + turns left.
-- Fog-honest by construction: every line reads the view's own city fields
-- (rival cities carry whatever filterView granted, and lines simply drop
-- when a field is absent); turns-left is presentational math via the
-- read-only cities.cityYields on a view shim, pcall'd (own cities have
-- their whole radius explored; anything less just omits the estimate).
local function cityBillboard(model, adornee, view, c)
	local mine = c.owner == view.you
	local rs = ClientState.rulesets()
	-- runI item 13: the city NAME reads 20% larger than unit names (unit label
	-- is size 22, so 26), bold and UPPERCASE for a stronger civic look; the
	-- pop/production lines stay at the base label size.
	local lines = { ('<b><font size="26">%s</font></b>  (pop %d)')
		:format((c.name or "city"):upper(), c.pop or 1) }
	if c.disorder == true then -- A68 parity: the disorder banner
		table.insert(lines, '<font color="#ff8878"><b>CIVIL DISORDER</b></font>')
	end
	if c.producing ~= nil then
		local def = (rs[c.producing.kind .. "s"] or {})[c.producing.id]
		local cost = def and def.cost or 0
		local turns = ""
		local shim = { map = view.map, cities = view.cities, cityOrder = view.cityOrder,
			units = view.units, players = view.players, wonders = view.wonders }
		local ok, y = pcall(citiesModule.cityYields, shim, c, rs)
		if ok and y ~= nil and (y.shields or 0) > 0 then
			turns = (" ~%d t"):format(math.ceil(math.max(0, cost - (c.shields or 0)) / y.shields))
		end
		table.insert(lines, ("%s %d/%d%s"):format(def and def.name or c.producing.id,
			c.shields or 0, cost, turns))
	end
	local bb = Instance.new("BillboardGui")
	bb.Name = "CityLabel"
	bb.Adornee = adornee
	bb.Size = UDim2.new(0, 240, 0, 28 * #lines) -- runI item 13: taller for the size-26 name line
	bb.StudsOffset = Vector3.new(0, 4.5, 0)
	bb.MaxDistance = 240
	local text = Instance.new("TextLabel")
	text.Size = UDim2.new(1, 0, 1, 0)
	text.BackgroundTransparency = 1
	text.RichText = true -- the A68 disorder banner uses a color tag
	text.TextColor3 = mine and Color3.fromRGB(235, 235, 235) or Color3.fromRGB(240, 190, 180)
	text.TextStrokeTransparency = 0.3
	text.Font = Enum.Font.SourceSansBold
	text.TextSize = 20
	text.Text = table.concat(lines, "\n")
	text.Parent = bb
	bb.Parent = model
end

-- runI item 9: label LOD by camera distance — CHEAP (one distance read; the
-- band is applied only when it CHANGES + to freshly-rendered labels, never per
-- label per frame). The ruling's "when labels start to overlap" is approximated
-- by zoom distance, not pairwise overlap tests. Near = full labels; zoomed out,
-- unit labels hide so they stop cluttering the map (city labels stay — item 13
-- keeps those uppercase/readable, and the item-8 influence tints are unaffected).
local LOD_HIDE_UNITS = 95 -- studs (camera dist 15..220); tune in Studio
local lodUnitsHidden = false
local function applyUnitLabelLOD()
	for _, m in ipairs(unitsFolder:GetChildren()) do
		local bb = m:FindFirstChild("Label")
		if bb ~= nil then
			bb.Enabled = not lodUnitsHidden
		end
	end
end
RunService.Heartbeat:Connect(function()
	local hide = (ClientState.cameraDist or 60) >= LOD_HIDE_UNITS
		or ClientState.hideUnitLabels == true -- runI item 8: the overlay hide-labels toggle
	if hide ~= lodUnitsHidden then
		lodUnitsHidden = hide
		applyUnitLabelLOD()
	end
end)

local function renderUnits(view)
	unitsFolder:ClearAllChildren()
	-- runI item 12: fortified units on a CITY tile show no earthworks (the city
	-- visual already implies walls/garrison) — build the own-tile city lookup once.
	local cityAt = {}
	for _, c in pairs(view.cities) do
		cityAt[c.y * view.map.width + c.x] = true
	end
	for id, u in pairs(view.units) do
		local model = Instance.new("Model")
		model.Name = id .. "_" .. u.type
		local top = tileTop(view.map.tiles[u.y * view.map.width + u.x + 1].t)
		local cx, cz = u.x * TILE, u.y * TILE
		local ownerColor = hexColor(Palette.displayColor(view.players[u.owner].color))

		local disc = Instance.new("Part")
		disc.Anchored = true
		disc.Shape = Enum.PartType.Cylinder
		disc.Name = "BaseDisc"
		disc.Size = Vector3.new(0.3, TILE * 0.7, TILE * 0.7)
		disc.CFrame = CFrame.new(cx, top + 0.15, cz) * CFrame.Angles(0, 0, math.rad(90))
		disc.Color = ownerColor
		disc.Material = Enum.Material.SmoothPlastic
		disc.Parent = model

		-- R8: the body is DATA — the same recipe table the browser renders;
		-- primary/secondary are the color-role slots (A88 contract). Faction
		-- identity stays procedural on top (disc, rampart, billboard).
		local built = pcall(AssetFactory.buildUnit, model, u.type,
			{ primary = ownerColor, secondary = ownerColor:Lerp(Color3.new(1, 1, 1), 0.35) },
			CFrame.new(cx, top + 0.1, cz))
		if not built then -- recipes gate failed or bad recipe: old placeholder
			block(model, "Body", Vector3.new(0.9, 1.6, 0.9),
				Vector3.new(cx, top + 1.1, cz), Color3.fromRGB(120, 120, 126))
			block(model, "Head", Vector3.new(0.6, 0.5, 0.6),
				Vector3.new(cx, top + 2.15, cz), Color3.fromRGB(199, 172, 140))
		end
		if u.fortified == true and cityAt[u.y * view.map.width + u.x] ~= true then
			-- runI item 12: a DUG-IN reading — a low earthen mound + angled pikes
			-- on the front (camera-facing at the default orbit) edge, replacing the
			-- old rampart slab. Owner-neutral earth tones; the unit chrome carries
			-- the faction. Static rest pose (Studio tunes the exact edge/angle).
			local edgeZ = cz - TILE * 0.34
			local mound = Instance.new("Part")
			mound.Anchored = true
			mound.CanCollide = false
			mound.CanQuery = false
			mound.Shape = Enum.PartType.Cylinder
			mound.Name = "Earthwork"
			mound.Size = Vector3.new(TILE * 0.5, 0.5, 0.5) -- a low ridge along the X edge
			mound.CFrame = CFrame.new(cx, top + 0.12, edgeZ)
			mound.Color = Color3.fromRGB(112, 84, 56)
			mound.Material = Enum.Material.Ground
			mound.Parent = model
			for i = -1, 1 do -- three angled pikes rising toward the camera
				local pike = Instance.new("Part")
				pike.Anchored = true
				pike.CanCollide = false
				pike.CanQuery = false
				pike.Shape = Enum.PartType.Cylinder
				pike.Name = "Pike"
				pike.Size = Vector3.new(1.0, 0.08, 0.08)
				pike.CFrame = CFrame.new(cx + i * TILE * 0.16, top + 0.42, edgeZ)
					* CFrame.Angles(0, 0, math.rad(90)) * CFrame.Angles(math.rad(38), 0, 0)
				pike.Color = Color3.fromRGB(122, 92, 60)
				pike.Material = Enum.Material.Wood
				pike.Parent = model
			end
		end
		unitBillboard(model, disc, view, u)
		model.Parent = unitsFolder
	end
	applyUnitLabelLOD() -- runI item 9: freshly-rendered labels honor the current zoom band
end

-- run-F #8 (user) — the city model GROWS with pop AND changes look by ERA.
-- SIZE (pop tier) sets house count + height; the visual BAND sets the STYLE.
-- The band contract is the SHARED shared/city-era.js (architect #1742): the
-- four band ids + the CITY_ERA_STYLES keys (body/roofShape/roofMat/prop) and
-- the cityEraBand fog rule are ported here 1:1 — check.sh gate 12 pins the
-- band ids + style keys against that file so Roblox never invents its own.
-- Fog-honest by construction: filterView carries `techs` only for the VIEWER,
-- so a rival city (no techs in view) resolves to the base 'ancient' band.
-- Layout is DETERMINISTIC from the city x,y (a render hash, never engine RNG).
local ERA_TO_BAND = { ancient = "ancient", renaissance = "classicalMedieval",
	industrial = "industrial", modern = "modernSpace" }
local BAND_RANK = { ancient = 0, classicalMedieval = 1, industrial = 2, modernSpace = 3 }

-- CITY_ERA_STYLES (shared/city-era.js) string keys -> Roblox geometry/material.
-- body -> wall color+material; roofShape -> cap proportions; roofMat -> roof
-- color+material; prop -> the per-band signature landmark.
local BAND_STYLE = {
	ancient = { -- body mud / roof thatch / no prop
		wall = Color3.fromRGB(198, 178, 146), wallMat = Enum.Material.Ground,
		roofShape = "peak", roof = Color3.fromRGB(158, 120, 72), roofMat = Enum.Material.Grass,
		prop = "" },
	classicalMedieval = { -- body stone / roof tile / keep
		wall = Color3.fromRGB(188, 186, 178), wallMat = Enum.Material.Slate,
		roofShape = "peak", roof = Color3.fromRGB(168, 86, 64), roofMat = Enum.Material.Slate,
		prop = "keep" },
	industrial = { -- body brick / roof tar / smokestack
		wall = Color3.fromRGB(168, 104, 86), wallMat = Enum.Material.Brick,
		roofShape = "flat", roof = Color3.fromRGB(48, 46, 44), roofMat = Enum.Material.Concrete,
		prop = "smokestack" },
	modernSpace = { -- body concrete / roof glass / spire
		wall = Color3.fromRGB(160, 178, 202), wallMat = Enum.Material.Concrete,
		roofShape = "slab", roof = Color3.fromRGB(120, 180, 215), roofMat = Enum.Material.Glass,
		prop = "spire" },
}

-- shared/city-era.js cityEraBand ported 1:1: highest era among the owner's
-- known techs wins; nil techs (rival under fog) -> 'ancient'
local function cityEraBand(ownerPlayer, techsTable)
	if ownerPlayer == nil or ownerPlayer.techs == nil or techsTable == nil then
		return "ancient"
	end
	local best = "ancient"
	for _, id in ipairs(ownerPlayer.techs) do
		local t = techsTable[id]
		if t ~= nil then
			local band = ERA_TO_BAND[t.era] or "ancient"
			if BAND_RANK[band] > BAND_RANK[best] then
				best = band
			end
		end
	end
	return best
end

-- pop -> settlement tier (block count grows 3/6/9/12); pop is fog-legal for
-- every visible city
local function popTier(pop)
	pop = pop or 1
	if pop <= 2 then return 1
	elseif pop <= 5 then return 2
	elseif pop <= 9 then return 3
	else return 4 end
end

local function renderCities(view)
	citiesFolder:ClearAllChildren()
	local retro = lookOf() ~= "enhanced"
	local techsTable = ClientState.rulesets().techs
	for id, c in pairs(view.cities) do
		local model = Instance.new("Model")
		model.Name = id .. "_" .. c.owner
		local top = tileTop(view.map.tiles[c.y * view.map.width + c.x + 1].t)
		local cx, cz = c.x * TILE, c.y * TILE
		local style = BAND_STYLE[cityEraBand(view.players[c.owner], techsTable)]

		local plaza = Instance.new("Part")
		plaza.Anchored = true
		plaza.Shape = Enum.PartType.Cylinder
		plaza.Name = "Plaza"
		plaza.Size = Vector3.new(0.3, TILE * 0.95, TILE * 0.95)
		plaza.CFrame = CFrame.new(cx, top + 0.15, cz) * CFrame.Angles(0, 0, math.rad(90))
		plaza.Color = hexColor(Palette.displayColor(view.players[c.owner].color))
		plaza.Material = retro and Enum.Material.SmoothPlastic or Enum.Material.Marble
		plaza.Parent = model

		local tier = popTier(c.pop)
		local nblocks = tier * 3
		for i = 1, nblocks do
			-- deterministic per-block hash (render-only, no engine RNG)
			local seed = c.x * 31 + c.y * 17 + i * 101
			local ang = (seed % 360) * (math.pi / 180)
			local ring = 0.22 + (i % 3) * 0.15
			local rad = ring * TILE * (0.45 + tier * 0.12)
			local bx, bz = math.cos(ang) * rad, math.sin(ang) * rad
			local w = TILE * (0.13 + (seed % 5) * 0.02)
			-- SIZE sets height (contract: band sets style, not height)
			local h = 1.2 * (0.55 + (seed % 7) / 9) * (0.7 + tier * 0.12)
			block(model, "Block" .. i, Vector3.new(w, h, w),
				Vector3.new(cx + bx, top + 0.3 + h / 2, cz + bz), style.wall,
				retro and Enum.Material.SmoothPlastic or style.wallMat)
			-- roof cap: proportions encode roofShape (peak/flat/slab)
			local rw, rh
			if style.roofShape == "peak" then
				rw, rh = w * 0.96, w * 0.55
			elseif style.roofShape == "flat" then
				rw, rh = w * 1.2, 0.18
			else -- slab
				rw, rh = w * 1.02, 0.14
			end
			block(model, "Roof" .. i, Vector3.new(rw, rh, rw),
				Vector3.new(cx + bx, top + 0.3 + h + rh / 2, cz + bz), style.roof,
				retro and Enum.Material.SmoothPlastic or style.roofMat)
		end
		-- the band's signature landmark (towns+ only, so hamlets read as huts)
		if tier >= 2 then
			if style.prop == "keep" then
				local kh = 2.0 + tier * 0.2
				block(model, "Keep", Vector3.new(TILE * 0.22, kh, TILE * 0.22),
					Vector3.new(cx, top + 0.3 + kh / 2, cz), style.wall,
					retro and Enum.Material.SmoothPlastic or Enum.Material.Slate)
			elseif style.prop == "smokestack" then
				local sh = 2.4 + tier * 0.2
				local st = Instance.new("Part")
				st.Anchored = true
				st.Shape = Enum.PartType.Cylinder
				st.Name = "Smokestack"
				st.Size = Vector3.new(sh, TILE * 0.12, TILE * 0.12)
				st.CFrame = CFrame.new(cx + TILE * 0.26, top + 0.3 + sh / 2, cz - TILE * 0.2)
					* CFrame.Angles(0, 0, math.rad(90))
				st.Color = Color3.fromRGB(60, 56, 54)
				st.Material = retro and Enum.Material.SmoothPlastic or Enum.Material.Concrete
				st.Parent = model
			elseif style.prop == "spire" then
				local ph = 2.8 + tier * 0.3
				block(model, "Spire", Vector3.new(TILE * 0.1, ph, TILE * 0.1),
					Vector3.new(cx, top + 0.3 + ph / 2, cz), style.wall,
					retro and Enum.Material.SmoothPlastic or Enum.Material.Metal)
			end
		end
		cityBillboard(model, plaza, view, c)
		model.Parent = citiesFolder
	end
end

-- session-E round 15 (user): DANGER overlay — any visible enemy unit standing
-- adjacent (king-move) to an own city or own unit gets a transparent red
-- quad on its tile. Pure view read; fog is respected by construction (only
-- units the filter shows can threaten).
local dangerFolder = Instance.new("Folder")
dangerFolder.Name = "DangerTiles"
dangerFolder.Parent = world

local function adjacentWrap(map, ax, ay, bx, by)
	local dx = math.abs(ax - bx)
	if map.wrapX then
		dx = math.min(dx, map.width - dx)
	end
	return dx <= 1 and math.abs(ay - by) <= 1
end

local function renderDanger(view)
	dangerFolder:ClearAllChildren()
	local own = {} -- own units + cities, the assets a neighbor can threaten
	for _, u in pairs(view.units) do
		if u.owner == view.you then
			table.insert(own, u)
		end
	end
	for _, c in pairs(view.cities) do
		if c.owner == view.you then
			table.insert(own, c)
		end
	end
	local marked = {}
	for _, u in pairs(view.units) do
		if u.owner ~= view.you then
			local key = u.y * view.map.width + u.x
			if marked[key] == nil then
				for _, a in ipairs(own) do
					if adjacentWrap(view.map, u.x, u.y, a.x, a.y) then
						marked[key] = true
						local quad = Instance.new("Part")
						quad.Anchored = true
						quad.CanCollide = false
						quad.CanQuery = false
						quad.Size = Vector3.new(TILE * 0.95, 0.15, TILE * 0.95)
						quad.CFrame = CFrame.new(u.x * TILE,
							tileTop(view.map.tiles[u.y * view.map.width + u.x + 1].t) + 0.35,
							u.y * TILE)
						quad.Color = Color3.fromRGB(220, 50, 40)
						quad.Material = Enum.Material.Neon
						quad.Transparency = 0.65
						quad.Parent = dangerFolder
						break
					end
				end
			end
		end
	end
end

-- CP1 (docs/13): tile props — the client/renderer/three/props.js twin, a
-- richer superset of the old run-F #5 improvement blocks it supersedes:
-- segmented roads with cross-ties, irrigation channel + field patches, mine
-- door+beam, a torus fortress, PLUS terrain features the blocks never drew
-- (forest/jungle trees, hill rocks, mountain peak+snow, scrub tufts, shore
-- foam, resource specials, goody huts). Shapes are the shared PROP_SHAPES
-- recipe built via AssetFactory (the R8 composer; gate 25). Fog-honest and
-- render-only; TileProps signature-caches so only prop-relevant tile changes
-- rebuild. All parts CanQuery=false so they never intercept the selection ray.
local propsFolder = Instance.new("Folder")
propsFolder.Name = "TileProps"
propsFolder.Parent = world

local function renderImprovements(view)
	if TileProps.rebuild(propsFolder, view, tileTop, TILE) then
		for _, p in ipairs(propsFolder:GetDescendants()) do
			if p:IsA("BasePart") then
				p.CanCollide = false
				p.CanQuery = false
			end
		end
	end
end

ClientState.onView(function(view)
	renderTerrain(view)
	renderUnits(view)
	renderCities(view)
	renderDanger(view)
	renderImprovements(view)
end)

-- runN (Studio soft-reset): wipe EVERY world cache so the next game starts from
-- a black map — the runN fog residue was tileParts/tileShown surviving the reset
ClientState.onServerReset(function()
	for i in pairs(tileParts) do
		tileParts[i] = nil
	end
	for i in pairs(tileShown) do
		tileShown[i] = nil
	end
	terrainFolder:ClearAllChildren()
	unitsFolder:ClearAllChildren()
	citiesFolder:ClearAllChildren()
	dangerFolder:ClearAllChildren()
	propsFolder:ClearAllChildren()
	TileProps.resetCache()
end)

-- R20: the enhanced look owns a subtle Atmosphere (depth haze) — removed
-- cleanly in retro; procedural, no assets
local Lighting = game:GetService("Lighting")
local atmosphere = Instance.new("Atmosphere")
atmosphere.Density = 0.28
atmosphere.Offset = 0.2
atmosphere.Haze = 1.4
atmosphere.Color = Color3.fromRGB(215, 225, 240)

local function applyLookExtras(look)
	atmosphere.Parent = look == "enhanced" and Lighting or nil
end
applyLookExtras(lookOf())

-- a look change repaints terrain + cities + units on the next frame
local lastLook = nil
game:GetService("RunService").Heartbeat:Connect(function()
	local look = lookOf() .. "|" .. Palette.mode() -- SO14: palette flips repaint too
	if lastLook ~= nil and look ~= lastLook and ClientState.view ~= nil then
		renderTerrain(ClientState.view)
		renderCities(ClientState.view)
		renderUnits(ClientState.view) -- unit materials come from AssetFactory's look map
		applyLookExtras(look)
	end
	lastLook = look
end)

print("[ViewRenderer] R4 view renderer up: waiting for the first view push")
