# Start (or restart) the RetroMultiCiv Node server on native Windows —
# the PowerShell twin of run.sh for Windows 11 hosts (no WSL needed;
# hosting natively also needs no portproxy, only the firewall rule).
#   .\run.ps1                 serve on port 8123
#   .\run.ps1 9000            serve on another port
#   .\run.ps1 8123 --seed 42 --civs 4     extra args go to the server
#   .\run.ps1 8123 --game saves/g42.json  resume a saved server game
#   .\run.ps1 -Help
# Works in Windows PowerShell 5.1 and PowerShell 7.

param(
  [Parameter(ValueFromRemainingArguments = $true)] [string[]] $Args,
  [switch] $Help
)
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

# ValueFromRemainingArguments binds NOTHING when no extra args are given -
# $Args is then $null, and @(...) + $null smuggles a null ELEMENT into
# Start-Process -ArgumentList (real Windows 11 report). Normalize once.
if ($null -eq $Args) { $Args = @() }

if ($Help -or ($Args -contains '--help') -or ($Args -contains '-h')) {
  Write-Host @'
usage: .\run.ps1 [PORT] [server args...]

  PORT                first argument, default 8123

server args (passed to node server/index.js):
  --seed N            world seed (default: random)
  --civs N            civilizations 2..7 (default 2)
  --humans N          human seats (default 1; hotseat plays LOCAL, without ?server=1)
  --size S            xsmall|small|medium|large|xlarge|huge (default medium)
  --game FILE         resume a server save (e.g. saves/g42.json)
  --reset-seats       with --game: drop seat-token bindings (resuming on a
                      different port or browser)
  --no-save           disable the autosave after each accepted command
  --no-spectators     the boot game refuses spectator joins
  --host IP           bind address (default 0.0.0.0 = reachable on the LAN)

after start:  play locally at /client/ - through the server at /client/?server=1
verify a server game:  node tools/replay.js saves/<gameId>.json
'@
  exit 0
}

# prerequisites: node runs the server, ws is its one dependency
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'node is required but not installed. Install it first:'
  Write-Host '  winget install OpenJS.NodeJS.LTS'
  Write-Host '  (or download the LTS from https://nodejs.org)'
  exit 1
}
if (-not (Test-Path 'node_modules/ws')) {
  Write-Host 'dependencies missing (node_modules/ws) - from the repo root run:'
  Write-Host '  npm ci'
  exit 1
}

# first arg is the port ONLY if numeric - `.\run.ps1 --humans 2` must not
# swallow a flag as the port
$Port = 8123
if ($Args.Count -gt 0 -and $Args[0] -match '^[0-9]+$') {
  $Port = [int]$Args[0]
  # NOT $Args[1..($Args.Count - 1)]: with a single element that range is
  # 1..0, which walks BACKWARDS and re-yields the port as a server arg
  $Args = @($Args | Select-Object -Skip 1)
}

# stop a previous game server holding this port (match the command line,
# same as run.sh's pkill pattern)
$pattern = "server[/\\]index\.js --port $Port"
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -match $pattern } |
  ForEach-Object {
    Write-Host "stopped previous game server on port $Port (pid $($_.ProcessId))"
    Stop-Process -Id $_.ProcessId -Force
    Start-Sleep -Milliseconds 500
  }

$log = Join-Path $env:TEMP 'multiciv-server.log'
$nodeArgs = @('server/index.js', '--port', "$Port") + $Args
$proc = Start-Process -FilePath 'node' -ArgumentList $nodeArgs -NoNewWindow -PassThru `
  -RedirectStandardOutput $log -RedirectStandardError "$log.err"
Start-Sleep -Milliseconds 700
if ($proc.HasExited) {
  Write-Host 'server failed to start:'
  foreach ($f in @($log, "$log.err")) {
    if (Test-Path $f) { Get-Content $f -Tail 10 | Write-Host }
  }
  exit 1
}

Write-Host "RetroMultiCiv server running (pid $($proc.Id), log $log)"
Write-Host ''
Write-Host "  play (local engine, hotseat OK):  http://localhost:$Port/client/"
Write-Host "  play THROUGH the server:          http://localhost:$Port/client/?server=1"
Write-Host '  diagnostics HUD: ?diag=1 - fixed world: ?seed=12345 - setup: bare URL'

$lanIp = (Get-NetIPConfiguration |
  Where-Object { $null -ne $_.IPv4DefaultGateway }).IPv4Address.IPAddress |
  Select-Object -First 1
if ($lanIp) {
  Write-Host "  LAN players:     http://${lanIp}:$Port/client/"
  Write-Host ''
  Write-Host '  first time hosting? allow the port through the firewall - once, in an'
  Write-Host '  ADMIN PowerShell (native hosting needs no portproxy):'
  Write-Host "    netsh advfirewall firewall add rule name=""RetroMultiCiv $Port"" dir=in action=allow protocol=TCP localport=$Port"
}
