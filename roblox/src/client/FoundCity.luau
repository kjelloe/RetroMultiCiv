-- F1 (docs/13): the found-city name prompt — the browser name dialog's
-- platform shape. A small centered card: TextBox pre-filled with the
-- suggestion, FOUND / CANCEL. No full-screen overlay (the browser modal once
-- covered its own confirm button with one), and TextBox focus is RELEASED on
-- every close so the game keys come back. An empty or unusable entry founds
-- with the suggestion. The server filters typed text (GameServer, TextService)
-- before it reaches game state.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local CityNames = require(script.Parent:WaitForChild("CityNames"))

local M = {}

local gui, box
local pendingUnit = nil
local suggested = nil

local function close()
	pendingUnit = nil
	if gui ~= nil then
		box:ReleaseFocus()
		gui.Enabled = false
	end
end

local function confirm()
	local unitId = pendingUnit
	if unitId == nil then
		return
	end
	local name = CityNames.clean(box.Text) or suggested
	close()
	print(("[FoundCity] found city '%s' with %s"):format(name, unitId))
	ClientState.send({ type = "foundCity", unitId = unitId, name = name })
end

local function button(parent, text, x, color)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, 150, 0, 44)
	b.Position = UDim2.new(0, x, 0, 108)
	b.BackgroundColor3 = color
	b.TextColor3 = Color3.fromRGB(240, 240, 240)
	b.Font = Enum.Font.SourceSansBold
	b.TextSize = 22
	b.Text = text
	b.Parent = parent
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = b
	return b
end

local function build()
	gui = Instance.new("ScreenGui")
	gui.Name = "RMCFoundCity"
	gui.ResetOnSpawn = false
	gui.DisplayOrder = 50
	gui.Enabled = false
	gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

	local frame = Instance.new("Frame")
	frame.Size = UDim2.new(0, 340, 0, 164)
	frame.Position = UDim2.new(0.5, -170, 0.5, -150)
	frame.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
	frame.BorderSizePixel = 0
	frame.Parent = gui
	local fc = Instance.new("UICorner")
	fc.CornerRadius = UDim.new(0, 10)
	fc.Parent = frame

	local title = Instance.new("TextLabel")
	title.Size = UDim2.new(1, 0, 0, 40)
	title.BackgroundTransparency = 1
	title.TextColor3 = Color3.fromRGB(235, 235, 235)
	title.Font = Enum.Font.SourceSansBold
	title.TextSize = 22
	title.Text = "Name your city"
	title.Parent = frame

	box = Instance.new("TextBox")
	box.Size = UDim2.new(1, -24, 0, 44)
	box.Position = UDim2.new(0, 12, 0, 48)
	box.BackgroundColor3 = Color3.fromRGB(44, 50, 64)
	box.TextColor3 = Color3.fromRGB(245, 245, 245)
	box.PlaceholderColor3 = Color3.fromRGB(150, 156, 170)
	box.Font = Enum.Font.SourceSansBold
	box.TextSize = 24
	box.ClearTextOnFocus = false
	box.Text = ""
	box.Parent = frame
	local bc = Instance.new("UICorner")
	bc.CornerRadius = UDim.new(0, 6)
	bc.Parent = box

	button(frame, "FOUND", 12, Color3.fromRGB(52, 110, 64)).Activated:Connect(confirm)
	button(frame, "CANCEL", 178, Color3.fromRGB(96, 56, 56)).Activated:Connect(close)

	box:GetPropertyChangedSignal("Text"):Connect(function()
		if #box.Text > CityNames.MAX_NAME then
			box.Text = box.Text:sub(1, CityNames.MAX_NAME)
		end
	end)
	box.FocusLost:Connect(function(enterPressed)
		if enterPressed then
			confirm()
		end
	end)
end

function M.isOpen()
	return pendingUnit ~= nil
end

function M.prompt(unitId)
	local view = ClientState.view
	if view == nil or pendingUnit ~= nil then
		return
	end
	if gui == nil then
		build()
	end
	suggested = CityNames.suggest(view, ClientState.rulesets().civs)
	pendingUnit = unitId
	box.Text = suggested
	box.PlaceholderText = suggested
	gui.Enabled = true
	-- keyboard-only devices type straight away; on touch the on-screen keyboard
	-- would cover the card, so the box waits for a tap. Deferred a frame so the
	-- B keypress that opened the prompt is not typed into it.
	if UserInputService.KeyboardEnabled and not UserInputService.TouchEnabled then
		task.defer(function()
			if pendingUnit == unitId then
				box:CaptureFocus()
				box.SelectionStart = 1
				box.CursorPosition = #box.Text + 1
			end
		end)
	end
end

-- the unit went away (moved, died, turn rolled): drop a stale prompt
ClientState.onView(function(view)
	if pendingUnit ~= nil and (view == nil or view.units[pendingUnit] == nil) then
		close()
	end
end)

return M
