# Getting started with RetroMultiCiv

A browser 4X in the spirit of the 1991 classics. No build step, no install
beyond Node (or any static file server). One engine, seeded worlds — the
same seed always makes the same world.

## 1. Start the server

```bash
./run.sh              # serves everything on http://localhost:8123
./run.sh 9000         # a different port
./run.sh --help       # all options (seed, civs, resume a save, ...)
```

(No Node? `python3 -m http.server 8123` from the repo root also works for
local-engine play — you just won't have the authoritative-server mode.)

Then open **http://localhost:8123/client/** — the bare URL shows the
**setup screen**.

## 2. Player vs AI (single player)

On the setup screen:

1. **Your civilization** — pick one (each has a small Civ 1-style
   specialty, shown under the picker) or leave Random.
2. **Civilizations** — how many are in the world (2–7).
3. **Human players: 1 (vs AI)** — this is the single-player setting.
4. **Map size** (XSmall→Huge), **Difficulty** (Trainer→God-Emperor),
   **Combat calculations** (authentic one-roll Civ 1, or best-of-three
   for fewer heartbreaking upsets).
5. **World seed** — leave blank for random, or type a number to get a
   reproducible world (share the seed with a friend: same world).
6. **Start game.**

You begin in 4000 BC with settlers. Click a unit to select it, move with
**WASD / arrows / click a neighboring tile**, found your first city with
**B**, end your turn with **E**. The action bar at the bottom shows what
the selected unit can do; the **⌨ Controls** panel (bottom left) lists
every key. Win by conquest — or by score when the clock hits 2100 AD.

## 3. Hotseat (2+ humans, one keyboard)

Same setup screen — set **Human players to 2 or more** (humans take the
first seats, AI fills the rest). After each human ends their turn, an
**opaque hand-off screen** names the next player: pass the keyboard,
click (or press any key), and play. Each player sees **only their own
map** — fog of war is per player, so no peeking at each other's empires.

Saving mid-session: **F5** quick-saves, **Shift+S** downloads a save file;
**F9 / Shift+L / drag-drop** load it back. Loading resumes at the right
player's seat, behind the hand-off cover.

## 4. LAN multiplayer (host + join codes)

`./run.sh`, then friends on your network open
`http://<your-ip>:8123/client/` — on the setup screen use **Host a LAN
game** (you get a 5-letter join code and a waiting room) while they use
**Join** with that code, pick seats, and appear by name. Start when
ready — unfilled seats become AI. Mid-game niceties: a 🔔 your-turn
banner, a ⏳ waiting banner if someone disconnects (the host can skip
their turn, or players can vote), and full resume if the server
restarts (`./run.sh 8123 --game saves/<gameId>.json`). Every save shows
a **game code** (like `AD1X-Q5MR-DP7H9`) — note it down; when the game
loads again, matching codes prove nobody edited the save in between.

**Windows/WSL2 host?** `./run.sh` detects WSL and prints the exact
commands for YOUR setup — paste them once into an *admin* PowerShell on
Windows. Under the default NAT networking that's a port forward plus a
firewall rule (players connect to the WINDOWS machine's IP from
`ipconfig`, which run.sh prints when it can):

```powershell
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=8123 connectaddress=$(wsl hostname -I).Trim() connectport=8123
netsh advfirewall firewall add rule name="RetroMultiCiv 8123" dir=in action=allow protocol=TCP localport=8123
```

(Windows 11 alternative: set `networkingMode=mirrored` in `%UserProfile%\.wslconfig`
— run.sh detects mirrored mode and prints only the firewall rule, and
players connect straight to the address it shows. The WSL IP changes
across reboots under NAT — if players stop reaching you after a restart,
`netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0
listenport=8123`, then re-run `./run.sh` for a fresh add-line.)

## 5. Playing THROUGH the server, solo (optional)

`./run.sh` also hosts an authoritative game server. Open
**http://localhost:8123/client/?server=1** and the browser becomes a thin
client: every move is validated server-side, the game autosaves to
`saves/<gameId>.json` after every action, and killing/restarting the
server resumes exactly where you were (`./run.sh 8123 --game
saves/<gameId>.json`; add `--reset-seats` if you're rejoining from a
different browser or port). This is the foundation for LAN multiplayer —
for everyday solo/hotseat play, the plain URL is all you need.

## 6. Useful URL parameters

| Parameter | Effect |
|---|---|
| `?seed=12345` | fixed world (skips the setup screen) |
| `&civs=4&humans=2` | world size of the match, humans in front seats |
| `&civ=romans` | your civilization |
| `&size=large` `&difficulty=hard` `&combat=bestof3` | as on the setup screen |
| `?server=1` | play through the authoritative server |
| `?diag=1` | graphics diagnostics HUD |

## 7. If something looks wrong

- **Blank map / WebGL error**: try a hard reload (Ctrl+Shift+R); the game
  runs on WebGL1-only machines too (that's deliberate), but a crashed GPU
  process sometimes needs a browser restart.
- **Report a bug**: press **Shift+D** — it downloads a diagnostics
  recording that lets us replay your exact game, move for move. Attach it
  (and mention your URL). For `?server=1` games, the recording lives
  server-side in `saves/<gameId>.json` — send that file instead.
