-- R3+R4: map camera (roblox/SPEC.md §3c/§3e), control scheme per user
-- playtest 2026-07-14: WASD/arrows stay with the CHARACTER (default controls
-- remain enabled); the camera is driven by mouse + Q/E only.
--   hold LMB + drag   orbit (yaw free, pitch clamped; a <5px drag is a
--                     selection click — see Select.client.luau)
--   hold RMB + drag   pan (grab-the-map, clamped to the map, scales w/ zoom)
--   Q / E             focus down / up
--   mouse wheel       zoom (distance clamped)
--   F                 follow-avatar toggle (R4, banked user request) — the
--                     focus tracks the character; free cam stays primary
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local TILE = ClientState.TILE

local camera = workspace.CurrentCamera

local focus = Vector3.new(0, 0, 0)
-- center on our first unit when the first view arrives
local centered = false
ClientState.onView(function(view)
	if centered then
		return
	end
	for _, u in pairs(view.units) do
		if u.owner == view.you then
			focus = Vector3.new(u.x * TILE, 0, u.y * TILE)
			centered = true
			break
		end
	end
end)
local yaw = math.rad(-30)
local pitch = math.rad(-55)
local dist = 60

local PITCH_MIN, PITCH_MAX = math.rad(-85), math.rad(-15)
local DIST_MIN, DIST_MAX = 15, 220
local FOCUS_Y_MIN, FOCUS_Y_MAX = 0, 100
local LIFT_SPEED = 25 -- studs/second for Q/E
local ORBIT_SENS = 0.008
local PAN_SENS = 0.0015 -- studs per pixel per stud of distance (grab feel)

local function mapMax()
	local view = ClientState.view
	if view == nil then
		return 1000, 1000 -- unclamped until the first view arrives
	end
	return (view.map.width - 1) * TILE, (view.map.height - 1) * TILE
end

-- orbit is POLLED (IsMouseButtonPressed + screen-position delta): mouse
-- events arrive pre-sunk by the default control scripts, polling can't be
local lastMouse = nil

UserInputService.InputChanged:Connect(function(input, processed)
	if input.UserInputType == Enum.UserInputType.MouseWheel and not processed then
		dist = math.clamp(dist * (input.Position.Z > 0 and 0.85 or 1.18), DIST_MIN, DIST_MAX)
	end
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if not processed and input.KeyCode == Enum.KeyCode.F then
		ClientState.followAvatar = not ClientState.followAvatar
		print("[Camera] follow-avatar " .. (ClientState.followAvatar and "ON" or "OFF"))
	end
end)

RunService.RenderStepped:Connect(function(dt)
	camera.CameraType = Enum.CameraType.Scriptable

	local mouse = UserInputService:GetMouseLocation()
	if lastMouse then
		local delta = mouse - lastMouse
		if UserInputService:IsMouseButtonPressed(Enum.UserInputType.MouseButton1) then
			yaw = yaw - delta.X * ORBIT_SENS
			pitch = math.clamp(pitch - delta.Y * ORBIT_SENS, PITCH_MIN, PITCH_MAX)
		elseif UserInputService:IsMouseButtonPressed(Enum.UserInputType.MouseButton2) then
			-- grab-the-map pan: the terrain follows the mouse, so the focus
			-- moves the opposite way along the camera's ground-plane axes
			local look = Vector3.new(math.sin(yaw), 0, math.cos(yaw)) -- focus->camera
			local right = Vector3.new(look.Z, 0, -look.X)
			local s = dist * PAN_SENS
			local maxX, maxZ = mapMax()
			focus += (-right * delta.X - look * delta.Y) * s
			focus = Vector3.new(
				math.clamp(focus.X, 0, maxX), focus.Y, math.clamp(focus.Z, 0, maxZ))
		end
	end
	lastMouse = mouse

	-- follow-avatar (R4): the focus rides the character's ground position
	if ClientState.followAvatar then
		local character = Players.LocalPlayer.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if root then
			focus = Vector3.new(root.Position.X, focus.Y, root.Position.Z)
		end
	end

	if not UserInputService:GetFocusedTextBox() then
		local lift = 0
		if UserInputService:IsKeyDown(Enum.KeyCode.E) then
			lift += 1
		end
		if UserInputService:IsKeyDown(Enum.KeyCode.Q) then
			lift -= 1
		end
		if lift ~= 0 then
			focus = Vector3.new(focus.X,
				math.clamp(focus.Y + lift * LIFT_SPEED * dt, FOCUS_Y_MIN, FOCUS_Y_MAX), focus.Z)
		end
	end

	local offset = CFrame.fromEulerAnglesYXZ(pitch, yaw, 0):VectorToWorldSpace(Vector3.new(0, 0, dist))
	camera.CFrame = CFrame.lookAt(focus + offset, focus)
end)

print(("[Camera] R4 map camera up: dist %d — LMB-drag orbit, RMB-drag pan, Q/E down/up, wheel zoom, F follow-avatar; WASD moves the avatar"):format(dist))
