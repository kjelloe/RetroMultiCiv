-- The self-checking UI tour (specs/roblox-parity-plan.md step 0). Started
-- from the Debug menu ("Run UI tour"): stages the game with debug commands,
-- opens every registered surface in turn, measures it (TourPlan.judge) and
-- prints one `[RMC-TOUR]` line per stop. Read the result with
-- `node roblox/tools/after-run.js`. Debug games only for the staging; the
-- walk itself sends nothing.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local TourPlan = require(script.Parent:WaitForChild("TourPlan"))
local Tooltip = require(script.Parent:WaitForChild("Tooltip"))
local UiTheme = require(script.Parent:WaitForChild("UiTheme"))
local techModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("tech"))

local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")

local gui = Instance.new("ScreenGui")
gui.Name = "RMCTour"
gui.ResetOnSpawn = false
gui.DisplayOrder = 40
gui.Enabled = false
gui.Parent = playerGui
local caption = Instance.new("TextLabel")
caption.AnchorPoint = Vector2.new(0.5, 1)
caption.Position = UDim2.new(0.5, 0, 1, -64)
caption.Size = UDim2.new(0, 520, 0, 40)
caption.BackgroundColor3 = Color3.fromRGB(20, 24, 34)
caption.BackgroundTransparency = 0.1
caption.TextColor3 = Color3.fromRGB(255, 225, 130)
caption.Font = UiTheme.FONT
caption.TextSize = 20
caption.Text = ""
caption.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 10)
	c.Parent = caption
end

local function shown(obj, top)
	local o = obj
	while o ~= nil and o ~= top.Parent do
		if o:IsA("GuiObject") and not o.Visible then
			return false
		end
		if o:IsA("ScreenGui") and not o.Enabled then
			return false
		end
		o = o.Parent
	end
	return true
end

local function rectOf(obj)
	local p, s = obj.AbsolutePosition, obj.AbsoluteSize
	return { x = math.floor(p.X + 0.5), y = math.floor(p.Y + 0.5), w = math.floor(s.X + 0.5), h = math.floor(s.Y + 0.5) }
end

local function itemsOf(root)
	local items = {}
	local function add(d)
		if d:IsA("TextLabel") or d:IsA("TextButton") or d:IsA("TextBox") then
			items[#items + 1] = { text = d.Text, size = d.TextSize, fits = d.TextFits,
				truncates = d.TextTruncate ~= Enum.TextTruncate.None or d.TextWrapped or d.TextScaled,
				visible = shown(d, root) }
		end
	end
	add(root)
	for _, d in ipairs(root:GetDescendants()) do
		add(d)
	end
	return items
end

local function viewport()
	local cam = workspace.CurrentCamera
	local v = cam ~= nil and cam.ViewportSize or Vector2.new(1280, 720)
	return { w = math.floor(v.X), h = math.floor(v.Y) }
end

local function ownCity(view)
	for _, cid in ipairs(view.cityOrder or {}) do
		local c = view.cities[cid]
		if c ~= nil and c.owner == view.you and c.pop ~= nil then
			return c
		end
	end
	return nil
end

-- staging: debug commands, each a normal logged command. Refusals during
-- staging are counted, so a game that is not a debug game says so.
local stageRefused = {}
ClientState.onRejected(function(code)
	table.insert(stageRefused, tostring(code))
end)
local function stage()
	local view = ClientState.view
	if view == nil then
		return
	end
	if ClientState.away then
		print("[RMC-TOUR] stage: skipped (the regent has the seat; commands are not sent)")
		return
	end
	local at = ownCity(view)
	stageRefused = {}
	for _, st in ipairs(TourPlan.STAGE) do
		if st.cmd ~= nil then
			ClientState.send(st.cmd)
		elseif st.action == "grantTech" then
			for _ = 1, st.count do
				view = ClientState.view
				local me = view.players[view.you]
				local ok, avail = pcall(techModule.availableTechs, { players = { [view.you] = me } }, view.you, ClientState.rulesets())
				if ok and avail[1] ~= nil then
					ClientState.send({ type = "debug", action = "grantTech", tech = avail[1] })
					task.wait(0.35) -- the next list needs the new view
				end
			end
		elseif st.action == "spawnUnit" and at ~= nil then
			ClientState.send({ type = "debug", action = "spawnUnit", unitType = st.unitType, x = at.x, y = at.y })
		end
		print(("[RMC-TOUR] stage: %s"):format(st.id))
		task.wait(0.25)
	end
	task.wait(0.5)
	if #stageRefused > 0 then
		print(("[RMC-TOUR] stage: REFUSED %d command(s): %s (the tour goes on with the game as it is)")
			:format(#stageRefused, stageRefused[1]))
	end
end

local running = false
local function run()
	if running or ClientState.view == nil then
		return
	end
	-- run A 18:37Z: a tour while the regent played failed two stops that pass
	-- in a still game (view pushes rebuild rows and close panels mid-measure)
	if ClientState.away then
		print("[RMC-TOUR] ABORT the regent has the seat: take it back (AI button), then run the tour")
		return
	end
	running = true
	ClientState.tourRunning = true -- DiscoveryCard: no splashes for the staged advances
	gui.Enabled = true
	local ok, err = pcall(function()
		caption.Text = "Tour: staging the game"
		stage()
		local results = {}
		local n = #TourPlan.STOPS
		for i, stop in ipairs(TourPlan.STOPS) do
			caption.Text = ("Tour %02d/%02d  %s"):format(i, n, stop.title)
			local view = ClientState.view
			local skipped, findings = nil, {}
			local reg = stop.panel ~= nil and ClientState.tourPanels[stop.panel] or nil
			-- a surface built on demand registers a function that finds its root
			local function rootOf()
				if reg == nil then
					return nil
				end
				return type(reg.root) == "function" and reg.root() or reg.root
			end
			if stop.needsCity and ownCity(view) == nil then
				skipped = "no city yet (found one, then run the tour again)"
			elseif stop.always then
				local sg = playerGui:FindFirstChild(stop.gui)
				if sg == nil then
					findings = { "gui missing" }
				else
					-- an always-on gui has no single root: judge its texts in the viewport
					local vp = viewport()
					findings = TourPlan.judge(stop, { x = 0, y = 0, w = vp.w, h = vp.h }, vp, itemsOf(sg))
				end
				task.wait(TourPlan.HOLD / 2)
			elseif reg == nil then
				findings = { "panel never registered" }
			else
				local opened, openErr = pcall(reg.open)
				task.wait(TourPlan.SETTLE)
				if not opened then
					findings = { "open failed: " .. tostring(openErr):sub(1, 80) }
				elseif stop.hover then
					-- show the first catalog row's card and judge the card itself
					local row = nil
					for _, d in ipairs(rootOf():GetDescendants()) do
						if d:IsA("TextButton") and d.Parent:IsA("ScrollingFrame") then
							row = d
							break
						end
					end
					if row == nil or not Tooltip.preview(row) then
						findings = { "no row with a hover card" }
					else
						task.wait(TourPlan.SETTLE)
						local card = Tooltip.card()
						local words = select(2, card.Text:gsub("%S+", ""))
						local it = { { text = card.Text, size = card.TextSize, fits = true, truncates = true, visible = card.Visible } }
						findings = TourPlan.judge({ minTexts = 1 }, rectOf(card), viewport(), it)
						if words < stop.minTexts then
							findings[#findings + 1] = ("card has %d word(s)"):format(words)
						end
					end
				else
					local root = rootOf()
					local visible = root ~= nil and shown(root, root)
					findings = TourPlan.judge(stop, visible and rectOf(root) or nil, viewport(), visible and itemsOf(root) or {})
				end
				task.wait(TourPlan.HOLD)
				Tooltip.hide()
				pcall(reg.close)
			end
			results[#results + 1] = { id = stop.id, findings = findings, skipped = skipped }
			print(TourPlan.line(i, n, stop, findings, skipped))
		end
		local _, _, _, line = TourPlan.summary(results)
		print(line)
		caption.Text = line:gsub("%[RMC%-TOUR%] ", "")
		task.wait(4)
	end)
	if not ok then
		print("[RMC-TOUR] ABORT " .. tostring(err))
	end
	gui.Enabled = false
	ClientState.tourRunning = false
	running = false
end

ClientState.runTour = function()
	task.spawn(run)
end

print("[Tour] UI tour ready (Debug menu > Run UI tour)")
