# Late joining + pause-on-empty + eviction (user design 2026-07-24)

Multiplayer refinement, provenance `original` (server lifecycle, not a
Civ mechanic). Three user rulings taken at design time: (1) late
joiners take NEVER-HUMAN AI civs only in v1 — abandoned human seats
stay reserved for their original token, the rejoin promise holds
unconditionally; (2) middle pick = SECOND-STRONGEST (drop top and
bottom by score, take the strongest remaining; 2 candidates → the
weaker; 1 → that one); (3) eviction = SAVE + REJOINABLE (final
autosave, unlisted, dropped from registry; the game code revives it
via the existing on-demand save-reload).

Two lanes build to this one spec (rejoin-contract precedent):
**hardening** owns the server half (join/list/create dispatch + game
lifecycle are its docs/17 region; caps/eviction/pause are resource
management — its vocabulary); **helper** owns the client half (setup
UI, lobby messages, host option). Reason strings + list-row shape
below are the contract; neither lane invents fields the other
doesn't know.

## 1. Host option: `lateJoining` (default ON)

Per-game flag set at host time (host form + LAN lobby checkbox, and a
server CLI default `--no-late-join` to turn it off host-wide).
Effective only when the game is also listed publicly — the pair
(listPublicly AND lateJoining) gates everything below.

## 2. Find game lists running + paused games (late-join)

`listGames` today returns public OPEN lobbies. It grows RUNNING and
PAUSED games that have ≥1 eligible civ (alive, AI-controlled,
never-human) and lateJoining on. Additive row fields:
`state: 'open'|'running'|'paused'`, `turn`, `era` (the city-era band
id of the leading civ — shared/city-era.js, already pure),
`joinable: true|false`. The A51b announce heartbeat's
`openGames` count TWINS the listGames filter (noted duplication,
both sites carry the comment) — update BOTH; decide there whether
the public count includes joinable-running games (recommended: yes,
it is the "can I play on this server" number).

## 3. Takeover selection (server-side, deterministic)

Eligible pool: alive + AI-controlled + never-human civs of that game.
Rank by current score (engine score.js values, fog-free server-side):
- ≥3 candidates: drop strongest and weakest, assign the strongest
  remaining (= second-strongest overall).
- 2: assign the weaker. 1: assign it.
The join answer returns the assigned civ + a fresh seat token; the
seat becomes human from the next round (mid-turn AI actions of that
civ complete first). IMPLEMENTATION FLAG for the lanes: prefer a
PURE SERVER-SIDE seat-mapping flip (AI-drive stops issuing for that
player index). If anything in ENGINE STATE must flip (a per-player
human flag read by engine logic), that is an engine command + golden
window + fixture — escalate to the architect before touching it;
do not improvise a state write server-side (docs/07 tamper rules).

## 4. Client UI (helper)

- "Find game" button moves up beside "Start game", same font/size —
  the two read as equivalent entries (setup.js; the current
  setup-lan-btn styling splits them).
- Find-game rows show state: "in progress · turn N · era" and
  "paused · turn N" with a Join affordance; joining a running game
  shows "you take over <civ>" before confirm (the server names it).
- Lobby full-server message (contract reason `serverFull`): "This
  server is full of active games — wait for a slot, find another
  server, or join an ongoing game from Find game." (the three user
  options, verbatim intent).

## 5. Pause-on-empty (listPublicly AND lateJoining)

When the LAST connected human leaves a STARTED game: the game
PAUSES — no AI turns, no regency turns, no clock. (While ≥1 human
remains connected, XIV §30 seat-grace regency behavior is unchanged
for the other seats.) Resume: a human joins (late-join) or rejoins
(token), plays, and either ENDS THEIR TURN or re-enables AI regency —
only then does AI processing restart. Paused games persist on the
server as long as total games < the `--max-games` cap; they stay
listed as `paused` (joinable revives them). Server restart: paused
games are ordinary saves — restart-from-autosave + on-demand reload
already cover them; no new persistence machinery.

## 6. Capacity + eviction (Create Game at the cap)

On Create Game when games == maxGames:
- If ≥1 paused game exists: evict ONE (rules §7), then create.
- Else (all games active with humans): reject with reason
  `serverFull` (§4 message). Never evict an active game.
Revival-at-cap mirrors this: rejoining an evicted game's code when
full may itself evict a paused game; if none, `serverFull`.

## 7. Eviction ranking (which paused game stops first)

Evict in this order (first match goes):
1. EARLIEST ERA first — a game still in the Ancient band is evicted
   before Classical, …; Space-age games are kept longest. (Era =
   the same band id as §2's list rows.)
2. Tie → fewer ORIGINAL human players evicted first (1-human games
   kept shortest; many-human games kept longer).
3. Tie → longest-paused evicted first.
Evicted = final autosave + unlisted + dropped from the live registry;
the code stays rejoinable (§ ruling 3). Saves rotation
(--max-saves-mb) remains the only true deleter.

## 8. Tests (both lanes)

Server: takeover ranking (3/2/1-candidate cases + never-human
filter), pause = zero AI/regency advance while empty, resume-on-
end-turn, eviction order (era → humans → pause-age), serverFull
reject, evicted-code revival. Client: button placement smoke,
full-server lobby message, takeover-confirm naming the civ.
server-lan4/auto-takeover test files are the templates.

## 9. Out of scope (v1)

Abandoned-human-seat handover (ruled out — revisit post-v1 if rejoin
abandonment proves common); cross-server balancing; spectator
promotion to seats; Roblox mirror (its abandoned-game rules differ —
roblox-helper evaluates parity AFTER the Node shape ships).
