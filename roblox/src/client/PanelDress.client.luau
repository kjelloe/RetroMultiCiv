-- Applies UiPanel's fit to every panel the client builds, without each panel
-- script knowing: a panel = a pixel-sized Frame placed straight on an RMC
-- ScreenGui. Each gets a UIScale (larger screen -> larger panel and text;
-- small screen -> cut until it fits), its position re-derived from the
-- offsets its owner gave it, one outline, and its heading in the display
-- font. Presentation only. A failure leaves the panel as built + one Diag line.
local Players = game:GetService("Players")
local GuiService = game:GetService("GuiService")

local UiPanel = require(script.Parent:WaitForChild("UiPanel"))
local UiTheme = require(script.Parent:WaitForChild("UiTheme"))
local Diag = require(script.Parent:WaitForChild("Diag"))

-- HUD surfaces that place themselves (bars, chips, cards sized to content,
-- the theater that owns the camera)
local SKIP = {
	RMCActionBar = true, RMCHud = true, RMCMinimap = true, RMCTooltip = true, RMCIntro = true,
	RMCAdvice = true, RMCDiscoveryCard = true, RMCTheater = true, RMCWaitStatus = true, RMCRidePad = true,
}

-- run-R log: these panels reported heading=NONE. Their rows start at the top
-- edge, so the name goes on a tab ABOVE the frame (nothing inside moves).
local TAB_TITLE = {
	RMCOptions = "Options", RMCDiplomacy = "Diplomacy", RMCTurnLog = "Turn log",
	RMCStats = "Statistics", RMCCityPanel = "City", RMCLegend = "Legend",
}
local TAB_H = 28

local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
local panels = {} -- frame -> { gui, home, scale, last }

-- the heading: a short text label along the panel's top edge
local function headingOf(frame)
	for _, c in ipairs(frame:GetChildren()) do
		if c:IsA("TextLabel") and c.Text ~= "" and c.Position.Y.Scale == 0 and c.Position.Y.Offset <= 12
			and c.Size.Y.Scale == 0 and c.Size.Y.Offset >= 18 and c.Size.Y.Offset <= 44 then
			return c
		end
	end
	return nil
end

local function place(frame, rec)
	-- not the ScreenGui's AbsoluteSize: it reads a stale 800x600 on a gui
	-- that is disabled or was built before the viewport settled (run-R log:
	-- every panel fitted at scale 1.00 in an 800x600 area)
	local cam = workspace.CurrentCamera
	if cam == nil then
		return
	end
	local area = cam.ViewportSize
	if not rec.gui.IgnoreGuiInset then
		area = Vector2.new(area.X, area.Y - GuiService:GetGuiInset().Y)
	end
	-- the viewport reads 1x1 while the client loads (shot9 log: every panel
	-- "cut to 0.30 in a 1x1 area" and clamped into the top-left corner)
	if area.X < UiPanel.MIN_AREA or area.Y < UiPanel.MIN_AREA then
		return
	end
	local home, size = rec.home, frame.Size
	local r = UiPanel.place(home.X.Scale, home.X.Offset, home.Y.Scale, home.Y.Offset,
		size.X.Offset, size.Y.Offset, area.X, area.Y, UiPanel.scaleFor(area.X, area.Y))
	rec.scale.Scale = r.s
	-- property signals are DEFERRED: a "placing" flag is already false again
	-- when the Position handler runs, so the handler took our own placement
	-- for an owner's move and adopted it as the new home (shot9: setup panel
	-- and seat list stuck top-left / bottom-left). The handler compares
	-- against the value written here instead.
	rec.written = UDim2.new(home.X.Scale, r.xo, home.Y.Scale, r.yo)
	frame.Position = rec.written
	local key = ("%.2f %dx%d"):format(r.s, size.X.Offset, size.Y.Offset)
	if key ~= rec.last then
		rec.last = key
		local head = headingOf(frame)
		Diag.note("panel", ("%s/%s scale=%.2f authored=%dx%d area=%dx%d heading=%s"):format(rec.gui.Name, frame.Name,
			r.s, size.X.Offset, size.Y.Offset, math.floor(area.X), math.floor(area.Y),
			head ~= nil and ("'" .. head.Text:sub(1, 28) .. "'")
				or (frame:FindFirstChild("PanelTab") ~= nil and ("tab '" .. frame.PanelTab.Text .. "'") or "NONE")))
		if r.s < UiPanel.READABLE then
			Diag.fail("panel", ("%s/%s cut to %.2f to fit"):format(rec.gui.Name, frame.Name, r.s),
				("authored %dx%d in a %dx%d area: text is under reading size, needs a narrow layout"):format(
					size.X.Offset, size.Y.Offset, math.floor(area.X), math.floor(area.Y)))
		end
	end
end

local function adopt(gui, frame)
	if panels[frame] ~= nil or not frame:IsA("Frame") or frame.ClassName ~= "Frame" then
		return
	end
	local sz = frame.Size
	if not UiPanel.isPanelSize(sz.X.Scale, sz.X.Offset, sz.Y.Scale, sz.Y.Offset)
		or frame.AnchorPoint ~= Vector2.new(0, 0) or frame:FindFirstChildOfClass("UIScale") ~= nil then
		return
	end
	local scale = Instance.new("UIScale")
	scale.Name = "PanelScale"
	scale.Parent = frame
	local rec = { gui = gui, home = frame.Position, scale = scale, written = nil }
	panels[frame] = rec

	local corner = frame:FindFirstChildOfClass("UICorner") or Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 12)
	corner.Parent = frame
	if frame:FindFirstChildOfClass("UIStroke") == nil then
		local stroke = Instance.new("UIStroke")
		stroke.Name = "PanelOutline"
		stroke.Color = UiTheme.OUTLINE
		stroke.Thickness = 2
		stroke.Parent = frame
	end
	local head = headingOf(frame)
	if head ~= nil then
		head.Font = UiTheme.FONT
		head.TextSize = math.max(head.TextSize, math.min(UiTheme.TEXT.title, head.Size.Y.Offset - 4))
	elseif TAB_TITLE[gui.Name] ~= nil then
		local tab = Instance.new("TextLabel")
		tab.Name = "PanelTab"
		tab.AutomaticSize = Enum.AutomaticSize.X
		tab.Size = UDim2.new(0, 0, 0, TAB_H)
		tab.Position = UDim2.new(0, 10, 0, -TAB_H + 2)
		tab.BackgroundColor3 = frame.BackgroundColor3
		tab.BackgroundTransparency = math.min(frame.BackgroundTransparency, 0.1)
		tab.BorderSizePixel = 0
		tab.TextColor3 = Color3.fromRGB(240, 242, 248)
		tab.Font = UiTheme.FONT
		tab.TextSize = 18
		tab.Text = TAB_TITLE[gui.Name]
		tab.ZIndex = frame.ZIndex
		tab.Parent = frame
		local tc = Instance.new("UICorner")
		tc.CornerRadius = UDim.new(0, 8)
		tc.Parent = tab
		local tp = Instance.new("UIPadding")
		tp.PaddingLeft, tp.PaddingRight = UDim.new(0, 12), UDim.new(0, 12)
		tp.Parent = tab
		local ts = Instance.new("UIStroke")
		ts.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
		ts.Color = UiTheme.OUTLINE
		ts.Thickness = 2
		ts.Parent = tab
	end

	frame:GetPropertyChangedSignal("Size"):Connect(function()
		place(frame, rec)
	end)
	-- an owner that moves its panel later sets a new home
	frame:GetPropertyChangedSignal("Position"):Connect(function()
		if frame.Position ~= rec.written then
			rec.home = frame.Position
			place(frame, rec)
		end
	end)
	frame.Destroying:Connect(function()
		panels[frame] = nil
	end)
	place(frame, rec)
end

local watched = {}
local function scan()
	for _, gui in ipairs(playerGui:GetChildren()) do
		if gui:IsA("ScreenGui") and gui.Name:sub(1, 3) == "RMC" and not SKIP[gui.Name] then
			if not watched[gui] then
				watched[gui] = true
				-- a dialog built on first use is fitted the frame it appears
				gui.ChildAdded:Connect(function(c)
					task.defer(function()
						local ok, err = pcall(adopt, gui, c)
						if not ok then
							Diag.fail("panel", ("%s/%s fit (left as built)"):format(gui.Name, c.Name), err)
						end
					end)
				end)
			end
			for _, c in ipairs(gui:GetChildren()) do
				local ok, err = pcall(adopt, gui, c)
				if not ok then
					Diag.fail("panel", ("%s/%s fit (left as built)"):format(gui.Name, c.Name), err)
				end
			end
		end
	end
end

local function replaceAll()
	for frame, rec in pairs(panels) do
		local ok, err = pcall(place, frame, rec)
		if not ok then
			Diag.fail("panel", ("%s/%s place"):format(rec.gui.Name, frame.Name), err)
		end
	end
end

task.spawn(function()
	local cam = workspace.CurrentCamera
	while cam == nil do
		task.wait(0.2)
		cam = workspace.CurrentCamera
	end
	cam:GetPropertyChangedSignal("ViewportSize"):Connect(function()
		task.defer(replaceAll)
	end)
end)

-- panels are built at script load: rescan while the client boots, then
-- slowly (a ScreenGui created on first use)
task.spawn(function()
	for _ = 1, 15 do
		scan()
		replaceAll()
		task.wait(1)
	end
	while true do
		task.wait(5)
		scan()
	end
end)

print("[PanelDress] panel fit up (authored for 1280x720; scale per screen, cut to fit small ones)")
