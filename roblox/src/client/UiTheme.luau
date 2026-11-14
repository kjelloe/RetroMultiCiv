-- Roblox-native look, phase U1 (specs/roblox-native-look.md): the shared
-- chunky game-style button dress. apply() decorates an EXISTING TextButton —
-- rounded corners, dark outline, top-lit gradient, rounded display font with
-- an outlined label, hover/press feedback, and an optional code-drawn icon
-- (MenuIcons via EditableGlyph). It never moves or resizes the button, so
-- each panel keeps its own layout; a button's own code may keep recolouring
-- BackgroundColor3 (the gradient multiplies whatever colour is set).
-- Presentation only: no state, no commands.
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local EditableGlyph = require(script.Parent:WaitForChild("EditableGlyph"))
local MenuIcons = require(script.Parent:WaitForChild("MenuIcons"))
local UiText = require(script.Parent:WaitForChild("UiText"))
local Diag = require(script.Parent:WaitForChild("Diag"))

local M = {}

M.FONT = Enum.Font.FredokaOne
-- reading text (cards, welcome / advice copy): proportional face, 17 px body,
-- never under SMALL for anything a player is meant to read
M.BODY_FONT = Enum.Font.GothamMedium
M.TEXT = { title = 22, body = 17, small = 14 }
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

-- ruling 2026-11-14: hotkey hints stay on desktop, go on a touch-only device
function M.touchOnly()
	return UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled
end

function M.phone()
	local cam = workspace.CurrentCamera
	if cam == nil then
		return false
	end
	return UiText.isPhone(UserInputService.TouchEnabled, cam.ViewportSize.X, cam.ViewportSize.Y)
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
		Diag.count("ui", "themed")
		-- owners rewrite Text at runtime ("Ride (P)" <-> "Dismount (P)"), so
		-- the hint is dropped on every write; a stripped label is a fixed point
		local function hint()
			-- an icon-only (compact) button stays icon-only when its owner
			-- rewrites the label ("Turn log (L) · 3"): the text is kept for
			-- the way back and blanked again
			if btn.Text ~= "" and btn:GetAttribute("themeCompact") == true then
				btn:SetAttribute("themeText", btn.Text)
				btn.Text = ""
				return
			end
			if btn.Text ~= "" and (M.touchOnly() or M.phone()) then
				local t = UiText.stripHint(btn.Text)
				if t ~= btn.Text then
					btn.Text = t
				end
			end
		end
		btn:GetPropertyChangedSignal("Text"):Connect(hint)
		hint()
		-- owners often add their own UICorner right after the dress; two
		-- corners on one button fight, so a later one is dropped
		btn.ChildAdded:Connect(function(c)
			if c:IsA("UICorner") and c ~= corner then
				task.defer(function()
					c:Destroy()
				end)
			end
		end)
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

	if opts.icon ~= nil then
		btn:SetAttribute("themeIcon", opts.icon) -- the audit compares wanted vs drawn
	end
	if opts.icon ~= nil and btn:FindFirstChild("ThemeIcon") == nil then
		local h = btn.AbsoluteSize.Y > 0 and btn.AbsoluteSize.Y or btn.Size.Y.Offset
		local w = btn.AbsoluteSize.X > 0 and btn.AbsoluteSize.X or btn.Size.X.Offset
		-- never taller than the button, never wider than its share of it
		local share = opts.iconOnly == true and (w - 12) or math.floor(w * 0.45)
		local px = math.max(12, math.min(h - 12, share > 0 and share or h - 12))
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
				-- run-R: UIPadding moves child instances too, so the icon is
				-- pulled back out of the padded area to the button's left edge
				local pad = child(btn, "UIPadding", "ThemePad")
				pad.PaddingLeft = UDim.new(0, px + 12)
				pad.PaddingRight = UDim.new(0, 6)
				icon.Position = UDim2.new(0, 7 - (px + 12), 0.5, 0)
				btn:SetAttribute("themeIconPad", px + 12)
				local cap = child(btn, "UITextSizeConstraint", "ThemeTextCap")
				cap.MaxTextSize = opts.maxText or btn.TextSize
				cap.MinTextSize = 9
				btn.TextScaled = true
			end
		end
	end
end

-- U3: flip a dressed icon + label button between its full form and an
-- icon-only square (HudDock, when the row runs out of width). A button whose
-- icon did not render keeps its text: there would be nothing left to show.
function M.setCompact(btn, compact)
	local icon = btn:FindFirstChild("ThemeIcon")
	if icon == nil or (btn:GetAttribute("themeCompact") == true) == compact then
		return
	end
	btn:SetAttribute("themeCompact", compact)
	local pad = btn:FindFirstChild("ThemePad")
	local padPx = btn:GetAttribute("themeIconPad") or 0
	if compact then
		btn:SetAttribute("themeText", btn.Text)
		btn.Text = ""
		if pad ~= nil then
			pad.PaddingLeft = UDim.new(0, 0)
			pad.PaddingRight = UDim.new(0, 0)
		end
		icon.AnchorPoint = Vector2.new(0.5, 0.5)
		icon.Position = UDim2.fromScale(0.5, 0.5)
	else
		btn.Text = btn:GetAttribute("themeText") or btn.Text
		if pad ~= nil then
			pad.PaddingLeft = UDim.new(0, padPx)
			pad.PaddingRight = UDim.new(0, 6)
		end
		icon.AnchorPoint = Vector2.new(0, 0.5)
		icon.Position = UDim2.new(0, 7 - padPx, 0.5, 0)
	end
end

-- A dress failure must never take the calling panel script down with it: the
-- button stays as its owner built it and the Output carries one warning.
function M.apply(btn, opts)
	local ok, err = pcall(dress, btn, opts)
	if not ok then
		Diag.fail("ui", ("dress %s '%s' (left as built)"):format(btn.Name, btn.Text), err)
	end
	return btn
end

-- U5 list rows (city list, research picker, build catalog): one look for a
-- clickable row inside a panel - rounded, reading size at least TEXT.small,
-- lighter under the pointer. The row keeps its owner's colour, font and
-- height (ledger rows stay monospace so their columns line up).
local function dressRow(row, opts)
	local corner = child(row, "UICorner", "RowCorner")
	corner.CornerRadius = UDim.new(0, 6)
	row.BorderSizePixel = 0
	row.AutoButtonColor = false
	row.TextSize = math.max(row.TextSize, M.TEXT.small)
	if opts ~= nil and opts.locked then
		return
	end
	local base = nil
	row.MouseEnter:Connect(function()
		base = row.BackgroundColor3
		row.BackgroundColor3 = base:Lerp(Color3.new(1, 1, 1), 0.14)
	end)
	row.MouseLeave:Connect(function()
		if base ~= nil then
			row.BackgroundColor3 = base
			base = nil
		end
	end)
end

function M.row(row, opts)
	local ok, err = pcall(dressRow, row, opts)
	if not ok then
		Diag.fail("ui", ("row %s (left as built)"):format(row.Name), err)
	end
	return row
end

return M
