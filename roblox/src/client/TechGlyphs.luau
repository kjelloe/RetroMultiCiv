-- Tech glyphs (XII.6 Part C), Roblox fallback (b) per architect ruling #2078
-- item 5: the EditableImage motif path is Studio-runtime-gated (beta flag), so
-- this ships the 4 ERA FRAMES only — a per-era colored frame badge, readable
-- and cheap, no image asset. The shared source of the era palette (1:1 with the
-- browser client/ui/tech-glyphs.js ERA table); TechTree/ResearchPicker/
-- DiscoveryCard all read it so era colouring is consistent. Render-only, fog
-- is the caller's concern. Gate 26 pins the palette to the browser twin. The
-- full 68-motif path unlocks later IF the EditableImage Studio spike passes.
local M = {}

-- era palette, edge/fill/ink — RGB of the browser tech-glyphs.js hex:
-- ancient #b9975b/#241d11/#ecdcb4, renaissance #6ba368/#152418/#cdeac7,
-- industrial #6f8bb0/#131d28/#d2e2f3, modern #9b7fc9/#1d1830/#e2d4f5.
M.ERA = {
	ancient = { edge = Color3.fromRGB(185, 151, 91), fill = Color3.fromRGB(36, 29, 17), ink = Color3.fromRGB(236, 220, 180) },
	renaissance = { edge = Color3.fromRGB(107, 163, 104), fill = Color3.fromRGB(21, 36, 24), ink = Color3.fromRGB(205, 234, 199) },
	industrial = { edge = Color3.fromRGB(111, 139, 176), fill = Color3.fromRGB(19, 29, 40), ink = Color3.fromRGB(210, 226, 243) },
	modern = { edge = Color3.fromRGB(155, 127, 201), fill = Color3.fromRGB(29, 24, 48), ink = Color3.fromRGB(226, 212, 245) },
}
M.ERA_ORDER = { "ancient", "renaissance", "industrial", "modern" }
M.ERA_NAME = { ancient = "ANCIENT", renaissance = "RENAISSANCE", industrial = "INDUSTRIAL", modern = "MODERN" }

-- era for a tech id, fog-free (era is a ruleset fact, not a fogged field).
function M.eraOf(techs, id)
	local def = techs[id]
	return (def ~= nil and def.era) or "ancient"
end

function M.colorOf(era)
	return M.ERA[era] or M.ERA.ancient
end

-- the fallback GLYPH: an era-framed badge (fill body + edge stroke + rounded
-- corner). No motif — the frame + colour IS the glyph at this tier. Parented to
-- `parent`; the caller sizes/positions via the returned Frame.
function M.badge(parent, era, px)
	local c = M.colorOf(era)
	local f = Instance.new("Frame")
	f.Name = "GlyphBadge"
	f.Size = UDim2.fromOffset(px, px)
	f.BackgroundColor3 = c.fill
	f.BorderSizePixel = 0
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, math.max(2, math.floor(px * 0.18)))
	corner.Parent = f
	local stroke = Instance.new("UIStroke")
	stroke.Color = c.edge
	stroke.Thickness = math.max(1, math.floor(px * 0.12))
	stroke.Parent = f
	-- an inner ink pip so the badge reads as "keyed" even at small sizes
	local pip = Instance.new("Frame")
	pip.Name = "Pip"
	pip.AnchorPoint = Vector2.new(0.5, 0.5)
	pip.Position = UDim2.fromScale(0.5, 0.5)
	pip.Size = UDim2.fromOffset(math.max(2, math.floor(px * 0.34)), math.max(2, math.floor(px * 0.34)))
	pip.BackgroundColor3 = c.ink
	pip.BorderSizePixel = 0
	local pc = Instance.new("UICorner")
	pc.CornerRadius = UDim.new(1, 0)
	pc.Parent = pip
	pip.Parent = f
	f.Parent = parent
	return f
end

return M
