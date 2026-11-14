-- Tech tree as a GRAPH (run-S shot13, user): boxes in columns by tech level,
-- left to right, with dependency lines. PURE layout - TechTree.client draws
-- it. Lune-pinned by roblox/selftest/techtree-layout.luau (check.sh gate 44).
--
-- Column = level (a prerequisite is always in an earlier column). Inside a
-- column the boxes are ordered by the mean row of their prerequisites, so
-- lines mostly run level; short columns are centred on the tallest one.
-- A line is an elbow: out of the prerequisite's right edge, across, then
-- down/up in the gap just before the target column, then into its left edge.
local M = {}

M.BOX_W = 168
M.BOX_H = 42
M.COL_PITCH = 228 -- box + a 60 px gap that holds the vertical runs
M.ROW_PITCH = 54
M.PAD = 14
M.LANES = 4 -- vertical runs in one gap are spread over this many x positions
M.LANE_STEP = 9

local ERA_RANK = { ancient = 1, renaissance = 2, industrial = 3, modern = 4 }

function M.layout(techs)
	local cols, maxLevel = {}, 0
	for id, def in pairs(techs) do
		local l = def.level
		cols[l] = cols[l] or {}
		table.insert(cols[l], id)
		maxLevel = math.max(maxLevel, l)
	end
	local tallest = 0
	for l = 1, maxLevel do
		cols[l] = cols[l] or {}
		tallest = math.max(tallest, #cols[l])
	end

	local nodes = {} -- id -> { col, row, x, y }
	for l = 1, maxLevel do
		local ids = cols[l]
		local key = {}
		for _, id in ipairs(ids) do
			local sum, n = 0, 0
			for _, p in ipairs(techs[id].prereqs or {}) do
				if nodes[p] ~= nil then
					sum += nodes[p].row
					n += 1
				end
			end
			key[id] = n > 0 and sum / n or -1
		end
		table.sort(ids, function(a, b)
			if key[a] ~= key[b] then
				return key[a] < key[b]
			end
			local ea, eb = ERA_RANK[techs[a].era] or 9, ERA_RANK[techs[b].era] or 9
			if ea ~= eb then
				return ea < eb
			end
			return a < b
		end)
		local first = (tallest - #ids) / 2
		for i, id in ipairs(ids) do
			local row = first + i - 1
			nodes[id] = { col = l, row = row,
				x = M.PAD + (l - 1) * M.COL_PITCH,
				y = M.PAD + math.floor(row * M.ROW_PITCH + 0.5) }
		end
	end

	-- edges, in a stable order (target column, target row, source row)
	local edges = {}
	for l = 1, maxLevel do
		local lane = 0
		for _, id in ipairs(cols[l]) do
			local pre = {}
			for _, p in ipairs(techs[id].prereqs or {}) do
				if nodes[p] ~= nil then
					table.insert(pre, p)
				end
			end
			table.sort(pre, function(a, b)
				if nodes[a].row ~= nodes[b].row then
					return nodes[a].row < nodes[b].row
				end
				return a < b
			end)
			for k, p in ipairs(pre) do
				local a, b = nodes[p], nodes[id]
				local x1, y1 = a.x + M.BOX_W, a.y + M.BOX_H / 2
				-- two lines into one box arrive a little apart
				local y2 = b.y + M.BOX_H / 2 + (#pre > 1 and (k - (#pre + 1) / 2) * 10 or 0)
				local mid = b.x - 12 - (lane % M.LANES) * M.LANE_STEP
				lane += 1
				edges[#edges + 1] = { from = p, to = id, x1 = x1, y1 = y1, mid = mid, x2 = b.x, y2 = y2 }
			end
		end
	end

	return {
		nodes = nodes, edges = edges, cols = maxLevel, rows = tallest,
		width = M.PAD * 2 + (maxLevel - 1) * M.COL_PITCH + M.BOX_W,
		height = M.PAD * 2 + (tallest - 1) * M.ROW_PITCH + M.BOX_H,
	}
end

return M
