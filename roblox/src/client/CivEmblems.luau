-- One small scene per civilization for the "Choose your civilization"
-- gallery, plus "random". Same model data and builder as the wonders. The
-- banner uses the roles civPrimary / civSecondary, which the gallery tints
-- with the civ's own colours. Returns a function: require(...)(StructureModels)
-- fills EMBLEMS.civs. Original scenes; gate 65 checks one per civs.json id.
return function(S)
	local k = S.kit
	local new, done, part, r2, G = k.new, k.done, k.part, k.r2, k.G
	local house, gable, tree, cypress, flag, columns = k.house, k.gable, k.tree, k.cypress, k.flag, k.columns
	local palm, obelisk = k.palm, k.obelisk
	S.EMBLEMS.civs = {}
	local CIV = S.EMBLEMS.civs
	local CAM = { yaw = 30, pitch = 20, fit = 0.9 }

	-- the civ's standard: a pole and a banner in its two colours
	local function standard(h)
		return {
			part("cyl", 0, 0, 0, 0.14, h, 0.14, "timber"),
			part("box", 0.75, h - 1.7, 0, 1.3, 1.6, 0.06, "civPrimary"),
			part("box", 0.75, h - 1.0, 0, 1.3, 0.3, 0.1, "civSecondary"),
			part("ball", 0, h, 0, 0.3, 0.3, 0.3, "civSecondary"),
		}
	end

	do -- Romans: a triumphal arch over a paved road
		local m = new("grass")
		m:add("box", 0, G, 0, 3.0, 0.06, 11.6, "stone")
		m:add("arch", 0, G, 0, 7.0, 6.0, 2.0, "marble"):add("box", 0, G + 6.0, 0, 7.4, 1.2, 2.2, "marble")
		m:add("box", 0, G + 7.2, 0, 2.2, 0.3, 1.0, "stone"):add("box", 0, G + 7.5, 0, 1.6, 0.8, 0.5, "gold")
		for _, x in ipairs({ -2.8, 2.8 }) do
			for _, z in ipairs({ -1.25, 1.25 }) do
				m:add("cyl", x, G, z, 0.5, 5.0, 0.5, "marble")
			end
		end
		m:group(-5.0, G, 2.6, 0, standard(5.0)):group(4.2, G, 2.6, 0, standard(5.0))
		m:group(-4.6, G, -3.6, 0, cypress(3.2)):group(4.6, G, -3.6, 0, cypress(3.2))
		CIV["romans"] = done(m, CAM)
	end

	do -- Babylonians: the stepped temple tower
		local m = new("sand", "sandstone")
		m:add("box", 0, G, -1.0, 8.0, 1.6, 8.0, "brick"):add("box", 0, G + 1.6, -1.0, 6.0, 1.6, 6.0, "brick")
		m:add("box", 0, G + 3.2, -1.0, 4.0, 1.6, 4.0, "brick"):add("box", 0, G + 4.8, -1.0, 2.0, 1.4, 2.0, "water")
		m:add("pyramid", 0, G + 6.2, -1.0, 2.2, 0.6, 2.2, "gold")
		m:add("wedge", 0, G, 4.2, 1.6, 1.6, 2.4, "sandstone", 180)
		m:add("box", 0, G + 1.6, 2.5, 1.6, 0.06, 1.0, "sandstone")
		m:group(-4.8, G, 4.6, 0, palm(2.6)):group(3.2, G, 4.9, 0, palm(2.2)):group(5.0, G, -4.6, 0, palm(2.4))
		m:group(-3.4, G, 4.4, 0, standard(4.6))
		CIV["babylonians"] = done(m, CAM)
	end

	do -- Germans: a keep and a round tower among firs
		local m = new("grass")
		m:add("box", 0, G, -1.0, 3.4, 5.0, 3.4, "stone"):add("pyramid", 0, G + 5.0, -1.0, 3.8, 2.2, 3.8, "slate")
		m:add("cyl", 3.0, G, -2.2, 1.8, 6.5, 1.8, "stone"):add("cone", 3.0, G + 6.5, -2.2, 2.2, 2.0, 2.2, "slate")
		m:add("box", 0, G, 0.72, 1.0, 1.8, 0.06, "timber")
		m:group(-3.4, G, 2.4, 0, house(3.0, 1.8, 2.4, "plaster", "terracotta", 1.2))
		m:add("box", -3.4, G + 0.8, 3.62, 3.0, 0.16, 0.05, "timber"):add("box", -3.4, G, 3.62, 0.16, 1.8, 0.05, "timber")
		m:group(-4.8, G, -3.8, 0, cypress(3.0)):group(-2.8, G, -4.6, 0, cypress(2.4)):group(5.0, G, 1.6, 0, cypress(2.8))
		m:group(2.6, G, 3.8, 0, standard(5.0))
		CIV["germans"] = done(m, CAM)
	end

	do -- Egyptians: a temple gate, obelisks and the river
		local m = new("sand")
		m:add("box", 5.2, G, 0, 1.2, 0.06, 11.6, "water")
		for _, x in ipairs({ -2.6, 2.6 }) do
			m:add("box", x, G, -2.0, 3.2, 5.0, 1.6, "sandstone"):add("box", x, G + 5.0, -2.0, 3.4, 0.3, 1.8, "sandstoneDark")
		end
		m:add("box", 0, G + 2.6, -2.0, 2.0, 1.0, 1.2, "sandstoneDark")
		m:group(-1.6, G, 1.2, 0, obelisk(5.0)):group(1.6, G, 1.2, 0, obelisk(5.0))
		for _, x in ipairs({ -2.8, 2.8 }) do
			for _, z in ipairs({ 2.6, 4.4 }) do
				m:add("box", x, G, z, 0.6, 0.5, 1.2, "sandstoneDark"):add("box", x, G + 0.5, z + 0.35, 0.4, 0.5, 0.4, "sandstoneDark")
			end
		end
		m:group(-4.8, G, 4.6, 0, palm(2.6)):group(4.0, G, 4.8, 0, palm(2.2))
		m:group(-5.0, G, 0.4, 0, standard(4.4))
		CIV["egyptians"] = done(m, CAM)
	end

	do -- Americans: a domed hall on a lawn
		local m = new("grass")
		m:add("box", 0, G, -1.6, 8.0, 2.2, 3.0, "plaster"):add("box", 0, G, -1.6, 3.4, 3.0, 3.4, "plaster")
		m:add("cyl", 0, G + 3.0, -1.6, 2.4, 1.4, 2.4, "plaster"):add("ball", 0, G + 4.0, -1.6, 2.6, 2.6, 2.6, "copper")
		m:add("cyl", 0, G + 6.4, -1.6, 0.5, 0.8, 0.5, "plaster"):add("cone", 0, G + 7.2, -1.6, 0.6, 0.6, 0.6, "copper")
		m:add("box", 0, G, 0.9, 4.0, 0.3, 1.2, "stone")
		m:group(0, G + 0.3, 0.6, 0, columns(6, 0.6, 2.2, 0.3, "marble"))
		m:group(0, G + 2.5, 0.4, 0, gable(0, 0, 0, 3.8, 0.8, 1.0, "marble"))
		m:group(-4.6, G, 3.6, 0, tree(2.0)):group(-2.6, G, 4.6, 0, tree(1.6))
		m:group(3.8, G, 3.6, 0, standard(5.5))
		CIV["americans"] = done(m, CAM)
	end

	do -- Greeks: a temple on a rock
		local m = new("grass")
		m:add("box", 0, G, -0.5, 9.0, 1.6, 7.0, "rock"):add("box", 0, G + 1.6, -0.5, 7.6, 0.8, 5.6, "rock")
		m:add("box", 0, G + 2.4, -0.5, 6.4, 0.3, 3.6, "marble"):add("box", 0, G + 2.7, -0.5, 4.0, 2.4, 1.6, "plaster")
		m:group(0, G + 2.7, 0.9, 0, columns(6, 1.1, 2.4, 0.4, "marble"))
		m:group(0, G + 2.7, -1.9, 0, columns(6, 1.1, 2.4, 0.4, "marble"))
		m:add("box", 0, G + 5.1, -0.5, 6.4, 0.4, 3.6, "marble")
		m:group(0, G + 5.5, -0.5, 0, gable(0, 0, 0, 6.6, 1.0, 3.8, "terracotta"))
		m:group(-5.2, G, 4.6, 0, cypress(2.6)):group(4.8, G, 4.6, 0, tree(1.6)):group(3.0, G, 4.9, 0, tree(1.3))
		m:group(-1.0, G, 4.4, 0, standard(4.8))
		CIV["greeks"] = done(m, CAM)
	end

	do -- Indians: a domed palace and its pool
		local m = new("grass", "sandstone")
		m:add("box", 0, G, -0.8, 7.0, 0.6, 7.0, "marble"):add("box", 0, G + 0.6, -0.8, 3.6, 2.6, 3.6, "plaster")
		m:add("ball", 0, G + 2.6, -0.8, 3.0, 3.0, 3.0, "marble"):add("cone", 0, G + 5.5, -0.8, 0.4, 0.9, 0.4, "gold")
		m:add("box", 0, G + 0.6, 1.03, 1.0, 1.6, 0.06, "black")
		for _, x in ipairs({ -3.0, 3.0 }) do
			for _, z in ipairs({ -3.8, 2.2 }) do
				m:add("cyl", x, G + 0.6, z, 0.5, 4.2, 0.5, "marble"):add("ball", x, G + 4.7, z, 0.7, 0.7, 0.7, "gold")
			end
		end
		m:add("box", 0, G, 4.2, 1.6, 0.06, 3.0, "water")
		for _, x in ipairs({ -1.6, 1.6 }) do
			m:group(x, G, 3.6, 0, cypress(1.6)):group(x, G, 5.0, 0, cypress(1.6))
		end
		m:group(3.8, G, 4.4, 0, standard(4.6))
		CIV["indians"] = done(m, CAM)
	end

	do -- Russians: a church with onion domes
		local m = new("grass", "plaster")
		m:add("box", 0, G, -0.8, 4.0, 3.0, 4.0, "brick"):add("cyl", 0, G + 3.0, -0.8, 1.6, 3.0, 1.6, "plaster")
		m:add("ball", 0, G + 5.8, -0.8, 2.0, 2.0, 2.0, "gold"):add("cone", 0, G + 7.4, -0.8, 1.0, 1.2, 1.0, "gold")
		local domes = { "red", "copper", "copper", "red" }
		local i = 0
		for _, x in ipairs({ -1.6, 1.6 }) do
			for _, z in ipairs({ -2.4, 0.8 }) do
				i += 1
				m:add("cyl", x, G + 3.0, z, 0.9, 1.6, 0.9, "plaster"):add("ball", x, G + 4.4, z, 1.2, 1.2, 1.2, domes[i])
				m:add("cone", x, G + 5.3, z, 0.6, 0.8, 0.6, domes[i])
			end
		end
		m:add("box", 0, G, 1.23, 1.0, 1.8, 0.06, "timber")
		m:group(-4.6, G, -3.6, 0, cypress(2.8)):group(4.6, G, -2.6, 0, cypress(2.4)):group(4.4, G, 3.8, 0, cypress(2.0))
		m:group(-4.6, G, 3.8, 0, standard(5.0))
		CIV["russians"] = done(m, CAM)
	end

	do -- Zulus: a ring of huts inside a palisade
		local m = new("grass", "sand")
		for h = 0, 4 do
			local a = math.rad(h * 72 + 36)
			local x, z = r2(math.sin(a) * 3.4), r2(math.cos(a) * 3.4)
			m:add("cyl", x, G, z, 2.2, 1.0, 2.2, "thatch"):add("ball", x, 0, z, 2.2, 2.2, 2.2, "thatch")
			m:add("box", r2(x * 0.68), G, r2(z * 0.68), 0.6, 0.8, 0.6, "black", h * 72 + 36)
		end
		for p = 0, 15 do
			local a = math.rad(p * 22.5)
			m:add("cyl", r2(math.sin(a) * 5.5), G, r2(math.cos(a) * 5.5), 0.22, 1.2, 0.22, "timber")
		end
		m:add("cone", 0.9, G, 0.6, 0.7, 0.9, 0.7, "lamp"):add("box", 0.9, G, 0.6, 1.0, 0.12, 0.16, "timber", 30)
		m:add("box", -0.9, G, 0.9, 0.8, 1.5, 0.1, "canvas", 20, -14):add("cyl", -1.3, G, 0.6, 0.06, 2.6, 0.06, "timber")
		m:group(-0.2, G, -0.6, 0, standard(4.6))
		CIV["zulus"] = done(m, CAM)
	end

	do -- French: a country house with towers and a formal garden
		local m = new("grass")
		m:add("box", 0, G, -2.0, 6.0, 2.6, 2.6, "plaster")
		m:group(0, G + 2.6, -2.0, 0, gable(0, 0, 0, 6.2, 1.6, 2.8, "slate"))
		for _, x in ipairs({ -3.2, 3.2 }) do
			for _, z in ipairs({ -3.1, -0.9 }) do
				m:add("cyl", x, G, z, 1.4, 3.6, 1.4, "plaster"):add("cone", x, G + 3.6, z, 1.7, 2.0, 1.7, "slate")
			end
		end
		m:add("box", 0, G, -0.68, 1.0, 1.6, 0.06, "timber")
		m:add("box", 0, G, 2.4, 1.0, 0.05, 6.0, "sand")
		for _, x in ipairs({ -2.2, 2.2 }) do
			for _, z in ipairs({ 1.6, 3.8 }) do
				m:add("box", x, G, z, 1.6, 0.4, 1.6, "foliage")
			end
		end
		m:add("cyl", 0, G + 0.05, 2.7, 1.4, 0.3, 1.4, "stone"):add("cyl", 0, G + 0.35, 2.7, 1.0, 0.08, 1.0, "water")
		m:group(-4.4, G, 2.7, 0, cypress(1.8))
		m:group(3.8, G, 2.7, 0, standard(4.8))
		CIV["french"] = done(m, CAM)
	end

	do -- Aztecs: a stepped temple with a shrine on top
		local m = new("grass", "stone")
		for i = 0, 3 do
			m:add("box", 0, G + i * 1.2, -0.8, 8.4 - i * 1.8, 1.2, 8.4 - i * 1.8, "stone")
		end
		m:add("wedge", 0, G, 2.5, 1.6, 4.8, 3.6, "sandstone", 180)
		m:add("box", 0, G + 4.8, -1.0, 2.0, 1.4, 1.6, "terracotta"):add("box", 0, G + 6.2, -1.0, 2.3, 0.5, 1.9, "red")
		m:add("box", 0, G + 6.7, -1.0, 1.6, 0.6, 0.3, "gold")
		for _, x in ipairs({ -2.6, 2.6 }) do
			m:add("cyl", x, G, 4.6, 0.5, 0.8, 0.5, "stone"):add("cone", x, G + 0.8, 4.6, 0.5, 0.7, 0.5, "lamp")
		end
		m:group(4.9, G, 4.8, 0, tree(2.2)):group(-4.9, G, -4.9, 0, tree(2.0)):group(4.9, G, -4.9, 0, tree(1.8))
		m:group(-5.0, G, 4.8, 0, standard(4.6))
		CIV["aztecs"] = done(m, CAM)
	end

	do -- Chinese: a pagoda behind a gated wall
		local m = new("grass")
		m:add("box", 0, G, -0.8, 5.4, 0.4, 5.4, "stone")
		for i = 0, 3 do
			local w = 4.0 - i * 0.7
			m:add("box", 0, r2(G + 0.4 + i * 1.9), -0.8, w, 1.2, w, "red")
			m:add("pyramid", 0, r2(G + 1.6 + i * 1.9), -0.8, w + 1.6, 0.7, w + 1.6, "terracotta")
		end
		m:add("cyl", 0, G + 8.0, -0.8, 0.14, 1.2, 0.14, "gold")
		for _, x in ipairs({ -3.4, 3.4 }) do
			m:add("box", x, G, 4.6, 4.4, 1.0, 0.6, "stone"):add("box", x, G + 1.0, 4.6, 4.5, 0.14, 0.8, "terracotta")
		end
		m:add("box", -1.0, G, 4.6, 0.3, 1.6, 0.3, "red"):add("box", 1.0, G, 4.6, 0.3, 1.6, 0.3, "red")
		m:add("box", 0, G + 1.6, 4.6, 2.8, 0.3, 1.0, "terracotta")
		m:group(-4.6, G, -3.6, 0, cypress(2.4)):group(4.6, G, -3.2, 0, tree(1.8))
		m:group(3.4, G, 2.4, 0, standard(4.8))
		CIV["chinese"] = done(m, CAM)
	end

	do -- English: a keep on a moated island
		local m = new("grass")
		m:add("box", 0, G, 0, 9.6, 0.05, 9.6, "water"):add("box", 0, G, -0.4, 7.0, 0.12, 7.0, "grass")
		m:add("box", 0, G + 0.12, -0.4, 3.6, 4.4, 3.6, "stone")
		for _, x in ipairs({ -1.7, 1.7 }) do
			for _, z in ipairs({ -2.1, 1.3 }) do
				m:add("box", x, G + 0.12, z, 1.0, 5.4, 1.0, "stone"):add("box", x, G + 5.52, z, 1.2, 0.3, 1.2, "slate")
			end
		end
		for _, x in ipairs({ -0.6, 0.6 }) do
			m:add("box", x, G + 4.52, 1.3, 0.5, 0.5, 0.4, "stone")
		end
		m:add("box", 0, G + 0.12, 1.43, 1.0, 1.8, 0.06, "timber"):add("box", 0, G + 0.1, 4.0, 1.4, 0.12, 2.4, "timber")
		m:group(0, G + 4.52, -0.4, 0, standard(3.8))
		m:group(-2.8, G + 0.12, 2.2, 0, tree(1.8)):group(2.9, G + 0.12, -3.0, 0, tree(1.6))
		m:group(-5.2, G, 5.0, 0, tree(1.6))
		CIV["english"] = done(m, CAM)
	end

	do -- Mongols: a camp of round tents on the steppe
		local m = new("grass", "sand")
		local function tent(x, z, d, yaw)
			m:add("cyl", x, G, z, d, r2(d * 0.45), d, "canvas"):add("cone", x, r2(G + d * 0.45), z, r2(d * 1.08), r2(d * 0.35), r2(d * 1.08), "thatch")
			m:add("cyl", x, r2(G + d * 0.3), z, r2(d * 1.02), 0.12, r2(d * 1.02), "red")
			local a = math.rad(yaw)
			m:add("box", r2(x + math.sin(a) * d * 0.5), G, r2(z + math.cos(a) * d * 0.5), 0.7, r2(d * 0.34), 0.1, "timber", yaw)
		end
		tent(-2.4, -2.2, 3.6, 40)
		tent(2.8, -1.6, 2.8, -30)
		tent(-3.2, 2.8, 2.4, 100)
		m:add("cone", 0.6, G, 2.0, 0.7, 0.9, 0.7, "lamp"):add("box", 0.6, G, 2.0, 1.1, 0.12, 0.16, "timber", 40)
		-- a horse at its post
		m:add("box", 3.4, G + 0.7, 3.4, 0.5, 0.6, 1.4, "timber"):add("box", 3.4, G + 1.1, 4.1, 0.34, 0.9, 0.34, "timber", 0, 30)
		for _, o in ipairs({ { -0.16, -0.5 }, { 0.16, -0.5 }, { -0.16, 0.5 }, { 0.16, 0.5 } }) do
			m:add("box", 3.4 + o[1], G, 3.4 + o[2], 0.14, 0.7, 0.14, "black")
		end
		m:add("box", 4.6, G, 4.4, 0.14, 1.2, 0.14, "timber")
		m:group(0.4, G, -0.2, 0, standard(5.0))
		CIV["mongols"] = done(m, CAM)
	end

	do -- Random: a globe ringed by flags
		local m = new("grass", "stone")
		m:add("cyl", 0, G, 0, 4.0, 0.5, 4.0, "stone"):add("cyl", 0, G + 0.5, 0, 2.4, 1.2, 2.4, "marble")
		m:add("ball", 0, G + 1.6, 0, 4.2, 4.2, 4.2, "water")
		for _, o in ipairs({ { 0.9, 4.0, 1.0, 1.9 }, { -1.1, 3.2, 0.9, 1.7 }, { 0.4, 2.0, -1.3, 1.8 }, { -0.8, 4.3, -0.7, 1.5 } }) do
			m:add("ball", o[1], G + o[2], o[3], o[4], o[4], o[4], "foliage")
		end
		m:add("ball", 0, G + 5.2, 0, 1.2, 1.2, 1.2, "plaster")
		local roles = { "red", "gold", "water", "violet", "copper", "canvas" }
		for i, role in ipairs(roles) do
			local a = math.rad(i * 60)
			m:group(r2(math.sin(a) * 4.4), G, r2(math.cos(a) * 4.4), 0,
				{ part("cyl", 0, 0, 0, 0.12, 3.4, 0.12, "timber"), part("box", 0.6, 2.2, 0, 1.1, 1.1, 0.06, role) })
		end
		CIV["random"] = done(m, CAM)
	end
end
