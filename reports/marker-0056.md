# marker-0056 — N11 window 3b: Leonardo's Workshop

The A63/N11 family completes. Leonardo's Workshop ships as a LABELED
Civ2 addition (the pre-spec fact-check established it was never a
Civ1 wonder; the roster grows 21→22 via a new WONDER_OVERLAY `added`
mechanism, since the Civ1 wiki extract by definition lacks the page).

Mechanics per the Civ2 article (stub-vs-detail doctrine): on each
tech acquisition by the wonder's owner, ALL eligible units advance
ONE step along their upgradesTo chain, free, with veteran status
DROPPED — through the same applyUpgrade machinery as 3a's paid
command (keepVeteran=false), so the two windows share one replacement
law (moves-min, no divergent twins). Determinism via the sortIds
idiom; no new state fields (R1 honored).

The structural piece with a future: engine/tech.js `grantTech` — the
R3 single tech-acquisition seam. processResearch routes through it
now; when goody huts (A4) or D-family tech trades land, they call the
same function and Leonardo fires automatically. The spec's
hut-granted-tech scenario case was honestly deferred (huts don't
exist yet and scenarios drive commands only) — scenario 039 pins the
equivalent property (a pre-existing tech enables an upgrade at a
grant trigger, one step NOT two despite the end tech being known,
veteran dropped, non-owners untouched), and the hut-as-trigger pin
lands with A4. Deviation ratified.

## Goldens — the honest signature

Leonardo is DORMANT in the soak (probed: no AI builds the 400-cost
wonder in 400 turns — consistent with the tech-pace measurements that
sized ending #4). So the re-record is a rulesetHash-only shift: soak
0xb7fd4fb3/0xb4372e67/0x22d95aac/0xb9f5b894, natural 0x7508bded
(rounds + winner UNCHANGED), A82a + 002 + witness re-recorded,
scenario 039 = 0x849ca221 cross-language (PORTED 38), wonders.json +
rules.json checksums re-pinned. JS==Luau throughout. Suite 534/534;
pins synced at the boundary.

## Family status

A63/N11 fully shipped: paid upgrades (veteran carries) + Leonardo
(veteran drops), 12 provenance-labeled chain rows, one shared
machinery. Next in the stream per the night order: N12 A92 debug
commands (unblocks Roblox R17 and gives the hut-trigger pin a
command-driven path when A4 arrives).
