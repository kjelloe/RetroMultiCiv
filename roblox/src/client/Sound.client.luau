-- SO15 sound player (A77). The browser client/ui/sound.js SYNTHESISES cues in
-- Web Audio; Roblox plays Sound instances mapped to UPLOADED audio assets: the
-- same recipes are rendered offline (tools/render-sounds.js, user-approved
-- 2026-07-26) and bulk-uploaded via Open Cloud (roblox/tools/upload-sounds.js),
-- which regenerates SoundAssets.luau (cue -> rbxassetid + the approved browser
-- mix as Volume). SoundMap.luau (the pure twin of sound-map.js) decides WHICH
-- cue an event earns; this fires it, fog-honest by construction (events arrive
-- pre-filtered; the map is viewer-relative). Honors an opt-out (options.sound).
-- A cue whose asset is still "" (not yet uploaded) stays a silent no-op.
local SoundService = game:GetService("SoundService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local SoundMap = require(script.Parent:WaitForChild("SoundMap"))
local SoundAssets = require(script.Parent:WaitForChild("SoundAssets"))

-- cue -> rbxassetid string + per-cue volume, from the generated table (empty
-- asset = silent until the uploader has run). SOUND_IDS stays the cue roster.
local SOUND_ASSET, CUE_VOLUME = {}, {}
for _, cue in ipairs(SoundMap.SOUND_IDS) do
	local row = SoundAssets[cue]
	SOUND_ASSET[cue] = row ~= nil and row.asset or ""
	CUE_VOLUME[cue] = row ~= nil and row.volume or 1
end

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

print("[Sound] SO15 cue player up (SoundAssets.luau: bespoke uploads via roblox/tools/upload-sounds.js)")
