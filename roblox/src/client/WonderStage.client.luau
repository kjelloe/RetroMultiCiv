-- The wonder completion scene (specs/roblox-pedia-art.md 2.6). An own
-- wonder: the model assembles on a stage away from the map while the camera
-- circles it, then a card. A rival's wonder: a small card with the picture.
-- WonderScene.luau decides what plays; this script only draws. Every play
-- prints `[WonderScene]` lines for roblox/tools/after-run.js.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local WonderScene = require(script.Parent:WaitForChild("WonderScene"))
local StructureModels = require(script.Parent:WaitForChild("StructureCatalog"))
local StructureBuilder = require(script.Parent:WaitForChild("StructureBuilder"))
local PediaPicture = require(script.Parent:WaitForChild("PediaPicture"))
local CatalogText = require(script.Parent:WaitForChild("CatalogText"))
local UiTheme = require(script.Parent:WaitForChild("UiTheme"))
local Diag = require(script.Parent:WaitForChild("Diag"))

local STAGE = CFrame.new(-4000, 500, -4000)
local K = 4 -- studs per model unit
local FOV = 30

local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
local gui = Instance.new("ScreenGui")
gui.Name = "RMCWonderScene"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.DisplayOrder = 40
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = playerGui

-- the tour measures this frame; cards are built inside it
local holder = Instance.new("Frame")
holder.Name = "Cards"
holder.Size = UDim2.fromScale(1, 1)
holder.BackgroundTransparency = 1
holder.ZIndex = 5 -- above the letterbox bars and the card backdrop
holder.Parent = gui

local queue = {}
local playing = false
local closeCard = nil -- closes the card that is up (the tour uses it)
local pump

local function round(inst, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r)
	c.Parent = inst
end
local function label(parent, x, y, w, h, size, font, color, text)
	local l = Instance.new("TextLabel")
	l.Position = UDim2.fromOffset(x, y)
	l.Size = UDim2.fromOffset(w, h)
	l.BackgroundTransparency = 1
	l.Font = font
	l.TextSize = size
	l.TextColor3 = color
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.TextYAlignment = Enum.TextYAlignment.Top
	l.TextWrapped = true
	l.Text = text
	l.Parent = parent
	return l
end

local function texts(item)
	local view = ClientState.view
	local rs = ClientState.rulesets()
	local def = rs.wonders[item.wonder]
	local city = view ~= nil and view.cities[item.cityId] or nil
	local owner = city ~= nil and view.players[city.owner] or nil
	local effect = CatalogText.make(rs).effectText(def)
	return {
		name = def ~= nil and def.name or item.wonder,
		caption = WonderScene.caption(item.mode, city ~= nil and city.name or nil,
			owner ~= nil and owner.name or nil, view ~= nil and view.year or 0),
		effect = effect ~= "" and effect or "a wonder of the world",
		blurb = WonderScene.BLURB[item.wonder] or "",
		city = city,
	}
end

-- every other ScreenGui is off while the scene owns the screen
local hidden = {}
local function hideHud()
	for _, g in ipairs(playerGui:GetChildren()) do
		if g:IsA("ScreenGui") and g ~= gui and g.Enabled then
			hidden[#hidden + 1] = g
			g.Enabled = false
		end
	end
end
local function restoreHud()
	for _, g in ipairs(hidden) do
		g.Enabled = true
	end
	hidden = {}
end

local function button(parent, x, y, w, text, color, onClick)
	local b = Instance.new("TextButton")
	b.Position = UDim2.fromOffset(x, y)
	b.Size = UDim2.fromOffset(w, 42)
	b.BackgroundColor3 = UiTheme.COLOR[color]
	b.TextColor3 = Color3.fromRGB(250, 250, 250)
	b.Font = UiTheme.FONT
	b.TextSize = 18
	b.Text = text
	b.Parent = parent
	UiTheme.apply(b, { color = color, radius = 10 })
	b.Activated:Connect(onClick)
	return b
end

-- the card: name, where and when, the effect, the blurb, three buttons.
-- withPicture = the model turns in a box on the card (no stage behind it).
local function buildCard(item, withPicture, onClose)
	local t = texts(item)
	local W, PAD = 620, 20
	local picH = withPicture and 220 or 0
	local card = Instance.new("Frame")
	card.Name = "Card"
	card.AnchorPoint = Vector2.new(0.5, 1)
	card.Position = withPicture and UDim2.new(0.5, 0, 0.5, 220) or UDim2.new(0.5, 0, 1, -28)
	card.BackgroundColor3 = Color3.fromRGB(26, 30, 44)
	card.BorderSizePixel = 0
	card.Parent = holder
	round(card, 14)
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(240, 198, 60)
	stroke.Thickness = 3
	stroke.Parent = card
	local scale = Instance.new("UIScale")
	scale.Scale = math.min(1, (gui.AbsoluteSize.X - 24) / W)
	scale.Parent = card

	local conns = nil
	local y = PAD
	if withPicture then
		local box = Instance.new("Frame")
		box.Position = UDim2.fromOffset(PAD, y)
		box.Size = UDim2.fromOffset(W - 2 * PAD, picH)
		box.BackgroundTransparency = 1
		box.Parent = card
		local root, c = PediaPicture.draw(box, { kind = "structure", id = item.wonder }, nil, ClientState.rulesets())
		if root == nil then
			Diag.fail("wonder", "card picture " .. item.wonder, c)
		else
			conns = c
		end
		y += picH + 12
	end
	label(card, PAD, y, W - 2 * PAD, 16, 14, Enum.Font.GothamBold, Color3.fromRGB(240, 198, 60), "WONDER OF THE WORLD")
	y += 20
	label(card, PAD, y, W - 2 * PAD, 38, 32, UiTheme.FONT, Color3.fromRGB(250, 250, 250), t.name).Name = "Heading"
	y += 42
	label(card, PAD, y, W - 2 * PAD, 20, 16, Enum.Font.GothamMedium, Color3.fromRGB(190, 198, 214), t.caption)
	y += 26
	label(card, PAD, y, W - 2 * PAD, 40, 16, Enum.Font.GothamBold, Color3.fromRGB(143, 209, 122), t.effect)
	y += 44
	if t.blurb ~= "" then
		label(card, PAD, y, W - 2 * PAD, 62, 16, UiTheme.BODY_FONT, Color3.fromRGB(226, 231, 242), t.blurb)
		y += 68
	end
	local bw, gap = 180, 10
	local x = W - PAD - (3 * bw + 2 * gap)
	local function close(after)
		closeCard = nil
		if conns ~= nil then
			for _, c in ipairs(conns) do
				c:Disconnect()
			end
		end
		card:Destroy()
		onClose()
		if after ~= nil then
			after()
		end
	end
	button(card, x, y, bw, "Encyclopedia", "menu", function()
		close(function()
			ClientState.openPedia("wonders", item.wonder)
		end)
	end)
	button(card, x + bw + gap, y, bw, "Go to city", "menu", function()
		close(function()
			if t.city ~= nil then
				ClientState.focusCamera(t.city.x, t.city.y)
			end
		end)
	end)
	button(card, x + 2 * (bw + gap), y, bw, "Continue", "go", function()
		close()
	end).Name = "Continue"
	card.Size = UDim2.fromOffset(W, y + 42 + PAD)
	closeCard = close
	return close
end

-- a rival's wonder: picture and two lines at the top of the screen
local function playRival(item, done)
	local t = texts(item)
	local card = Instance.new("TextButton")
	card.Name = "RivalCard"
	card.AnchorPoint = Vector2.new(0.5, 0)
	card.Position = UDim2.new(0.5, 0, 0, 70)
	card.Size = UDim2.fromOffset(440, 116)
	card.BackgroundColor3 = Color3.fromRGB(26, 30, 44)
	card.AutoButtonColor = false
	card.Text = ""
	card.Parent = holder
	round(card, 12)
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(143, 155, 179)
	stroke.Thickness = 2
	stroke.Parent = card
	local box = Instance.new("Frame")
	box.Position = UDim2.fromOffset(8, 8)
	box.Size = UDim2.fromOffset(100, 100)
	box.BackgroundTransparency = 1
	box.Parent = card
	local conns = nil
	if StructureModels.MODELS[item.wonder] ~= nil then
		local root, c = PediaPicture.draw(box, { kind = "structure", id = item.wonder }, nil, ClientState.rulesets())
		if root == nil then
			Diag.fail("wonder", "rival card picture " .. item.wonder, c)
		else
			conns = c
		end
	end
	label(card, 120, 12, 310, 16, 13, Enum.Font.GothamBold, Color3.fromRGB(143, 155, 179), "A RIVAL WONDER")
	label(card, 120, 30, 310, 28, 22, UiTheme.FONT, Color3.fromRGB(250, 250, 250), t.name)
	label(card, 120, 60, 310, 20, 15, Enum.Font.GothamMedium, Color3.fromRGB(190, 198, 214), t.caption)
	label(card, 120, 82, 310, 20, 14, UiTheme.BODY_FONT, Color3.fromRGB(143, 209, 122), t.effect)
	local closed = false
	local function close()
		if closed then
			return
		end
		closed = true
		if conns ~= nil then
			for _, c in ipairs(conns) do
				c:Disconnect()
			end
		end
		card:Destroy()
		done()
	end
	card.Activated:Connect(close)
	task.delay(WonderScene.RIVAL_SECONDS, close)
end

local function playCard(item, done)
	local backdrop = Instance.new("TextButton")
	backdrop.Size = UDim2.fromScale(1, 1)
	backdrop.BackgroundColor3 = Color3.fromRGB(6, 8, 14)
	backdrop.BackgroundTransparency = 0.45
	backdrop.AutoButtonColor = false
	backdrop.Text = ""
	backdrop.Parent = gui
	buildCard(item, StructureModels.MODELS[item.wonder] ~= nil, function()
		backdrop:Destroy()
		done()
	end)
end

local function playScene(item, done, startAtCard)
	local def = StructureModels.MODELS[item.wonder]
	local camera = workspace.CurrentCamera
	local stage = Instance.new("Folder")
	stage.Name = "WonderStage"
	stage.Parent = workspace
	local built = StructureBuilder.build(stage, def, STAGE, K)
	local top = 1
	for _, p in ipairs(StructureModels.expand(def)) do
		top = math.max(top, p.at[2] + p.size[2])
	end
	-- each part's place; it starts below it and invisible
	local groups = {}
	for i, g in ipairs(built.groups) do
		local list = {}
		for _, p in ipairs(g) do
			list[#list + 1] = { part = p, cf = p.CFrame }
			p.Transparency = 1
		end
		groups[i] = list
	end
	local sparkle = Instance.new("Part")
	sparkle.Anchored = true
	sparkle.CanCollide = false
	sparkle.CanQuery = false
	sparkle.Transparency = 1
	sparkle.Size = Vector3.new(1, 1, 1)
	sparkle.CFrame = STAGE * CFrame.new(0, top * K, 0)
	sparkle.Parent = stage
	local emitter = Instance.new("ParticleEmitter")
	emitter.Rate = 0
	emitter.Lifetime = NumberRange.new(1.2, 2)
	emitter.Speed = NumberRange.new(3, 7)
	emitter.SpreadAngle = Vector2.new(180, 180)
	emitter.LightEmission = 1
	emitter.Color = ColorSequence.new(Color3.fromRGB(255, 233, 160))
	emitter.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.2), NumberSequenceKeypoint.new(1, 0) })
	emitter.Parent = sparkle

	hideHud()
	local oldFov = camera.FieldOfView
	ClientState.sceneActive = true
	camera.FieldOfView = FOV

	local barH = 0.11
	local bars = {}
	for i = 1, 2 do
		local b = Instance.new("Frame")
		b.BackgroundColor3 = Color3.new(0, 0, 0)
		b.BorderSizePixel = 0
		b.AnchorPoint = Vector2.new(0, i == 1 and 0 or 1)
		b.Position = UDim2.fromScale(0, i == 1 and 0 or 1)
		b.Size = UDim2.fromScale(1, 0)
		b.Parent = gui
		bars[i] = b
	end
	local title = label(gui, 0, 0, 0, 0, 34, UiTheme.FONT, Color3.fromRGB(250, 250, 250), texts(item).name)
	title.AnchorPoint = Vector2.new(0.5, 0.5)
	title.Position = UDim2.fromScale(0.5, barH / 2)
	title.Size = UDim2.new(1, 0, 0, 40)
	title.TextXAlignment = Enum.TextXAlignment.Center
	title.TextTransparency = 1
	title.ZIndex = 2
	local hint = label(gui, 0, 0, 0, 0, 14, Enum.Font.GothamMedium, Color3.fromRGB(143, 155, 179), "click or press a key to skip")
	hint.AnchorPoint = Vector2.new(0.5, 0.5)
	hint.Position = UDim2.fromScale(0.5, 1 - barH / 2)
	hint.Size = UDim2.new(1, 0, 0, 20)
	hint.TextXAlignment = Enum.TextXAlignment.Center
	hint.ZIndex = 2

	local t = startAtCard and WonderScene.CARD_AT or 0
	local beat, skipped, cardUp = nil, false, false
	local conns = {}
	local function finish()
		for _, c in ipairs(conns) do
			c:Disconnect()
		end
		stage:Destroy()
		for _, b in ipairs(bars) do
			b:Destroy()
		end
		title:Destroy()
		hint:Destroy()
		camera.FieldOfView = oldFov
		ClientState.sceneActive = false
		restoreHud()
		print(("[WonderScene] done %s skipped=%s camera=restored"):format(item.wonder, tostring(skipped)))
		done()
	end
	local dist = def.camera.fit * 9.2 * K / math.tan(math.rad(FOV / 2))
	local failed = false
	conns[#conns + 1] = RunService.RenderStepped:Connect(function(dt)
		if failed then
			return
		end
		local ok, err = pcall(function()
			t += dt
			local now = WonderScene.beatAt(t)
			if now ~= beat then
				beat = now
				print(("[WonderScene] beat %s %s t=%.1f"):format(item.wonder, now, t))
				emitter.Rate = now == "reveal" and 30 or 0
			end
			for i, list in ipairs(groups) do
				local u = (t - WonderScene.riseStart(i, #groups)) / WonderScene.RISE
				local f = WonderScene.rise(u)
				for _, e in ipairs(list) do
					e.part.CFrame = e.cf + Vector3.new(0, -WonderScene.DROP * K * (1 - f), 0)
					e.part.Transparency = u <= 0 and 1 or math.max(0, 1 - u * 3)
				end
			end
			local open = math.clamp(t / WonderScene.BEATS.open, 0, 1)
			for _, b in ipairs(bars) do
				b.Size = UDim2.fromScale(1, barH * open)
			end
			title.TextTransparency = 1 - math.clamp((t - WonderScene.BEATS.open - WonderScene.BEATS.build) / 0.6, 0, 1)
			local c = WonderScene.camera(math.min(t, WonderScene.CARD_AT), def.camera)
			local yaw, pitch = math.rad(c.yaw), math.rad(c.pitch)
			local at = (STAGE * CFrame.new(0, top * 0.4 * K, 0)).Position
			local eye = at + Vector3.new(math.sin(yaw) * math.cos(pitch), math.sin(pitch), math.cos(yaw) * math.cos(pitch)) * dist * c.zoom
			camera.CameraType = Enum.CameraType.Scriptable
			camera.CFrame = CFrame.lookAt(eye, at)
			if now == "card" and not cardUp then
				cardUp = true
				hint.Visible = false
				buildCard(item, false, finish)
			end
		end)
		if not ok then
			failed = true
			Diag.fail("wonder", ("scene %s stopped mid-way (the view is handed back)"):format(item.wonder), err)
			if closeCard ~= nil then
				closeCard()
			else
				finish()
			end
		end
	end)
	conns[#conns + 1] = UserInputService.InputBegan:Connect(function(input)
		local kind = input.UserInputType
		if kind ~= Enum.UserInputType.Keyboard and kind ~= Enum.UserInputType.MouseButton1 and kind ~= Enum.UserInputType.Touch then
			return
		end
		if not cardUp then
			skipped = true
			t = WonderScene.CARD_AT
		end
	end)
end

local function play(item, opts)
	playing = true
	print(("[WonderScene] play %s mode=%s"):format(item.wonder, item.mode))
	local function done()
		playing = false
		pump()
	end
	local ok, err = pcall(function()
		if item.mode == "scene" then
			playScene(item, done, opts ~= nil and opts.startAtCard == true)
		elseif item.mode == "card" then
			playCard(item, done)
		else
			playRival(item, done)
		end
	end)
	if not ok then
		ClientState.sceneActive = false
		restoreHud()
		local stale = workspace:FindFirstChild("WonderStage")
		if stale ~= nil then
			stale:Destroy()
		end
		for _, child in ipairs(gui:GetChildren()) do
			if child ~= holder then
				child:Destroy()
			end
		end
		Diag.fail("wonder", ("scene %s (%s; the turn log line stands)"):format(item.wonder, item.mode), err)
		done()
	end
end

pump = function()
	if playing or #queue == 0 then
		return
	end
	play(table.remove(queue, 1))
end

ClientState.onEvents(function(events, view)
	if view == nil then
		return
	end
	local items = WonderScene.plan(events, {
		you = view.you, cities = view.cities, models = StructureModels.MODELS,
		scenes = ClientState.options.wonderScenes, away = ClientState.away == true,
		tour = ClientState.tourRunning == true, fastForward = ClientState.fastForwardActive == true,
		theater = ClientState.theaterActive == true, gameOver = ClientState.gameOver == true,
	})
	for _, it in ipairs(items) do
		queue[#queue + 1] = it
	end
	pump()
end)

-- the Debug menu and the tour play a scene without a wonder being built
local previewAt = 0
ClientState.previewWonderScene = function(wonderId, mode, startAtCard)
	local ids = {}
	for id in pairs(ClientState.rulesets().wonders) do
		ids[#ids + 1] = id
	end
	table.sort(ids)
	if wonderId == nil then
		previewAt = previewAt % #ids + 1
		wonderId = ids[previewAt]
	end
	if playing then
		return
	end
	local view = ClientState.view
	local cityId = nil
	if view ~= nil then
		for id, c in pairs(view.cities) do
			if c.owner == view.you then
				cityId = id
				break
			end
		end
	end
	if mode == nil or mode == "scene" then
		mode = WonderScene.ownMode(ClientState.options.wonderScenes, StructureModels.MODELS[wonderId] ~= nil)
	end
	play({ mode = mode, wonder = wonderId, cityId = cityId }, { startAtCard = startAtCard })
end

ClientState.registerPanel("wonder", holder, function()
	ClientState.previewWonderScene("pyramids", "scene", true)
end, function()
	if closeCard ~= nil then
		closeCard()
	end
end)

print("[WonderScene] ready (own wonder: scene; rival: card; Options > wonder scenes)")
