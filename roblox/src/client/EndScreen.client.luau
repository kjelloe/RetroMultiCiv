-- SO7 (catalog row; browser A73 twin, client/ui/endscreen.js): the END
-- SCREEN — a full-screen scoreboard on gameOver. Rows arrive PRE-COMPUTED
-- from the server's {t="endscreen"} frame (full-state scoreBreakdown; the
-- fog-filtered view could not rank rivals honestly), sorted here, with the
-- component composition per civ and the victory headline (conquest / score
-- / space branch). Close returns to the world; the THEATER button remains
-- the replay path. Palette-aware color chips.

local Players = game:GetService("Players")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local Palette = require(script.Parent:WaitForChild("Palette"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCEndScreen"
gui.ResetOnSpawn = false
gui.DisplayOrder = 15
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local frame = Instance.new("Frame")
frame.Size = UDim2.new(0, 720, 0, 460)
frame.Position = UDim2.new(0.5, -360, 0.5, -230)
frame.BackgroundColor3 = Color3.fromRGB(14, 16, 26)
frame.BorderSizePixel = 0
frame.Visible = false
frame.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 12)
	c.Parent = frame
	local s = Instance.new("UIStroke")
	s.Color = Color3.fromRGB(200, 170, 90)
	s.Transparency = 0.4
	s.Thickness = 2
	s.Parent = frame
end

local headline = Instance.new("TextLabel")
headline.Size = UDim2.new(1, -24, 0, 60)
headline.Position = UDim2.new(0, 12, 0, 10)
headline.BackgroundTransparency = 1
headline.TextColor3 = Color3.fromRGB(255, 225, 130)
headline.Font = Enum.Font.SourceSansBold
headline.TextSize = 24
headline.TextWrapped = true
headline.TextXAlignment = Enum.TextXAlignment.Left
headline.Text = ""
headline.Parent = frame

local list = Instance.new("ScrollingFrame")
list.Size = UDim2.new(1, -24, 1, -130)
list.Position = UDim2.new(0, 12, 0, 76)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 6
list.Parent = frame

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 160, 0, 36)
closeBtn.Position = UDim2.new(0.5, -80, 1, -46)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 66, 80)
closeBtn.TextColor3 = Color3.fromRGB(235, 235, 235)
closeBtn.Font = Enum.Font.SourceSansBold
closeBtn.TextSize = 18
closeBtn.Text = "Back to the world"
closeBtn.Parent = frame
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = closeBtn
end
closeBtn.Activated:Connect(function()
	frame.Visible = false
end)

local function hexColor(hex)
	local n = tonumber(string.sub(hex, 2), 16) or 0
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
end

local function headlineOf(msg)
	local wname = msg.winner
	for _, r in ipairs(msg.rows) do
		if r.pid == msg.winner then
			wname = r.name
		end
	end
	local year = msg.year < 0 and (-msg.year .. " BC") or (msg.year .. " AD")
	if msg.victory == "conquest" then
		return ("Conquest - the %s stand alone; every rival has fallen."):format(wname)
	elseif msg.victory == "space" then
		return ("Space victory - the %s have reached Alpha Centauri, and a new world is theirs."):format(wname)
	end
	return ("Score victory - the year %s arrived, and the %s had built the greatest civilization."):format(year, wname)
end

local function show(msg)
	headline.Text = headlineOf(msg)
	for _, child in ipairs(list:GetChildren()) do
		child:Destroy()
	end
	local rows = {}
	for _, r in ipairs(msg.rows) do
		table.insert(rows, r)
	end
	table.sort(rows, function(a, b)
		if a.total ~= b.total then
			return a.total > b.total
		end
		return a.name < b.name
	end)
	local you = ClientState.view ~= nil and ClientState.view.you or nil
	for i, r in ipairs(rows) do
		local row = Instance.new("Frame")
		row.Size = UDim2.new(1, -8, 0, 34)
		row.Position = UDim2.new(0, 0, 0, (i - 1) * 38)
		row.BackgroundColor3 = r.pid == you and Color3.fromRGB(34, 40, 58) or Color3.fromRGB(22, 26, 38)
		row.BorderSizePixel = 0
		row.Parent = list
		local chip = Instance.new("Frame")
		chip.Size = UDim2.new(0, 14, 0, 14)
		chip.Position = UDim2.new(0, 8, 0, 10)
		chip.BorderSizePixel = 0
		chip.BackgroundColor3 = hexColor(Palette.displayColor(r.color or "#888888"))
		chip.Parent = row
		local text = Instance.new("TextLabel")
		text.Size = UDim2.new(1, -36, 1, 0)
		text.Position = UDim2.new(0, 30, 0, 0)
		text.BackgroundTransparency = 1
		text.RichText = true
		text.TextColor3 = r.alive and Color3.fromRGB(230, 234, 242) or Color3.fromRGB(140, 144, 152)
		text.Font = Enum.Font.Code
		text.TextSize = 14
		text.TextXAlignment = Enum.TextXAlignment.Left
		text.Text = ("%d. %-14s <b>%d</b>  <font color=\"#9db2c8\">pop %d + techs %d + wonders %d</font>  · %d cities%s")
			:format(i, r.name, r.total, r.popPts or 0, r.techPts or 0, r.wonderPts or 0,
				r.cities or 0, r.alive and "" or "  (fallen)")
		text.Parent = row
	end
	list.CanvasSize = UDim2.new(0, 0, 0, #rows * 38)
	frame.Visible = true
end

ClientState.onEndscreen(show)

print("[EndScreen] SO7 end screen up (opens on the server's gameOver frame)")
