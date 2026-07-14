-- R3: map camera (roblox/SPEC.md §3c). Scriptable orbit/pan/zoom around a
-- focus point on the tile plane — the character never drives the view.
--   RMB drag        orbit (yaw free, pitch clamped)
--   WASD / arrows   pan the focus in the camera's ground plane
--   mouse wheel     zoom (distance clamped)

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local MockState = require(ReplicatedStorage:WaitForChild("GameData"):WaitForChild("MockState"))

local TILE = 4 -- must match RenderWorld's scale

local camera = workspace.CurrentCamera

-- free WASD for panning (and keep the avatar out of screenshots): the map
-- camera owns all movement input, the character never moves
local Players = game:GetService("Players")
task.spawn(function()
	local playerModule = Players.LocalPlayer:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule")
	require(playerModule):GetControls():Disable()
end)

-- start over the western continent (units around tile 5,4)
local focus = Vector3.new(5 * TILE, 0, 4 * TILE)
local yaw = math.rad(-30)
local pitch = math.rad(-55)
local dist = 60

local PITCH_MIN, PITCH_MAX = math.rad(-85), math.rad(-15)
local DIST_MIN, DIST_MAX = 15, 220
local PAN_SPEED = 40 -- studs/second at dist 60, scales with zoom
local ORBIT_SENS = 0.008

local mapMaxX = (MockState.map.width - 1) * TILE
local mapMaxZ = (MockState.map.height - 1) * TILE

-- orbit is POLLED in RenderStepped (IsMouseButtonPressed + screen-position
-- delta): RMB events arrive pre-sunk by the default control scripts, so
-- event handlers never saw them — polling can't be sunk
local lastMouse = nil

UserInputService.InputChanged:Connect(function(input, processed)
	if input.UserInputType == Enum.UserInputType.MouseWheel and not processed then
		dist = math.clamp(dist * (input.Position.Z > 0 and 0.85 or 1.18), DIST_MIN, DIST_MAX)
	end
end)

local function panInput()
	local dx, dz = 0, 0
	if UserInputService:GetFocusedTextBox() then
		return dx, dz
	end
	if UserInputService:IsKeyDown(Enum.KeyCode.W) or UserInputService:IsKeyDown(Enum.KeyCode.Up) then
		dz -= 1
	end
	if UserInputService:IsKeyDown(Enum.KeyCode.S) or UserInputService:IsKeyDown(Enum.KeyCode.Down) then
		dz += 1
	end
	if UserInputService:IsKeyDown(Enum.KeyCode.A) or UserInputService:IsKeyDown(Enum.KeyCode.Left) then
		dx -= 1
	end
	if UserInputService:IsKeyDown(Enum.KeyCode.D) or UserInputService:IsKeyDown(Enum.KeyCode.Right) then
		dx += 1
	end
	return dx, dz
end

RunService.RenderStepped:Connect(function(dt)
	camera.CameraType = Enum.CameraType.Scriptable

	local mouse = UserInputService:GetMouseLocation()
	if UserInputService:IsMouseButtonPressed(Enum.UserInputType.MouseButton2) and lastMouse then
		local delta = mouse - lastMouse
		yaw = yaw - delta.X * ORBIT_SENS
		pitch = math.clamp(pitch - delta.Y * ORBIT_SENS, PITCH_MIN, PITCH_MAX)
	end
	lastMouse = mouse

	local dx, dz = panInput()
	if dx ~= 0 or dz ~= 0 then
		-- pan in the camera's ground-plane axes so W is always "screen up";
		-- look points focus->camera, so screen-right = (look.Z, 0, -look.X)
		local look = Vector3.new(math.sin(yaw), 0, math.cos(yaw))
		local right = Vector3.new(look.Z, 0, -look.X)
		local speed = PAN_SPEED * (dist / 60) * dt
		focus += (right * dx + look * dz) * speed
		focus = Vector3.new(
			math.clamp(focus.X, 0, mapMaxX), 0, math.clamp(focus.Z, 0, mapMaxZ))
	end

	local offset = CFrame.fromEulerAnglesYXZ(pitch, yaw, 0):VectorToWorldSpace(Vector3.new(0, 0, dist))
	camera.CFrame = CFrame.lookAt(focus + offset, focus)
end)

print(("[Camera] R3 map camera up: focus tile (5,4), dist %d — RMB orbit, WASD/arrows pan, wheel zoom"):format(dist))
