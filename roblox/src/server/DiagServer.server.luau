-- Server half of the diagnostics tag (client: Diag.luau / DiagAudit): an
-- uncaught server script error is re-printed as one [RMC-DIAG] line so
-- `node roblox/tools/studio-log.js --diag` shows it beside the client's.
local ScriptContext = game:GetService("ScriptContext")

ScriptContext.Error:Connect(function(message, trace, source)
	local where = source ~= nil and source:GetFullName() or "?"
	local text = (tostring(message) .. " | " .. tostring(trace)):gsub("[\r\n]+", " | ")
	warn(("[RMC-DIAG] FAIL script: %s: %s"):format(where, text))
end)
