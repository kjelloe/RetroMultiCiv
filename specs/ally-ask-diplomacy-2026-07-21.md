# To our designer ally — four diplomacy questions (design, not rules)

(Shareable as-is. Context: diplomacy phases D4–D6 are next in design after
the space-race AI. The Civ 1 *rules* are already recovered from the wiki —
tribute mechanics, senate triggers, espionage cost formulas — so none of
this asks what the game should compute. All four ask how it should FEEL
and READ. Your envoy modal groundwork is relevant: incoming offers already
get a blocking Accept / Reject / Consider-later window.)

## 1. The audience — the dramatic frame for negotiation (D4)

When a rival's envoy arrives with terms (peace, tribute demand, tech
exchange), what should the MOMENT be? You gave the tech discovery a
sequence (reveal → name → consequence → deliberate exits). An audience is
the social equivalent: leader glyph, their tone (haughty demand vs humble
plea?), the terms, your options. Questions:
- Should the rival's POSTURE be visible (strong civ demands, weak civ
  begs) — and how, without a portrait art budget (we have procedural
  glyphs + faction colors)?
- Counter-offers: in 1.0 we can keep Civ 1's take-it-or-leave-it, or add
  ONE counter round. Which serves the fantasy better at this scope?

## 2. Reputation legibility (D5 — the one we care most about)

Our acceptance test is already yours in spirit: a player must be able to
answer "are we at war, since when, and why" at any moment, and a betrayal
must have VISIBLE consequences. The engine will track reputation; the
design question is how trust READS:
- What does "this civ breaks treaties" look like at a glance in the
  relations panel — iconography, a word-scale (Honorable…Treacherous), a
  history line?
- When YOU break a treaty, how loudly should the game tell you the world
  noticed? (A quiet log line undersells the ally-designed tension; a
  shaming splash may overdo it.)
- Should the historian narrate reputation events ("the world no longer
  trusts the word of Rome")?

## 3. The senate moment (D5)

Under Republic/Democracy the senate can overrule a war decision. This is a
famous emotional beat (players HATED and loved it). How should it land —
a blocking proclamation ("The Senate refuses your declaration!"), a
pre-warning when you're ABOUT to be blocked, both? Where is the line
between authentic frustration and modern-player rage-quit?

## 4. Human-to-human treaties over LAN (D4)

Two humans negotiating peace/tribute in a multiplayer game, turn-based:
the offer sits until the other player's turn. What does the OFFERING
player see meanwhile (pending badge? envoy-in-transit fiction?), and how
do we keep an ignored offer from feeling like a bug? One idea on the
table: offers expire after N turns with a visible "your envoy returned
unanswered" — better ideas welcome.

---

NOT asked (already settled): tribute/exchange mechanics, senate trigger
rules, espionage costs and once-per-city limits (wiki-recovered);
mission determinism (our replay constraint); which slices are 1.0
(all of D4–D6, ruled). Provenance labels per the house rule as always.
