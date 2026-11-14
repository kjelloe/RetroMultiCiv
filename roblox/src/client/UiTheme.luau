-- Roblox-native look, phase U1 (specs/roblox-native-look.md): the shared
-- chunky game-style button dress. apply() decorates an EXISTING TextButton —
-- rounded corners, dark outline, top-lit gradient, rounded display font with
-- an outlined label, hover/press feedback, and an optional code-drawn icon
-- (MenuIcons via EditableGlyph). It never moves or resizes the button, so
-- each panel keeps its own layout; a button's own code may keep recolouring
-- BackgroundColor3 (the gradient multiplies whatever colour is set).
-- Presentation only: no state, no commands.
local TweenService = game:GetService("TweenService")

local EditableGlyph = require(script.Parent:WaitForChild("EditableGlyph"))
local MenuIcons = require(script.Parent:WaitForChild("MenuIcons"))

local M = {}

M.FONT = Enum.Font.FredokaOne
M.COLOR = {
	menu = Color3.fromRGB(56, 128, 214), -- blue: opens a panel
	go = Color3.fromRGB(62, 176, 84), -- green: commits / advances
	science = Color3.fromRGB(232, 158, 44), -- amber
	space = Color3.fromRGB(142, 96, 214), -- purple
	danger = Color3.fromRGB(214, 78, 70), -- red: close / cancel / destructive
	neutral = Color3.fromRGB(88, 98, 120),
}
M.OUTLINE = Color3.fromRGB(18, 20, 28)
M.INK = Color3.fromRGB(250, 250, 250)

local REST = Vector2.new(0, 0)
local PRESSED = Vector2.new(0, 0.35) -- gradient slides down = the face darkens
local TWEEN = TweenInfo.new(0.08, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)

local function child(parent, class, name)
	local c = parent:FindFirstChild(name)
	if c == nil then
		c = Instance.new(class)
		c.Name = name
		c.Parent = parent
	end
	return c
end

-- opts: color (Color3 or a M.COLOR key), icon (MenuIcons id), iconOnly (drop
-- the text when the icon renders), radius, maxText
local function dress(btn, opts)
	opts = opts or {}
	local color = opts.color
	if type(color) == "string" then
		color = M.COLOR[color]
	end
	if color ~= nil then
		btn.BackgroundColor3 = color
	end
	btn.AutoButtonColor = false
	btn.BorderSizePixel = 0
	btn.Font = M.FONT
	btn.TextColor3 = M.INK

	local corner = btn:FindFirstChildOfClass("UICorner") or Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, opts.radius or 12)
	corner.Parent = btn

	local outline = child(btn, "UIStroke", "ThemeOutline")
	outline.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	outline.Color = M.OUTLINE
	outline.Thickness = 2.5

	local textStroke = child(btn, "UIStroke", "ThemeTextStroke")
	textStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Contextual
	textStroke.Color = M.OUTLINE
	textStroke.Thickness = 1.5

	local grad = child(btn, "UIGradient", "ThemeGradient")
	grad.Rotation = 90
	grad.Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 255, 255)),
		ColorSequenceKeypoint.new(0.55, Color3.fromRGB(232, 232, 232)),
		ColorSequenceKeypoint.new(1, Color3.fromRGB(168, 168, 168)),
	})

	if btn:GetAttribute("themed") ~= true then
		btn:SetAttribute("themed", true)
		btn.MouseEnter:Connect(function()
			outline.Color = Color3.fromRGB(245, 245, 245)
		end)
		btn.MouseLeave:Connect(function()
			outline.Color = M.OUTLINE
			TweenService:Create(grad, TWEEN, { Offset = REST }):Play()
		end)
		btn.MouseButton1Down:Connect(function()
			TweenService:Create(grad, TWEEN, { Offset = PRESSED }):Play()
		end)
		btn.MouseButton1Up:Connect(function()
			TweenService:Create(grad, TWEEN, { Offset = REST }):Play()
		end)
	end

	if opts.icon ~= nil and btn:FindFirstChild("ThemeIcon") == nil then
		local h = btn.AbsoluteSize.Y > 0 and btn.AbsoluteSize.Y or btn.Size.Y.Offset
		local px = math.max(16, h - 12)
		local icon = EditableGlyph.renderPrims(btn, MenuIcons.ICONS[opts.icon], px, M.INK)
		if icon ~= nil then
			icon.Name = "ThemeIcon"
			icon.AnchorPoint = Vector2.new(0, 0.5)
			icon.Position = UDim2.new(0, 7, 0.5, 0)
			icon.ZIndex = btn.ZIndex + 1
			if opts.iconOnly == true then
				icon.AnchorPoint = Vector2.new(0.5, 0.5)
				icon.Position = UDim2.fromScale(0.5, 0.5)
				btn.Text = ""
			else
				-- the label shares the button with the icon: shrink-to-fit, never clip
				local pad = child(btn, "UIPadding", "ThemePad")
				pad.PaddingLeft = UDim.new(0, px + 12)
				pad.PaddingRight = UDim.new(0, 6)
				local cap = child(btn, "UITextSizeConstraint", "ThemeTextCap")
				cap.MaxTextSize = opts.maxText or btn.TextSize
				cap.MinTextSize = 9
				btn.TextScaled = true
			end
		end
	end
end

-- A dress failure must never take the calling panel script down with it: the
-- button stays as its owner built it and the Output carries one warning.
function M.apply(btn, opts)
	local ok, err = pcall(dress, btn, opts)
	if not ok then
		warn(("[UiTheme] %s left unstyled: %s"):format(btn.Name, tostring(err)))
	end
	return btn
end

return M
