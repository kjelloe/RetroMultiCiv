# For the designer ally — evening update + requests (2026-07-17)

Five items: two updates on your input landing, three requests.

## 1. Your AI-simulation framework is the program now

Your strategic-modes/metrics feedback landed verbatim-in-substance as
`specs/ai-modes-framework.md` and re-sequenced the whole AI lane:

- **v1 (SHIPPED today, marker-0043):** static heterogeneous stances — your
  "leader weights choose modes" direction, in its simplest form. ~35% of AI
  civs draw a **builder** stance (walls+garrison first, then economy,
  capital-only wonders, no offense). Measured on the shipped code: elim
  median stays in the user's 20–40% band at dg=30 UNCHANGED, builder civs
  build real economy, and **wonders complete** (6 across the acceptance
  seeds — rare like real Civ 1, but real; the AI built ZERO wonders ever
  before this).
- **The display name is "Perfectionist"** — the reviewer fact-checked the
  wiki's Civ 1 leader-traits table (six traits with per-leader membership);
  your archetype maps to Perfectionist, and Caesar/Catherine being
  trait-LESS in Civ 1 mirrors our absent-field=balanced encoding exactly.
- **The aggressive archetype is deferred, with measurement:** builders die
  before completing wonders next to any aggressor (wonders need 100+
  uninterrupted turns); a fixed aggressive fraction with random assignment
  makes eliminations hyper-sensitive to spawn geography (~1/5 seeds
  in-band). It returns with spawn-aware placement or D1 diplomacy's
  non-aggression — exactly your "world state can override" principle.
- **v1.5 (live):** your §A instrumentation — a per-AI strategic snapshot
  every 10 turns (assigned stance vs INFERRED behavior mode, threat,
  production histogram, topGoal) + outcome rows (victory type/turn,
  comebacks, lead changes, elimination timeline) in the soak telemetry.
  Your experiment waves 1–8 are the roadmap from here; wave 1
  (threat-relative garrison — your formula) is the designed answer to the
  defender-treadmill root cause we measured.
- **The human-benchmark gap is the primary metric** per your bottom line —
  Kjell's Shift+D recordings will seed the corpus.

## 2. Ruling applied: Civ mixing

Kjell ruled mixing Civ1/2/4 features is fine when deliberate — all design
verdicts now carry provenance labels (Civ1-authentic / Civ2-shape /
Civ4-shape / original). E.g. the 3-free-units-under-Monarchy shape was
RATIFIED as a labeled Civ2 borrow (and pinned by a test so nothing
"fixes" it silently).

## 3. REQUEST — 68 tech-discovery blurbs (new authoring task)

Kjell wants a small card when a tech is discovered: name + era + a line of
flavor + what it unlocks (unlocks/pedia links already exist). License
boundary means NO wiki sentences — we need **68 ORIGINAL one-liners** (1–2
sentences each, ≤200 chars, the same voice as your pedia-concepts pass).
Design: `specs/tech-discovery-card.md`. The list of tech ids is
`data/techs.json`. Any subset is useful; the card ships with whatever
exists (coverage gate tells us what's missing).

## 4. REQUEST — one substitution in your leader-attributes table

Your recommended favorite wonder for Caesar is **Sun Tzu's War Academy —
that's Civ 2**; it isn't among Civ 1's 21 wonders. Pick a Civ 1
substitute for the conquest identity (Colossus? Great Wall? — your call;
the table is otherwise unchanged and Great Wall is currently Frederick's).

## 5. SMALL FLAGS for your next pedia/concepts pass

- Two advice cards ('unit-selected', 'regent') are deliberately UNLINKED —
  'movement' and 'regency' concept entries would complete the advice→pedia
  map.
- Authenticity question found in audit: **Mysticism's temple-doubling and
  the Oracle's temple-doubling currently STACK to ×4** on a temple. Is
  that intended Civ 1 behavior, or should they cap at ×2? (Engine follows
  the wiki tables individually; the stack case is undocumented.)
- The Roblox pedia's 'recordings' entry diverges from the browser's
  (Theater button + resume code vs Shift+D download) — platform-correct,
  just keep both in mind if you revise that entry.
