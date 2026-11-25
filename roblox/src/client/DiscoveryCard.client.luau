-- SO3 (catalog row; browser twin: client/ui/discovery-card.js): the
-- TECH-DISCOVERY CARD — a transient card on techDiscovered for the OWN
-- viewpoint: tech name + era, the original blurb (empty-tolerant until the
-- ally's authored lines land as shared data), the unlock list as PEDIA deep
-- links, and the choose-research prompt folded in. One at a time, queued;
-- click-through or 6 s auto-dismiss; options.discoveryCards mutes it.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TextService = game:GetService("TextService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local techModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("tech"))
local UiTheme = require(script.Parent:WaitForChild("UiTheme"))
local TechGlyphs = require(script.Parent:WaitForChild("TechGlyphs")) -- CP-art: era colouring
local CivIntro = require(script.Parent:WaitForChild("CivIntro")) -- info-19: the start card
local PediaPicture = require(script.Parent:WaitForChild("PediaPicture"))
local leadersModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("leaders"))

-- CONTENT RULES (license boundary, CLAUDE.md): original prose only — never
-- wiki sentences. Ported 1:1 from the browser's client/ui/tech-blurbs.js (the
-- one authoring source, ally §B1 — ORIGINAL committable prose, NOT
-- wiki-extract; 68 lines, ids verified vs data/techs.json). Keep in sync with
-- that file; selftest/tech-blurbs-parity.mjs (check.sh gate 11) enforces it.
local TECH_BLURBS = {
	["advanced-flight"] = "The sky becomes a true battlefield and highway. Aircraft now range farther, strike harder, and connect distant fronts.",
	["alphabet"] = "Speech can vanish with its speaker; writing lets ideas outlive a single voice. Knowledge can now be shared, stored, and built upon.",
	["astronomy"] = "The heavens become a chart rather than a mystery. Distant stars and wandering worlds sharpen the art of navigation.",
	["atomic-theory"] = "Matter is revealed as a restless architecture of unseen parts. Great power—and grave responsibility—lies within the smallest things.",
	["automobile"] = "Personal machines carry people and goods farther than muscle or horse ever could. Roads become arteries of a faster civilization.",
	["banking"] = "Wealth can now be gathered, lent, and directed at a larger scale. Commerce gains institutions built to survive individual fortunes.",
	["bridge-building"] = "Rivers no longer have to divide your realm. Strong crossings carry workers, armies, and trade toward new opportunities.",
	["bronze-working"] = "Copper and tin become a stronger tool in skilled hands. Better blades and implements give your people a durable advantage.",
	["ceremonial-burial"] = "Honoring the dead binds the living together. Shared rites give communities memory, meaning, and a sense of order.",
	["chemistry"] = "Careful experiment turns substances into knowledge. Materials can now be understood, transformed, and put to new purposes.",
	["chivalry"] = "Armored riders become the emblem of a warrior elite. Their charge can decide a field before foot soldiers can recover.",
	["code-of-laws"] = "Rule no longer rests only on a ruler's memory or mood. Written law makes authority more predictable across a growing realm.",
	["combustion"] = "Controlled fire can drive engines with immense force. Fuel becomes motion, and motion reshapes industry and war.",
	["communism"] = "The question of who owns work and wealth becomes a question of state. Society can now be organized around collective purpose.",
	["computers"] = "Machines begin to process information at a scale beyond any clerk's desk. Calculation, coordination, and design accelerate together.",
	["conscription"] = "The defense of the state becomes a duty shared by its citizens. Armies can grow rapidly when danger demands it.",
	["construction"] = "Organized labor and durable materials raise works beyond the reach of a single household. Cities can now build for generations.",
	["corporation"] = "Enterprises gain lives larger than their founders. Capital, risk, and ambition can now be gathered under one enduring banner.",
	["currency"] = "A trusted measure of value makes exchange easier between strangers. Trade no longer depends on finding the perfect barter.",
	["democracy"] = "Government draws its authority from the consent of citizens. Debate becomes a strength when institutions can carry it.",
	["electricity"] = "Invisible current becomes useful power. Light, industry, and communication can now reach farther and work faster.",
	["electronics"] = "Tiny signals can be shaped into useful work. Control, communication, and calculation become more precise than ever before.",
	["engineering"] = "Practical knowledge becomes organized craft. Roads, works, and machines can be planned to serve an entire civilization.",
	["explosives"] = "Stored force can break stone, open earth, and shatter defenses. It is a tool of industry as readily as war.",
	["feudalism"] = "Land, service, and protection bind society into a strict hierarchy. Local lords can hold a realm together—or pull it apart.",
	["flight"] = "Humanity leaves the ground by craft rather than myth. The map gains a new dimension, and distance loses some of its power.",
	["fusion-power"] = "The force that lights the stars is brought within human reach. Energy becomes abundant enough to transform every grand project.",
	["future-tech"] = "Your civilization has reached beyond the known tree of knowledge. Each new answer reveals a still larger frontier.",
	["genetic-engineering"] = "Life's instructions can now be read and altered with care. Medicine, food, and the future itself enter a new age of choice.",
	["gunpowder"] = "A spark now carries the force of thunder. Old fortifications and old warrior traditions must adapt or be swept aside.",
	["horseback-riding"] = "A rider and mount become faster than either could be alone. Open land now favors those who can move before an enemy responds.",
	["industrialization"] = "Workshops give way to systems of machines, fuel, and labor. Production expands from skilled craft to national power.",
	["invention"] = "Practical curiosity becomes a force in its own right. New devices turn familiar materials and motions toward unexpected ends.",
	["iron-working"] = "Iron yields tools and weapons that outlast bronze. A civilization that masters it can work harder land and field stronger armies.",
	["labor-union"] = "Workers discover strength in common cause. Industry must now reckon with organized voices as well as organized capital.",
	["literacy"] = "Reading is no longer the preserve of a few scribes. A people who can learn from records can advance together.",
	["magnetism"] = "A needle that seeks direction becomes a guide across uncertain waters. Invisible forces begin to serve practical navigation.",
	["map-making"] = "The world becomes something that can be drawn, compared, and remembered. Explorers can now turn journeys into shared knowledge.",
	["masonry"] = "Stone is shaped from shelter into monument. Walls, temples, and cities can now stand against time and attack.",
	["mass-production"] = "Standard parts and organized lines turn great output into routine work. A nation can now equip itself at remarkable speed.",
	["mathematics"] = "Number and pattern reveal order beneath the world's confusion. Builders, traders, and scholars gain a common language of measure.",
	["medicine"] = "Illness becomes a problem to study rather than merely endure. Care, observation, and treatment preserve more lives.",
	["metallurgy"] = "Metals are no longer simply found and forged; their qualities can be deliberately controlled. Stronger tools and weapons follow.",
	["monarchy"] = "Authority is gathered into a single crown. A ruler can now command a realm with greater unity, splendor, and burden.",
	["mysticism"] = "The unseen world is sought through ritual, contemplation, and symbol. Faith gives people comfort beyond what law alone can offer.",
	["navigation"] = "Sailors learn to trust instruments, charts, and the stars. Oceans become routes to knowledge, wealth, and distant rivals.",
	["nuclear-fission"] = "The atom can be split, releasing power on an unimaginable scale. A new age begins beneath the shadow of its own creation.",
	["nuclear-power"] = "Atomic energy is harnessed for sustained work. The promise is vast, but safety and stewardship become matters of national importance.",
	["philosophy"] = "Questions about truth, justice, and nature become disciplines of their own. A civilization learns to examine the ideas guiding it.",
	["physics"] = "Motion, force, and matter yield to systematic inquiry. Nature becomes not less wondrous, but more deeply understandable.",
	["plastics"] = "New materials can be molded for nearly any task. Light, durable manufacture reaches into homes, laboratories, and industry.",
	["pottery"] = "Clay becomes a vessel for food, water, and memory. Settlements gain the means to store plenty through leaner seasons.",
	["railroad"] = "Iron tracks bind distant cities to a common rhythm. Goods, people, and armies cross the land with unprecedented speed.",
	["recycling"] = "Waste becomes a resource when materials are recovered and used again. Prosperity need not always leave ruin behind it.",
	["refining"] = "Raw resources are separated into more useful forms. What once seemed crude and limited becomes fuel for a changing world.",
	["religion"] = "Belief is shaped into institutions, teachings, and communities that reach beyond a single city. Faith becomes a force in public life.",
	["republic"] = "Citizens share in governing through offices and law. Power becomes a public trust, though it still demands vigilance.",
	["robotics"] = "Machines gain the precision to act on the world directly. Labor, industry, and exploration enter a new partnership with automation.",
	["rocketry"] = "Engines can now throw machines beyond the pull of ordinary travel. The upper sky becomes a frontier waiting to be crossed.",
	["space-flight"] = "Your civilization can now send vessels beyond Earth itself. The greatest journey begins with engineering, courage, and a destination.",
	["steam-engine"] = "Heated water becomes reliable mechanical power. Mines, mills, ships, and factories can work beyond the limits of wind and muscle.",
	["steel"] = "Iron is strengthened into a material fit for railways, engines, and towering works. Industry gains a tougher backbone.",
	["superconductor"] = "Electricity moves with almost no resistance. Once-impractical machines and immense projects become newly possible.",
	["theory-of-gravity"] = "The same laws that guide a falling stone also govern the heavens. Earth and sky are revealed as one physical order.",
	["trade"] = "Exchange links cities that may never share a border. Surplus becomes wealth when it can travel to where it is wanted.",
	["university"] = "Learning gathers into a lasting institution. Scholars can preserve knowledge, challenge it, and pass it to new generations.",
	["wheel"] = "A simple turning circle changes how burdens move. Carts and machines make distance less costly to cross.",
	["writing"] = "Words can now travel across time and distance without changing. Records give rulers, merchants, and scholars a longer memory.",
}

local DiscoveryView = require(script.Parent:WaitForChild("DiscoveryView"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCDiscoveryCard"
gui.ResetOnSpawn = false
gui.DisplayOrder = 25 -- above the panels, below the tour caption
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local queue = {}
local card = nil -- the splash's root (backdrop) while one is up
local cardGen = 0

-- the tech tree's hover card reads the same text and unlock list (a
-- LocalScript cannot be required; ClientState is the shared table)
ClientState.techBlurbs = TECH_BLURBS
ClientState.techUnlocks = DiscoveryView.unlocks

local pump -- forward: close() pumps the queue

local function close()
	cardGen += 1
	if card ~= nil then
		card:Destroy()
		card = nil
	end
	pump()
end

local function label(parent, y, h, size, font, color, text)
	local l = Instance.new("TextLabel")
	l.Position = UDim2.new(0, DiscoveryView.PAD, 0, y)
	l.Size = UDim2.new(1, -2 * DiscoveryView.PAD, 0, h)
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
local function round(inst, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r)
	c.Parent = inst
end
local function measure(text, size, font, width)
	local ok, v = pcall(function()
		return TextService:GetTextSize(text, size, font, Vector2.new(width, 2000))
	end)
	return ok and (v.Y + 4) or (math.ceil(#text * size * 0.55 / width) * (size + 4) + 4)
end

-- user, 2026-11-15: "a bigger splash screen and panel with what has just been
-- invented, with info from the pedia". A dimmed backdrop and a centred card:
-- era band with the badge, the name, the encyclopedia text, everything the
-- advance lets you build as chips that open their encyclopedia entry, what
-- it opens next, and Choose research / Encyclopedia / Continue. It stays up
-- until dismissed; only under the AI regent does it time out.
local function show(techId)
	local view = ClientState.view
	local rs = ClientState.rulesets()
	local me = view ~= nil and view.players[view.you] or nil
	local m = view ~= nil and DiscoveryView.model(techId, rs, me, TECH_BLURBS[techId], ClientState.away == true) or nil
	if m == nil then
		pump()
		return
	end
	if card ~= nil then -- never two splashes: an orphan backdrop would swallow every click
		card:Destroy()
		card = nil
	end
	local W, PAD = DiscoveryView.W, DiscoveryView.PAD
	local INNER = W - 2 * PAD
	local eraCol = TechGlyphs.colorOf(m.era)

	local backdrop = Instance.new("TextButton") -- swallows clicks meant for the map
	backdrop.Name = "Splash"
	backdrop.Size = UDim2.fromScale(1, 1)
	backdrop.BackgroundColor3 = Color3.fromRGB(6, 8, 14)
	backdrop.BackgroundTransparency = 0.45
	backdrop.AutoButtonColor = false
	backdrop.Text = ""
	backdrop.Parent = gui
	card = backdrop

	local box = Instance.new("Frame")
	box.Name = "Card"
	box.AnchorPoint = Vector2.new(0.5, 0.5)
	box.Position = UDim2.fromScale(0.5, 0.48)
	box.BackgroundColor3 = Color3.fromRGB(26, 30, 44)
	box.BorderSizePixel = 0
	box.Parent = backdrop
	round(box, 14)
	local stroke = Instance.new("UIStroke")
	stroke.Color = eraCol.edge
	stroke.Thickness = 3
	stroke.Parent = box
	-- larger screens get a larger card; a small screen cuts it to fit
	local scale = Instance.new("UIScale")
	scale.Parent = box

	local band = Instance.new("Frame")
	band.Size = UDim2.new(1, 0, 0, 92)
	band.BackgroundColor3 = eraCol.fill
	band.BorderSizePixel = 0
	band.Parent = box
	round(band, 14)
	local badge = TechGlyphs.badge(band, m.era, 56)
	badge.Position = UDim2.new(0, PAD, 0, 18)
	local kicker = label(band, 14, 18, 15, Enum.Font.GothamBold, eraCol.ink,
		m.future and "BEYOND THE KNOWN TREE" or "ADVANCE DISCOVERED")
	kicker.Position = UDim2.new(0, PAD + 72, 0, 14)
	kicker.Size = UDim2.new(1, -(2 * PAD + 72), 0, 18)
	local name = label(band, 32, 40, 34, UiTheme.FONT, Color3.fromRGB(250, 250, 250), m.name)
	name.Name = "Heading"
	name.Position = UDim2.new(0, PAD + 72, 0, 32)
	name.Size = UDim2.new(1, -(2 * PAD + 72), 0, 40)
	name.TextWrapped = false
	name.TextTruncate = Enum.TextTruncate.AtEnd
	local era = label(band, 70, 16, 14, Enum.Font.GothamMedium, eraCol.ink, (TechGlyphs.ERA_NAME[m.era] or "") .. " ERA")
	era.Position = UDim2.new(0, PAD + 72, 0, 70)
	era.Size = UDim2.new(1, -(2 * PAD + 72), 0, 16)

	local y = 92 + 14
	if m.blurb ~= nil then
		local h = measure(m.blurb, 18, UiTheme.BODY_FONT, INNER)
		label(box, y, h, 18, UiTheme.BODY_FONT, Color3.fromRGB(226, 231, 242), m.blurb)
		y += h + 12
	end
	local function section(text, color)
		label(box, y, 18, 14, Enum.Font.GothamBold, color, text)
		y += 22
	end
	local function chips(items, color)
		local names = {}
		for i, it in ipairs(items) do
			names[i] = it.name
		end
		local lay = DiscoveryView.chipLayout(names, INNER)
		for _, c in ipairs(lay.chips) do
			local it = items[c.i]
			local b = Instance.new("TextButton")
			b.Name = "Unlock"
			b.Position = UDim2.new(0, PAD + c.x, 0, y + c.y)
			b.Size = UDim2.new(0, c.w, 0, DiscoveryView.CHIP_H)
			b.BackgroundColor3 = Color3.fromRGB(44, 54, 76)
			b.TextColor3 = color
			b.Font = Enum.Font.GothamBold
			b.TextSize = 15
			b.TextTruncate = Enum.TextTruncate.AtEnd
			b.Text = it.name
			b.Parent = box
			round(b, 8)
			b.Activated:Connect(function()
				close()
				ClientState.openPedia(it.cat, it.id) -- the full entry
			end)
		end
		y += lay.height + 10
	end
	if m.empty then
		label(box, y, 20, 15, UiTheme.BODY_FONT, Color3.fromRGB(143, 155, 179),
			"Nothing new to build yet: this advance opens the way to others.")
		y += 28
	end
	for _, g in ipairs(m.groups) do
		section(("NEW %s (click one for its encyclopedia entry)"):format(g.label:upper()), Color3.fromHex(g.color))
		chips(g.items, Color3.fromHex(g.color))
	end
	if #m.governments > 0 then
		section("NEW FORM OF GOVERNMENT", Color3.fromRGB(201, 168, 255))
		label(box, y, 22, 17, Enum.Font.GothamBold, Color3.fromRGB(226, 231, 242), table.concat(m.governments, ", "))
		y += 30
	end
	if #m.nowOpen > 0 then
		section("YOU CAN NOW RESEARCH", Color3.fromRGB(143, 209, 122))
		local text = table.concat(m.nowOpen, ", ")
		local h = measure(text, 16, UiTheme.BODY_FONT, INNER)
		label(box, y, h, 16, UiTheme.BODY_FONT, Color3.fromRGB(226, 231, 242), text)
		y += h + 8
	end
	if #m.leadsTo > 0 then
		section("LATER, WITH OTHER ADVANCES", Color3.fromRGB(143, 155, 179))
		local text = table.concat(m.leadsTo, ", ")
		local h = measure(text, 16, UiTheme.BODY_FONT, INNER)
		label(box, y, h, 16, UiTheme.BODY_FONT, Color3.fromRGB(190, 198, 214), text)
		y += h + 8
	end

	y += 6
	local buttons = DiscoveryView.buttons(m)
	local bw, gap = 180, 10
	local x = W - PAD - (#buttons * bw + (#buttons - 1) * gap)
	for _, def in ipairs(buttons) do
		local b = Instance.new("TextButton")
		b.Name = "Do_" .. def.id
		b.Position = UDim2.new(0, x, 0, y)
		b.Size = UDim2.new(0, bw, 0, 42)
		b.BackgroundColor3 = UiTheme.COLOR[def.color]
		b.TextColor3 = Color3.fromRGB(250, 250, 250)
		b.Font = UiTheme.FONT
		b.TextSize = 18
		b.Text = def.label
		b.Parent = box
		UiTheme.apply(b, { color = def.color, radius = 10 })
		b.Activated:Connect(function()
			close()
			if def.id == "research" then
				ClientState.openResearch()
			elseif def.id == "pedia" then
				ClientState.openPedia("techs", m.id)
			end
		end)
		x += bw + gap
	end
	y += 42 + PAD
	box.Size = UDim2.new(0, W, 0, y)
	local cam = workspace.CurrentCamera
	local v = cam ~= nil and cam.ViewportSize or Vector2.new(1280, 720)
	scale.Scale = math.clamp(math.min((v.X - 24) / W, (v.Y - 80) / y, v.Y / 720 * 1.1), 0.5, 1.5)

	cardGen += 1
	local gen = cardGen
	if m.auto ~= nil then
		task.delay(m.auto, function()
			if gen == cardGen and card ~= nil then
				close()
			end
		end)
	end
	print(("[DiscoveryCard] splash: %s (%d to build, %d now open%s)"):format(m.name, #DiscoveryView.unlocks(rs, m.id),
		#m.nowOpen, m.auto ~= nil and ", auto-dismiss" or ""))
end

-- info-19 (plan R6.1): once at the game start, the civilization card - the
-- civ's scene in its colours, the leader and stance, the people's strength,
-- the specialty unit's encyclopedia entry, Begin your reign
local introShown = false
local introPicture = nil
local function hex(s, fallback)
	local ok, c = pcall(Color3.fromHex, s or "")
	return ok and c or fallback
end
local function showCivIntro(view)
	local rs = ClientState.rulesets()
	local civId = view.players[view.you].civ
	local civ = rs.civs[civId]
	if civ == nil then
		return false
	end
	introShown = true
	local ok, stance = pcall(leadersModule.stanceFromPersonality, civ.personality or {})
	local m = CivIntro.card(civ, ok and stance or "balanced", rs.units)
	if card ~= nil then
		card:Destroy()
	end
	local W, PAD = DiscoveryView.W, DiscoveryView.PAD
	local INNER = W - 2 * PAD
	local primary = hex(m.color, Color3.fromRGB(143, 168, 204))
	local secondary = hex(m.secondary, primary:Lerp(Color3.new(1, 1, 1), 0.4))

	local backdrop = Instance.new("TextButton")
	backdrop.Name = "Splash"
	backdrop.Size = UDim2.fromScale(1, 1)
	backdrop.BackgroundColor3 = Color3.fromRGB(6, 8, 14)
	backdrop.BackgroundTransparency = 0.45
	backdrop.AutoButtonColor = false
	backdrop.Text = ""
	backdrop.Parent = gui
	card = backdrop
	local box = Instance.new("Frame")
	box.Name = "Card"
	box.AnchorPoint = Vector2.new(0.5, 0.5)
	box.Position = UDim2.fromScale(0.5, 0.48)
	box.BackgroundColor3 = Color3.fromRGB(26, 30, 44)
	box.BorderSizePixel = 0
	box.Parent = backdrop
	round(box, 14)
	local stroke = Instance.new("UIStroke")
	stroke.Color = primary
	stroke.Thickness = 3
	stroke.Parent = box
	local scale = Instance.new("UIScale")
	scale.Parent = box

	local PIC = 150
	local pic = Instance.new("Frame")
	pic.Name = "CivPicture"
	pic.Position = UDim2.new(0, PAD, 0, PAD)
	pic.Size = UDim2.new(0, PIC, 0, PIC)
	pic.BackgroundTransparency = 1
	pic.Parent = box
	local TX = PAD + PIC + 16
	local function line(y, h, size, font, color, text)
		local l = label(box, y, h, size, font, color, text)
		l.Position = UDim2.new(0, TX, 0, y)
		l.Size = UDim2.new(0, W - TX - PAD, 0, h)
		return l
	end
	line(PAD, 18, 15, Enum.Font.GothamBold, secondary, m.kicker)
	local heading = line(PAD + 22, 40, 32, UiTheme.FONT, Color3.fromRGB(250, 250, 250), m.name)
	heading.Name = "Heading"
	local bh = measure(m.blurb, 17, UiTheme.BODY_FONT, W - TX - PAD)
	line(PAD + 68, bh, 17, UiTheme.BODY_FONT, Color3.fromRGB(226, 231, 242), m.blurb)
	local y = math.max(PAD + 68 + bh + 12, PAD + PIC + 12)
	label(box, y, 18, 14, Enum.Font.GothamBold, primary:Lerp(Color3.new(1, 1, 1), 0.35), m.strengthHead)
	y += 22
	local sh = measure(m.strength, 18, UiTheme.BODY_FONT, INNER)
	label(box, y, sh, 18, UiTheme.BODY_FONT, Color3.fromRGB(240, 242, 248), m.strength)
	y += sh + 16

	local buttons = {}
	if m.unit ~= nil then
		buttons[#buttons + 1] = { id = "pedia", label = m.unitName, color = "menu" }
	end
	buttons[#buttons + 1] = { id = "begin", label = CivIntro.BEGIN, color = "go" }
	local bw, gap = 200, 10
	local x = W - PAD - (#buttons * bw + (#buttons - 1) * gap)
	for _, def in ipairs(buttons) do
		local b = Instance.new("TextButton")
		b.Name = "Do_" .. def.id
		b.Position = UDim2.new(0, x, 0, y)
		b.Size = UDim2.new(0, bw, 0, 42)
		b.BackgroundColor3 = UiTheme.COLOR[def.color]
		b.TextColor3 = Color3.fromRGB(250, 250, 250)
		b.Font = UiTheme.FONT
		b.TextSize = 18
		b.Text = def.label
		b.Parent = box
		UiTheme.apply(b, { color = def.color, radius = 10 })
		b.Activated:Connect(function()
			close()
			if def.id == "pedia" then
				ClientState.openPedia("units", m.unit)
			end
		end)
		x += bw + gap
	end
	y += 42 + PAD
	box.Size = UDim2.new(0, W, 0, y)
	local cam = workspace.CurrentCamera
	local v = cam ~= nil and cam.ViewportSize or Vector2.new(1280, 720)
	scale.Scale = math.clamp(math.min((v.X - 24) / W, (v.Y - 80) / y, v.Y / 720 * 1.1), 0.5, 1.5)

	local root, conns = PediaPicture.draw(pic, { kind = "structure", set = "civs", id = civId,
		tint = { civPrimary = primary, civSecondary = secondary } }, nil, nil)
	if root ~= nil then
		introPicture = conns
	end
	cardGen += 1
	print(("[DiscoveryCard] civilization card: %s (%s, picture %s)"):format(civ.name, ok and stance or "balanced",
		root ~= nil and "on" or "none"))
	return true
end

pump = function()
	if introPicture ~= nil and card == nil then
		for _, c in ipairs(introPicture) do
			c:Disconnect()
		end
		introPicture = nil
	end
	if card ~= nil or #queue == 0 then
		return
	end
	show(table.remove(queue, 1))
end

-- the civilization card comes first, on the first view of a new game
ClientState.onView(function(view)
	if not CivIntro.shouldShow(view, introShown, ClientState.away == true) or ClientState.tourRunning == true then
		return
	end
	if card == nil then
		showCivIntro(view)
	end
end)

ClientState.onEvents(function(events, view)
	-- the UI tour grants advances while staging: no splashes over its stops
	if ClientState.options.discoveryCards == false or view == nil or ClientState.tourRunning == true then
		return
	end
	for _, e in ipairs(events) do
		if e.type == "techDiscovered" and e.playerId == view.you and e.tech ~= nil then
			table.insert(queue, e.tech)
		end
	end
	-- under the regent a long queue would play for minutes: keep the newest two
	while ClientState.away == true and #queue > 2 do
		table.remove(queue, 1)
	end
	pump()
end)

-- UI tour: show the splash for an advance the player knows (or Alphabet)
ClientState.registerPanel("discovery", function()
	return card ~= nil and card:FindFirstChild("Card") or nil
end, function()
	local view = ClientState.view
	local me = view ~= nil and view.players[view.you] or nil
	local known = me ~= nil and me.techs or {}
	queue = {} -- before close(): close pumps the queue (run A 19:04Z showed two splashes at once)
	close()
	show(known[#known] or "alphabet")
end, function()
	queue = {}
	close()
end)

print("[DiscoveryCard] discovery splash up (options.discoveryCards mutes; stays until dismissed)")
