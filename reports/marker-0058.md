# marker-0058 — N13/A4: goody huts + the barbarian leader ransom

The night's widest window (26+ files, both engines) and its first
genuinely behavioral golden move. Grounded in the reviewer's
pre-spec fact-check: Civ1 villages have FIVE outcomes — docs/04's
four-outcome sketch is superseded — and the advanced tribe (a free
city) is real.

## What plays differently

Villages dot the map (1-in-40 land tiles, never on or beside a
start). A ground unit entering rolls ONE eligibility-gated weighted
draw: advanced tribe (a new city on the tile, via a createCityAt
seam factored from foundCity), a free advance (never on turn 1 or
after 1000 AD — wiki gates verbatim; routed through grantTech so
Leonardo fires, pinned by scenario 042), 50 gold, mercenaries (a
free cavalry or legion homed to the closest OWNED city — foreign or
absent closest = homeless, no support), or a barbarian ambush
(era-tier units on adjacent tiles; suppressed near cities and
against civs with no city yet). Air or barbarian entry destroys the
village with no reward. Working the tile does NOT consume it
(explicitly unlike Civ2).

One in four inland barbarian spawns now brings a LEADER stacked
under its escort. The reviewer's R1 catch made the ransom real:
without an exemption, our Civ1 open-ground stack-annihilation rule
would kill the leader with its escort and the ransom would be dead
code. As shipped: the leader survives while escorted (bestDefender
never picks it, casualties filter it out), and killing it ALONE
pays the wiki's exact 100 gold — scenario 043 pins the two-attack
sequence.

## A real bug caught in-window

Sim telemetry (seed 7, turn 31) surfaced "duplicate tech": a hut
advance granting the tech a player was CURRENTLY researching, which
processResearch then completed again. Fixed at the single grantTech
acquisition seam — acquiring a tech finishes in-progress research of
it, bulbs carry. The pinned soak seeds never hit the case, so those
goldens are byte-identical before/after the fix.

## Pins and goldens

Scenarios 041-044 cross-language (PORTED 43). Full re-record for the
rulesetHash + map + behavioral ripple: soak
0xd5c51a95/0x61028ca1/0xc9d946f2/0x942e20a1, natural r395/p2/
0x52aebef8, A82a map anchors 435a5db9/0733cc0e/b3f5ab45/46b9d0c8,
002 0xf63b7607, witness re-recorded, checksums 8/8. Honest
signature: villages ARE consumed and leaders DO spawn in the soak,
yet rounds/winner converge unchanged. JS==Luau verified including
the FULL luau soak + natural. Suite 551/551; pins synced.

## Follow-ups routed

The client half (hut prop + gallery row, barbleader silhouette
[recipe shipped in-window — the renderer coverage gate forced it],
hutEntered/ransomPaid toasts + own-seat fog turnlog rows) goes to
the helper with the N11 upgrade-button slice. docs/04 §5 carries the
superseded-by note; docs/01 gains the huts section.
