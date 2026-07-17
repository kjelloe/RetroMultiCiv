# Game verification code — design & implementation

Status: IMPLEMENTED (A11, 2026-07-12). Golden anchors (phase-5
cross-engine, doubly derived — helper implementation + architect's
independent Python): for the statehash golden object {b:2,a:[1,"x",true]}:
codeLo 0x30db1e29 (= the statehash anchor), codeHi 0xa687b72d,
gameCode AD1X-Q5MR-DP7H9. One open fix: the joined reply must carry
gameId (server-mode Shift+S/D 404 on resumed games).

The feature: a short alphanumeric code shown
to every human player whenever a game pauses (save-and-quit, crash, game
over), and again on load — so players can verify the save wasn't modified
between sessions. Mainly for multiplayer (phase 3–4: the HOST holds the
save; the other players hold the code), but equally useful in hotseat
(whoever keeps the save file can't quietly edit it).

## 1. What the code is

A **64-bit digest of the canonical game state**, displayed as 13
Crockford-base32 characters in groups: `K7Q2-9FMX-3TZB2`. Built from the
machinery we already trust:

```
canon  = canonicalize(state)              // shared/statehash.js, unchanged
codeLo = FNV-1a-32(canon)                 // the existing hash, existing anchors
codeHi = FNV-1a-32(canon REVERSED)        // same STANDARD basis/prime, iterated
                                          // last char to first — a genuinely
                                          // different function of the input
                                          // with zero invented constants
code   = base32crockford(codeHi * 2^32 + codeLo)   // integer math via mul32
```

(An earlier draft said "alternate basis/prime pair" — superseded: there is
no second standard FNV-32 pair, and invented constants would weaken the
independence claim. Reverse iteration is authoritative; A11 pins it.)

- Hashes ONLY `state` — the same object across quicksave, file save, and
  the server envelope, so all save kinds yield the same code, and the
  JSON round-trip is already proven hash-stable by tests.
- Two independent FNV passes instead of one, because the threat model
  demands it (§2). Both passes are the same integer-only algorithm the
  Luau port must implement anyway — no new cross-language burden. New
  module `shared/gamecode.js` (usable by client, server, and the phase-5
  twin) with golden vectors pinned like statehash's `0x30db1e29` anchor.
- Crockford base32 (no 0/O or 1/I ambiguity): readable aloud over voice
  chat, writable on paper.

## 2. Threat model — honest version

- **32 bits is not enough**: `rngState` is a free 32-bit field, so a
  cheater could edit gold and then grind rngState (~2³¹ tries, minutes
  offline) until the old 32-bit hash matches. That is why the code is 64
  bits from two independent passes — grinding one free field can no
  longer satisfy both.
- **64 bits is tamper-EVIDENT, not cryptographically binding.** Against
  friends and honest mistakes (the actual audience) it is decisive.
  A cryptographic digest (SHA-256) would be stronger but breaks the
  Luau-portability story for no practical gain at this trust level.
  Document this plainly in the help panel text.
- The verification is social: each player NOTES the code independently.
  The save holder cannot alter what the others wrote down.

## 3. When the code is shown

1. **Save**: Shift+S / F5 show a PERSISTENT dialog (not the 5-second
   banner): "💾 Saved turn 57 — game code `K7Q2-9FMX-3TZB2`. Every player
   should note this code." In hotseat, the next hand-off screen also
   carries "code as of last save: …" so the player who wasn't holding the
   keyboard sees it too.
2. **Abrupt end**: the existing window error handler additionally
   quicksaves the last coherent state and shows its code in the error
   overlay: "state code `…` (autosaved)".
3. **Game over**: the victory/defeat banner includes the final code — a
   verified-game stamp for records and rematches.
4. **Multiplayer (phase 3–4)**: the server puts the code in the save
   envelope, includes it in every `joined` reply, and broadcasts
   `{t:"code", turn, code}` on autosave and shutdown. Clients show it on
   the disconnect screen — that's the "write this down" moment.

## 4. Validation on load / rejoin

- Loading (any kind) shows a persistent banner: "📂 Loaded turn 57 — game
  code `K7Q2-9FMX-3TZB2`. Compare with what you noted." Players compare
  verbally — that's the core mechanism, zero infrastructure.
- **Auto-compare where it's free**: the client stores the last-seen code
  per gameId in localStorage; on load/rejoin it compares and shows either
  "✓ matches your last session" or a red "⚠ code differs from your last
  session (yours: X, loaded: Y)". Strong for multiplayer reconnect (each
  player's own browser remembers); weaker on a shared hotseat machine
  (the save holder can also edit localStorage) — the verbal comparison
  remains the hotseat backstop.
- **Ruleset lineage (`state.rulesetHash`, specs/ruleset-compat-policy.md).**
  A game is pinned at creation to the statehash of the ruleset that produced
  it. Server `--game` load and client load REFUSE a mismatched save by
  default (a mid-game rules upgrade would diverge silently); `--allow-ruleset-
  drift` (server) or a client confirm overrides. The pin is never rewritten on
  load, so a drift-overridden game KEEPS its original `rulesetHash` — the pin
  is itself the honest lineage marker (the game code, which hashes the state
  including it, and any report show what the game was actually created under,
  not the running build). Omit-safe: crafted/older saves without the field are
  exempt. `tools/replay.js` warns (never refuses) on a mismatch.

## 5. Implementation slices (when green-lit — helper-friendly)

1. `shared/gamecode.js` — alternate-basis FNV pass + base32 + golden
   vectors test (these become phase-5 cross-engine anchors, like the
   statehash anchor).
2. Client hooks: saves.js (save/load dialogs + localStorage compare),
   hud (game-over line), main.js error overlay, handoff.js last-save
   line. Client-only, golden-safe.
3. Server: envelope field, `joined` reply, code broadcast — one small
   addition to game.js/protocol.js + tests. Golden-safe.
