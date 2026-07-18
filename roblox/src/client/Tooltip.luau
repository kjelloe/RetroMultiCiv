-- SO2 (catalog row; browser C2 twin, ruled @38e36677: hover cards for mouse
-- + LONG-PRESS for touch — Roblox has no native title attrs). One floating
-- card, latest-wins; attach(gui, textFn) arms a target: hover dwell 0.35 s
-- or a 0.5 s touch hold shows textFn() beside it, leave/release hides.
-- Presentation only — textFns read shared read-only ledgers, never act.

local Players = game:GetService("Players")

local M = {}

local gui = Instance.new("ScreenGui")
gui.Name = "RMCTooltip"
gui.ResetOnSpawn = false
gui.DisplayOrder = 20 -- above the panels it annotates
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local card = Instance.new("TextLabel")
card.BackgroundColor3 = Color3.fromRGB(14, 16, 26)
card.BackgroundTransparency = 0.03
card.TextColor3 = Color3.fromRGB(225, 230, 240)
card.Font = Enum.Font.Code
card.TextSize = 13
card.TextWrapped = true
card.TextXAlignment = Enum.TextXAlignment.Left
card.TextYAlignment = Enum.TextYAlignment.Top
card.RichText = true
card.Visible = false
card.Size = UDim2.new(0, 300, 0, 40)
card.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 6)
	c.Parent = card
	local s = Instance.new("UIStroke")
	s.Color = Color3.fromRGB(120, 140, 180)
	s.Transparency = 0.5
	s.Parent = card
end

local gen = 0

local function showAt(target, text)
	if text == nil or text == "" then
		return
	end
	card.Text = " " .. text
	-- size to content: measure via TextService-less heuristic (wrapped at
	-- 300px, ~13px lines) — generous height, clipped by content being short
	local _, lineCount = string.gsub(text, "\n", "")
	card.Size = UDim2.new(0, 300, 0, 14 * (lineCount + 1) + 12)
	local pos = target.AbsolutePosition
	local size = target.AbsoluteSize
	local screen = gui.AbsoluteSize
	local x = pos.X + size.X + 8
	if x + 300 > screen.X then
		x = math.max(4, pos.X - 308)
	end
	local y = math.clamp(pos.Y, 4, math.max(4, screen.Y - card.AbsoluteSize.Y - 4))
	card.Position = UDim2.new(0, x, 0, y)
	card.Visible = true
end

function M.hide()
	gen += 1
	card.Visible = false
end

-- attach(guiObject, textFn): hover dwell (mouse) or long-press (touch)
function M.attach(target, textFn)
	target.MouseEnter:Connect(function()
		gen += 1
		local myGen = gen
		task.delay(0.35, function()
			if gen == myGen and target.Visible ~= false then
				showAt(target, textFn())
			end
		end)
	end)
	target.MouseLeave:Connect(M.hide)
	target.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.Touch then
			gen += 1
			local myGen = gen
			task.delay(0.5, function()
				if gen == myGen then
					showAt(target, textFn())
				end
			end)
		end
	end)
	target.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.Touch then
			M.hide()
		end
	end)
end

print("[Tooltip] SO2 tooltip helper up (hover 0.35s / long-press 0.5s)")

return M
