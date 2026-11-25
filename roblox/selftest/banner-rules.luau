-- check.sh gate 75: centre banners (BannerRules, plan R6.3).
local B = require("../src/client/BannerRules")
local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local function view(active, humans)
	local players = { p1 = { human = true }, p2 = { human = humans > 1 }, p3 = { human = false } }
	return { you = "p1", activePlayer = active, players = players }
end
local on = { muteTurnBanner = false }
check("hand-back with two humans", B.yourTurn("p2", view("p1", 2), on))
check("not with one human (the browser's rule)", not B.yourTurn("p2", view("p1", 1), on))
check("not while it stays your turn", not B.yourTurn("p1", view("p1", 2), on))
check("not on the first view", not B.yourTurn(nil, view("p1", 2), on))
check("not on someone else's turn", not B.yourTurn("p1", view("p2", 2), on))
check("muted", not B.yourTurn("p2", view("p1", 2), { muteTurnBanner = true }))
local over = view("p1", 2)
over.gameOver = true
check("not after the game", not B.yourTurn("p2", over, on))
check("humans counted", B.humans(view("p1", 2)) == 2 and B.humans({}) == 0)
check("location on the map", B.hasLoc({ x = 3, y = 4 }, { width = 10, height = 10 }))
check("no location", not B.hasLoc(nil) and not B.hasLoc({ x = 3 }) and not B.hasLoc({ x = 1.5, y = 2 }))
check("off the map", not B.hasLoc({ x = 10, y = 4 }, { width = 10, height = 10 }))
check("hold", B.HOLD == 5)

if fails > 0 then
	error(("banner-rules: %d failure(s)"):format(fails))
end
print("banner-rules: ok")
