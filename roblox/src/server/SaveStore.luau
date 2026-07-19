-- R10 (docs/13 Tier-3, user design 2026-07-16): the save envelope store —
-- a DataStore KEYED BY THE GAME CODE (docs/07: knowing the code IS the
-- authorization, browser A98's twin). The envelope is statehash.canonicalize
-- output (round-trip proven identity: canonicalize -> json2lua.parse ->
-- hashState is hash-stable and re-canonicalizes byte-identical), so the
-- docs/07 tamper check works on resume: gameCode(state) must equal the key.
-- Every call is pcall-wrapped: Studio needs "Enable Studio Access to API
-- Services" and offline places just report the miss.

local DataStoreService = game:GetService("DataStoreService")

local M = {}

local store = nil
local function getStore()
	if store == nil then
		local ok, s = pcall(DataStoreService.GetDataStore, DataStoreService, "rmc_saves")
		if ok then
			store = s
		end
	end
	return store
end

-- run-F #7: is persistence usable at all? (Studio needs the API-access toggle;
-- offline/no-DataStore places return false). Lets the server tell seated
-- clients ONCE that saves/resume won't work, instead of failing silently.
function M.available()
	return getStore() ~= nil
end

-- returns true on success
function M.save(code, envelopeJson)
	local s = getStore()
	if s == nil then
		print("[SaveStore] DataStore unavailable — saves/resume disabled. In Studio: "
			.. "Home > Game Settings > Security > Enable Studio Access to API Services.")
		return false
	end
	local ok, err = pcall(s.SetAsync, s, code, envelopeJson)
	if not ok then
		print("[SaveStore] save failed: " .. tostring(err))
	end
	return ok
end

-- returns the envelope JSON string, or nil
function M.load(code)
	local s = getStore()
	if s == nil then
		print("[SaveStore] DataStore unavailable (Studio API access off?)")
		return nil
	end
	local ok, value = pcall(s.GetAsync, s, code)
	if not ok then
		print("[SaveStore] load failed: " .. tostring(value))
		return nil
	end
	return value
end

return M
