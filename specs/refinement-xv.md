# Refinement XV — playtest batch (2026-07-22)

Source: user playtest on the entry-flow/difficulty build. 13 items,
triaged by the architect; queue tags reference these section numbers.
Routing key: **[helper]** client/UI golden-neutral · **[engine]**
bugfixer golden lane · **[server]** golden-neutral server runtime.
Queued AFTER the current XIV backlog per the user's instruction.

## §1 Top bar: +8ch width, tax/sci/lux ICONS [helper — xv-topbar-icons]

The top bar is ~8 characters too narrow for tax/sci/lux. Replace the
text forms `T50 / S50 / L10` with the same icon vocabulary the research
panel already uses (money / bulb / luxury icons) + the number. Widen the
bar accordingly.

## §2 Research panel suspends tile hover [helper — xv-research-ux]

The §24 tile-yield hover keeps firing under the open research panel.
Suspend map-tile hover cards while the research panel is open (the
panels module knows open state; hover-card gains a suppress hook).

## §3 "View Technology Tree" button placement [helper — xv-research-ux]

Misplaced today; move to the LOWER LEFT corner of the research panel.

## §4 Tech-tree panel exit buttons [helper — xv-research-ux]

Two additions in the tree panel's lower bar: lower-left **"Back to
technology list"** (returns to the research panel), lower-right
**"Close research"** (closes BOTH tree and research panel).

## §5 Jungle tile visual — tropical, not spruce [helper — xv-jungle-tile]

Jungle reads too much like forest. Rework the jungle tile prop shapes
(renderer/three assets/props): tropical rainforest silhouettes — tall
slender trunks (relative height ABOVE forest trees), broad flat canopy,
buttress-flared bases, no conical spruce forms. Verify with
debugging/gallery.html screenshots (forest vs jungle side-by-side must
be instantly distinguishable at zoom 4-6). Render-only, golden-neutral.

## §6 Research-complete popup: pedia hover overlays [helper — xv-popup-pedia]

In the discovery/research-complete popup, every mentioned building,
unit, wonder, or concept gets the §22 hover treatment — the shared
hover-card entity summary from the civilopedia (name→{id,kind} resolver
already exists from §22; reuse, don't fork).

## §7 Size-1 settler completion: warn modal + CAPITAL EXEMPTION [engine + helper — xv-settler-modal]

Two parts:
- **Client modal** (helper half): when a size-1 city's settler build
  COMPLETES, an intercepting modal warns "this will disband <city>" with
  **Go ahead** / **Change build** (change = re-open the build picker,
  production stays banked). Shape note: completion happens at turn wrap,
  so the clean client implementation is a PRE-WRAP intercept — when the
  player ends the turn and a size-1 city would complete a settler, the
  modal fires BEFORE the endTurn command is sent (the engine stays
  untouched by the modal path).
- **Engine rule** (bugfixer half, GOLDEN MOVE + provenance): the CAPITAL
  can never disband — a size-1 capital completing a settler creates the
  settler and the city REMAINS (architect lean: pop stays 1, no pop
  deduction — the capital absorbs the cost; flag if the fact-check
  says Civ1 handled this differently). Label: needs reviewer
  fact-check vs the dump — likely `original` or `Civ2-shape`; the §40
  authentic rule stays the default for non-capitals. Fixture-first,
  twins, scenario update if 040-family pins move.

## §8 Beeline interrupt: manual pick first, then resume [helper — xv-beeline-interrupt]

With a beeline target set, manually selecting a different tech in the
research panel researches THAT tech first, then the beeline resumes
(client-side: the beeline driver in shared/beeline.js + tech-tree state
already issues normal setResearch — add an interrupt slot, golden-
neutral).

## §9 First-contact event: goto-location icon [helper — xv-contact-zoomto]

The first-sight-of-another-civ turnlog entry gets the 🔍 zoom-to icon
the city-completed-building event has. Composes with the queued XIV §35
zoom-to item (#21) — build together if that item is still open when
this one is reached.

## §10 Goto stops on enemy block [helper — xv-goto-stop]

A goto whose route becomes blocked by an enemy unit CANCELS at the
block and returns control to the player (no silent re-route, no
repeated bump). Client goto driver (session goto stepper); golden-
neutral (it just stops issuing moves).

## §11 AI/regency civil-disorder playbook [engine — xv-ai-disorder]

When a city enters disorder, the AI (and regency) should walk the human
playbook, in order: (1) re-assign a worked tile → entertainer and check;
(2) buildable happiness building available? consider it; (3) raise
luxuries if the treasury allows — COMPUTE how long a net gold loss is
sustainable (treasury / deficit rate) and accept a bounded deficit
window; (4) better government available? consider revolution; (5) last
resorts — rush-buy the happiness building, or deliberately starve the
city down one pop. Engine golden move; composes with §13 deficit ladder
+ §14 treasury doctrine + the happiness module. Design pass with
impl-confirm before build (this is a real AI slice, not a patch).

## §12 End-score "undefined" civ name [helper — xv-endscreen-name, BUG]

"Score victory — the year 2100 AD arrived, and the undefined had built
the greatest civilization." The winner's civ adjective/name lookup
fails — likely the fog-filtered server view (rival identity fields
absent) or a civs.json adjective lookup on a missing key. Fix with the
server-view trap in mind (memory: server view differs from local);
fall back to the civ display name, never print 'undefined'.

## §13 Shift+S / Shift+D in ?server=1: "No server save yet — 404" [server — xv-server-save, BUG]

On a live server game, the save download 404s until the first autosave
exists. Fix: the save endpoint snapshots the CURRENT authoritative
state on demand (write-then-serve, same envelope as autosave) instead
of serving only the last periodic autosave. Shift+D in server mode
should download the same server save (client diag is a stub there —
keep the current fallback but make it succeed). server/game.js /
report.js path; golden-neutral; server tests extend.

## Routing summary

- **helper** (after the XIV backlog): xv-endscreen-name (bug, first of
  the XV set) → xv-research-ux (§2+§3+§4) → xv-topbar-icons (§1) →
  xv-popup-pedia (§6) → xv-beeline-interrupt (§8) → xv-goto-stop (§10)
  → xv-jungle-tile (§5) → xv-contact-zoomto (§9, w/ #21).
- **bugfixer** (after the current engine queue): xv-server-save (§13,
  server-only, can interleave anytime) → xv-settler-modal engine half
  (§7, needs fact-check first) → xv-ai-disorder (§11, design pass +
  impl-confirm).
- **reviewer**: fact-check ask — Civ1 behavior for a size-1 CAPITAL
  completing a settler (§7); feeds the provenance label.
