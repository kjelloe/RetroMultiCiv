-- D3 Tier-B: the Foreign-relations panel (docs/14 diplomacy / docs/13 tier) —
-- the Roblox mirror of client/ui/diplomacy.js. Lists every KNOWN rival civ
-- with its relation status line (relationLabel) + reputation, read from the
-- filtered view (view.relations now exposed by the D3 filterView twin,
-- bb8ce1d). Presentation only: reads the view, sends nothing (Civ 1-scope
-- read-only legibility; treaty ACTIONS are a later slice). Fog-honest —
-- relations are global/non-secret; a civ appears once the player has met it
-- (has a players[] row). Collapsible; Y toggles it (chat-focus guarded; K is
-- the Studio gallery-grid tool).
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local DiplomacyView = require(script.Parent:WaitForChild("DiplomacyView"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCDiplomacy"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local toggle = Instance.new("TextButton")
toggle.Name = "Toggle"
toggle.Size = UDim2.new(0, 190, 0, 40)
toggle.Position = UDim2.new(0, 8, 1, -120) -- above Legend (which is above the Turn log)
toggle.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
toggle.BackgroundTransparency = 0.25
toggle.TextColor3 = Color3.fromRGB(235, 235, 235)
toggle.Font = Enum.Font.Code
toggle.TextSize = 18
toggle.TextXAlignment = Enum.TextXAlignment.Left
toggle.Text = "  Diplomacy (Y)"
toggle.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = toggle
end

local panel = Instance.new("Frame")
panel.Name = "Panel"
panel.Size = UDim2.new(0, 360, 0, 200)
panel.Position = UDim2.new(0, 8, 1, -324)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.15
panel.BorderSizePixel = 0
panel.Visible = false
panel.Parent = gui

local list = Instance.new("ScrollingFrame")
list.Size = UDim2.new(1, -8, 1, -8)
list.Position = UDim2.new(0, 4, 0, 4)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 6
list.Parent = panel
local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 2)
layout.Parent = list

local COLORS = {
	peace = Color3.fromRGB(150, 230, 150),
	war = Color3.fromRGB(235, 140, 130),
	head = Color3.fromRGB(225, 225, 225),
}

local function row(order, text, color)
	local r = Instance.new("TextLabel")
	r.Size = UDim2.new(1, -8, 0, 18)
	r.LayoutOrder = order
	r.BackgroundTransparency = 1
	r.TextColor3 = color
	r.Font = Enum.Font.Code
	r.TextSize = 14
	r.TextXAlignment = Enum.TextXAlignment.Left
	r.TextTruncate = Enum.TextTruncate.AtEnd
	r.Text = text
	r.Parent = list
end

local function repaint()
	for _, c in ipairs(list:GetChildren()) do
		if c:IsA("TextLabel") then
			c:Destroy()
		end
	end
	local view = ClientState.view
	if view == nil then
		return
	end
	local you = view.you
	row(1, "🤝 Foreign relations", COLORS.head)
	local order, shown = 2, 0
	-- stable order: playerOrder if present, else sorted player ids
	local ids = {}
	for pid in pairs(view.players) do
		if pid ~= you and pid ~= "barb" then
			table.insert(ids, pid)
		end
	end
	table.sort(ids)
	for _, pid in ipairs(ids) do
		local p = view.players[pid]
		local rel = DiplomacyView.relationOf(view, you, pid)
		local label = DiplomacyView.relationLabel(view, you, pid)
		local rep = DiplomacyView.reputationOf(view, pid)
		local repTag = rep ~= 0 and ("  rep %d"):format(rep) or ""
		row(order, ("%s — %s%s"):format(p.name or pid, label, repTag), COLORS[rel] or COLORS.head)
		order += 1
		shown += 1
	end
	if shown == 0 then
		row(order, "no rivals met yet", COLORS.head)
	end
	list.CanvasSize = UDim2.new(0, 0, 0, order * 20)
end

local function setOpen(open)
	panel.Visible = open
	if open then
		ClientState.panelOpened("diplomacy") -- run-F #1: hide the other left-stack panels
		repaint()
	end
end

ClientState.onPanelOpen(function(id)
	if id ~= "diplomacy" then
		setOpen(false)
	end
end)

-- refresh while open as the world changes (new treaties/wars ride the round view)
ClientState.onEvents(function()
	if panel.Visible then
		repaint()
	end
end)

toggle.Activated:Connect(function()
	setOpen(not panel.Visible)
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil then
		return
	end
	if input.KeyCode == Enum.KeyCode.Y then
		setOpen(not panel.Visible)
	end
end)

print("[Diplomacy] D3 Tier-B foreign-relations panel up (Y toggles)")
