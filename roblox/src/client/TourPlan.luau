-- The UI tour as data + its judging rules (pure: no Instances).
-- specs/roblox-parity-plan.md step 0: one Play, one button, every surface
-- opened and checked, one `[RMC-TOUR]` line per stop in the Studio log.
-- UiTour.client walks STOPS; roblox/selftest/tour-plan.luau (gate 52) pins
-- the rules and that every ScreenGui is toured or EXEMPT with a reason.
local M = {}

M.HOLD = 1.5 -- seconds a stop stays on screen
M.SETTLE = 0.4 -- seconds between opening a surface and measuring it
M.MIN_TEXT = 14

-- panel = the id the panel registered with ClientState.registerPanel;
-- gui = its ScreenGui (for the coverage pin); minTexts = fewer visible texts
-- than this means the surface came up empty
M.STOPS = {
	{ id = "research", panel = "research", gui = "RMCResearch", title = "Research", minTexts = 4 },
	{ id = "techtree", panel = "techtree", gui = "RMCTechTree", title = "Technology tree", minTexts = 20 },
	{ id = "cities", panel = "cities", gui = "RMCCityList", title = "Cities", minTexts = 2 },
	{ id = "economy", panel = "economy", gui = "RMCCityList", title = "Economy", minTexts = 4, needsCity = true },
	{ id = "city", panel = "city", gui = "RMCCityPanel", title = "City", minTexts = 8, needsCity = true },
	{ id = "city-hover", panel = "city", gui = "RMCTooltip", title = "City list hover card", minTexts = 8, needsCity = true, hover = true },
	{ id = "discovery", panel = "discovery", gui = "RMCDiscoveryCard", title = "Discovery splash", minTexts = 5 },
	{ id = "government", panel = "government", gui = "RMCGovernment", title = "Government", minTexts = 6 },
	{ id = "military", panel = "military", gui = "RMCMilitary", title = "Military", minTexts = 3 },
	{ id = "stats", panel = "stats", gui = "RMCStats", title = "Statistics", minTexts = 3 },
	{ id = "pedia", panel = "pedia", gui = "RMCPedia", title = "Encyclopedia", minTexts = 10 },
	{ id = "options", panel = "options", gui = "RMCOptions", title = "Options", minTexts = 6 },
	{ id = "legend", panel = "legend", gui = "RMCLegend", title = "Controls", minTexts = 20 },
	{ id = "turnlog", panel = "turnlog", gui = "RMCTurnLog", title = "Turn log", minTexts = 6 },
	{ id = "diplomacy", panel = "diplomacy", gui = "RMCDiplomacy", title = "Diplomacy", minTexts = 1 },
	{ id = "overlays", panel = "overlays", gui = "RMCOverlays", title = "Map overlays", minTexts = 4 },
	{ id = "ship", panel = "ship", gui = "RMCShip", title = "Spaceship", minTexts = 3 },
	{ id = "wonder", panel = "wonder", gui = "RMCWonderScene", title = "Wonder completion card", minTexts = 5 },
	{ id = "regent", panel = "regent", gui = "RMCRegentDialog", title = "Regent stance", minTexts = 5 },
	-- always-on surfaces: measured where they stand, nothing to open
	{ id = "hud", gui = "RMCHud", title = "Top-left status and End Turn", minTexts = 2, always = true },
	{ id = "actionbar", gui = "RMCActionBar", title = "Action bar and top row", minTexts = 8, always = true },
}

-- ScreenGuis the tour does not open, each with the run that covers it
M.EXEMPT = {
	RMCLobby = "before the game: run A covers it by hand (host setup, seat list)",
	RMCCivGallery = "before the game: run A by hand",
	RMCResume = "host-only strip inside the lobby",
	RMCFastForward = "only on a later-age start",
	RMCEndScreen = "game over: run C (regent game to the end)",
	RMCHistorian = "age change: run C",
	RMCTheater = "post-game replay: run C",
	RMCAdvice = "first-time cards appear on their own triggers",
	RMCMinimap = "always on screen; nothing to open",
	RMCRidePad = "touch only: run B",
	RMCTileCard = "follows the pointer",
	RMCWaitStatus = "another player's turn: run D",
	RMCStrategic = "debug / spectator surface",
	RMCFoundCity = "appears on Found city: staging uses it",
	RMCDebugMenu = "the tour starts from it",
	RMCDebug = "Studio button",
	RMCIntro = "shown once at boot, before any game",
	RMCTooltip = "measured by the hover stops",
	RMCTour = "the tour's own caption strip",
	RMCEnvoy = "envoy and Propose cards need a met rival: run C by hand, then plan step R1",
}

-- staging (debug commands; ordinary logged commands, so the run replays).
-- Each is skipped with a note when the game is not a debug game.
M.STAGE = {
	{ id = "reveal", cmd = { type = "debug", action = "revealMap" } },
	{ id = "gold", cmd = { type = "debug", action = "grantGold", amount = 2000 } },
	{ id = "tech", action = "grantTech", count = 6 }, -- the next six available advances
	{ id = "caravan", action = "spawnUnit", unitType = "caravan" },
	{ id = "diplomat", action = "spawnUnit", unitType = "diplomat" },
	{ id = "settlers", action = "spawnUnit", unitType = "settlers" },
}

-- item: { text, size, fits, truncates, visible }; root / viewport: { x, y, w, h }
-- -> list of finding strings (empty = the stop passes)
function M.judge(stop, root, viewport, items)
	local out = {}
	if root == nil then
		return { "did not open" }
	end
	if root.w <= 0 or root.h <= 0 then
		out[#out + 1] = "has no size"
	end
	if root.x < -1 or root.y < -1 or root.x + root.w > viewport.w + 1 or root.y + root.h > viewport.h + 1 then
		out[#out + 1] = ("off screen (%d,%d %dx%d in %dx%d)"):format(root.x, root.y, root.w, root.h, viewport.w, viewport.h)
	end
	local texts, clipped, small = 0, {}, {}
	for _, it in ipairs(items) do
		if it.visible and it.text ~= "" then
			texts += 1
			if it.size < M.MIN_TEXT then
				small[#small + 1] = it.text
			end
			-- a label that truncates on purpose (TextTruncate) is not a fault
			if not it.fits and not it.truncates then
				clipped[#clipped + 1] = it.text
			end
		end
	end
	if texts < (stop.minTexts or 1) then
		out[#out + 1] = ("only %d text(s), expected at least %d (came up empty?)"):format(texts, stop.minTexts or 1)
	end
	if #clipped > 0 then
		out[#out + 1] = ("%d clipped text(s), first '%s'"):format(#clipped, clipped[1]:sub(1, 30))
	end
	if #small > 0 then
		out[#out + 1] = ("%d text(s) under %d px, first '%s'"):format(#small, M.MIN_TEXT, small[1]:sub(1, 30))
	end
	return out
end

function M.line(i, n, stop, findings, skipped)
	local verdict = skipped ~= nil and ("SKIP " .. skipped) or (#findings == 0 and "PASS" or ("FAIL " .. table.concat(findings, "; ")))
	return ("[RMC-TOUR] %02d/%02d %s %s"):format(i, n, stop.id, verdict)
end

-- results: { { id, findings, skipped } } -> pass, fail, skip counts + summary line
function M.summary(results)
	local pass, fail, skip = 0, 0, 0
	local failed = {}
	for _, r in ipairs(results) do
		if r.skipped ~= nil then
			skip += 1
		elseif #r.findings == 0 then
			pass += 1
		else
			fail += 1
			failed[#failed + 1] = r.id
		end
	end
	local line = ("[RMC-TOUR] DONE %d stops: %d pass, %d fail, %d skipped%s"):format(#results, pass, fail, skip,
		fail > 0 and (" - failed: " .. table.concat(failed, ", ")) or "")
	return pass, fail, skip, line
end

return M
