-- R8: the Luau recipe composer (roblox/SPEC.md §3k) — the twin of
-- client/renderer/three/composer-side building from the SAME data:
-- data/assets/asset-recipes.json baked as GameData.AssetRecipes (raw JSON,
-- json2lua at first require, gated on gamecode.fnv32 over the raw bytes —
-- recipes carry floats + prose, so statehash is the wrong hasher here).
--
-- Geometry mapping (three.js recipe frame -> Roblox):
--   box    -> Part Block; size [w,h,d] * scale * SCALE
--   cyl    -> Part Cylinder (axis X, stood up to Y); size [rTop,rBot,h] —
--             Roblox has no taper, radius = (rTop+rBot)/2 (flagged approx);
--             non-uniform scale maps r *= (sx+sz)/2, h *= sy
--   sphere -> Part Ball; size [r]
--   cone   -> seg 4 = square pyramid from 4 CornerWedgeParts;
--             seg N = coneMode "fan" (N WedgeParts, chord-width slabs) or
--             "stack" (3-disc ziggurat) — the USER'S judgment point, both
--             render in the gallery grid (K)
--   dodeca -> squat Ball (rock stand-in, flagged approx)
--   torus  -> ring of 8 boxes (fortress wall stand-in, flagged approx)
--   rot [rx,ry,rz] radians -> CFrame.fromEulerAnglesXYZ (single-axis in
--   practice); pos is y-up, scaled by SCALE studs per recipe unit.
-- colorRole 'primary'/'secondary' are SLOTS filled from the civ color at
-- build time — the data never carries a faction hex (A88 contract).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local json2lua = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("json2lua"))
local gamecode = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("gamecode"))
local gameData = ReplicatedStorage:WaitForChild("GameData")
local expectedHashes = require(gameData:WaitForChild("RulesetHashes"))

local SCALE = 4 -- studs per recipe unit (recipe world: 1 unit = 1 tile edge)

local M = {}
M.coneMode = "fan" -- default; "stack" is the alternate gallery variant

local data = nil
function M.data()
	if data == nil then
		local raw = require(gameData:WaitForChild("AssetRecipes"))
		local h = gamecode.fnv32(raw, false)
		if h ~= expectedHashes.assetRecipes then
			error(("[AssetFactory] RECIPES GATE FAILED: baked bytes hash %d, expected %d")
				:format(h, expectedHashes.assetRecipes))
		end
		data = json2lua.parse(raw)
	end
	return data
end

local function hexColor(hex)
	local n = tonumber(string.sub(hex, 2), 16) or 0
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
end

local function resolveColor(role, colors)
	if role == "primary" then
		return colors.primary
	elseif role == "secondary" then
		return colors.secondary or colors.primary
	end
	local hex = M.data().colorRoles[role]
	return hex and hexColor(hex) or Color3.fromRGB(200, 200, 200)
end

-- R20 (visual-fidelity, #1186): the ENHANCED look maps colorRoles to
-- built-in materials — presentation only, the shared recipes untouched.
-- Faction slots (primary/secondary) and organics stay SmoothPlastic for
-- silhouette readability. activeMaterial is set once per primitive in
-- buildPrimitive; every part (incl. pyramid/fan pieces) inherits it.
local ROLE_MATERIAL = {
	wood = Enum.Material.WoodPlanks, hull = Enum.Material.WoodPlanks,
	wheel = Enum.Material.Wood, canvas = Enum.Material.Fabric,
	cloth = Enum.Material.Fabric, metal = Enum.Material.Metal,
	darkMetal = Enum.Material.Metal, stone = Enum.Material.Slate,
	house = Enum.Material.Brick,
}
local activeMaterial = Enum.Material.SmoothPlastic

local function lookMaterial(role)
	local ClientState = require(script.Parent:WaitForChild("ClientState"))
	if ClientState.options.look ~= "enhanced" then
		return Enum.Material.SmoothPlastic
	end
	return ROLE_MATERIAL[role] or Enum.Material.SmoothPlastic
end

local function basePart(className)
	local p = Instance.new(className or "Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = activeMaterial
	return p
end

-- scale spec: nil | scalar | [sx,sy,sz] -> three numbers
local function scaleOf(spec)
	if spec == nil then
		return 1, 1, 1
	elseif typeof(spec) == "number" then
		return spec, spec, spec
	end
	return spec[1], spec[2], spec[3]
end

local function rotOf(prim)
	local r = prim.rot
	if r == nil then
		return CFrame.identity
	end
	return CFrame.fromEulerAnglesXYZ(r[1], r[2], r[3])
end

-- place: model-local CFrame for a primitive's center offset (dy above pos)
local function placeAt(origin, prim, dy)
	local p = prim.pos or { 0, 0, 0 }
	return origin * CFrame.new(p[1] * SCALE, (p[2] + (dy or 0)) * SCALE, p[3] * SCALE) * rotOf(prim)
end

-- square pyramid: 4 CornerWedgeParts, apex corners meeting at the axis.
-- baseCF = base-center CFrame IN THE PRIMITIVE'S ROTATED FRAME (a tilted
-- cone's base shifts along its own axis). The +180 yaw is the flip the
-- user's model-house-fail1.png proved necessary (apexes pointed outward,
-- a crown) — the gallery grid (K) is the verification surface.
local function pyramid(model, baseCF, r, h, color)
	for i = 0, 3 do
		local piece = basePart("CornerWedgePart")
		piece.Size = Vector3.new(r, h, r)
		piece.Color = color
		piece.CFrame = baseCF * CFrame.Angles(0, math.rad(90 * i + 180), 0) * CFrame.new(r / 2, h / 2, -r / 2)
		piece.Parent = model
	end
end

-- N-sided cone, variant A: a fan of N wedge slabs — vertical faces meet at
-- the axis, ramps descend outward; chord width tiles the base circle
local function coneFan(model, baseCF, r, h, color, n)
	local chord = 2 * r * math.tan(math.pi / n)
	for i = 0, n - 1 do
		local piece = basePart("WedgePart")
		piece.Size = Vector3.new(chord, h, r)
		piece.Color = color
		piece.CFrame = baseCF * CFrame.Angles(0, (i + 0.5) * 2 * math.pi / n, 0)
			* CFrame.new(0, h / 2, -r / 2)
		piece.Parent = model
	end
end

-- N-sided cone, variant B: the 3-disc ziggurat cheat
local function coneStack(model, baseCF, r, h, color)
	for i, frac in ipairs({ 5 / 6, 3 / 6, 1 / 6 }) do
		local piece = basePart()
		piece.Shape = Enum.PartType.Cylinder
		piece.Size = Vector3.new(h / 3, 2 * r * frac, 2 * r * frac)
		piece.Color = color
		piece.CFrame = baseCF * CFrame.new(0, (i - 0.5) * h / 3, 0) * CFrame.Angles(0, 0, math.rad(90))
		piece.Parent = model
	end
end

-- one primitive into the model; coneMode overrides M.coneMode when given.
-- Recipe pos marks the primitive CENTER for box/cyl/sphere but the cone
-- BASE-to-apex span is centered at pos in three (ConeGeometry centers on
-- its half-height) — cones therefore offset down by h/2.
local function buildPrimitive(model, prim, colors, origin, coneMode)
	activeMaterial = lookMaterial(prim.color) -- R20: every part below inherits
	local sx, sy, sz = scaleOf(prim.scale)
	local shape = prim.shape
	if shape == "box" then
		local p = basePart()
		p.Size = Vector3.new(prim.size[1] * sx, prim.size[2] * sy, prim.size[3] * sz) * SCALE
		p.Color = resolveColor(prim.color, colors)
		p.CFrame = placeAt(origin, prim)
		p.Parent = model
	elseif shape == "cyl" then
		local r = (prim.size[1] + prim.size[2]) / 2 * (sx + sz) / 2 * SCALE
		local h = prim.size[3] * sy * SCALE
		local p = basePart()
		p.Shape = Enum.PartType.Cylinder
		p.Size = Vector3.new(h, 2 * r, 2 * r)
		p.Color = resolveColor(prim.color, colors)
		p.CFrame = placeAt(origin, prim) * CFrame.Angles(0, 0, math.rad(90))
		p.Parent = model
	elseif shape == "sphere" then
		local d = prim.size[1] * 2 * (sx + sy + sz) / 3 * SCALE
		local p = basePart()
		p.Shape = Enum.PartType.Ball
		p.Size = Vector3.new(d, d, d)
		p.Color = resolveColor(prim.color, colors)
		p.CFrame = placeAt(origin, prim)
		p.Parent = model
	elseif shape == "cone" then
		-- three's ConeGeometry centers on half-height: pos = the cone CENTER;
		-- shift to the base in the primitive's OWN rotated frame
		local r = prim.size[1] * (sx + sz) / 2 * SCALE
		local h = prim.size[2] * sy * SCALE
		local color = resolveColor(prim.color, colors)
		local baseCF = placeAt(origin, prim) * CFrame.new(0, -h / 2, 0)
		if (prim.seg or 8) == 4 then
			pyramid(model, baseCF, r, h, color)
		elseif (coneMode or M.coneMode) == "stack" then
			coneStack(model, baseCF, r, h, color)
		else
			coneFan(model, baseCF, r, h, color, prim.seg or 8)
		end
	elseif shape == "dodeca" then
		local d = prim.size[1] * 2 * SCALE
		local p = basePart()
		p.Shape = Enum.PartType.Ball
		p.Size = Vector3.new(d, d * 0.75, d)
		p.Color = resolveColor(prim.color, colors)
		p.CFrame = placeAt(origin, prim)
		p.Parent = model
	elseif shape == "torus" then
		local r = prim.size[1] * SCALE
		local tube = prim.size[2] * 2 * SCALE
		local color = resolveColor(prim.color, colors)
		for i = 0, 7 do
			local a = i * math.pi / 4
			local seg = basePart()
			seg.Size = Vector3.new(2 * r * math.tan(math.pi / 8), tube, tube)
			seg.Color = color
			seg.CFrame = placeAt(origin, prim)
				* CFrame.Angles(0, a, 0) * CFrame.new(0, 0, -r)
			seg.Parent = model
		end
	end
end

function M.buildRecipe(model, recipeKey, colors, origin, coneMode)
	local recipe = M.data().unitRecipes[recipeKey]
	if recipe == nil then
		return false
	end
	for _, prim in ipairs(recipe) do
		buildPrimitive(model, prim, colors, origin, coneMode)
	end
	return true
end

-- the composer contract (assets.js twin): silhouette key by unit type;
-- extras (e.g. chariot -> chariotWheels) come from the JSON's typeExtra
-- block (2bc97b3 killed the dual source; the old hardcode is gone)
function M.buildUnit(model, unitTypeId, colors, origin, coneMode)
	local data = M.data()
	local key = data.unitSilhouette[unitTypeId]
	if key == nil then
		key = "fallback"
	end
	local ok = M.buildRecipe(model, key, colors, origin, coneMode)
	local extra = data.typeExtra ~= nil and data.typeExtra[unitTypeId] or nil
	if extra ~= nil then
		M.buildRecipe(model, extra, colors, origin, coneMode)
	end
	return ok
end

function M.buildShape(model, prim, colors, origin, coneMode)
	buildPrimitive(model, prim, colors, origin, coneMode)
end

return M
