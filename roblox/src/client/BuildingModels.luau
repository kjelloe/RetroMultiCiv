-- The 21 city buildings as model data (specs/roblox-pedia-art.md P4), in
-- the diorama style of the wonders. Returns a function so Roblox
-- (StructureCatalog) and the lune selftests load it the same way:
-- require(...)(StructureModels) adds the entries to MODELS.
return function(S)
	local k = S.kit
	local new, done, part, r2, G = k.new, k.done, k.part, k.r2, k.G
	local house, gable, tree, cypress, flag, columns = k.house, k.gable, k.tree, k.cypress, k.flag, k.columns
	local MODELS = S.MODELS
	local CAM = { yaw = 35, pitch = 20, fit = 1.0 }

	-- a temple front: steps, a row of columns, a pediment, the hall behind
	local function portico(m, z, w, h, wall, roof, n)
		m:add("box", 0, G, z + 1.2, w + 1.6, 0.25, 2.4, "stone"):add("box", 0, G + 0.25, z + 0.9, w + 0.8, 0.25, 1.6, "stone")
		m:add("box", 0, G + 0.5, z - 2.4, w, h, 4.8, wall)
		m:group(0, G + 0.5, z + 0.8, 0, columns(n, w / n, h, 0.42, "marble"))
		m:add("box", 0, G + 0.5 + h, z - 1.6, w + 0.5, 0.3, 6.6, "marble")
		m:group(0, G + 0.8 + h, z - 1.6, 90, gable(0, 0, 0, 6.6, 1.2, w + 0.5, roof))
	end
	local function chimney(m, x, z, w, h, role)
		m:add("cyl", x, G, z, w, h, w, role):add("cyl", x, G + h, z, w * 1.15, 0.3, w * 1.15, "black")
	end
	local function crates(m, x, z)
		m:add("box", x, G, z, 0.7, 0.7, 0.7, "timber"):add("box", x + 0.8, G, z + 0.2, 0.6, 0.5, 0.6, "timber", 20)
		m:add("box", x + 0.3, G + 0.7, z + 0.1, 0.5, 0.5, 0.5, "thatch", 35)
	end
	local function pylon(m, x, z, h)
		m:add("box", x, G, z, 0.16, h, 0.16, "steel"):add("box", x, G + h * 0.72, z, 1.3, 0.1, 0.12, "steel")
		m:add("box", x, G + h * 0.9, z, 0.9, 0.1, 0.12, "steel")
	end

	do -- Aqueduct
		local m = new("grass")
		m:add("box", 0, G, 0, 2.6, 0.06, 11.6, "water") -- the stream it crosses
		for i = -2, 2 do
			m:add("arch", i * 2.2, G, -1, 2.2, 3.4, 1.2, "sandstone")
			m:add("arch", i * 2.2, G + 3.7, -1, 2.2, 1.6, 1.0, "sandstone")
		end
		m:add("box", 0, G + 3.4, -1, 11.2, 0.3, 1.3, "sandstoneDark"):add("box", 0, G + 5.3, -1, 11.2, 0.3, 1.2, "sandstoneDark")
		m:add("box", 0, G + 5.6, -1, 11.2, 0.12, 0.6, "water")
		m:group(-4.2, G, 3.2, 0, tree(2.2)):group(4.4, G, 2.6, 0, tree(1.8)):group(3.4, G, 4.4, 0, cypress(2.4))
		m:group(-3, G, -4.2, 0, house(1.6, 1.0, 1.3, "plaster", "terracotta")):group(4, G, -4.4, 0, cypress(2))
		MODELS["aqueduct"] = done(m, { yaw = 25, pitch = 16, fit = 1.0 })
	end

	do -- Bank
		local m = new("grass", "stone")
		portico(m, 0.6, 6.4, 3.2, "marble", "slate", 6)
		m:add("box", 0, G + 0.5, 0.75, 1.2, 2.2, 0.2, "bronze") -- the door
		m:add("box", 0, G + 3.0, 1.1, 2.6, 0.5, 0.1, "gold") -- the sign
		for _, x in ipairs({ -2.4, 2.4 }) do
			m:add("cyl", x, G, 3.6, 0.9, 0.5, 0.9, "stone"):add("cyl", x, G + 0.5, 3.6, 0.5, 0.25, 0.5, "gold") -- coin stacks
			m:add("cyl", x, G + 0.75, 3.6, 0.5, 0.2, 0.5, "gold")
		end
		m:add("box", 0, G, 4.4, 1.3, 0.8, 0.9, "steel"):add("box", 0, G + 0.8, 4.4, 0.5, 0.2, 0.3, "gold") -- the strongbox
		MODELS["bank"] = done(m, CAM)
	end

	do -- Barracks
		local m = new("sand")
		m:group(0, G, -2.4, 0, house(8, 2.0, 2.6, "timber", "thatch", 1.3))
		m:add("box", -1.6, G, -1.06, 0.9, 1.5, 0.1, "black"):add("box", 1.6, G, -1.06, 0.9, 1.5, 0.1, "black")
		for i = -5, 5 do -- the palisade
			m:add("cyl", i * 1.05, G, 5.2, 0.3, 1.5, 0.3, "timber")
		end
		for _, x in ipairs({ -3, 0, 3 }) do -- training posts
			m:add("cyl", x, G, 1.8, 0.2, 1.6, 0.2, "timber"):add("box", x, G + 1.0, 1.8, 1.1, 0.16, 0.16, "timber")
			m:add("cyl", x, G + 1.5, 1.8, 0.5, 0.5, 0.5, "thatch")
		end
		m:group(-4.6, G, 2.6, 0, flag(3.2, "red")):group(4.6, G, 2.6, 0, flag(3.2, "red"))
		m:add("box", 4.4, G, 0.4, 1.4, 0.9, 0.5, "timber"):add("box", 4.4, G + 0.9, 0.4, 0.1, 1.3, 0.1, "steel") -- weapon rack
		m:add("box", 4.0, G + 0.9, 0.4, 0.1, 1.5, 0.1, "steel"):add("box", 4.8, G + 0.9, 0.4, 0.1, 1.1, 0.1, "steel")
		MODELS["barracks"] = done(m, CAM)
	end

	do -- Cathedral
		local m = new("grass", "stone")
		m:group(0, G, -1.2, 90, house(7.4, 3.6, 3.4, "stone", "slate", 2.0)) -- the nave
		m:group(0, G, -2.2, 0, house(6.4, 2.6, 2.2, "stone", "slate", 1.3)) -- the transept
		for _, x in ipairs({ -1.5, 1.5 }) do
			m:add("box", x, G, 2.9, 1.3, 6.2, 1.3, "stone"):add("pyramid", x, G + 6.2, 2.9, 1.5, 2.4, 1.5, "slate")
			m:add("box", x, G + 4.4, 3.56, 0.5, 1.0, 0.06, "black")
		end
		m:add("box", 0, G, 2.56, 1.2, 2.0, 0.1, "timber"):add("cyl", 0, G + 3.2, 2.5, 1.3, 0.12, 1.3, "glass", 0, 90) -- door, rose window
		m:add("box", 0, G + 5.7, -1.2, 0.14, 1.4, 0.14, "gold"):add("box", 0, G + 6.5, -1.2, 0.7, 0.14, 0.14, "gold") -- the cross
		m:group(-4.6, G, 3.6, 0, cypress(2.6)):group(4.6, G, 3.6, 0, cypress(2.6)):group(4.4, G, -4.2, 0, tree(2))
		MODELS["cathedral"] = done(m, { yaw = 30, pitch = 18, fit = 1.05 })
	end

	do -- City Walls
		local m = new("grass")
		for _, s in ipairs({ { 0, -4.4, 0 }, { -4.4, 0, 90 }, { 4.4, 0, 90 } }) do
			m:add("box", s[1], G, s[2], 8.8, 2.4, 0.8, "stone", s[3] ~= 0 and s[3] or nil)
		end
		m:add("box", -2.9, G, 4.4, 3.0, 2.4, 0.8, "stone"):add("box", 2.9, G, 4.4, 3.0, 2.4, 0.8, "stone")
		m:add("arch", 0, G, 4.4, 2.8, 3.2, 1.0, "sandstoneDark"):add("box", 0, G, 4.4, 1.6, 2.2, 0.2, "timber") -- the gate
		for _, c in ipairs({ { -4.4, -4.4 }, { 4.4, -4.4 }, { -4.4, 4.4 }, { 4.4, 4.4 } }) do
			m:add("cyl", c[1], G, c[2], 1.7, 3.4, 1.7, "stone"):add("cone", c[1], G + 3.4, c[2], 2.0, 1.2, 2.0, "terracotta")
		end
		for i = -3, 3 do -- battlements on the front
			if math.abs(i) > 1 then
				m:add("box", i * 0.95, G + 2.4, 4.4, 0.5, 0.45, 0.8, "stone")
			end
			m:add("box", i * 1.0, G + 2.4, -4.4, 0.5, 0.45, 0.8, "stone")
		end
		m:group(-1.6, G, -1.4, 0, house(1.8, 1.1, 1.5, "plaster", "terracotta")):group(1.6, G, -0.4, 90, house(1.8, 1.0, 1.4, "plaster", "terracotta"))
		m:group(-1.2, G, 1.6, 0, house(1.5, 0.9, 1.3, "plaster", "thatch")):group(0, G + 3.2, 4.4, 0, flag(1.8, "red"))
		MODELS["city-walls"] = done(m, { yaw = 30, pitch = 28, fit = 1.05 })
	end

	do -- Colosseum
		local m = new("sand")
		m:add("cyl", 0, G, 0, 8.6, 0.5, 8.6, "stone"):add("cyl", 0, G + 0.5, 0, 5.0, 0.12, 5.0, "sand") -- seating base, arena
		for i = 0, 11 do
			local a = i * 30
			local x, z = r2(4.4 * math.sin(math.rad(a))), r2(4.4 * math.cos(math.rad(a)))
			m:add("arch", x, G, z, 2.25, 2.4, 0.9, "sandstone", a)
			m:add("box", x, G + 2.4, z, 2.3, 1.2, 0.9, i % 2 == 0 and "sandstone" or "sandstoneDark", a)
			local sx, sz = r2(3.3 * math.sin(math.rad(a))), r2(3.3 * math.cos(math.rad(a)))
			m:add("box", sx, G + 0.5, sz, 1.8, 0.9, 1.0, "marble", a) -- the lower seats
		end
		m:group(0, G + 3.6, 4.4, 0, flag(1.6, "red")):group(0, G + 3.6, -4.4, 0, flag(1.6, "red"))
		MODELS["colosseum"] = done(m, { yaw = 30, pitch = 30, fit = 1.0 })
	end

	do -- Courthouse
		local m = new("grass", "stone")
		portico(m, 0.4, 6.0, 3.0, "plaster", "terracotta", 4)
		m:add("box", 0, G + 0.5, 0.55, 1.1, 2.1, 0.2, "timber")
		m:add("cyl", 0, G + 4.6, -1.2, 2.0, 0.8, 2.0, "plaster"):add("ball", 0, G + 4.9, -1.2, 1.9, 1.9, 1.9, "copper") -- the dome
		-- the scales in front
		m:add("cyl", 0, G, 3.8, 0.9, 0.3, 0.9, "stone"):add("cyl", 0, G + 0.3, 3.8, 0.14, 2.0, 0.14, "gold")
		m:add("box", 0, G + 2.2, 3.8, 2.4, 0.1, 0.1, "gold")
		for _, x in ipairs({ -1.1, 1.1 }) do
			m:add("box", x, G + 1.5, 3.8, 0.04, 0.7, 0.04, "gold"):add("cyl", x, G + 1.4, 3.8, 0.7, 0.1, 0.7, "gold")
		end
		m:group(-4.6, G, 3.4, 0, tree(2)):group(4.6, G, 3.4, 0, tree(2))
		MODELS["courthouse"] = done(m, CAM)
	end

	do -- Factory
		local m = new("grass", "concrete")
		m:add("box", -0.6, G, -1.4, 8.0, 2.6, 4.4, "brick")
		for i = 0, 3 do -- the saw-tooth roof
			m:add("wedge", -3.6 + i * 2.0, G + 2.6, -1.4, 4.4, 1.0, 2.0, "slate", 90)
			m:add("box", -2.62 + i * 2.0, G + 2.6, -1.4, 0.06, 0.9, 4.2, "glass")
		end
		chimney(m, 4.6, -2.6, 0.9, 6.4, "brick")
		chimney(m, 4.6, -0.6, 0.8, 5.2, "brick")
		m:add("box", -1.6, G, 0.84, 1.6, 1.8, 0.1, "black")
		for i = 0, 2 do
			m:add("box", 1 + i * 1.1, G + 1.2, 0.84, 0.7, 0.8, 0.08, "glass")
		end
		crates(m, -3.4, 2.6)
		crates(m, 1.4, 3.2)
		m:add("box", -0.4, G, 4.2, 2.2, 0.7, 1.0, "steel"):add("box", 0.9, G, 4.2, 0.7, 1.1, 1.0, "red") -- a wagon
		MODELS["factory"] = done(m, CAM)
	end

	do -- Granary
		local m = new("grass", "sand")
		for _, p in ipairs({ { -2.8, -1.6, 2.6, 3.4 }, { 0.6, -2.4, 3.0, 4.0 }, { 3.6, -0.4, 2.2, 2.8 } }) do
			m:add("cyl", p[1], G, p[2], p[3] * 0.8, 0.4, p[3] * 0.8, "stone"):add("cyl", p[1], G + 0.4, p[2], p[3], p[4], p[3], "plaster")
			m:add("cone", p[1], G + 0.4 + p[4], p[2], p[3] * 1.25, p[3] * 0.7, p[3] * 1.25, "thatch")
			m:add("box", p[1], G + 0.4, p[2] + p[3] / 2, 0.6, 1.1, 0.1, "timber")
		end
		for _, p in ipairs({ { -1.6, 2.6 }, { -0.9, 2.9 }, { -1.2, 3.4 }, { 2.2, 3.0 } }) do -- sacks
			m:add("ball", p[1], G, p[2], 0.7, 0.7, 0.7, "canvas")
		end
		m:add("box", 1.4, G, 3.8, 1.8, 0.5, 1.0, "timber"):add("box", 1.4, G + 0.5, 3.8, 1.5, 0.3, 0.8, "thatch") -- a cart of grain
		m:add("cyl", 0.6, G + 0.1, 4.34, 0.6, 0.1, 0.6, "timber", 0, 90):add("cyl", 2.2, G + 0.1, 4.34, 0.6, 0.1, 0.6, "timber", 0, 90)
		for i = -5, 5 do
			m:add("box", i * 1.05, G, 5.4, 0.12, 0.8, 0.12, "timber")
		end
		m:add("box", 0, G + 0.55, 5.4, 11.2, 0.1, 0.08, "timber")
		MODELS["granary"] = done(m, CAM)
	end

	do -- Hydro Plant
		local m = new("grass", "rock")
		m:add("box", 0, G, -3.6, 11.6, 2.6, 4.4, "water") -- the reservoir
		m:add("box", 0, G, -1.0, 11.6, 3.2, 1.0, "concrete"):add("wedge", 0, G, 0, 11.6, 3.0, 1.2, "concrete", 180) -- the dam
		m:add("box", 0, G, 3.2, 3.0, 0.08, 5.2, "water") -- the tailrace
		for _, x in ipairs({ -1, 0, 1 }) do
			m:add("box", x, G + 0.6, 0.2, 0.5, 1.6, 0.9, "water") -- the spillways
		end
		m:add("box", 3.6, G, 1.8, 3.2, 1.6, 2.0, "concrete"):add("box", 3.6, G + 1.6, 1.8, 3.4, 0.2, 2.2, "slate") -- the powerhouse
		m:add("box", 3.6, G + 0.5, 2.82, 2.4, 0.6, 0.06, "glass")
		for _, x in ipairs({ 2.8, 3.6, 4.4 }) do
			m:add("cyl", x, G + 1.8, 1.8, 0.5, 0.4, 0.5, "steel")
		end
		pylon(m, -3.2, 2.2, 3.4)
		pylon(m, -4.6, 4.4, 3.0)
		m:add("box", -4.6, G + 3.2, -1.0, 1.0, 0.8, 1.0, "concrete"):add("box", 4.6, G + 3.2, -1.0, 1.0, 0.8, 1.0, "concrete")
		MODELS["hydro-plant"] = done(m, { yaw = 20, pitch = 26, fit = 1.05 })
	end

	do -- Library
		local m = new("grass", "stone")
		portico(m, 0.4, 5.6, 2.8, "sandstone", "terracotta", 5)
		m:add("box", 0, G + 0.5, 0.55, 1.0, 2.0, 0.2, "timber")
		-- a stack of books and a scroll in front
		local roles = { "red", "violet", "copper", "bronze" }
		for i = 1, 4 do
			m:add("box", -2.6, G + (i - 1) * 0.32, 3.8, 1.5 - i * 0.1, 0.3, 1.1, roles[i], i * 12)
		end
		m:add("cyl", 2.4, G + 0.25, 3.8, 0.5, 1.6, 0.5, "canvas", 90, 90):add("cyl", 2.4, G + 0.25, 3.2, 0.5, 1.6, 0.5, "canvas", 90, 90)
		for _, x in ipairs({ -4.4, 4.4 }) do
			m:add("cyl", x, G, 2.4, 0.14, 1.8, 0.14, "bronze"):add("ball", x, G + 1.8, 2.4, 0.4, 0.4, 0.4, "lamp")
		end
		m:group(-4.6, G, -3.6, 0, cypress(2.6)):group(4.6, G, -3.6, 0, cypress(2.6))
		MODELS["library"] = done(m, CAM)
	end

	do -- Marketplace
		local m = new("sand", "sandstone")
		local awn = { "red", "canvas", "violet", "copper" }
		for i, p in ipairs({ { -3, -2.6 }, { 0.2, -3.2 }, { 3.4, -2.4 }, { -2.8, 2.2 } }) do
			for _, o in ipairs({ { -0.9, -0.6 }, { 0.9, -0.6 }, { -0.9, 0.6 }, { 0.9, 0.6 } }) do
				m:add("cyl", p[1] + o[1], G, p[2] + o[2], 0.1, 1.6, 0.1, "timber")
			end
			m:add("box", p[1], G, p[2], 1.9, 0.7, 1.0, "timber"):add("wedge", p[1], G + 1.6, p[2], 2.2, 0.5, 1.6, awn[i])
			m:add("ball", p[1] - 0.5, G + 0.7, p[2], 0.34, 0.34, 0.34, "red"):add("ball", p[1], G + 0.7, p[2], 0.34, 0.34, 0.34, "gold")
			m:add("ball", p[1] + 0.5, G + 0.7, p[2], 0.34, 0.34, 0.34, "foliage")
		end
		m:add("cyl", 1.6, G, 1.8, 1.5, 0.7, 1.5, "stone"):add("cyl", 1.6, G + 0.7, 1.8, 1.1, 0.04, 1.1, "water") -- the well
		m:add("arch", 1.6, G + 0.7, 1.8, 1.5, 1.4, 0.14, "timber", 90)
		crates(m, 3.4, 3.6)
		m:add("cyl", -0.6, G, 4.2, 0.6, 0.8, 0.6, "terracotta"):add("cyl", 0.2, G, 4.5, 0.5, 0.6, 0.5, "terracotta")
		MODELS["marketplace"] = done(m, { yaw = 30, pitch = 26, fit = 1.0 })
	end

	do -- Mass Transit
		local m = new("grass", "concrete")
		m:add("box", 0, G, -1.2, 11.6, 0.2, 2.2, "rock") -- the track bed
		m:add("box", 0, G + 0.2, -1.8, 11.6, 0.1, 0.14, "steel"):add("box", 0, G + 0.2, -0.6, 11.6, 0.1, 0.14, "steel")
		for i = -1, 1 do -- three cars
			m:add("box", i * 3.5, G + 0.4, -1.2, 3.2, 1.5, 1.6, i == 0 and "plaster" or "red")
			m:add("box", i * 3.5, G + 1.0, -0.38, 2.6, 0.55, 0.06, "glass"):add("box", i * 3.5, G + 1.9, -1.2, 3.0, 0.14, 1.4, "steel")
		end
		m:add("box", 0, G, 1.8, 10.4, 0.6, 2.4, "concrete") -- the platform
		for _, x in ipairs({ -4, -1.3, 1.3, 4 }) do
			m:add("cyl", x, G + 0.6, 2.2, 0.16, 2.2, 0.16, "steel")
		end
		m:add("box", 0, G + 2.8, 1.8, 10.0, 0.16, 2.6, "glass") -- the canopy
		m:add("box", -3, G + 0.6, 2.6, 1.4, 0.4, 0.4, "timber"):add("box", 3, G + 0.6, 2.6, 1.4, 0.4, 0.4, "timber") -- benches
		m:add("box", 0, G + 0.6, 2.7, 0.14, 1.6, 0.14, "steel"):add("box", 0, G + 2.0, 2.7, 1.1, 0.5, 0.1, "lamp") -- the sign
		m:group(-4.6, G, 4.6, 0, tree(1.8)):group(4.6, G, 4.6, 0, tree(1.8))
		MODELS["mass-transit"] = done(m, { yaw = 25, pitch = 22, fit = 1.0 })
	end

	do -- Mfg. Plant
		local m = new("grass", "concrete")
		m:add("box", -1.0, G, -1.8, 8.4, 3.0, 4.6, "steel"):add("box", -1.0, G + 3.0, -1.8, 8.6, 0.2, 4.8, "slate")
		m:add("box", -1.0, G + 1.6, 0.52, 7.6, 0.6, 0.06, "glass"):add("box", -3.4, G, 0.52, 1.8, 1.4, 0.08, "black")
		for _, x in ipairs({ -3.4, -1.0, 1.4 }) do
			m:add("cyl", x, G + 3.2, -1.8, 0.8, 0.5, 0.8, "concrete") -- roof vents
		end
		m:add("cyl", 4.6, G, -3.0, 1.6, 3.6, 1.6, "plaster"):add("cone", 4.6, G + 3.6, -3.0, 1.6, 0.5, 1.6, "steel") -- tanks
		m:add("cyl", 4.6, G, -0.8, 1.3, 2.6, 1.3, "plaster"):add("cone", 4.6, G + 2.6, -0.8, 1.3, 0.4, 1.3, "steel")
		m:add("cyl", 3.6, G + 1.6, -1.9, 0.2, 2.2, 0.2, "copper", 0, 90) -- a pipe between them
		m:add("box", 0.4, G, 2.6, 6.0, 0.5, 0.9, "black") -- the conveyor
		for i = 0, 3 do
			m:add("box", -2 + i * 1.6, G + 0.5, 2.6, 0.7, 0.5, 0.6, i % 2 == 0 and "bronze" or "steel")
		end
		-- the robot arm
		m:add("cyl", 1.8, G, 4.0, 0.8, 0.4, 0.8, "red"):add("box", 1.8, G + 0.4, 4.0, 0.3, 1.5, 0.3, "red")
		m:add("box", 1.8, G + 1.7, 3.5, 0.26, 0.26, 1.4, "red"):add("box", 1.8, G + 1.3, 2.9, 0.16, 0.5, 0.16, "steel")
		MODELS["mfg-plant"] = done(m, CAM)
	end

	do -- Nuclear Plant
		local m = new("grass", "concrete")
		for _, p in ipairs({ { -3.0, -2.2 }, { 0.6, -3.2 } }) do -- cooling towers
			m:add("cyl", p[1], G, p[2], 3.4, 1.6, 3.4, "concrete"):add("cyl", p[1], G + 1.6, p[2], 2.9, 1.6, 2.9, "concrete")
			m:add("cyl", p[1], G + 3.2, p[2], 2.6, 1.4, 2.6, "concrete"):add("cyl", p[1], G + 4.6, p[2], 2.9, 0.9, 2.9, "concrete")
			m:add("ball", p[1], G + 5.2, p[2], 2.2, 2.2, 2.2, "canvas") -- steam
			m:add("ball", p[1] + 0.6, G + 6.6, p[2], 1.6, 1.6, 1.6, "canvas")
		end
		m:add("cyl", 3.4, G, 0.6, 2.8, 1.8, 2.8, "plaster"):add("ball", 3.4, G + 0.4, 0.6, 2.8, 2.8, 2.8, "plaster") -- the reactor dome
		m:add("box", 0.2, G, 1.8, 3.4, 1.6, 2.2, "steel"):add("box", 0.2, G + 1.6, 1.8, 3.6, 0.16, 2.4, "slate") -- the turbine hall
		m:add("box", 0.2, G + 0.6, 2.92, 2.6, 0.5, 0.06, "glass")
		m:add("box", 1.9, G + 0.5, 1.2, 0.8, 0.3, 0.3, "copper") -- the steam pipe
		pylon(m, -3.6, 3.2, 3.2)
		pylon(m, -1.6, 4.6, 3.2)
		m:add("box", 3.4, G, 4.4, 1.2, 0.9, 0.1, "gold"):add("cyl", 3.4, G + 0.2, 4.46, 0.5, 0.06, 0.5, "black", 0, 90) -- the warning sign
		MODELS["nuclear-plant"] = done(m, CAM)
	end

	do -- Palace
		local m = new("grass", "marble")
		m:add("box", 0, G, 1.6, 9.0, 0.3, 4.0, "stone"):add("box", 0, G + 0.3, 1.0, 7.6, 0.3, 2.6, "stone") -- the steps
		m:add("box", 0, G, -2.0, 5.0, 4.2, 3.6, "plaster") -- the centre block
		m:add("box", -3.9, G, -2.2, 2.8, 2.8, 3.0, "plaster"):add("box", 3.9, G, -2.2, 2.8, 2.8, 3.0, "plaster") -- the wings
		m:add("box", -3.9, G + 2.8, -2.2, 3.0, 0.2, 3.2, "terracotta"):add("box", 3.9, G + 2.8, -2.2, 3.0, 0.2, 3.2, "terracotta")
		m:group(0, G + 0.6, 0.1, 0, columns(4, 1.2, 3.0, 0.4, "marble"))
		m:add("box", 0, G + 3.6, 0.0, 5.2, 0.4, 0.8, "marble")
		m:add("cyl", 0, G + 4.2, -2.0, 3.0, 0.8, 3.0, "plaster"):add("ball", 0, G + 4.3, -2.0, 3.0, 3.0, 3.0, "gold") -- the dome
		m:add("box", 0, G + 7.2, -2.0, 0.1, 0.9, 0.1, "gold")
		for _, x in ipairs({ -5.0, 5.0 }) do
			m:add("cyl", x, G, -0.4, 1.1, 4.4, 1.1, "plaster"):add("cone", x, G + 4.4, -0.4, 1.4, 1.6, 1.4, "violet")
			m:group(x, G + 6.0, -0.4, 0, flag(1.2, "violet"))
		end
		m:add("box", 0, G + 0.6, -0.18, 1.2, 2.2, 0.1, "bronze") -- the door
		m:add("box", 0, G + 0.02, 3.6, 1.6, 0.04, 3.6, "red") -- the carpet
		m:group(-3.4, G, 4.4, 0, cypress(2.2)):group(3.4, G, 4.4, 0, cypress(2.2))
		MODELS["palace"] = done(m, { yaw = 25, pitch = 18, fit = 1.05 })
	end

	do -- Power Plant
		local m = new("grass", "concrete")
		m:add("box", -1.4, G, -2.0, 6.4, 3.2, 3.6, "brick"):add("box", -1.4, G + 3.2, -2.0, 6.6, 0.2, 3.8, "slate")
		for i = 0, 3 do
			m:add("box", -3.6 + i * 1.5, G + 1.2, -0.18, 0.8, 1.4, 0.06, "glass")
		end
		chimney(m, 3.0, -3.2, 1.0, 7.4, "concrete")
		chimney(m, 4.4, -1.6, 1.0, 6.4, "concrete")
		chimney(m, 3.0, -0.2, 0.9, 5.4, "concrete")
		m:add("ball", 3.0, G + 7.9, -3.2, 1.6, 1.6, 1.6, "stone"):add("ball", 3.6, G + 9.0, -3.0, 1.2, 1.2, 1.2, "stone") -- smoke
		m:add("pyramid", -3.2, G, 3.0, 3.4, 1.6, 3.4, "black"):add("pyramid", -1.2, G, 3.8, 2.2, 1.0, 2.2, "black") -- coal
		m:add("box", -1.6, G + 0.8, 1.2, 0.7, 0.14, 3.4, "steel", 0, -22) -- the conveyor up to the hall
		pylon(m, 2.6, 3.0, 3.6)
		pylon(m, 4.8, 4.4, 3.6)
		m:add("box", 3.7, G + 3.3, 3.7, 2.7, 0.04, 0.04, "black", 32)
		MODELS["power-plant"] = done(m, CAM)
	end

	do -- Recycling Center
		local m = new("grass", "concrete")
		m:add("box", -1.6, G, -2.6, 6.6, 2.4, 3.2, "steel"):add("wedge", -1.6, G + 2.4, -2.6, 6.8, 0.9, 3.4, "copper")
		m:add("box", -1.6, G, -0.96, 2.4, 1.8, 0.08, "black")
		local bins = { "foliage", "water", "gold", "red" }
		for i, role in ipairs(bins) do
			m:add("box", -4.2 + (i - 1) * 1.5, G, 2.4, 1.2, 1.2, 1.0, role):add("box", -4.2 + (i - 1) * 1.5, G + 1.2, 2.4, 1.3, 0.12, 1.1, "black")
		end
		m:add("box", 3.6, G, -2.2, 2.6, 1.0, 2.6, "rock"):add("pyramid", 3.6, G + 1.0, -2.2, 2.4, 1.2, 2.4, "bronze") -- the scrap heap
		m:add("box", 3.2, G + 1.3, -1.6, 0.8, 0.5, 0.5, "steel", 30):add("cyl", 4.2, G + 1.2, -2.6, 0.5, 0.5, 0.5, "glass", 0, 60)
		-- the truck
		m:add("box", 2.8, G + 0.3, 3.4, 2.6, 1.2, 1.4, "foliage"):add("box", 4.5, G + 0.3, 3.4, 0.9, 0.9, 1.3, "plaster")
		m:add("box", 4.6, G + 0.8, 3.4, 0.6, 0.35, 1.1, "glass")
		for _, x in ipairs({ 2.0, 3.4, 4.5 }) do
			m:add("cyl", x, G + 0.3, 4.14, 0.6, 0.12, 0.6, "black", 0, 90)
		end
		m:group(-4.8, G, -4.8, 0, tree(2)):group(-4.6, G, 4.6, 0, tree(1.6))
		MODELS["recycling-center"] = done(m, CAM)
	end

	do -- SDI Defense
		local m = new("sand", "concrete")
		m:add("box", -2.6, G, -2.6, 4.4, 1.2, 3.4, "concrete"):add("wedge", -2.6, G, -0.5, 4.4, 1.2, 0.8, "concrete", 180) -- the bunker
		m:add("box", -2.6, G + 0.5, -0.88, 2.6, 0.3, 0.06, "black")
		m:add("cyl", -2.6, G + 1.2, -2.6, 2.4, 0.5, 2.4, "concrete"):add("ball", -2.6, G + 1.2, -2.6, 2.6, 2.6, 2.6, "plaster") -- the radome
		for _, p in ipairs({ { 2.4, -3.0 }, { 4.0, -1.0 }, { 2.2, 1.0 } }) do -- launchers
			m:add("box", p[1], G, p[2], 1.5, 0.5, 1.5, "steel")
			for _, o in ipairs({ -0.35, 0.35 }) do
				m:add("cyl", p[1] + o, G + 0.5, p[2], 0.4, 2.2, 0.4, "plaster", 0, 28)
				m:add("cone", p[1] + o, G + 2.44, p[2] + 1.03, 0.4, 0.5, 0.4, "red", 0, 28)
			end
		end
		m:add("cyl", -3.4, G, 3.2, 0.3, 1.6, 0.3, "steel"):add("cone", -3.4, G + 2.3, 3.2, 2.2, 0.6, 2.2, "plaster", 40, 150) -- the dish
		m:add("box", 0.4, G, 3.8, 1.6, 0.9, 1.0, "slate"):add("box", 0.4, G + 0.9, 3.8, 0.9, 0.5, 0.06, "lamp") -- the console
		m:add("box", 0, G, 5.4, 11.2, 0.9, 0.1, "steel") -- the fence
		MODELS["sdi-defense"] = done(m, CAM)
	end

	do -- Temple
		local m = new("grass", "sand")
		m:add("box", 0, G, 0, 8.0, 0.35, 9.4, "stone"):add("box", 0, G + 0.35, 0, 7.0, 0.35, 8.4, "stone")
		m:add("box", 0, G + 0.7, -0.6, 3.6, 2.8, 5.0, "plaster") -- the inner room
		for _, x in ipairs({ -2.8, 2.8 }) do
			for i = 0, 4 do
				m:add("cyl", x, G + 0.7, -3.4 + i * 1.7, 0.5, 3.0, 0.5, "marble")
			end
		end
		m:add("cyl", -1, G + 0.7, 3.4, 0.5, 3.0, 0.5, "marble"):add("cyl", 1, G + 0.7, 3.4, 0.5, 3.0, 0.5, "marble")
		m:add("box", 0, G + 3.7, 0, 6.6, 0.3, 7.8, "marble")
		m:group(0, G + 4.0, 0, 90, gable(0, 0, 0, 7.8, 1.4, 6.6, "terracotta"))
		m:add("box", 0, G + 0.7, 1.94, 1.2, 2.0, 0.1, "bronze")
		m:add("cyl", 0, G, 5.2, 0.9, 0.9, 0.9, "stone"):add("cone", 0, G + 0.9, 5.2, 0.6, 0.9, 0.6, "lamp") -- the altar fire
		m:group(-4.8, G, 3.8, 0, cypress(2.8)):group(4.8, G, 3.8, 0, cypress(2.8)):group(4.8, G, -4.2, 0, cypress(2.2))
		MODELS["temple"] = done(m, CAM)
	end

	do -- University
		local m = new("grass")
		m:group(0, G, -3.4, 0, house(8.4, 2.6, 2.4, "brick", "slate", 1.2))
		m:group(-3.8, G, 0.2, 90, house(5.0, 2.4, 2.2, "brick", "slate", 1.1)):group(3.8, G, 0.2, 90, house(5.0, 2.4, 2.2, "brick", "slate", 1.1))
		m:add("box", 0, G, -2.6, 1.8, 6.4, 1.8, "sandstone"):add("pyramid", 0, G + 6.4, -2.6, 2.1, 1.8, 2.1, "slate") -- the clock tower
		m:add("cyl", 0, G + 5.0, -1.66, 1.1, 0.08, 1.1, "plaster", 0, 90):add("box", 0, G + 5.5, -1.6, 0.08, 0.5, 0.04, "black")
		m:add("arch", 0, G, -1.66, 1.4, 2.0, 0.2, "sandstoneDark")
		for i = -2, 2 do
			if i ~= 0 then
				m:add("box", i * 1.6, G + 1.2, -2.18, 0.7, 0.9, 0.06, "glass")
			end
		end
		m:add("box", 0, G, 1.4, 4.6, 0.05, 4.4, "foliage") -- the lawn
		m:add("box", 0, G, 1.4, 0.8, 0.07, 4.4, "sand") -- the path
		m:add("cyl", 0, G, 1.6, 1.0, 0.4, 1.0, "stone"):add("box", 0, G + 0.4, 1.6, 0.3, 1.2, 0.3, "bronze") -- a statue
		m:group(-1.6, G, 3.0, 0, tree(2.0)):group(1.6, G, 3.0, 0, tree(2.0)):group(-1.6, G, 0.2, 0, tree(1.6))
		MODELS["university"] = done(m, CAM)
	end
end
