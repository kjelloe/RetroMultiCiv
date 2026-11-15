-- Statistics panel content rules (pure: no Instances). THE FOG RULE
-- (architect @8285016a) lives here: a rival card carries only what the
-- seat's view shows (cities seen, units in sight); the own card adds the
-- fields filterView grants its own seat. roblox/selftest/stats-view.luau.
local M = {}

M.W = 520
M.CARD_H = 50
M.CARD_GAP = 6
M.SECTION_H = 26
M.WONDER_H = 22
M.CHART_H = 110
M.HEAD_H = 62 -- heading + subtitle above the scrolling body
M.BODY_MAX = 460 -- the body scrolls beyond this
M.WONDER_LIMIT = 8
M.CHART_COLS = 88

local function countOwned(t, pid)
	local n = 0
	for _, v in pairs(t or {}) do
		if v.owner == pid then
			n += 1
		end
	end
	return n
end

-- one civ -> what its card shows
function M.card(view, pid, rs, battles)
	local p = view.players[pid]
	if p == nil then
		return nil
	end
	local you = pid == view.you
	local cities, units = countOwned(view.cities, pid), countOwned(view.units, pid)
	local card = { pid = pid, name = p.name, you = you, color = p.color or "#888888", tags = {}, facts = {} }
	if you then
		card.tags[#card.tags + 1] = "You"
	elseif p.human == true then
		card.tags[#card.tags + 1] = "Human"
	end
	if p.stance == "builder" then
		card.tags[#card.tags + 1] = "Perfectionist" -- public by ruling (marker-0045)
	end
	if you then
		local gov = rs.governments[p.government or "despotism"] -- unset = despotism (engine default)
		card.facts = {
			{ label = "Cities", value = tostring(cities) },
			{ label = "Units", value = tostring(units) },
			{ label = "Gold", value = tostring(p.gold or 0) },
			{ label = "Techs", value = tostring(#(p.techs or {})) },
			{ label = "Rule", value = gov and gov.name or "?" },
		}
		local r = p.researching
		if r ~= nil and r ~= "" then
			card.research = (rs.techs[r] or {}).name or r
		else
			card.research = nil
			card.researchUnset = true
		end
	else
		card.facts = {
			{ label = "Cities seen", value = tostring(cities) },
			{ label = "Units in sight", value = tostring(units) },
		}
	end
	local b = battles ~= nil and battles[pid] or nil
	if b ~= nil and ((b.won or 0) ~= 0 or (b.lost or 0) ~= 0) then
		card.record = { won = b.won or 0, lost = b.lost or 0 }
	end
	return card
end

function M.cards(view, rs, battles)
	local out = {}
	for _, pid in ipairs(view.playerOrder or {}) do
		local c = M.card(view, pid, rs, battles)
		if c ~= nil then
			out[#out + 1] = c
		end
	end
	return out
end

-- the newest WONDER_LIMIT wonders, oldest of them first
function M.wonderRows(wonders, view, rs)
	local out = {}
	for i = math.max(1, #wonders - M.WONDER_LIMIT + 1), #wonders do
		local w = wonders[i]
		local owner = w.owner ~= nil and view.players[w.owner] or nil
		out[#out + 1] = { turn = w.turn or 0, owner = owner and owner.name or "Unknown",
			color = owner and owner.color or "#888888", name = (rs.wonders[w.wonder] or {}).name or w.wonder }
	end
	return out
end

function M.maxScore(series)
	local m = 1
	for _, sample in ipairs(series) do
		for _, sc in pairs(sample.scores) do
			if sc > m then
				m = sc
			end
		end
	end
	return m
end

-- one civ's score line as dots: { { x, y } } inside a w x CHART_H box
-- (y grows downward; the highest score sits 4 px under the top edge)
function M.chartDots(series, pid, w, maxScore)
	local out = {}
	if #series < 2 then
		return out
	end
	local cols = math.min(#series, M.CHART_COLS)
	local step = #series / cols
	for c = 1, cols do
		local sample = series[math.max(1, math.floor(c * step))]
		local sc = sample ~= nil and sample.scores[pid] or nil
		if sc ~= nil then
			out[#out + 1] = { x = math.floor((c - 1) / cols * w),
				y = M.CHART_H - 4 - math.floor(sc / maxScore * (M.CHART_H - 8)) }
		end
	end
	return out
end

-- where each block starts inside the scrolling body, and the panel height
function M.layout(nCards, nWonders, hasChart)
	local y = 0
	local cardsY = y
	y += nCards * (M.CARD_H + M.CARD_GAP)
	local wondersY = nil
	if nWonders > 0 then
		wondersY = y
		y += M.SECTION_H + nWonders * M.WONDER_H + M.CARD_GAP
	end
	local chartY = nil
	if hasChart then
		chartY = y
		y += M.SECTION_H + M.CHART_H + M.CARD_GAP
	end
	local body = math.min(y, M.BODY_MAX)
	return { cardsY = cardsY, wondersY = wondersY, chartY = chartY, content = y, body = body,
		panelH = M.HEAD_H + body + 8 }
end

return M
