# SO15 SoundId curation worksheet (roblox-helper, polish-pair queue#1)

**Hard platform constraint:** the real values are Roblox audio Asset IDs, obtainable ONLY from
Studio (Toolbox → Audio → copy Asset ID) under a logged-in account — an agent cannot browse the
Toolbox or mint valid `rbxassetid://` values, and guessing numeric IDs would wire wrong/invalid
audio. So this is the maximal agent-executable deliverable: the complete cue→trigger→character
worksheet the user fills in Studio. Fill each AFTER cell with `SOUND_ASSET["<cue>"] =
"rbxassetid://<id>"` in `roblox/src/client/Sound.client.luau` (the table is keyed by
`SoundMap.SOUND_IDS`; empty = silent no-op today).

- **BEFORE (all cues):** `""` — provisional/silent (SOUND_ASSET initialised empty for every cue).
- **Volume:** default 1; `combat-distant` & `capture-distant` already set to 0.4 (CUE_VOLUME) —
  keep distant cues quieter than own-seat cues.
- **Scope:** own = only the viewer's own event; world = everyone hears (public news).

| # | cue | fires when (soundForEvent / celebration path) | scope | suggested character |
|---|-----|-----------------------------------------------|-------|---------------------|
| 1 | combat-win | your unit wins a battle (also ransomPaid) | own | short triumphant sting / blade-clash-then-fanfare |
| 2 | combat-loss | your unit loses a battle | own | dull thud / falling minor tone |
| 3 | combat-distant | a battle you're not in resolves | world | muffled distant clash (quiet, 0.4) |
| 4 | capture-win | you capture a city | own | rising fanfare + crowd |
| 5 | capture-loss | you lose a city | own | somber horn / bell toll |
| 6 | capture-distant | a city changes hands elsewhere | world | distant bell (quiet, 0.4) |
| 7 | found | you found a city (also hutEntered) | own | gentle chime / settling "ta-da" |
| 8 | grow | your city grows a pop | own | soft positive blip |
| 9 | starve | your city starves | own | low mournful tone |
| 10 | build | your city finishes a building (also tradeRoute/unitUpgrade) | own | wooden hammer-tap done-chime |
| 11 | disorder | your city falls to disorder | own | discordant murmur / alarm |
| 12 | order | your city recovers from disorder | own | calming resolve tone |
| 13 | tech | you discover an advance | own | bright discovery shimmer |
| 14 | wonder | ANY wonder completes (world news) | world | grand orchestral hit |
| 15 | wonder-triumph | YOUR wonder completes (splash celebration) | own | bigger, sustained triumphant fanfare (larger than #14) |
| 16 | age | the world enters a new age | world | epochal swell / choir |
| 17 | defeat | YOU are defeated | self | game-over descent / heavy toll |
| 18 | elimination | another civ is eliminated | world | distant final horn |
| 19 | barbarian | barbarians spawn | world | ominous drum / horn |
| 20 | victory | YOU win the game | winner | full victory fanfare |
| 21 | gameover | the game ends, you didn't win | else | neutral closing tone |
| 22 | government | you change government | own | civic transition chord |
| 23 | regent | your seat's regent takes a turn | own | subtle robotic/neutral tick |
| 24 | ship-part | you build a spaceship part | own | mechanical assembly beep |
| 25 | ship-launch | a colony ship launches (world) | world | rocket ignition roar |
| 26 | ship-down | a spaceship is destroyed | world | descending explosion |
| 27 | discovery-ancient | tech advance into the ANCIENT era (celebration overlay) | own | primitive/tribal motif |
| 28 | discovery-classical | advance into the CLASSICAL era | own | lyre/horn classical motif |
| 29 | discovery-industrial | advance into the INDUSTRIAL era | own | steam/gear industrial motif |
| 30 | discovery-modern | advance into the MODERN era | own | electronic/modern motif |

**After curation:** re-run `debugging/soundboard.html` (served under `--debug`) to audition every
cue; the roblox `SOUND_IDS` rows appear automatically. `roblox/check.sh` gate 27 only pins the
CATALOGUE (cue names) parity vs `client/ui/sound-map.js` — it does NOT check Asset IDs, so filling
IDs stays golden-neutral and gate-neutral. No engine/state impact.

**Residual owner:** the user (Studio Toolbox audio-asset step). This worksheet closes the
agent-executable half of SO15 curation.
