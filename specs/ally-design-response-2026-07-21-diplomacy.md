# Designer-ally response — D4–D6 diplomacy presentation (VERBATIM, relay via user, 2026-07-21)

Answers to specs/ally-ask-diplomacy-2026-07-21.md. All four questions ruled
+ an unrequested (welcome) player-facing vocabulary standard. Routing:
specs/d456-diplomacy-impl.md consumes this as the presentation layer;
counter-offers explicitly OUT of 1.0 (plan-version2 entry); the §33 envoy
modal (helper queue) must follow the five-beat audience frame below.
Provenance per the ally: original presentation over Civ1-authentic rules.

---
### Diplomacy presentation verdicts

The through-line for D4–D6 should be:

> **Diplomacy is not a hidden modifier screen. It is a record of promises, pressure, and consequences between named civilizations.**

The rules may remain Civ1-authentic; the presentation should ensure players always understand the human meaning of those rules.

**Provenance:** `original` presentation layer over `Civ1-authentic` diplomacy mechanics.

### 1. The audience: make the envoy feel like a political encounter

An incoming envoy should use the same basic rhythm as a technology discovery, but with tension rather than celebration:

1. **Arrival:** faction-colored envoy seal/glyph enters over a subtly dimmed map.
2. **Speaker:** leader name, civilization, and an immediately legible diplomatic posture.
3. **Terms:** one clean, rules-derived statement of what is offered or demanded.
4. **Consequences:** a compact factual summary—peace ends war, tribute transfers a stated amount, exchange grants named advances.
5. **Deliberate response:** `Accept`, `Reject`, and where appropriate `Consider Later`.

Posture via THREE-part combination (no portraits): envoy glyph treatment
(Haughty = tall angular crest / Formal = balanced seal / Conciliatory =
open downward motif) + faction-color framing + a short posture line
("Caesar speaks from strength." / "Hammurabi seeks a settlement." /
"Elizabeth offers terms as an equal."). Tone-reporting only — never
"they are weak" state leakage.

COUNTER-OFFERS: DO NOT add to 1.0. Take-it-or-leave-it audiences; a later
`original` negotiation layer only with full AI valuation + multiplayer
timing + a clear player reason.

### 2. Reputation: a public record, not a mysterious score

Relations panel = three layers per civ: current STATUS chip (At Peace / At
War / Ceasefire) + REPUTATION seal-badge with plain-language label +
HISTORY (one-line latest event + expandable timeline). Scale: Honorable /
Reliable / Uncertain / Dishonored / Treacherous. Icon system = CRACKED
TREATY SEAL (whole → lightly fractured → split → separated halves).
Faction color identifies WHO; the seal says whether promises carry weight.
History must be rules-derived and event-backed, answering "at war since
when and why" directly.

PLAYER breaking a treaty: brief BLOCKING confirmation BEFORE the act
("BREAK TREATY? … [Keep the Treaty] [Break Treaty and Declare War]"),
then a non-blocking but prominent consequence card after ("TREATY BROKEN …
Your reputation has suffered. [View Relations] [Continue]"), then durable
surfacing in panel/history/log/future envoy framing. Never surprise the
player THAT there was a consequence.

HISTORIAN: yes, sparingly — landmark judgments only (first betrayal by
anyone; shift into Dishonored/Treacherous; recovery threshold if rules
support one; major peace after long war). Voice factual and grave:
"The courts of the world now question Rome's promises."

### 3. The Senate: warn first, then let the refusal land

BOTH a pre-warning and a blocking proclamation. Pre-warning at
declaration ("THE SENATE MAY OBJECT … [Ask the Senate] [Cancel]") without
prematurely revealing a guaranteed outcome; if refused, a dignified
blocking proclamation ("THE SENATE REFUSES WAR — 'The people will not
support this declaration.' … [Understood]") + a permanent history entry.
Three rage-quit safeguards: warn before the action is spent; state the
result plainly; return immediate alternate agency. NO "try again" button —
the Senate is an institution, not an RNG gate.

### 4. LAN treaties: an envoy can wait, but it must never disappear

Durable PENDING ENVOY state from send until resolved/withdrawn/expired:
"ENVOY TO BABYLON — Peace offer pending. Their court will consider it on
Babylon's turn. Sent on turn 118. Expires after turn 121. [View Offer]
[Withdraw]". Full lifecycle table (sent → awaiting → their-turn audience →
outcome cards both sides → expiry). EXPIRY: yes — TWO RECIPIENT TURNS
initial recommendation, exact expiration turn stated, sender may withdraw,
expiry is NOT rejection/insult unless rules say so, recorded neutrally
("Peace offer to Babylon expired unanswered"). Disconnects: standard
turn/disconnect handling, no parallel timeout system.

### Player-facing vocabulary (consistent across modal/panel/log/historian)

At Peace / At War · Treaty active since [year] · War began in [year] ·
Treaty broken by [civ] · Offer pending · Offer expires on turn [N] ·
Offer accepted / rejected / expired unanswered · Reputation: Honorable …
Treacherous · The Senate refuses war.
