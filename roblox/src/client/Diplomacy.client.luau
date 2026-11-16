-- The Foreign-relations panel and its two cards (docs/14; the Roblox mirror of
-- client/ui/diplomacy.js): every rival with its relation line and the treaty
-- buttons (accept / reject a standing offer, offer peace, declare war,
-- Propose... for peace / tribute / tech swap), plus the envoy card that
-- presents an incoming offer on your turn. Rules, wording and command shapes
-- live in DiplomacyView (gate 63, checked against the engine); this script
-- only draws and sends. Read from the filtered view; Y toggles the panel.
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local DiplomacyView = require(script.Parent:WaitForChild("DiplomacyView"))
local Palette = require(script.Parent:WaitForChild("Palette"))
local UiTheme = require(script.Parent:WaitForChild("UiTheme"))

local BG = Color3.fromRGB(24, 28, 38)
local CARD = Color3.fromRGB(34, 40, 54)
local TEXT = Color3.fromRGB(235, 235, 235)
local MUTED = Color3.fromRGB(170, 176, 190)
local COLORS = {
	peace = Color3.fromRGB(150, 230, 150),
	war = Color3.fromRGB(235, 140, 130),
	offer = Color3.fromRGB(255, 220, 120),
}

local function make(class, parent, props)
	local o = Instance.new(class)
	for k, v in pairs(props) do
		o[k] = v
	end
	o.Parent = parent
	return o
end

local function corner(o, r)
	make("UICorner", o, { CornerRadius = UDim.new(0, r or 8) })
end

local function label(parent, x, y, w, h, size, color, textValue)
	return make("TextLabel", parent, { Position = UDim2.new(0, x, 0, y), Size = UDim2.new(0, w, 0, h),
		BackgroundTransparency = 1, Font = UiTheme.BODY_FONT, TextSize = size, TextColor3 = color,
		TextXAlignment = Enum.TextXAlignment.Left, TextTruncate = Enum.TextTruncate.AtEnd, Text = textValue or "" })
end

local function button(parent, x, y, w, h, textValue, color)
	local b = make("TextButton", parent, { Position = UDim2.new(0, x, 0, y), Size = UDim2.new(0, w, 0, h),
		BackgroundColor3 = Color3.fromRGB(50, 66, 92), TextColor3 = TEXT, Font = UiTheme.BODY_FONT,
		TextSize = 14, Text = textValue })
	UiTheme.apply(b, { color = color or "neutral", radius = 8 })
	return b
end

local gui = Instance.new("ScreenGui")
gui.Name = "RMCDiplomacy"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local toggle = make("TextButton", gui, { Name = "Toggle", Size = UDim2.new(0, 190, 0, 40),
	Position = UDim2.new(0, 8, 1, -180), -- runJ item 2: moved up so Map overlays fits above Legend
	BackgroundColor3 = BG, BackgroundTransparency = 0.25, TextColor3 = TEXT, Font = Enum.Font.Code, TextSize = 18,
	TextXAlignment = Enum.TextXAlignment.Left, Text = "  Diplomacy (Y)" })
UiTheme.apply(toggle, { color = "menu", icon = "diplomacy" }) -- U2 dress
require(script.Parent:WaitForChild("LeftStack")).register(toggle, 4) -- phone: one icon row, bottom-left
corner(toggle)

local W, H = 360, 300
local panel = make("Frame", gui, { Name = "Panel", Size = UDim2.new(0, W, 0, H),
	BackgroundColor3 = BG, BackgroundTransparency = 0.15, BorderSizePixel = 0, Visible = false })
panel.Position = UDim2.new(0, 206, 1, -(H + 56)) -- beside the 190 px button column, above the action bar

local list = make("ScrollingFrame", panel, { Size = UDim2.new(1, -8, 1, -36), Position = UDim2.new(0, 4, 0, 4),
	BackgroundTransparency = 1, BorderSizePixel = 0, ScrollBarThickness = 6,
	AutomaticCanvasSize = Enum.AutomaticSize.Y, CanvasSize = UDim2.new(0, 0, 0, 0) })
make("UIListLayout", list, { SortOrder = Enum.SortOrder.LayoutOrder, Padding = UDim.new(0, 6) })

-- why the last treaty command was refused
local note = label(panel, 8, H - 30, W - 16, 24, 14, COLORS.war, "")

local pendingIds = {} -- commandId -> true: the commands this panel sent
local armed = nil -- { pid, at }: Declare war pressed once

local repaint

local function send(cmd)
	note.Text = ""
	if not ClientState.myTurn() then
		note.Text = "Not sent: " .. DiplomacyView.reasonText("notYourTurn") .. "."
		return
	end
	local id = ClientState.send(cmd)
	if id ~= nil then
		pendingIds[id] = true
	end
end

ClientState.onRejected(function(code, commandId)
	if commandId ~= nil and pendingIds[commandId] then
		pendingIds[commandId] = nil
		note.Text = "Refused: " .. DiplomacyView.reasonText(code) .. "."
	end
end)

local function civColor(hex)
	local ok, c = pcall(Color3.fromHex, Palette.displayColor(hex or "#8899aa"))
	return ok and c or TEXT
end

-- ---------------------------------------------------------------------------
-- the cards: one ScreenGui, a dimmed backdrop, the envoy card and the
-- Propose card (never both)
local cards = Instance.new("ScreenGui")
cards.Name = "RMCEnvoy"
cards.ResetOnSpawn = false
cards.DisplayOrder = 40
cards.Enabled = false
cards.Parent = Players.LocalPlayer.PlayerGui
local backdrop = make("TextButton", cards, { Name = "Backdrop", Size = UDim2.new(1, 0, 1, 0), AutoButtonColor = false,
	BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.5, Text = "" })

local EW, EH = 440, 200
local envoy = make("Frame", cards, { Name = "Frame", Size = UDim2.new(0, EW, 0, EH),
	Position = UDim2.new(0.5, -EW / 2, 0.5, -EH / 2), BackgroundColor3 = BG, BorderSizePixel = 0, Visible = false })
corner(envoy, 10)
local envoyHead = label(envoy, 16, 12, EW - 32, 28, 22, TEXT, "")
envoyHead.Name = "Heading"
envoyHead.Font = UiTheme.FONT
local envoyBody = label(envoy, 16, 50, EW - 32, 70, 17, TEXT, "")
envoyBody.TextWrapped = true
envoyBody.TextTruncate = Enum.TextTruncate.None
envoyBody.TextYAlignment = Enum.TextYAlignment.Top
local envoyAccept = button(envoy, 16, EH - 56, 120, 40, "Accept", "go")
local envoyReject = button(envoy, 146, EH - 56, 120, 40, "Reject", "danger")
local envoyLater = button(envoy, 276, EH - 56, 148, 40, "Consider later", "neutral")

local PW, PH = 460, 400
local propose = make("Frame", cards, { Name = "Propose", Size = UDim2.new(0, PW, 0, PH),
	Position = UDim2.new(0.5, -PW / 2, 0.5, -PH / 2), BackgroundColor3 = BG, BorderSizePixel = 0, Visible = false })
corner(propose, 10)
local proposeHead = label(propose, 16, 12, PW - 32, 28, 22, TEXT, "")
proposeHead.Name = "Heading"
proposeHead.Font = UiTheme.FONT
local termButtons = {}
for i, term in ipairs(DiplomacyView.TERMS) do
	termButtons[term] = button(propose, 16 + (i - 1) * 146, 50, 138, 36, DiplomacyView.TERM_LABEL[term], "neutral")
end
local detail = make("Frame", propose, { Position = UDim2.new(0, 16, 0, 96), Size = UDim2.new(0, PW - 32, 0, 236),
	BackgroundTransparency = 1 })
local detailText = label(detail, 0, 0, PW - 32, 40, 14, MUTED, "Choose what to propose.")
detailText.TextWrapped = true
detailText.TextTruncate = Enum.TextTruncate.None
detailText.TextYAlignment = Enum.TextYAlignment.Top
-- tribute
local goldRow = make("Frame", detail, { Position = UDim2.new(0, 0, 0, 48), Size = UDim2.new(1, 0, 0, 40),
	BackgroundTransparency = 1, Visible = false })
local goldLess = button(goldRow, 0, 0, 56, 40, "- 10", "neutral")
local goldLabel = label(goldRow, 68, 0, 130, 40, 22, COLORS.offer, "")
goldLabel.TextXAlignment = Enum.TextXAlignment.Center
local goldMore = button(goldRow, 210, 0, 56, 40, "+ 10", "neutral")
-- tech swap: two lists
local swapRow = make("Frame", detail, { Position = UDim2.new(0, 0, 0, 44), Size = UDim2.new(1, 0, 0, 192),
	BackgroundTransparency = 1, Visible = false })
local COL = (PW - 32 - 12) / 2
local function swapList(x, heading)
	label(swapRow, x, 0, COL, 20, 14, MUTED, heading)
	local f = make("ScrollingFrame", swapRow, { Position = UDim2.new(0, x, 0, 22), Size = UDim2.new(0, COL, 0, 170),
		BackgroundColor3 = CARD, BorderSizePixel = 0, ScrollBarThickness = 6,
		AutomaticCanvasSize = Enum.AutomaticSize.Y, CanvasSize = UDim2.new(0, 0, 0, 0) })
	corner(f, 6)
	make("UIListLayout", f, { SortOrder = Enum.SortOrder.LayoutOrder, Padding = UDim.new(0, 2) })
	return f
end
local giveList = swapList(0, "You give")
local wantList = swapList(COL + 12, "You ask for (optional)")
local proposeSend = button(propose, 16, PH - 56, 160, 40, "Send offer", "go")
local proposeCancel = button(propose, PW - 136, PH - 56, 120, 40, "Cancel", "neutral")

local chooser = nil -- { pid, term, gold, give, want } while the Propose card is up
local envoyPid = nil -- the civ whose offer the envoy card shows
local deferred = {} -- offer key -> true: "Consider later" (the offer stays in the panel)

local function showCards()
	envoy.Visible = envoyPid ~= nil
	propose.Visible = chooser ~= nil
	cards.Enabled = envoy.Visible or propose.Visible
end

local function fillSwap(listFrame, items, field)
	for _, c in ipairs(listFrame:GetChildren()) do
		if c:IsA("TextButton") then
			c:Destroy()
		end
	end
	for i, item in ipairs(items) do
		local picked = chooser[field] == item.id
		local b = make("TextButton", listFrame, { LayoutOrder = i, Size = UDim2.new(1, -8, 0, 26),
			BackgroundColor3 = picked and Color3.fromRGB(70, 110, 70) or CARD, BorderSizePixel = 0,
			Font = UiTheme.BODY_FONT, TextSize = 14, TextColor3 = TEXT, TextXAlignment = Enum.TextXAlignment.Left,
			TextTruncate = Enum.TextTruncate.AtEnd, Text = "  " .. item.name })
		b.Activated:Connect(function()
			-- a second press on the asked-for advance clears it (a gift)
			chooser[field] = (field == "want" and picked) and nil or item.id
			fillSwap(listFrame, items, field)
		end)
	end
end

local function paintChooser()
	local view = ClientState.view
	if chooser == nil or view == nil then
		return
	end
	local p = view.players[chooser.pid]
	proposeHead.Text = "Propose to " .. (p ~= nil and p.name or chooser.pid)
	for term, b in pairs(termButtons) do
		b.BackgroundColor3 = chooser.term == term and Color3.fromRGB(70, 110, 70) or Color3.fromRGB(50, 66, 92)
	end
	goldRow.Visible = chooser.term == "tribute"
	swapRow.Visible = chooser.term == "techswap"
	proposeSend.Visible = chooser.term ~= nil
	if chooser.term == "peace" then
		detailText.Text = "A lasting peace treaty. They answer on their turn."
	elseif chooser.term == "tribute" then
		detailText.Text = "Demand gold. If they accept, they pay it from their treasury."
		goldLabel.Text = ("%d gold"):format(chooser.gold)
	elseif chooser.term == "techswap" then
		detailText.Text = "Give one advance; ask for one in return, or none for a gift."
		local sw = DiplomacyView.swapChoices(view, view.you, ClientState.rulesets())
		chooser.give = chooser.give or (sw.give[1] ~= nil and sw.give[1].id or nil)
		fillSwap(giveList, sw.give, "give")
		fillSwap(wantList, sw.want, "want")
	else
		detailText.Text = "Choose what to propose."
	end
end

local function openChooser(pid)
	envoyPid = nil
	chooser = { pid = pid, gold = DiplomacyView.TRIBUTE_DEFAULT }
	showCards()
	paintChooser()
end

local function closeChooser()
	chooser = nil
	showCards()
end

for term, b in pairs(termButtons) do
	b.Activated:Connect(function()
		if chooser ~= nil then
			chooser.term = term
			paintChooser()
		end
	end)
end
goldLess.Activated:Connect(function()
	chooser.gold = DiplomacyView.tributeStep(chooser.gold, -1)
	paintChooser()
end)
goldMore.Activated:Connect(function()
	chooser.gold = DiplomacyView.tributeStep(chooser.gold, 1)
	paintChooser()
end)
proposeCancel.Activated:Connect(closeChooser)
proposeSend.Activated:Connect(function()
	if chooser == nil or chooser.term == nil then
		return
	end
	if chooser.term == "techswap" and chooser.give == nil then
		detailText.Text = "You have no advance to give yet."
		return
	end
	local c = chooser
	closeChooser()
	send(DiplomacyView.parleyCommand(c.pid, c.term, { gold = c.gold, giveTech = c.give, wantTech = c.want }))
end)

-- the envoy: an offer THEY made, shown once on my turn; "later" keeps it in
-- the panel
local function scanOffers()
	local view = ClientState.view
	if view == nil or envoyPid ~= nil or chooser ~= nil then
		return
	end
	if not ClientState.myTurn() or ClientState.away or ClientState.tourRunning == true then
		return
	end
	for _, inc in ipairs(DiplomacyView.incomingOffers(view, view.you, ClientState.rulesets())) do
		if not deferred[inc.key] then
			local p = view.players[inc.pid]
			envoyPid = inc.pid
			envoyHead.Text = p ~= nil and p.name or inc.pid
			envoyHead.TextColor3 = civColor(p ~= nil and p.color or nil)
			envoyBody.Text = inc.text
			showCards()
			return
		end
	end
end

-- every way out marks the offer as shown: an answer the server refuses leaves
-- it standing, and it must not come straight back
local function leaveEnvoy(term)
	local view = ClientState.view
	local pid = envoyPid
	if pid == nil then
		return
	end
	if view ~= nil then
		local offer = DiplomacyView.pendingOfferFor(view, view.you, pid)
		if offer ~= nil then
			deferred[pid .. "|" .. tostring(offer.turn)] = true
		end
	end
	envoyPid = nil
	showCards()
	if term ~= nil then
		send(DiplomacyView.parleyCommand(pid, term))
	end
	scanOffers()
end
envoyAccept.Activated:Connect(function()
	leaveEnvoy("accept")
end)
envoyReject.Activated:Connect(function()
	leaveEnvoy("reject")
end)
envoyLater.Activated:Connect(function()
	leaveEnvoy(nil)
end)
backdrop.Activated:Connect(function()
	if chooser ~= nil then
		closeChooser()
	else
		leaveEnvoy(nil)
	end
end)

-- ---------------------------------------------------------------------------
-- the panel
local function paintRow(order, r)
	local buttonsY = 52 + (r.offerText ~= nil and 22 or 0)
	local row = make("Frame", list, { Name = "Row", LayoutOrder = order, BackgroundColor3 = CARD, BorderSizePixel = 0,
		Size = UDim2.new(1, -8, 0, r.met and buttonsY + 38 or 52) })
	corner(row, 8)
	local name = label(row, 10, 6, 210, 20, 17, r.met and civColor(r.color) or MUTED, r.name)
	name.Font = UiTheme.FONT
	if r.repBand ~= nil then
		label(row, 224, 6, 110, 20, 14, COLORS.offer, r.repBand).TextXAlignment = Enum.TextXAlignment.Right
	end
	label(row, 10, 28, 326, 18, 14, COLORS[r.rel] or MUTED, r.label)
	if not r.met then
		return
	end
	if r.offerText ~= nil then
		label(row, 10, 48, 326, 18, 14, COLORS.offer, r.offerText)
	end
	local a = r.actions
	local x = 10
	local function add(w, textValue, color, onPress)
		local b = button(row, x, buttonsY, w, 30, textValue, color)
		b.Activated:Connect(onPress)
		x += w + 6
		return b
	end
	if a.canAccept then
		add(84, "Accept", "go", function()
			send(DiplomacyView.parleyCommand(r.pid, "accept"))
		end)
		add(84, "Reject", "danger", function()
			send(DiplomacyView.parleyCommand(r.pid, "reject"))
		end)
	elseif a.offerSent then
		label(row, x, buttonsY, 104, 30, 14, MUTED, "offer sent")
		x += 110
	elseif a.canOffer then
		add(104, "Offer peace", "go", function()
			send(DiplomacyView.parleyCommand(r.pid, "peace"))
		end)
	end
	if a.canDeclare and not a.canAccept then
		local sure = armed ~= nil and armed.pid == r.pid and os.clock() - armed.at <= DiplomacyView.CONFIRM_WINDOW
		add(110, sure and "Sure?" or "Declare war", "danger", function()
			if DiplomacyView.confirmPress(armed and armed.pid, armed and armed.at, r.pid, os.clock()) == "send" then
				armed = nil
				send(DiplomacyView.parleyCommand(r.pid, "declare"))
			else
				armed = { pid = r.pid, at = os.clock() }
				task.delay(DiplomacyView.CONFIRM_WINDOW + 0.1, function()
					if panel.Visible then
						repaint()
					end
				end)
			end
			repaint()
		end)
	end
	add(96, "Propose...", "primary", function()
		openChooser(r.pid)
	end)
end

function repaint()
	for _, c in ipairs(list:GetChildren()) do
		if c:IsA("Frame") or c:IsA("TextLabel") then
			c:Destroy()
		end
	end
	local view = ClientState.view
	if view == nil then
		return
	end
	local rows = DiplomacyView.rows(view, view.you, ClientState.rulesets())
	make("TextLabel", list, { LayoutOrder = 0, Size = UDim2.new(1, -8, 0, 22), BackgroundTransparency = 1,
		Font = UiTheme.FONT, TextSize = 17, TextColor3 = TEXT, TextXAlignment = Enum.TextXAlignment.Left,
		Text = #rows == 0 and "Foreign relations - no other civilizations" or "Foreign relations" })
	for i, r in ipairs(rows) do
		paintRow(i, r)
	end
end

local function setOpen(open)
	panel.Visible = open
	if open then
		ClientState.panelOpened("diplomacy") -- run-F #1: hide the other left-stack panels
		note.Text = ""
		repaint()
	end
end

ClientState.onPanelOpen(function(id)
	if id ~= "diplomacy" then
		setOpen(false)
	end
end)

-- treaties, offers and whose turn it is all ride the view
ClientState.onView(function()
	if panel.Visible then
		repaint()
	end
	if chooser ~= nil then
		paintChooser()
	end
	scanOffers()
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

-- UI tour (specs/roblox-parity-plan.md step 0): open / close without a click
ClientState.registerPanel("diplomacy", panel, function()
	setOpen(true)
end, function()
	setOpen(false)
end)

print("[Diplomacy] foreign-relations panel with treaty actions up (Y toggles)")
