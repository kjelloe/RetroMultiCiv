-- SO15 sound player (A77; architect ruling #2078 item 5 = curated library-map,
-- PROVISIONAL, no upload). The browser client/ui/sound.js SYNTHESISES cues in
-- Web Audio; Roblox plays Sound instances, so each cue maps to a Roblox audio
-- asset id. SoundMap.luau (the pure twin of sound-map.js) decides WHICH cue an
-- event earns; this fires it, fog-honest by construction (events arrive pre-
-- filtered; the map is viewer-relative). Honors an opt-out (options.sound).
--
-- SOUND_ASSET is PROVISIONAL: the ids are the user's to curate from the Studio
-- Toolbox (Audio) — filling one makes that cue audible; empty = silent no-op.
-- Upload-swap to bespoke cues stays the user-gated 1.y item (per the ruling).
local SoundService = game:GetService("SoundService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local SoundMap = require(script.Parent:WaitForChild("SoundMap"))

-- cue -> rbxassetid string. Curate in Studio (Toolbox → Audio → copy Asset ID);
-- e.g. SOUND_ASSET["found"] = "rbxassetid://<id>". Empty = silent until filled.
local SOUND_ASSET = {}
for _, cue in ipairs(SoundMap.SOUND_IDS) do
	SOUND_ASSET[cue] = ""
end

-- per-cue relative gain (the browser mixes cues at different levels; kept here
-- so curation is id-only). Defaults to 1; tune once real assets are in.
local CUE_VOLUME = { ["combat-distant"] = 0.4, ["capture-distant"] = 0.4 }

local function muted()
	return ClientState.options ~= nil and ClientState.options.sound == false
end

local function play(cue)
	local asset = SOUND_ASSET[cue]
	if asset == nil or asset == "" or muted() then
		return -- provisional/empty or opted-out: silent no-op
	end
	local s = Instance.new("Sound")
	s.SoundId = asset
	s.Volume = CUE_VOLUME[cue] or 1
	s.Parent = SoundService
	s.Ended:Connect(function()
		s:Destroy()
	end)
	s:Play()
	-- safety cleanup if Ended never fires (bad/unresolved asset)
	task.delay(8, function()
		if s.Parent ~= nil then
			s:Destroy()
		end
	end)
end

ClientState.onEvents(function(events, view)
	local function cityOwner(cityId)
		local c = view.cities[cityId]
		return c ~= nil and c.owner or nil
	end
	for _, e in ipairs(events) do
		local ok, cue = pcall(SoundMap.soundForEvent, e, view.you, cityOwner)
		if ok and cue ~= nil then
			play(cue)
		end
	end
end)

print("[Sound] SO15 cue player up (SoundIds provisional — curate in Studio Toolbox)")
