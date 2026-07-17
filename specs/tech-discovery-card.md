# Design check: tech-discovery card with article text + unlocks

Advisory from the reviewer, user-requested. Question: show a small wiki
article text when a tech is discovered, including the units/buildings/
wonders unlocked.

## License answer first (the hard part is settled policy)

Actual WIKI article text cannot ship: the license boundary (CLAUDE.md /
docs/18) forbids wiki SENTENCES anywhere in the repo or client — CC BY-SA
prose. Close paraphrase is equally out. What CAN ship: facts (names,
numbers, unlock relationships — all already committed) and ORIGINAL prose.
If the user ever wants literal wiki text it would mean shipping CC BY-SA
content with attribution UI — recommend against; the original-prose route
below costs one content pass and keeps the boundary intact.

## What already exists (verified at f69ddfd — this is ~80% built)

- techDiscovered event; turnlog.js:275 already prints "X discovered —
  unlocks A, B, C" from catalog-text.js techUnlocks (units+buildings+
  wonders per tech, built from the rulesets) and flashes a research prompt.
- pedia.js (A58b) renders a full entry per tech/unit/building/wonder from
  the rulesets, and ctx.pedia.openTo(cat, id) deep-links (advice.js's
  "📖 More" pattern).
- historian.js (A75) is the transient-interstitial precedent; ff-overlay
  the other. endscreen/theater own the full-screen tier.
- What does NOT exist: any per-tech flavor PROSE (pedia tech entries are
  stats + links only), and a discovery card UI.

## Proposed shape (client-only, golden-neutral)

1. `TECH_BLURBS` — 68 ORIGINAL one-liners (1-2 sentences each, the
   advice.js "short + original" standard), authored content — a natural
   ally task (they wrote the diplomacy line sets). Lives beside
   pedia-concepts.js as pure data; the pedia tech entries gain the same
   line, so the card and the pedia stay one source.
2. `ui/discovery-card.js` — on techDiscovered for ctx.HUMAN: transient
   card (historian-precedent, one at a time, click-through or ~6 s):
   tech name + era, the blurb, the unlock list as PEDIA LINKS (openTo
   per unlocked unit/building/wonder — the data-goto pattern), and the
   existing choose-research prompt folded in so it does not double-flash
   with turnlog's flashMessage. localStorage mute toggle (advice
   precedent). Hotseat: keyed to ctx.HUMAN per event, never cached.
3. Roblox parity: one docs/13 row — the card consumes catalog-text +
   TECH_BLURBS (both pure data→string), only the card chrome re-authors.

## Verification

UI-lane case: scripted e2e discovers a tech, asserts the card shows the
blurb + unlock links and a link opens the pedia entry; goldens untouched
(render-only). Blurb table gets the coverage-gate pattern: 68 entries,
every techs.json id present, no entry over ~200 chars.

## Cost

The only real work is content: 68 original lines (ally) + ~100-line card
module + a docs/13 row. No engine, no state, no golden movement.
