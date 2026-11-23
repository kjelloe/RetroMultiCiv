-- Draws YieldIcons rows into a label box: one tiled ImageLabel per resource
-- (the icon repeated n times), all sharing one drawn image per resource.
-- fill() returns false when the images cannot be drawn; the caller then
-- shows YieldIcons.text (the glyph rows).
local YieldIcons = require(script.Parent:WaitForChild("YieldIcons"))
local EditableGlyph = require(script.Parent:WaitForChild("EditableGlyph"))

local M = {}

local function hexColor(hex)
	local n = tonumber(string.sub(hex, 2), 16) or 0
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
end

local content = nil -- key -> Content; false = drawing failed (reported once by EditableGlyph)
local function contents()
	if content == nil then
		local made = {}
		for _, k in ipairs(YieldIcons.KINDS) do
			local c = EditableGlyph.primsContent(YieldIcons.ICONS[k.key], hexColor(k.color))
			if c == nil then
				content = false
				return false
			end
			made[k.key] = c
		end
		content = made
		print("[YieldLabel] icons drawn: food wheat, shields coin, trade arrows")
	end
	return content
end

-- box = a GuiObject; replaces the rows it holds. -> true when drawn
function M.fill(box, yields)
	local imgs = contents()
	if not imgs then
		return false
	end
	for _, child in ipairs(box:GetChildren()) do
		if child.Name == "YieldRow" then
			child:Destroy()
		end
	end
	for _, row in ipairs(YieldIcons.layout(yields)) do
		local label = Instance.new("ImageLabel")
		label.Name = "YieldRow"
		label.AnchorPoint = Vector2.new(0.5, 0)
		label.Position = UDim2.fromScale(0.5, row.y)
		label.Size = UDim2.fromScale(1, row.h)
		label.BackgroundTransparency = 1
		label.Active = false
		label.ImageContent = imgs[row.key]
		label.ScaleType = Enum.ScaleType.Tile
		label.TileSize = UDim2.fromScale(1 / row.n, 1)
		local aspect = Instance.new("UIAspectRatioConstraint")
		aspect.AspectRatio = row.n
		aspect.Parent = label
		label.Parent = box
	end
	return true
end

return M
