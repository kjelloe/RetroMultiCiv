-- Builds a StructureModels entry out of Parts (specs/roblox-pedia-art.md).
-- Returns one list of instances per primitive, bottom-up, so the wonder
-- scene can raise them in order. The pyramid and the cone fan follow
-- AssetFactory's proven piece placement.
local StructureModels = require(script.Parent:WaitForChild("StructureModels"))

local M = {}

local function hexColor(hex)
	local n = tonumber(string.sub(hex, 2), 16) or 0
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
end

local function piece(parent, className, role)
	local def = StructureModels.ROLES[role]
	local p = Instance.new(className)
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CastShadow = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Color = hexColor(def.color)
	p.Material = Enum.Material[def.material]
	p.Parent = parent
	return p
end

local function primitive(parent, prim, origin, k)
	local w, h, d = prim.size[1] * k, prim.size[2] * k, prim.size[3] * k
	local base = origin * CFrame.new(prim.at[1] * k, prim.at[2] * k, prim.at[3] * k)
		* CFrame.Angles(0, math.rad(prim.yaw or 0), 0)
	local out = {}
	local s = prim.s
	if s == "box" then
		local p = piece(parent, "Part", prim.role)
		p.Size = Vector3.new(w, h, d)
		p.CFrame = base * CFrame.new(0, h / 2, 0)
		out[1] = p
	elseif s == "cyl" then
		local p = piece(parent, "Part", prim.role)
		p.Shape = Enum.PartType.Cylinder
		p.Size = Vector3.new(h, w, w)
		p.CFrame = base * CFrame.new(0, h / 2, 0) * CFrame.Angles(0, 0, math.rad(90))
		out[1] = p
	elseif s == "ball" then
		local p = piece(parent, "Part", prim.role)
		p.Shape = Enum.PartType.Ball
		p.Size = Vector3.new(w, w, w)
		p.CFrame = base * CFrame.new(0, w / 2, 0)
		out[1] = p
	elseif s == "wedge" then
		local p = piece(parent, "WedgePart", prim.role)
		p.Size = Vector3.new(w, h, d)
		p.CFrame = base * CFrame.new(0, h / 2, 0)
		out[1] = p
	elseif s == "pyramid" then
		local r = w / 2
		for i = 0, 3 do
			local p = piece(parent, "CornerWedgePart", prim.role)
			p.Size = Vector3.new(r, h, r)
			p.CFrame = base * CFrame.Angles(0, math.rad(90 * i + 180), 0) * CFrame.new(r / 2, h / 2, -r / 2)
			out[#out + 1] = p
		end
	elseif s == "cone" then
		local r, n = w / 2, 8
		local chord = 2 * r * math.tan(math.pi / n)
		for i = 0, n - 1 do
			local p = piece(parent, "WedgePart", prim.role)
			p.Size = Vector3.new(chord, h, r)
			p.CFrame = base * CFrame.Angles(0, (i + 0.5) * 2 * math.pi / n, 0) * CFrame.new(0, h / 2, -r / 2)
			out[#out + 1] = p
		end
	end
	return out
end

-- origin = the centre of the model's floor; k = studs per model unit.
-- Returns { groups = { {Instance,...}, ... } bottom-up, ground = Part }
function M.build(parent, def, origin, k)
	k = k or 1
	local groups = {}
	for _, prim in ipairs(StructureModels.expand(def)) do
		groups[#groups + 1] = primitive(parent, prim, origin, k)
	end
	local ground = piece(parent, "Part", def.ground)
	ground.Shape = Enum.PartType.Cylinder
	local span = (StructureModels.LIMIT.half * 2 + 5) * k
	ground.Size = Vector3.new(0.3 * k, span, span)
	ground.CFrame = origin * CFrame.new(0, -0.15 * k, 0) * CFrame.Angles(0, 0, math.rad(90))
	return { groups = groups, ground = ground }
end

return M
