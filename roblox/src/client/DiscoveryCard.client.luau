-- SO3 (catalog row; browser twin: client/ui/discovery-card.js): the
-- TECH-DISCOVERY CARD — a transient card on techDiscovered for the OWN
-- viewpoint: tech name + era, the original blurb (empty-tolerant until the
-- ally's authored lines land as shared data), the unlock list as PEDIA deep
-- links, and the choose-research prompt folded in. One at a time, queued;
-- click-through or 6 s auto-dismiss; options.discoveryCards mutes it.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local techModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("tech"))
local TechGlyphs = require(script.Parent:WaitForChild("TechGlyphs")) -- CP-art: era colouring

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

local AUTO_S = 6

local gui = Instance.new("ScreenGui")
gui.Name = "RMCDiscoveryCard"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local queue = {}
local card = nil
local cardGen = 0

local function unlocksOf(rs, techId)
	local out = {}
	for _, pair in ipairs({ { "units", rs.units }, { "buildings", rs.buildings }, { "wonders", rs.wonders } }) do
		local cat, tbl = pair[1], pair[2]
		local ids = {}
		for id in pairs(tbl) do
			table.insert(ids, id)
		end
		table.sort(ids)
		for _, id in ipairs(ids) do
			if tbl[id].tech == techId then
				table.insert(out, { cat = cat, id = id, name = tbl[id].name or id })
			end
		end
	end
	return out
end

local pump -- forward: close() pumps the queue

local function close()
	cardGen += 1
	if card ~= nil then
		card:Destroy()
		card = nil
	end
	pump()
end

local function show(techId)
	local view = ClientState.view
	local rs = ClientState.rulesets()
	local def = rs.techs[techId]
	if view == nil or def == nil then
		pump()
		return
	end
	local blurb = TECH_BLURBS[techId]
	local unlocks = unlocksOf(rs, techId)
	local me = view.players[view.you]
	local wantsResearch = false
	if me ~= nil and (me.researching == "" or me.researching == nil) then
		local ok, avail = pcall(techModule.availableTechs,
			{ players = { [view.you] = me } }, view.you, rs)
		wantsResearch = ok and #avail > 0
	end

	local shownUnlocks = math.min(#unlocks, 3)
	local height = 34 + (blurb ~= nil and 36 or 0) + shownUnlocks * 26
		+ (#unlocks > shownUnlocks and 18 or 0) + (wantsResearch and 20 or 0) + 18

	card = Instance.new("TextButton") -- whole card click = dismiss
	card.Size = UDim2.new(0, 440, 0, height)
	card.Position = UDim2.new(0.5, -220, 0.12, 0)
	card.BackgroundColor3 = Color3.fromRGB(26, 30, 44)
	card.BackgroundTransparency = 0.05
	card.Text = ""
	card.AutoButtonColor = false
	card.Parent = gui
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 10)
	corner.Parent = card
	-- CP-art (glyphs fallback b): the card wears its tech's ERA colour
	local eraCol = TechGlyphs.colorOf(def.era or "ancient")
	local stroke = Instance.new("UIStroke")
	stroke.Color = eraCol.edge
	stroke.Transparency = 0.4
	stroke.Thickness = 2
	stroke.Parent = card

	local y = 4
	local head = Instance.new("TextLabel")
	head.Size = UDim2.new(1, -16, 0, 26)
	head.Position = UDim2.new(0, 8, 0, y)
	head.BackgroundTransparency = 1
	head.RichText = true
	head.TextColor3 = eraCol.ink
	head.Font = Enum.Font.SourceSansBold
	head.TextSize = 20
	head.TextXAlignment = Enum.TextXAlignment.Left
	head.Text = ("%s  <font size=\"14\" color=\"#9db2c8\">%s</font>"):format(def.name or techId, def.era or "")
	head.Parent = card
	y += 30

	if blurb ~= nil then
		local b = Instance.new("TextLabel")
		b.Size = UDim2.new(1, -16, 0, 32)
		b.Position = UDim2.new(0, 8, 0, y)
		b.BackgroundTransparency = 1
		b.TextColor3 = Color3.fromRGB(220, 226, 238)
		b.Font = Enum.Font.Code
		b.TextSize = 14
		b.TextWrapped = true
		b.TextXAlignment = Enum.TextXAlignment.Left
		b.Text = blurb
		b.Parent = card
		y += 36
	end

	for i = 1, shownUnlocks do
		local u = unlocks[i]
		local link = Instance.new("TextButton")
		link.Size = UDim2.new(1, -16, 0, 22)
		link.Position = UDim2.new(0, 8, 0, y)
		link.BackgroundColor3 = Color3.fromRGB(40, 52, 70)
		link.TextColor3 = Color3.fromRGB(180, 220, 255)
		link.Font = Enum.Font.Code
		link.TextSize = 14
		link.TextXAlignment = Enum.TextXAlignment.Left
		link.Text = "  unlocks: " .. u.name .. "  (pedia)"
		link.Parent = card
		local lc = Instance.new("UICorner")
		lc.CornerRadius = UDim.new(0, 6)
		lc.Parent = link
		link.Activated:Connect(function()
			close()
			ClientState.openPedia(u.cat, u.id)
		end)
		y += 26
	end
	if #unlocks > shownUnlocks then
		local more = Instance.new("TextLabel")
		more.Size = UDim2.new(1, -16, 0, 16)
		more.Position = UDim2.new(0, 8, 0, y)
		more.BackgroundTransparency = 1
		more.TextColor3 = Color3.fromRGB(150, 160, 175)
		more.Font = Enum.Font.Code
		more.TextSize = 12
		more.TextXAlignment = Enum.TextXAlignment.Left
		more.Text = ("  +%d more in the Pedia"):format(#unlocks - shownUnlocks)
		more.Parent = card
		y += 18
	end
	if wantsResearch then
		local r = Instance.new("TextLabel")
		r.Size = UDim2.new(1, -16, 0, 18)
		r.Position = UDim2.new(0, 8, 0, y)
		r.BackgroundTransparency = 1
		r.TextColor3 = Color3.fromRGB(255, 220, 120)
		r.Font = Enum.Font.SourceSansBold
		r.TextSize = 14
		r.TextXAlignment = Enum.TextXAlignment.Left
		r.Text = "Choose new research - press T or the Research button"
		r.Parent = card
		y += 20
	end
	local hint = Instance.new("TextLabel")
	hint.Size = UDim2.new(1, -16, 0, 14)
	hint.Position = UDim2.new(0, 8, 0, y)
	hint.BackgroundTransparency = 1
	hint.TextColor3 = Color3.fromRGB(130, 140, 155)
	hint.Font = Enum.Font.Code
	hint.TextSize = 11
	hint.TextXAlignment = Enum.TextXAlignment.Left
	hint.Text = "click to dismiss"
	hint.Parent = card

	card.Activated:Connect(close)
	cardGen += 1
	local gen = cardGen
	task.delay(AUTO_S, function()
		if gen == cardGen and card ~= nil then
			close()
		end
	end)
end

pump = function()
	if card ~= nil or #queue == 0 then
		return
	end
	show(table.remove(queue, 1))
end

ClientState.onEvents(function(events, view)
	if ClientState.options.discoveryCards == false or view == nil then
		return
	end
	for _, e in ipairs(events) do
		if e.type == "techDiscovered" and e.playerId == view.you and e.tech ~= nil then
			table.insert(queue, e.tech)
		end
	end
	pump()
end)

print("[DiscoveryCard] SO3 tech-discovery card up (options.discoveryCards mutes)")
