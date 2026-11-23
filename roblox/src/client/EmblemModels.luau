-- Governments and encyclopedia concepts as small emblem scenes
-- (specs/roblox-pedia-art.md P5): the same model data and builder as the
-- wonders, so every entry has a picture that turns. Returns a function:
-- require(...)(StructureModels) fills EMBLEMS.governments / .concepts.
return function(S)
	local k = S.kit
	local new, done, part, r2, G = k.new, k.done, k.part, k.r2, k.G
	local house, gable, tree, cypress, flag, columns = k.house, k.gable, k.tree, k.cypress, k.flag, k.columns
	local GOV, CON = S.EMBLEMS.governments, S.EMBLEMS.concepts
	local CAM = { yaw = 30, pitch = 22, fit = 0.9 }
	local TOP = { yaw = 30, pitch = 38, fit = 0.9 }

	local function person(h, body, hat)
		local out = {
			part("box", 0, 0, 0, 0.34 * h, 0.42 * h, 0.2 * h, "black"),
			part("box", 0, 0.42 * h, 0, 0.42 * h, 0.34 * h, 0.24 * h, body),
			part("ball", 0, 0.74 * h, 0, 0.26 * h, 0.26 * h, 0.26 * h, "sandstone"),
		}
		if hat ~= nil then
			out[#out + 1] = part("cyl", 0, 0.96 * h, 0, 0.3 * h, 0.08 * h, 0.3 * h, hat)
		end
		return out
	end
	local function coins(n)
		local out = {}
		for i = 0, n - 1 do
			out[#out + 1] = part("cyl", 0, i * 0.18, 0, 0.7, 0.16, 0.7, "gold")
		end
		return out
	end
	local function torch(h)
		return { part("cyl", 0, 0, 0, 0.2, h, 0.2, "timber"), part("cone", 0, h, 0, 0.5, 0.8, 0.5, "lamp") }
	end
	-- an n x n board of flat tiles; roleAt(ix, iz) names each tile's role
	local function board(m, n, size, roleAt)
		for ix = 0, n - 1 do
			for iz = 0, n - 1 do
				m:add("box", r2((ix - (n - 1) / 2) * size), G, r2((iz - (n - 1) / 2) * size), size - 0.12, 0.2, size - 0.12, roleAt(ix, iz))
			end
		end
	end
	local function throne(m, x, z, role)
		m:add("box", x, G, z, 4.4, 0.4, 4.0, "stone"):add("box", x, G + 0.4, z - 0.3, 3.4, 0.4, 3.0, "stone")
		m:add("box", x, G + 0.8, z - 0.4, 1.8, 0.9, 1.6, role):add("box", x, G + 1.7, z - 1.1, 1.8, 2.8, 0.3, role)
		m:add("box", x - 0.95, G + 1.7, z - 0.4, 0.3, 0.7, 1.5, role):add("box", x + 0.95, G + 1.7, z - 0.4, 0.3, 0.7, 1.5, role)
		m:add("box", x, G + 1.7, z - 0.3, 1.5, 0.16, 1.3, "red")
	end
	local function crown(m, x, y, z, w)
		m:add("cyl", x, y, z, w, w * 0.35, w, "gold")
		for i = 0, 4 do
			local a = math.rad(i * 72)
			m:add("pyramid", r2(x + math.sin(a) * w * 0.4), y + w * 0.35, r2(z + math.cos(a) * w * 0.4), w * 0.24, w * 0.4, w * 0.24, "gold", i * 72)
		end
		m:add("ball", x, y + w * 0.3, z, w * 0.5, w * 0.5, w * 0.5, "red")
	end
	local function ballotBox(m, x, y, z, w)
		m:add("box", x, y, z, w, w * 0.8, w * 0.7, "timber"):add("box", x, y + w * 0.8, z, w * 1.06, w * 0.08, w * 0.76, "bronze")
		m:add("box", x, y + w * 0.88, z, w * 0.5, 0.03, w * 0.1, "black"):add("box", x, y + w * 0.82, z, w * 0.4, w * 0.5, 0.04, "canvas", 0, -12)
	end
	local function rocket(m, x, y, z, h)
		m:add("cyl", x, y, z, h * 0.2, h * 0.75, h * 0.2, "plaster"):add("cone", x, y + h * 0.75, z, h * 0.2, h * 0.25, h * 0.2, "red")
		m:add("box", x, y, z, h * 0.5, h * 0.18, 0.08, "red"):add("box", x, y, z, 0.08, h * 0.18, h * 0.5, "red")
		m:add("box", x, y + h * 0.5, z + h * 0.1, h * 0.1, h * 0.06, 0.04, "black")
	end

	-- ---- governments ----------------------------------------------------------
	do -- Anarchy
		local m = new("sand", "rock")
		m:add("cyl", -3, G, -2, 1.0, 3.6, 1.0, "marble"):add("cyl", -0.6, G, -3, 1.0, 1.6, 1.0, "marble") -- standing, broken
		m:add("cyl", 1.2, G + 0.5, -2.4, 1.0, 3.0, 1.0, "marble", 70, 90) -- fallen
		m:add("box", 2.6, G, 1.0, 2.6, 0.5, 1.8, "stone"):add("box", 2.8, G + 0.5, 1.2, 1.2, 0.9, 1.0, "stone", 25) -- a toppled plinth
		crown(m, -1.4, G, 2.6, 1.2) -- the crown in the dust
		for _, p in ipairs({ { -3.6, 2.4, 1.6 }, { 0.8, 0.4, 2.2 }, { 4.0, -3.4, 1.4 } }) do -- fires
			m:add("cone", p[1], G, p[2], p[3] * 0.7, p[3], p[3] * 0.7, "lamp"):add("cone", p[1] + 0.3, G, p[2] + 0.2, p[3] * 0.5, p[3] * 0.7, p[3] * 0.5, "red")
			m:add("ball", p[1], G + p[3] + 0.4, p[2], p[3] * 0.7, p[3] * 0.7, p[3] * 0.7, "slate")
		end
		m:add("cyl", 3.6, G, 3.6, 0.12, 3.4, 0.12, "timber", 0, 18):add("box", 4.0, G + 2.5, 4.5, 1.2, 0.8, 0.05, "red", 20) -- a torn banner
		GOV["anarchy"] = done(m, CAM)
	end

	do -- Despotism
		local m = new("sand", "sandstone")
		throne(m, 0, -1.6, "sandstoneDark")
		m:add("box", 0, G + 0.02, 3.2, 1.8, 0.04, 5.0, "red")
		m:group(-3.4, G, 0.6, 0, torch(2.6)):group(3.4, G, 0.6, 0, torch(2.6))
		for _, x in ipairs({ -2.2, 2.2 }) do -- guards with spears
			m:group(x, G, 2.4, 0, person(2.2, "bronze", "bronze"))
			m:add("cyl", x + (x < 0 and -0.6 or 0.6), G, 2.4, 0.08, 3.2, 0.08, "timber")
			m:add("pyramid", x + (x < 0 and -0.6 or 0.6), G + 3.2, 2.4, 0.26, 0.5, 0.26, "steel")
		end
		m:group(0, G, 4.4, 180, person(1.4, "thatch")) -- a subject, small before the throne
		m:add("pyramid", 0, G + 4.5, -2.7, 0.9, 0.7, 0.9, "gold")
		GOV["despotism"] = done(m, CAM)
	end

	do -- Monarchy
		local m = new("grass", "marble")
		m:add("cyl", 0, G, 0, 4.4, 0.5, 4.4, "stone"):add("cyl", 0, G + 0.5, 0, 2.6, 2.2, 2.6, "marble")
		m:add("box", 0, G + 2.7, 0, 3.0, 0.5, 3.0, "violet") -- the cushion
		crown(m, 0, G + 3.2, 0, 2.6)
		for _, x in ipairs({ -4.4, 4.4 }) do
			m:add("cyl", x, G, -1.5, 0.16, 6.0, 0.16, "steel"):add("box", x, G + 3.4, -1.46, 1.6, 2.4, 0.06, "violet")
			m:add("box", x, G + 3.0, -1.4, 0.5, 0.4, 0.06, "gold", 0, 0)
		end
		m:add("box", -2.4, G, 3.4, 0.14, 2.6, 0.14, "gold", 0, -40):add("ball", -2.4, G + 0.1, 3.4, 0.5, 0.5, 0.5, "gold") -- the sceptre
		m:add("ball", 2.6, G, 3.2, 1.0, 1.0, 1.0, "gold"):add("box", 2.6, G + 1.0, 3.2, 0.1, 0.5, 0.1, "gold") -- the orb
		m:add("box", 2.6, G + 1.25, 3.2, 0.4, 0.1, 0.1, "gold")
		GOV["monarchy"] = done(m, CAM)
	end

	do -- Communism
		local m = new("grass", "concrete")
		m:add("cyl", -1.6, G, -1.0, 0.2, 8.0, 0.2, "steel"):add("box", 0.5, G + 5.2, -1.0, 4.0, 2.6, 0.08, "red") -- the flag
		m:add("box", -0.4, G + 6.9, -0.94, 0.6, 0.6, 0.06, "gold")
		-- the gear
		m:add("cyl", 2.4, G + 1.9, 2.2, 3.0, 0.5, 3.0, "steel", 0, 90):add("cyl", 2.4, G + 1.9, 2.5, 1.2, 0.5, 1.2, "black", 0, 90)
		for i = 0, 7 do
			local a = math.rad(i * 45)
			m:add("box", r2(2.4 + math.sin(a) * 1.7), r2(G + 1.6 + math.cos(a) * 1.7), 2.45, 0.6, 0.6, 0.5, "steel", 0, 0)
		end
		-- the hammer
		m:add("box", -2.8, G, 3.0, 0.3, 3.4, 0.3, "timber", 0, 0):add("box", -2.8, G + 3.0, 3.0, 1.6, 0.8, 0.7, "steel")
		-- housing blocks behind
		for _, x in ipairs({ -4.2, 3.8 }) do
			m:add("box", x, G, -3.8, 2.6, 3.4, 1.8, "concrete")
			for r = 0, 2 do
				m:add("box", x, G + 0.6 + r, -2.88, 2.0, 0.4, 0.05, "glass")
			end
		end
		m:add("box", 0.4, G, 4.6, 1.6, 0.9, 0.9, "thatch"):add("box", 0.4, G + 0.9, 4.6, 1.4, 0.3, 0.7, "gold") -- the shared harvest
		GOV["communism"] = done(m, CAM)
	end

	do -- Republic
		local m = new("grass", "marble")
		m:add("cyl", 0, G, 0, 10.4, 0.4, 10.4, "stone")
		for i = -3, 3 do -- a half circle of columns under a ring beam
			local a = math.rad(i * 26 + 180)
			m:add("cyl", r2(math.sin(a) * 4.4), G + 0.4, r2(math.cos(a) * 4.4), 0.6, 4.0, 0.6, "marble")
			m:add("box", r2(math.sin(a) * 4.4), G + 4.4, r2(math.cos(a) * 4.4), 2.3, 0.5, 0.9, "marble", i * 26)
		end
		for row = 0, 1 do -- the benches
			for i = -2, 2 do
				local a = math.rad(i * 30 + 180)
				local rr = 2.0 + row * 1.2
				m:add("box", r2(math.sin(a) * rr), G + 0.4, r2(math.cos(a) * rr), 1.0 + row * 0.6, 0.5 + row * 0.3, 0.5, "timber", i * 30)
			end
		end
		m:add("box", 0, G + 0.4, 2.4, 1.2, 1.2, 0.8, "sandstone") -- the rostrum
		m:group(0, G + 0.4, 3.4, 180, person(2.0, "canvas"))
		m:add("box", 0, G + 1.6, 2.4, 0.9, 0.06, 0.6, "canvas") -- the law on it
		m:group(-4.4, G + 0.4, 3.0, 0, flag(3.4, "red")):group(4.4, G + 0.4, 3.0, 0, flag(3.4, "red"))
		GOV["republic"] = done(m, CAM)
	end

	do -- Democracy
		local m = new("grass", "marble")
		-- the assembly hall behind
		m:add("box", 0, G, -3.4, 9.0, 2.6, 2.6, "plaster"):add("box", 0, G + 2.6, -3.4, 9.2, 0.3, 2.8, "marble")
		m:group(0, G, -1.9, 0, columns(6, 1.4, 2.6, 0.4, "marble"))
		m:add("cyl", 0, G + 2.9, -3.4, 2.8, 1.0, 2.8, "plaster"):add("ball", 0, G + 3.1, -3.4, 2.8, 2.8, 2.8, "plaster")
		m:add("box", 0, G + 5.9, -3.4, 0.1, 1.2, 0.1, "gold")
		-- the ballot box in front, a queue of voters
		m:add("box", 0, G, 2.0, 2.4, 0.8, 1.8, "stone")
		ballotBox(m, 0, G + 0.8, 2.0, 2.0)
		local roles = { "red", "water", "foliage", "violet" }
		for i, role in ipairs(roles) do
			m:group(-4.6 + i * 0.9, G, 3.0 + i * 0.35, 90, person(1.7, role))
		end
		m:group(3.2, G, 3.4, 270, person(1.7, "thatch")):group(4.6, G, 1.0, 0, flag(4.0, "water"))
		GOV["democracy"] = done(m, CAM)
	end

	-- ---- concepts ---------------------------------------------------------------
	do -- Cities & worked tiles
		local m = new("grass")
		local roles = { "foliage", "thatch", "grass", "water", "sand", "thatch", "grass", "foliage", "rock" }
		board(m, 3, 3.6, function(ix, iz)
			return roles[ix * 3 + iz + 1]
		end)
		m:group(0, G + 0.2, 0, 0, house(1.6, 1.0, 1.3, "plaster", "terracotta")):group(-0.9, G + 0.2, 0.9, 90, house(1.0, 0.7, 0.9, "plaster", "terracotta"))
		m:add("box", 0.9, G + 0.2, -0.8, 0.7, 1.8, 0.7, "stone"):add("pyramid", 0.9, G + 2.0, -0.8, 0.8, 0.6, 0.8, "slate")
		for _, p in ipairs({ { -3.6, -3.6 }, { 0, -3.6 }, { 3.6, 0 } }) do -- the worked tiles carry a marker
			m:add("cyl", p[1], G + 0.2, p[2], 0.9, 0.12, 0.9, "gold")
		end
		m:group(-3.6, G + 0.2, 3.2, 0, tree(1.6)):group(-3.0, G + 0.2, 4.2, 0, tree(1.3)):group(3.6, G + 0.2, -3.6, 0, tree(1.5))
		m:add("pyramid", 3.6, G + 0.2, 3.6, 2.6, 1.8, 2.6, "rock")
		CON["cities"] = done(m, TOP)
	end

	do -- Rivers
		local m = new("grass")
		local z = -4.4
		for i, x in ipairs({ -2.4, -1.2, 0.4, 1.4, 0.6, -0.8, -1.6 }) do
			m:add("box", x, G, z + (i - 1) * 1.46, 2.4, 0.1, 1.8, "water", i % 2 == 0 and 12 or -12)
		end
		m:add("arch", -0.2, G, -0.1, 4.6, 1.3, 1.2, "stone", 90):add("box", -0.2, G + 1.3, -0.1, 1.3, 0.14, 5.4, "sandstone", 90) -- the bridge
		m:group(3.8, G, -3.4, 0, house(1.6, 1.0, 1.3, "plaster", "terracotta"))
		m:add("box", 3.6, G, 2.2, 2.6, 0.12, 2.6, "thatch"):add("box", -4.2, G, -3.0, 2.2, 0.12, 2.6, "thatch") -- irrigated fields
		m:group(-4.2, G, 2.4, 0, tree(2.0)):group(-3.4, G, 4.2, 0, tree(1.6)):group(4.2, G, 4.6, 0, tree(1.5))
		m:add("box", 0.9, G + 0.1, 3.4, 0.5, 0.3, 1.2, "timber"):add("box", 0.9, G + 0.4, 3.4, 0.06, 0.9, 0.7, "canvas") -- a boat
		CON["river"] = done(m, TOP)
	end

	do -- Terrain, yields & specials
		local m = new("grass")
		m:add("box", -2.9, G, -2.9, 5.6, 0.2, 5.6, "grass"):add("box", 2.9, G, -2.9, 5.6, 0.2, 5.6, "rock")
		m:add("box", -2.9, G, 2.9, 5.6, 0.2, 5.6, "sand"):add("box", 2.9, G, 2.9, 5.6, 0.1, 5.6, "water")
		m:group(-3.8, G + 0.2, -3.6, 0, tree(2.0)):group(-2.2, G + 0.2, -2.4, 0, tree(1.6)):group(-3.8, G + 0.2, -1.4, 0, cypress(2.0))
		m:add("pyramid", 3.0, G + 0.2, -3.0, 4.4, 3.8, 4.4, "rock"):add("pyramid", 3.0, G + 3.0, -3.0, 1.2, 1.0, 1.2, "plaster")
		m:add("pyramid", -3.2, G + 0.2, 3.2, 3.0, 1.0, 3.0, "sand"):add("pyramid", -1.8, G + 0.2, 2.0, 2.0, 0.7, 2.0, "sand")
		m:group(-4.2, G + 0.2, 1.4, 0, k.palm(1.8))
		m:add("box", 2.4, G + 0.1, 2.6, 0.9, 0.3, 0.4, "steel", 30):add("wedge", 2.9, G + 0.1, 2.9, 0.4, 0.4, 0.5, "steel", 30) -- a fish
		m:add("ball", -1.2, G + 0.2, -4.4, 0.6, 0.6, 0.6, "gold") -- a special resource
		CON["terrain"] = done(m, TOP)
	end

	do -- Happiness & luxuries
		local m = new("grass", "sandstone")
		local roles = { "red", "gold", "violet", "water", "foliage" }
		for i, role in ipairs(roles) do
			local x = -4.4 + (i - 1) * 2.2
			m:group(x, G, 1.6 + (i % 2) * 1.2, 0, person(2.0, role))
			m:add("box", x, G + 2.0, 1.6 + (i % 2) * 1.2, 0.03, 2.0, 0.03, "black"):add("ball", x, G + 3.8, 1.6 + (i % 2) * 1.2, 0.9, 0.9, 0.9, role)
		end
		m:add("box", 0, G, -3.0, 7.0, 0.8, 2.6, "timber") -- the stage
		m:add("box", -3.2, G + 0.8, -3.8, 0.2, 3.4, 0.2, "timber"):add("box", 3.2, G + 0.8, -3.8, 0.2, 3.4, 0.2, "timber")
		m:add("box", 0, G + 3.6, -3.8, 6.8, 0.8, 0.1, "red")
		m:group(0, G + 0.8, -3.0, 0, person(1.8, "canvas", "gold"))
		m:add("ball", 4.6, G + 5.2, -4.4, 1.6, 1.6, 1.6, "lamp") -- the sun
		CON["happiness"] = done(m, CAM)
	end

	do -- Entertainer
		local m = new("sand", "timber")
		m:add("box", 0, G, 0, 6.0, 0.6, 5.0, "timber")
		m:group(0, G + 0.6, 0, 0, person(4.4, "violet", "red"))
		for i, p in ipairs({ { -2.0, 3.6 }, { -1.0, 5.4 }, { 0, 6.0 }, { 1.0, 5.4 }, { 2.0, 3.6 } }) do -- juggling
			m:add("ball", p[1], G + p[2], 0.6, 0.6, 0.6, 0.6, i % 2 == 0 and "gold" or "red")
		end
		m:add("box", -3.4, G, -2.6, 0.3, 6.4, 0.3, "timber"):add("box", 3.4, G, -2.6, 0.3, 6.4, 0.3, "timber")
		m:add("box", 0, G + 5.6, -2.6, 7.0, 1.0, 0.1, "red"):add("box", -3.0, G + 0.6, -2.6, 1.0, 5.0, 0.1, "red")
		m:add("box", 3.0, G + 0.6, -2.6, 1.0, 5.0, 0.1, "red")
		m:add("cyl", -4.2, G, 3.4, 0.9, 0.5, 0.9, "bronze"):add("ball", -4.2, G + 0.5, 3.4, 0.5, 0.5, 0.5, "gold") -- the collection bowl
		CON["entertainer"] = done(m, CAM)
	end

	do -- Tax collector
		local m = new("sand", "stone")
		m:group(0, G, -2.0, 0, person(4.2, "slate", "black"))
		m:add("box", 0, G, 0.6, 6.4, 1.6, 2.0, "timber"):add("box", 0, G + 1.6, 0.6, 6.8, 0.2, 2.4, "timber") -- the desk
		m:group(-2.2, G + 1.8, 0.6, 0, coins(5)):group(-1.3, G + 1.8, 0.9, 0, coins(3)):group(-2.0, G + 1.8, 1.4, 0, coins(2))
		m:add("box", 0.4, G + 1.8, 0.6, 1.6, 0.06, 1.2, "canvas"):add("box", 1.0, G + 1.86, 0.4, 0.06, 1.0, 0.06, "black", 0, 60) -- ledger, quill
		m:add("box", 3.6, G, 3.6, 2.4, 1.4, 1.6, "timber"):add("box", 3.6, G + 1.4, 3.6, 2.5, 0.2, 1.7, "bronze") -- the chest
		m:add("box", 3.6, G + 0.5, 4.42, 0.4, 0.5, 0.06, "gold")
		m:group(-3.8, G, 3.6, 0, coins(4)):group(-2.8, G, 4.2, 0, coins(2))
		CON["taxman"] = done(m, CAM)
	end

	do -- Scientist
		local m = new("sand", "stone")
		m:group(-1.4, G, -1.8, 0, person(4.2, "plaster"))
		m:add("box", 0.4, G, 0.8, 6.0, 1.6, 1.8, "timber"):add("box", 0.4, G + 1.6, 0.8, 6.4, 0.2, 2.2, "timber")
		m:add("cyl", -1.2, G + 1.8, 0.8, 0.3, 0.7, 0.3, "glass"):add("ball", -1.2, G + 2.2, 0.8, 1.0, 1.0, 1.0, "copper") -- a flask
		m:add("cyl", 0.2, G + 1.8, 1.0, 0.5, 1.2, 0.5, "glass"):add("cyl", 0.2, G + 1.8, 1.0, 0.4, 0.6, 0.4, "violet")
		m:add("cone", 1.4, G + 1.8, 0.6, 0.9, 1.1, 0.9, "glass"):add("cyl", 1.4, G + 1.8, 0.6, 0.8, 0.3, 0.8, "red")
		m:add("box", 2.6, G + 1.8, 0.9, 1.2, 0.3, 0.9, "red", 15):add("box", 2.6, G + 2.1, 0.9, 1.1, 0.26, 0.8, "water", -10) -- books
		-- the telescope
		m:add("cyl", 4.0, G, -2.6, 0.14, 2.6, 0.14, "timber"):add("cyl", 4.0, G + 2.4, -2.6, 0.6, 3.0, 0.6, "bronze", 200, 55)
		m:add("ball", -4.4, G + 5.0, -4.2, 0.8, 0.8, 0.8, "lamp") -- a star to look at
		CON["scientist"] = done(m, CAM)
	end

	do -- Civil disorder
		local m = new("sand", "rock")
		m:group(-2.6, G, -3.0, 0, house(3.4, 2.2, 2.6, "plaster", "terracotta", 1.2))
		m:add("cone", -3.2, G + 2.4, -3.0, 1.6, 2.6, 1.6, "lamp"):add("cone", -1.8, G + 2.6, -2.6, 1.2, 1.8, 1.2, "red")
		m:add("ball", -2.6, G + 5.2, -3.0, 2.0, 2.0, 2.0, "slate"):add("ball", -1.8, G + 6.8, -3.2, 1.4, 1.4, 1.4, "slate")
		local roles = { "red", "thatch", "bronze", "red" }
		for i, role in ipairs(roles) do
			local x = -2.8 + i * 1.5
			m:group(x, G, 2.0 + (i % 2) * 1.0, 0, person(2.2, role))
			m:add("cyl", x + 0.6, G + 0.8, 2.0 + (i % 2) * 1.0, 0.1, 2.4, 0.1, "timber")
			m:add(i % 2 == 0 and "cone" or "box", x + 0.6, G + 3.2, 2.0 + (i % 2) * 1.0, 0.6, 0.6, i % 2 == 0 and 0.6 or 0.06, i % 2 == 0 and "lamp" or "red")
		end
		m:add("box", 3.8, G + 0.3, -2.4, 2.4, 0.5, 1.4, "timber", 0, 24):add("cyl", 4.2, G + 0.5, -1.2, 1.0, 0.16, 1.0, "timber", 20, 70) -- an overturned cart
		CON["disorder"] = done(m, CAM)
	end

	do -- Research & the tech tree
		local m = new("grass", "stone")
		local roles = { "red", "water", "violet", "bronze" }
		for i, role in ipairs(roles) do
			m:add("box", 0, G + (i - 1) * 0.8, 0, 4.6 - i * 0.3, 0.74, 3.4 - i * 0.2, role, i * 9)
		end
		m:add("cyl", 0, G + 3.2, 0, 1.0, 0.8, 1.0, "steel"):add("ball", 0, G + 3.8, 0, 3.0, 3.0, 3.0, "lamp") -- the idea
		for i = 0, 5 do -- rays
			local a = math.rad(i * 60)
			m:add("box", r2(math.sin(a) * 2.4), G + 5.2, r2(math.cos(a) * 2.4), 0.14, 0.14, 1.0, "gold", i * 60)
		end
		m:add("cyl", -3.8, G + 0.3, 3.0, 0.6, 2.6, 0.6, "canvas", 60, 90) -- a scroll
		m:add("cyl", 3.6, G, 3.4, 0.9, 0.3, 0.9, "bronze"):add("box", 3.6, G + 0.3, 3.4, 0.08, 1.6, 0.08, "black", 0, 25) -- ink and quill
		CON["research"] = done(m, CAM)
	end

	do -- Future Tech
		local m = new("grass", "steel")
		m:add("cyl", 0, G, 0, 6.0, 0.4, 6.0, "slate"):add("cyl", 0, G + 0.4, 0, 3.0, 0.3, 3.0, "lamp")
		m:add("cyl", 0, G + 0.7, 0, 0.8, 5.6, 0.8, "glass"):add("ball", 0, G + 5.6, 0, 2.6, 2.6, 2.6, "glass")
		m:add("ball", 0, G + 6.3, 0, 1.2, 1.2, 1.2, "lamp")
		for i = 0, 2 do
			m:add("cyl", 0, G + 2.0 + i * 1.3, 0, 3.4 - i * 0.6, 0.14, 3.4 - i * 0.6, "copper")
		end
		for i = 0, 3 do
			local a = math.rad(i * 90 + 45)
			m:add("box", r2(math.sin(a) * 3.8), G, r2(math.cos(a) * 3.8), 0.5, 2.4, 0.5, "steel", i * 90 + 45)
			m:add("ball", r2(math.sin(a) * 3.8), G + 2.4, r2(math.cos(a) * 3.8), 0.7, 0.7, 0.7, "lamp")
		end
		CON["futuretech"] = done(m, CAM)
	end

	do -- Upkeep & shields
		local m = new("grass", "stone")
		m:group(-3.2, G, -2.4, 0, house(3.0, 1.8, 2.4, "plaster", "terracotta", 1.0))
		-- the balance: shields in, coins out
		m:add("cyl", 0.6, G, 0.6, 1.4, 0.4, 1.4, "stone"):add("cyl", 0.6, G + 0.4, 0.6, 0.2, 4.0, 0.2, "bronze")
		m:add("box", 0.6, G + 4.3, 0.6, 6.0, 0.16, 0.16, "bronze", 0, 0)
		for _, s in ipairs({ { -2.2, "steel" }, { 3.4, "gold" } }) do
			m:add("box", s[1], G + 2.6, 0.6, 0.04, 1.7, 0.04, "black"):add("cyl", s[1], G + 2.4, 0.6, 1.8, 0.16, 1.8, "bronze")
			for i = 0, 2 do
				m:add("cyl", s[1], G + 2.56 + i * 0.2, 0.6, 1.0, 0.16, 1.0, s[2])
			end
		end
		for i = 0, 3 do -- shields laid out in front
			m:add("cyl", -3.6 + i * 1.3, G, 3.8, 1.0, 0.16, 1.0, "steel"):add("cyl", -3.6 + i * 1.3, G + 0.16, 3.8, 0.4, 0.1, 0.4, "red")
		end
		m:group(3.8, G, 3.8, 0, coins(3)):group(4.6, G, 3.0, 0, coins(2))
		CON["upkeep"] = done(m, CAM)
	end

	do -- Fortify & garrisons
		local m = new("grass", "sand")
		m:add("box", 0, G, 1.0, 9.0, 2.2, 1.0, "stone")
		for i = -4, 4, 2 do
			m:add("box", i * 1.0, G + 2.2, 1.0, 1.0, 0.7, 1.0, "stone")
		end
		m:add("cyl", -4.4, G, 1.0, 2.0, 4.0, 2.0, "stone"):add("cone", -4.4, G + 4.0, 1.0, 2.4, 1.4, 2.4, "terracotta")
		m:group(0.6, G, -1.2, 0, person(3.2, "water", "steel"))
		m:add("cyl", 0.6, G + 1.0, -0.4, 1.8, 0.16, 1.8, "steel", 0, 90):add("cyl", 0.6, G + 1.5, -0.24, 0.6, 0.1, 0.6, "gold", 0, 90) -- the shield
		m:add("cyl", 1.8, G, -1.2, 0.1, 4.6, 0.1, "timber"):add("pyramid", 1.8, G + 4.6, -1.2, 0.36, 0.7, 0.36, "steel")
		m:group(3.6, G, -2.4, 0, k.flag(4.0, "water"))
		m:add("box", -1.8, G, -3.2, 2.4, 1.4, 1.6, "canvas"):add("wedge", -1.8, G + 1.4, -3.6, 2.4, 0.9, 0.8, "canvas") -- a tent
		m:add("wedge", -1.8, G + 1.4, -2.8, 2.4, 0.9, 0.8, "canvas", 180)
		CON["garrison"] = done(m, CAM)
	end

	do -- Zones of control
		local m = new("grass")
		board(m, 3, 3.6, function(ix, iz)
			return (ix == 1 and iz == 1) and "grass" or "red"
		end)
		m:group(0, G + 0.2, 0, 0, person(3.0, "red", "steel"))
		m:add("cyl", 0.9, G + 0.2, 0, 0.1, 3.6, 0.1, "timber"):add("pyramid", 0.9, G + 3.8, 0, 0.3, 0.6, 0.3, "steel")
		m:group(-3.6, G + 0.2, 3.6, 135, person(2.4, "water", "steel")) -- the rival held at the edge
		m:add("box", -2.4, G + 1.4, 2.4, 1.6, 0.2, 0.2, "black", 45):add("box", -2.4, G + 1.4, 2.4, 1.6, 0.2, 0.2, "black", 135) -- no entry
		m:add("box", 3.6, G + 0.2, -3.6, 0.5, 0.06, 2.0, "gold", 45):add("pyramid", 2.9, G + 0.2, -2.9, 0.9, 0.06, 0.9, "gold", 45)
		m:group(3.6, G + 0.2, 3.6, 0, tree(1.6)):group(-3.6, G + 0.2, -3.6, 0, tree(1.6))
		CON["zoc"] = done(m, TOP)
	end

	do -- Movement
		local m = new("grass")
		m:add("box", 0, G, 0.6, 11.6, 0.1, 2.0, "sandstoneDark") -- the road
		m:add("pyramid", -3.6, G, -3.4, 3.4, 1.6, 3.4, "grass"):add("pyramid", 3.4, G, -3.2, 4.0, 3.2, 4.0, "rock")
		m:group(0.2, G, -3.8, 0, tree(1.8)):group(-1.0, G, -3.0, 0, tree(1.5))
		-- the wagon
		m:add("box", -3.4, G + 0.5, 0.6, 2.2, 0.7, 1.3, "timber"):add("box", -3.4, G + 1.2, 0.6, 2.0, 0.9, 1.2, "canvas")
		m:add("cyl", -4.0, G + 0.5, 1.3, 1.0, 0.12, 1.0, "timber", 0, 90):add("cyl", -2.8, G + 0.5, 1.3, 1.0, 0.12, 1.0, "timber", 0, 90)
		m:add("box", -1.5, G + 0.4, 0.6, 1.3, 0.9, 0.5, "bronze"):add("box", -0.8, G + 1.0, 0.6, 0.4, 0.8, 0.4, "bronze") -- the horse
		for i = 0, 2 do -- arrows: fast on the road, slow in the hills
			m:add("box", 1.4 + i * 1.6, G + 0.12, 0.6, 0.9, 0.06, 0.4, "gold"):add("pyramid", 2.1 + i * 1.6, G + 0.12, 0.6, 0.7, 0.06, 0.7, "gold", 45)
		end
		m:add("box", 2.0, G + 0.02, 4.0, 0.9, 0.06, 0.4, "red"):add("pyramid", 2.7, G + 0.02, 4.0, 0.7, 0.06, 0.7, "red", 45)
		m:add("box", 0, G, 4.0, 3.0, 0.3, 2.2, "foliage")
		CON["movement"] = done(m, TOP)
	end

	do -- Government types
		local m = new("grass", "marble")
		for i, x in ipairs({ -3.8, 0, 3.8 }) do
			m:add("cyl", x, G, 0, 2.6, 0.4, 2.6, "stone"):add("cyl", x, G + 0.4, 0, 1.8, 1.4 + (i == 2 and 0.8 or 0), 1.8, "marble")
		end
		crown(m, -3.8, G + 1.8, 0, 1.8)
		ballotBox(m, 0, G + 2.6, 0, 1.6)
		m:add("cyl", 3.6, G + 1.8, 0, 0.12, 3.6, 0.12, "steel"):add("box", 4.5, G + 4.0, 0, 1.8, 1.3, 0.06, "red")
		m:add("box", 0, G, 3.6, 9.0, 0.06, 0.4, "gold"):add("pyramid", -4.8, G, 3.6, 1.0, 0.06, 1.0, "gold", 45) -- the choice
		m:add("pyramid", 4.8, G, 3.6, 1.0, 0.06, 1.0, "gold", 45)
		m:group(-3.6, G, -3.8, 0, cypress(2.4)):group(3.6, G, -3.8, 0, cypress(2.4))
		CON["governments"] = done(m, CAM)
	end

	do -- Corruption
		local m = new("sand", "stone")
		m:add("box", -3.2, G, -2.6, 3.0, 1.8, 2.0, "timber"):add("box", -3.2, G + 1.8, -3.4, 3.1, 0.2, 2.0, "bronze", 0, -50) -- the open chest
		m:group(-3.6, G + 1.2, -2.6, 0, coins(3)):group(-2.7, G + 1.2, -2.4, 0, coins(2))
		for i, p in ipairs({ { -1.2, -1.6 }, { 0, -0.6 }, { 1.0, 0.6 }, { 2.0, 1.6 }, { 3.0, 2.6 } }) do -- the trail
			m:add("cyl", p[1], G, p[2], 0.7, 0.14, 0.7, "gold", 0, i * 6)
		end
		m:group(3.6, G, 3.6, 220, person(3.4, "black", "black")) -- the one it goes to
		m:add("box", 3.0, G + 1.2, 3.0, 1.0, 1.1, 0.8, "thatch") -- his sack
		m:add("cyl", -4.0, G, 3.6, 2.2, 0.06, 2.2, "black") -- a hole in the treasury floor
		m:group(3.8, G, -3.6, 0, house(1.8, 1.1, 1.5, "plaster", "terracotta")) -- the far city
		m:add("box", 0.4, G, -4.4, 4.0, 0.06, 0.3, "sandstoneDark")
		CON["corruption"] = done(m, CAM)
	end

	do -- Veterancy
		local m = new("grass", "stone")
		m:add("cyl", 0, G, 0, 5.0, 0.5, 5.0, "stone")
		m:add("box", 0, G + 0.5, 0, 4.4, 5.0, 0.5, "red") -- the shield
		for i = 0, 2 do -- chevrons
			m:add("box", -0.75, G + 1.6 + i * 1.1, 0.3, 1.9, 0.4, 0.1, "gold", 0, 0):add("box", 0.75, G + 1.6 + i * 1.1, 0.3, 1.9, 0.4, 0.1, "gold")
		end
		m:add("pyramid", 0, G + 5.5, 0, 1.0, 1.0, 1.0, "gold")
		-- crossed swords behind
		m:add("box", 0, G + 0.8, -0.5, 0.3, 7.0, 0.1, "steel", 0, 0):add("box", -2.6, G + 0.5, -0.5, 0.3, 6.4, 0.1, "steel")
		m:add("box", 2.6, G + 0.5, -0.5, 0.3, 6.4, 0.1, "steel"):add("box", -2.6, G + 1.4, -0.5, 1.2, 0.2, 0.2, "bronze")
		m:add("box", 2.6, G + 1.4, -0.5, 1.2, 0.2, 0.2, "bronze")
		m:group(-4.2, G, 3.4, 0, person(1.8, "thatch")):group(4.0, G, 3.4, 0, person(2.4, "red", "gold"))
		CON["veterancy"] = done(m, CAM)
	end

	do -- Buildings & wonders
		local m = new("sand", "sandstone")
		m:add("box", -2.0, G, -1.6, 5.0, 0.4, 4.4, "stone")
		m:group(-2.0, G + 0.4, 0.2, 0, columns(4, 1.3, 2.6, 0.4, "marble")):add("box", -2.0, G + 0.4, -2.2, 4.2, 2.0, 2.6, "plaster")
		m:add("box", -2.0, G + 3.0, -0.2, 4.6, 0.3, 1.0, "marble") -- half finished: no roof yet
		-- the crane
		m:add("box", 3.2, G, -2.2, 0.4, 6.4, 0.4, "timber"):add("box", 1.8, G + 6.0, -2.2, 4.6, 0.3, 0.3, "timber")
		m:add("box", 0.2, G + 3.8, -2.2, 0.05, 2.2, 0.05, "black"):add("box", 0.2, G + 3.2, -2.2, 1.1, 0.7, 0.9, "marble")
		m:add("box", 3.2, G + 1.0, -1.4, 0.2, 5.4, 0.2, "timber", 0, -18)
		-- blocks and a ramp
		for i, p in ipairs({ { 1.6, 2.6 }, { 2.7, 2.8 }, { 2.1, 3.7 }, { 3.6, 3.6 } }) do
			m:add("box", p[1], G, p[2], 0.9, 0.7, 0.8, i % 2 == 0 and "sandstone" or "marble", i * 13)
		end
		m:add("box", 2.2, G + 0.7, 3.0, 0.9, 0.7, 0.8, "sandstone", 8)
		m:add("wedge", -2.0, G, 2.6, 2.0, 0.4, 2.0, "timber", 180)
		m:group(-4.4, G, 3.6, 0, person(1.8, "thatch")):group(0.2, G, 3.8, 90, person(1.8, "bronze"))
		CON["buildings"] = done(m, CAM)
	end

	do -- Regency
		local m = new("sand", "marble")
		throne(m, -1.2, -1.6, "gold")
		crown(m, -1.2, G + 1.9, -1.9, 1.0) -- the crown waits on the seat
		-- the steward beside it: a figure of steel, holding the orders
		m:group(2.8, G, 1.0, 330, person(3.6, "steel", "copper"))
		m:add("ball", 2.6, G + 2.7, 1.5, 0.3, 0.3, 0.3, "lamp")
		m:add("box", 1.9, G + 1.6, 1.6, 1.0, 1.3, 0.06, "canvas", 330, -20)
		m:add("cyl", 3.2, G + 3.7, 0.8, 0.06, 1.0, 0.06, "steel"):add("ball", 3.2, G + 4.7, 0.8, 0.3, 0.3, 0.3, "red")
		m:add("box", -1.2, G + 0.02, 2.4, 1.6, 0.04, 4.0, "red")
		m:group(-4.6, G, 1.0, 0, torch(2.4))
		CON["regency"] = done(m, CAM)
	end

	do -- Replays & resuming
		local m = new("sand", "timber")
		-- the hourglass
		m:add("cyl", -2.2, G, 0, 3.2, 0.4, 3.2, "timber"):add("cone", -2.2, G + 0.4, 0, 2.6, 2.9, 2.6, "glass")
		m:add("cone", -2.2, G + 6.2, 0, 2.6, 2.9, 2.6, "glass", 0, 180):add("cyl", -2.2, G + 6.2, 0, 3.2, 0.4, 3.2, "timber")
		m:add("cyl", -2.2, G + 0.4, 0, 2.7, 0.3, 2.7, "sand")
		for _, o in ipairs({ { -1.4, -1.0 }, { 1.4, -1.0 }, { 0, 1.5 } }) do
			m:add("cyl", -2.2 + o[1], G + 0.4, o[2], 0.2, 5.8, 0.2, "bronze")
		end
		-- the chronicle: an open book and a row of volumes
		m:add("box", 2.8, G, 2.4, 3.2, 0.3, 2.2, "red"):add("box", 2.0, G + 0.3, 2.4, 1.5, 0.12, 2.0, "canvas", 0, 0)
		m:add("box", 3.6, G + 0.3, 2.4, 1.5, 0.12, 2.0, "canvas")
		local roles = { "water", "violet", "bronze", "red", "copper" }
		for i, role in ipairs(roles) do
			m:add("box", 1.4 + i * 0.62, G, -2.6, 0.56, 2.4 - (i % 2) * 0.3, 1.6, role)
		end
		m:add("box", 3.3, G, -3.6, 4.0, 0.2, 0.3, "timber")
		CON["recordings"] = done(m, CAM)
	end

	do -- The game code
		local m = new("sand", "stone")
		m:add("box", 0, G, -0.6, 7.0, 0.6, 2.0, "stone"):add("box", 0, G + 0.6, -0.8, 6.0, 5.4, 0.8, "sandstone") -- the tablet
		local roles = { "black", "gold", "black", "black", "gold", "black", "gold", "black" }
		for row = 0, 3 do
			for col = 0, 5 do
				m:add("box", -2.0 + col * 0.8, G + 4.9 - row * 1.0, -0.36, 0.5, 0.6, 0.1, roles[(row * 3 + col) % 8 + 1])
			end
		end
		m:add("cyl", 0, G + 0.9, -0.3, 1.4, 0.2, 1.4, "red", 0, 90) -- the seal
		-- the key
		m:add("cyl", -2.6, G + 0.2, 3.4, 1.4, 0.2, 1.4, "gold"):add("cyl", -2.6, G + 0.3, 3.4, 0.7, 0.14, 0.7, "sand")
		m:add("box", -0.4, G + 0.2, 3.4, 3.2, 0.2, 0.3, "gold"):add("box", 0.8, G + 0.2, 3.8, 0.3, 0.2, 0.6, "gold")
		m:add("box", 0.2, G + 0.2, 3.7, 0.3, 0.2, 0.4, "gold")
		m:group(4.6, G, 2.0, 0, torch(2.4))
		CON["gamecode"] = done(m, CAM)
	end

	do -- Exploration and tribal villages
		local m = new("grass")
		for _, p in ipairs({ { 2.6, -2.6, 2.4 }, { 4.2, -0.4, 1.8 }, { 1.4, -0.6, 1.6 } }) do -- the huts
			m:add("cyl", p[1], G, p[2], p[3], p[3] * 0.6, p[3], "timber"):add("cone", p[1], G + p[3] * 0.6, p[2], p[3] * 1.3, p[3] * 0.8, p[3] * 1.3, "thatch")
		end
		m:add("cone", 2.8, G, 0.8, 0.7, 0.9, 0.7, "lamp") -- their fire
		m:group(-2.4, G, 2.6, 60, person(2.4, "water")) -- the explorer
		m:add("cyl", -1.7, G, 2.9, 0.1, 2.8, 0.1, "timber")
		m:add("box", -3.6, G + 0.5, 3.6, 1.6, 1.0, 0.6, "bronze", 60):add("box", -2.9, G + 1.3, 4.0, 0.4, 0.9, 0.4, "bronze", 60) -- the horse
		-- the unknown: dark ground at the far edge
		m:add("box", -3.9, G, -3.9, 3.6, 0.5, 3.6, "black"):add("box", 0, G, -4.6, 4.0, 0.4, 2.2, "black")
		m:add("box", -4.6, G, 0, 2.2, 0.3, 4.0, "slate")
		m:group(4.4, G, 3.8, 0, tree(2.0)):group(0.6, G, 4.4, 0, tree(1.6))
		CON["exploration"] = done(m, TOP)
	end

	do -- Diplomacy and audiences
		local m = new("grass", "marble")
		m:add("cyl", 0, G, 0, 3.6, 1.6, 3.6, "timber"):add("cyl", 0, G + 1.6, 0, 4.2, 0.2, 4.2, "timber") -- the table
		m:add("box", 0, G + 1.8, 0, 1.8, 0.06, 1.3, "canvas"):add("cyl", 0.5, G + 1.86, 0.3, 0.4, 0.06, 0.4, "red") -- the treaty and its seal
		m:group(-3.4, G, 0, 90, person(3.8, "red", "gold")):group(3.4, G, 0, 270, person(3.8, "water", "gold"))
		m:add("box", 0, G + 2.5, 0, 3.4, 0.3, 0.3, "sandstone") -- the handshake across it
		m:group(-4.6, G, -3.4, 0, flag(5.4, "red")):group(4.4, G, -3.4, 0, flag(5.4, "water"))
		m:add("ball", 0, G + 4.6, -2.0, 0.9, 0.9, 0.9, "canvas"):add("wedge", 0.5, G + 4.8, -2.0, 0.5, 0.2, 0.7, "canvas", 90) -- a dove
		m:add("wedge", -0.5, G + 4.8, -2.0, 0.5, 0.2, 0.7, "canvas", 270)
		CON["diplomacy"] = done(m, CAM)
	end

	do -- Pollution and global warming
		local m = new("sand", "rock")
		m:add("box", -2.6, G, -3.0, 4.0, 2.2, 2.4, "brick")
		m:add("cyl", -3.6, G, -1.6, 1.0, 6.0, 1.0, "brick"):add("cyl", -1.8, G, -1.6, 0.9, 4.8, 0.9, "brick")
		for i, p in ipairs({ { -3.6, 6.4, 1.8 }, { -3.0, 7.8, 2.4 }, { -1.8, 5.2, 1.6 }, { -1.0, 6.4, 2.0 } }) do
			m:add("ball", p[1], G + p[2], -1.6 + i * 0.2, p[3], p[3], p[3], i % 2 == 0 and "black" or "slate")
		end
		for _, p in ipairs({ { 1.6, 2.4 }, { 3.4, 0.6 }, { 0.2, 4.2 } }) do -- fouled ground
			m:add("cyl", p[1], G, p[2], 2.6, 0.06, 2.6, "black")
		end
		m:add("cyl", 1.6, G, 2.4, 0.8, 1.1, 0.8, "gold"):add("cyl", 2.4, G + 0.4, 3.0, 0.8, 1.1, 0.8, "gold", 30, 90) -- barrels
		-- a dead tree
		m:add("cyl", 4.0, G, -3.0, 0.3, 3.0, 0.3, "timber"):add("cyl", 4.0, G + 2.0, -3.0, 0.14, 1.4, 0.14, "timber", 0, 50)
		m:add("cyl", 4.0, G + 1.4, -3.0, 0.14, 1.2, 0.14, "timber", 180, 55)
		m:add("box", 3.4, G, 4.0, 4.4, 0.1, 2.6, "water"):add("box", 3.0, G + 0.1, 4.2, 1.4, 0.06, 0.8, "black") -- the rising sea, a slick
		m:add("ball", 4.4, G + 6.4, 3.6, 1.6, 1.6, 1.6, "red") -- a hot sun
		CON["pollution"] = done(m, CAM)
	end

	do -- Victory conditions
		local m = new("grass", "marble")
		m:add("box", 0, G, 0, 2.6, 2.6, 2.6, "marble"):add("box", -2.6, G, 0, 2.6, 1.7, 2.6, "stone"):add("box", 2.6, G, 0, 2.6, 1.0, 2.6, "sandstone")
		m:add("box", 0, G + 1.0, 1.32, 0.3, 1.0, 0.04, "gold")
		-- the cup
		m:add("cyl", 0, G + 2.6, 0, 1.0, 0.2, 1.0, "gold"):add("cyl", 0, G + 2.8, 0, 0.3, 0.9, 0.3, "gold")
		m:add("cone", 0, G + 5.3, 0, 1.8, 1.6, 1.8, "gold", 0, 180)
		m:add("box", -1.0, G + 4.2, 0, 0.5, 0.7, 0.14, "gold"):add("box", 1.0, G + 4.2, 0, 0.5, 0.7, 0.14, "gold")
		m:group(-2.6, G + 1.7, 0, 0, person(2.0, "water")):group(2.6, G + 1.0, 0, 0, person(2.0, "red"))
		m:group(-4.8, G, -3.6, 0, flag(5.0, "gold")):group(4.6, G, -3.6, 0, flag(5.0, "gold"))
		for i, p in ipairs({ { -3.6, 3.4 }, { -1.4, 4.2 }, { 1.2, 3.8 }, { 3.6, 4.4 } }) do -- the crowd
			m:group(p[1], G, p[2], 180, person(1.3, i % 2 == 0 and "violet" or "thatch"))
		end
		CON["victory"] = done(m, CAM)
	end

	do -- Combat
		local m = new("sand", "rock")
		m:group(-2.6, G, 0, 90, person(4.0, "red", "steel")):group(2.6, G, 0, 270, person(4.0, "water", "steel"))
		-- crossed spears
		m:add("cyl", -1.6, G + 1.0, 0.4, 0.14, 5.6, 0.14, "timber", 90, 40):add("cyl", 1.6, G + 1.0, 0.4, 0.14, 5.6, 0.14, "timber", 270, 40)
		m:add("ball", 0, G + 4.6, 0.4, 1.0, 1.0, 1.0, "lamp") -- the clash
		for i = 0, 5 do
			local a = math.rad(i * 60)
			m:add("box", r2(math.sin(a) * 0.9), r2(G + 5.0 + math.cos(a) * 0.9), 0.4, 0.14, 0.14, 0.14, "gold")
		end
		m:add("cyl", -2.6, G + 1.2, 0.9, 1.8, 0.16, 1.8, "red", 0, 90):add("cyl", 2.6, G + 1.2, 0.9, 1.8, 0.16, 1.8, "water", 0, 90) -- shields
		m:add("cyl", -4.4, G, -3.0, 0.1, 4.4, 0.1, "steel"):add("box", -3.8, G + 3.4, -3.0, 1.2, 0.9, 0.05, "red")
		m:add("cyl", 4.4, G, -3.0, 0.1, 4.4, 0.1, "steel"):add("box", 3.8, G + 3.4, -3.0, 1.2, 0.9, 0.05, "water")
		m:add("box", -0.6, G, 3.6, 1.6, 0.14, 0.2, "steel", 30):add("cyl", 1.4, G, 3.2, 1.2, 0.14, 1.2, "bronze") -- dropped arms
		CON["combat"] = done(m, CAM)
	end

	do -- Fog of war
		local m = new("grass")
		board(m, 4, 2.8, function(ix, iz)
			if ix >= 2 then
				return (ix + iz) % 2 == 0 and "black" or "slate"
			end
			return (ix + iz) % 2 == 0 and "grass" or "foliage"
		end)
		m:group(-2.8, G + 0.2, -1.4, 0, house(1.5, 0.9, 1.2, "plaster", "terracotta")):group(-4.2, G + 0.2, 2.8, 0, tree(1.6))
		m:group(-1.4, G + 0.2, 1.6, 90, person(2.0, "water", "steel")) -- the scout whose sight this is
		m:add("cyl", -1.4, G + 0.22, 1.6, 5.4, 0.04, 5.4, "lamp")
		for _, p in ipairs({ { 1.6, -3.4, 2.2 }, { 3.4, -1.0, 2.6 }, { 1.8, 1.2, 2.0 }, { 4.0, 3.2, 2.4 }, { 2.0, 4.0, 1.8 } }) do -- the fog
			m:add("ball", p[1], G + 0.6, p[2], p[3], p[3], p[3], "canvas")
		end
		m:add("pyramid", 3.6, G + 0.2, 1.2, 1.4, 0.9, 1.4, "black") -- something half seen
		CON["fog"] = done(m, TOP)
	end

	do -- Trade routes
		local m = new("sand")
		m:group(-4.0, G, -3.4, 0, house(2.0, 1.2, 1.6, "plaster", "terracotta")):group(-4.4, G, -1.4, 90, house(1.4, 0.9, 1.1, "plaster", "terracotta"))
		m:group(4.0, G, 3.4, 0, house(2.0, 1.2, 1.6, "sandstone", "slate")):group(4.4, G, 1.4, 90, house(1.4, 0.9, 1.1, "sandstone", "slate"))
		for i = 0, 6 do -- the road between them
			m:add("box", -3.6 + i * 1.2, G, -2.6 + i * 0.9, 1.6, 0.06, 0.8, "sandstoneDark", 323)
		end
		for i = 0, 2 do -- the caravan
			local x, z = -2.2 + i * 1.7, -1.5 + i * 1.28
			m:add("box", x, G + 0.6, z, 1.2, 0.7, 0.5, "thatch", 323):add("box", x, G, z, 0.9, 0.6, 0.3, "timber", 323)
			m:add("ball", x, G + 1.2, z, 0.6, 0.6, 0.6, i % 2 == 0 and "red" or "violet")
		end
		m:group(3.0, G, -3.4, 0, coins(4)):group(3.8, G, -2.8, 0, coins(2)):group(-3.4, G, 3.6, 0, coins(3))
		m:add("box", 0.4, G, 4.6, 5.0, 0.06, 1.6, "water"):group(1.0, G, 4.6, 90, k.ship(2.2, 0.8, { { 0, 1.8, 1.0 } }))
		m:group(-4.6, G, 1.4, 0, k.palm(2.0)):group(4.6, G, -4.6, 0, k.palm(1.8))
		CON["traderoutes"] = done(m, TOP)
	end

	do -- The space race
		local m = new("sand", "concrete")
		m:add("cyl", 0, G, 0, 5.0, 0.5, 5.0, "concrete")
		rocket(m, 0, G + 1.0, 0, 8.6)
		m:add("cone", 0, G + 0.3, 0, 1.4, 0.9, 1.4, "lamp")
		-- the gantry
		m:add("box", 2.4, G + 0.5, -0.8, 0.5, 7.6, 0.5, "steel"):add("box", 2.4, G + 0.5, 0.8, 0.5, 7.6, 0.5, "steel")
		for i = 0, 3 do
			m:add("box", 2.4, G + 1.6 + i * 1.8, 0, 0.3, 0.3, 2.0, "red"):add("box", 1.6, G + 1.8 + i * 1.8, 0, 1.6, 0.14, 0.4, "steel")
		end
		m:add("ball", -3.6, G + 6.6, -3.6, 1.8, 1.8, 1.8, "canvas") -- the moon
		m:add("cyl", -3.8, G, 3.0, 2.0, 2.2, 2.0, "plaster"):add("cone", -3.8, G + 2.2, 3.0, 2.0, 0.5, 2.0, "steel") -- a fuel tank
		m:add("box", 3.6, G, 3.6, 2.4, 1.2, 1.8, "concrete"):add("box", 3.6, G + 0.5, 4.52, 1.8, 0.4, 0.06, "glass") -- the control room
		CON["spacerace"] = done(m, CAM)
	end
end
