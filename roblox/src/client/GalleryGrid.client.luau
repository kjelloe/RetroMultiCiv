-- R8: the Studio gallery grid (roblox/SPEC.md §3k) — K toggles a floating
-- (F9 is platform-reserved: Roblox Developer Console — see SPEC §3k reserved keys)
-- grid of EVERY unit recipe built TWICE (cone variant A "fan" on the left,
-- variant B "stack" on the right — the user's cone-fidelity judgment point),
-- plus the city house+roof and every propShape. Labels are Billboards.
-- Screenshot of this grid vs the browser's debugging/gallery.html is the
-- R8 acceptance artifact. Render-only; nothing here touches the game.

local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local AssetFactory = require(script.Parent:WaitForChild("AssetFactory"))

local Y = 80 -- floats above any terrain
local STEP = 8

local folder = nil

local function label(model, text, at)
	local anchorPart = Instance.new("Part")
	anchorPart.Anchored = true
	anchorPart.Transparency = 1
	anchorPart.CanCollide = false
	anchorPart.CanQuery = false
	anchorPart.Size = Vector3.new(0.2, 0.2, 0.2)
	anchorPart.CFrame = at
	anchorPart.Parent = model
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.new(0, 120, 0, 14)
	bb.StudsOffset = Vector3.new(0, -1.5, 0)
	bb.AlwaysOnTop = true
	bb.Adornee = anchorPart
	local t = Instance.new("TextLabel")
	t.Size = UDim2.new(1, 0, 1, 0)
	t.BackgroundTransparency = 1
	t.TextColor3 = Color3.fromRGB(235, 235, 235)
	t.TextStrokeTransparency = 0.3
	t.Font = Enum.Font.Code
	t.TextSize = 12
	t.Text = text
	t.Parent = bb
	bb.Parent = anchorPart
end

local function build()
	folder = Instance.new("Folder")
	folder.Name = "GalleryGrid"
	local data = AssetFactory.data()
	local colors = { primary = Color3.fromRGB(200, 60, 60), secondary = Color3.fromRGB(230, 150, 150) }

	local keys = {}
	for key in pairs(data.unitRecipes) do
		table.insert(keys, key)
	end
	table.sort(keys)

	local row = 0
	for _, key in ipairs(keys) do
		local model = Instance.new("Model")
		model.Name = "G_" .. key
		local zA = row * STEP
		AssetFactory.buildRecipe(model, key, colors, CFrame.new(0, Y, zA), "fan")
		label(model, key .. " (fan)", CFrame.new(0, Y, zA))
		AssetFactory.buildRecipe(model, key, colors, CFrame.new(STEP, Y, zA), "stack")
		label(model, key .. " (stack)", CFrame.new(STEP, Y, zA))
		model.Parent = folder
		row += 1
	end

	-- city house + roof (the roof is the 4-seg cone = pyramid path)
	local city = Instance.new("Model")
	city.Name = "G_city"
	local zC = row * STEP
	AssetFactory.buildShape(city, data.cityRecipe.house, colors, CFrame.new(0, Y + 0.5, zC))
	local roof = table.clone(data.cityRecipe.roof)
	-- recipe pos = cone CENTER (three convention): house top 0.5 + h/2 = 1.0
	roof.pos = { 0, 1.0, 0 }
	AssetFactory.buildShape(city, roof, colors, CFrame.new(0, Y + 0.5, zC))
	label(city, "city house+roof", CFrame.new(0, Y, zC))
	city.Parent = folder

	-- props
	local col = 1
	local propKeys = {}
	for key in pairs(data.propShapes) do
		table.insert(propKeys, key)
	end
	table.sort(propKeys)
	for _, key in ipairs(propKeys) do
		local model = Instance.new("Model")
		model.Name = "P_" .. key
		local shape = data.propShapes[key]
		if shape.pos == nil and shape.shape == "cone" then
			-- pos-less cone recipes center at origin; lift h/2 so the base sits on the anchor
			shape = table.clone(shape)
			shape.pos = { 0, shape.size[2] / 2, 0 }
		end
		AssetFactory.buildShape(model, shape, colors, CFrame.new(col * STEP, Y + 0.5, zC))
		label(model, key, CFrame.new(col * STEP, Y, zC))
		model.Parent = folder
		col += 1
	end

	folder.Parent = workspace
	print(("[Gallery] R8 grid up: %d unit recipes x2 cone variants + city + %d props at y=%d")
		:format(#keys, #propKeys, Y))
end

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil then
		return
	end
	if input.KeyCode == Enum.KeyCode.K then
		if folder ~= nil then
			folder:Destroy()
			folder = nil
			print("[Gallery] grid down")
		else
			local ok, err = pcall(build)
			if not ok then
				print("[Gallery] build failed: " .. tostring(err))
				if folder ~= nil then
					folder:Destroy()
					folder = nil
				end
			end
		end
	end
end)

print("[Gallery] R8 gallery grid ready (K toggles; fly there or zoom out)")
