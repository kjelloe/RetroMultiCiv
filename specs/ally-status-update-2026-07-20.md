# To our designer ally — where your deliverables landed (2026-07-20)

Cover note for relay. Both of your latest deliveries are in the pipeline; here's
the honest disposition of each, plus two things you'll want to know about.

## Your unit + building blurbs — SHIPPED ✅

All 49 (28 units + 21 buildings) id-verified against the data files and merged
into the game (marker-0063, already in the main line). They appear in the
browser Civilopedia and build tooltips exactly like your 68 tech blurbs; the
Roblox client picks them up from the same data table. Nothing bounced — the
whole set went in verbatim.

## Your city-name expansion (+114 names) — VERIFIED, QUEUED

The full 14-civ append set passed the collision audit (your Thebes/Lyons/
Londinium/Khanbaliq/Strasbourg calls all held up) and is staged as work item
11b. It's queued behind one engine-lane item ahead of it — names touch the
city-spawn path, so they ride the same verification train as engine changes
(a small hash re-record with a "nothing else moved" proof). No action needed;
they'll be in the next batch.

## FYI 1 — a public test server is going up

We're standing up a small public test box at `multiciv.kjell.today` (8 civs,
500-turn games). Once it's live you'll be able to playtest your own blurbs,
names, and glyph work in a real browser session with nothing to install —
we'll send the link when it's open.

## FYI 2 — the AI now builds toward a space victory (and a design question)

The late-game AI work you'd enjoy: AI civs now actually commit to the space
race — they build the Apollo Program (previously: never, in 42 measured
games) and spaceship parts. What they don't yet do is *launch* within a
normal-length game: the 600-shield Apollo build lands around turn 800 and the
part chain doesn't close by turn 1200. We're measuring an extended horizon
before deciding anything.

One authenticity note we've already locked (Civ1-authentic): no gold-rushing
Apollo — wonders can't be bought in Civ 1. The real 1991 accelerant was the
caravan trick (start a building, switch to the wonder, ship caravans in),
which the game models for human players.

**Optional, if you have an instinct:** in *your* ideal game, should an AI
space victory be a live threat inside a normal-length game, or is "the AI
reaches for the stars but only gets there in marathon games" the authentic
shape? No wrong answer — we're gathering views alongside the measurements.

— The RetroMultiCiv team
