-- check.sh gate 48: statistics content rules (StatsView): the fog rule on
-- rival cards, the own card's fields, wonders window, chart dots in the box,
-- block layout without overlap.
local V = require("../src/client/StatsView")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local rs = { governments = { despotism = { name = "Despotism" }, monarchy = { name = "Monarchy" } },
	techs = { alphabet = { name = "Alphabet" } }, wonders = { pyramids = { name = "Pyramids" } } }
local view = { you = "p1", playerOrder = { "p1", "p2", "p3", "p9" },
	players = {
		p1 = { name = "Rome", color = "#ff0000", gold = 42, techs = { "a", "b", "c" }, researching = "alphabet", government = "monarchy" },
		p2 = { name = "Babylon", color = "#00ff00", human = true, stance = "builder", gold = 999, techs = { "x" }, researching = "alphabet" },
		p3 = { name = "Zulu" },
	},
	cities = { c1 = { owner = "p1" }, c2 = { owner = "p1" }, c3 = { owner = "p2" } },
	units = { u1 = { owner = "p1" }, u2 = { owner = "p2" }, u3 = { owner = "p2" } } }
local battles = { p1 = { won = 3, lost = 1 }, p2 = { won = 0, lost = 0 } }

local cards = V.cards(view, rs, battles)
check("a card per known player (p9 has no player row)", #cards == 3, #cards)
local own, rival, bare = cards[1], cards[2], cards[3]
local function fact(card, label)
	for _, f in ipairs(card.facts) do
		if f.label == label then
			return f.value
		end
	end
	return nil
end
check("own: you tag", own.you and own.tags[1] == "You")
check("own: counts", fact(own, "Cities") == "2" and fact(own, "Units") == "1")
check("own: gold techs rule", fact(own, "Gold") == "42" and fact(own, "Techs") == "3" and fact(own, "Rule") == "Monarchy")
check("own: research name", own.research == "Alphabet" and own.researchUnset == nil)
check("own: record", own.record ~= nil and own.record.won == 3 and own.record.lost == 1)
-- the fog rule: nothing but view-derived counts on a rival card
check("rival: two facts only", #rival.facts == 2, #rival.facts)
check("rival: seen counts", fact(rival, "Cities seen") == "1" and fact(rival, "Units in sight") == "2")
check("rival: no gold / techs / rule / research", fact(rival, "Gold") == nil and fact(rival, "Techs") == nil
	and fact(rival, "Rule") == nil and rival.research == nil and rival.researchUnset == nil)
check("rival: tags", rival.tags[1] == "Human" and rival.tags[2] == "Perfectionist")
check("rival: 0-0 record hidden", rival.record == nil)
check("bare player: defaults", bare.color == "#888888" and #bare.tags == 0 and fact(bare, "Cities seen") == "0")
view.players.p1.researching = ""
check("own: empty research = unset", V.card(view, "p1", rs, nil).researchUnset == true)
view.players.p1.researching = nil
view.players.p1.government = nil
local c = V.card(view, "p1", rs, nil)
check("own: nil research = unset, nil government = Despotism", c.researchUnset == true and fact(c, "Rule") == "Despotism")

local wonders = {}
for i = 1, 11 do
	wonders[i] = { turn = i * 10, owner = i % 2 == 0 and "p2" or "pX", wonder = i == 11 and "pyramids" or "w" .. i }
end
local rows = V.wonderRows(wonders, view, rs)
check("wonders: newest window", #rows == V.WONDER_LIMIT and rows[1].turn == 40 and rows[#rows].turn == 110)
check("wonders: names", rows[#rows].name == "Pyramids" and rows[1].name == "w4")
check("wonders: owner", rows[1].owner == "Babylon" and rows[2].owner == "Unknown")
check("wonders: empty", #V.wonderRows({}, view, rs) == 0)

local series = {}
for t = 1, 300 do
	series[t] = { scores = { p1 = t, p2 = 300 - t } }
end
local max = V.maxScore(series)
check("max score", max == 300, max)
local dots = V.chartDots(series, "p1", 480, max)
check("chart: capped columns", #dots == V.CHART_COLS, #dots)
local lastX = -1
for _, d in ipairs(dots) do
	check("chart: dot inside the box", d.x >= 0 and d.x <= 480 - 4 and d.y >= 0 and d.y <= V.CHART_H - 3, d.x .. "," .. d.y)
	check("chart: x strictly rises", d.x > lastX)
	lastX = d.x
end
check("chart: rising score climbs", dots[#dots].y < dots[1].y)
check("chart: top score near the top", dots[#dots].y == 4, dots[#dots].y)
check("chart: unknown player has no dots", #V.chartDots(series, "p7", 480, max) == 0)
check("chart: one sample draws nothing", #V.chartDots({ series[1] }, "p1", 480, max) == 0)
check("max score floor", V.maxScore({}) == 1)

local l = V.layout(3, 0, false)
check("layout: cards only", l.wondersY == nil and l.chartY == nil and l.content == 3 * (V.CARD_H + V.CARD_GAP))
l = V.layout(3, 2, true)
check("layout: blocks in order", l.cardsY == 0 and l.wondersY == 3 * (V.CARD_H + V.CARD_GAP)
	and l.chartY == l.wondersY + V.SECTION_H + 2 * V.WONDER_H + V.CARD_GAP)
check("layout: content holds the chart", l.content == l.chartY + V.SECTION_H + V.CHART_H + V.CARD_GAP)
check("layout: panel = head + body", l.panelH == V.HEAD_H + l.body + 8 and l.body == l.content)
l = V.layout(14, 8, true)
check("layout: 14 civs scroll", l.body == V.BODY_MAX and l.content > V.BODY_MAX and l.panelH <= 560, l.panelH)

if fails > 0 then
	error(fails .. " stats view pin(s) failed")
end
print("stats-view: cards, wonders, chart, layout")
