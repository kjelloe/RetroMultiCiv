-- StructureModels with the building and emblem data applied (the data
-- modules are functions so the lune selftests can load them by path).
local S = require(script.Parent:WaitForChild("StructureModels"))
require(script.Parent:WaitForChild("BuildingModels"))(S)
require(script.Parent:WaitForChild("EmblemModels"))(S)
return S
