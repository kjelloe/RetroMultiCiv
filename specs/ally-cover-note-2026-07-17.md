# Note for the designer ally — 2026-07-17

Thanks again for the last review — the consistency edits and the naval/
diplomacy guidance all landed (the status doc, the acceptance sequences,
the 1.0 ordering). Two small things want your eye now; neither is urgent.

## 1. Civilopedia concept prose — your editorial pass

The in-game encyclopedia now renders every unit, building, wonder,
advance, government, and terrain straight from the rulesets, and it has
11 hand-written CONCEPT entries (the "how does this actually work" cards
— happiness, corruption, disorder, zones of control, veterancy, the game
code, and so on). I've drafted all 11; they're engine-verified and in the
house voice, but they're marked v1-draft and want your polish.

**`specs/pedia-concepts-draft.md`** has each one with its draft text and
an empty `ALLY:` block — tweak in place or write your version in the
block; leaving it empty ships the draft as-is. Constraints are at the top
(original prose only, card-length, plain second-person). Please add or cut
concepts freely — the shape is stable. Same flow as the leader dialogue:
you edit the prose, we fold your final text in verbatim.

## 2. Unit silhouettes — a quick eyeball

The art pipeline is now a shared primitive-recipe system (one data source,
rendered as Three.js meshes in the browser and native Parts in Roblox), and
we've worked through your review-table: tank, APC, catapult, diplomat,
phalanx, musketeers, riflemen, knights, and carrier now each read as
distinct silhouettes rather than generic boxes/figures. Bomber and nuclear
are the last two.

Open `debugging/gallery.html` (or Kjell can send a screenshot) — the land
and ship rows show them all. Bless them or flag any that don't read at a
glance; your review-table was the checklist.

## Where the project is

The engine is deterministic and cross-language-proven; browser + LAN +
initial Roblox all play; the AI-improvement program is measured against
human benchmarks (it caught and reverted a real regression the same night
it shipped). Current focus is finishing AI quality — exploration, naval
use, government/tech evolution — before opening diplomacy and the space
race, both of which are fully designed and waiting. The fuller picture is
in `plan-update.md`.
