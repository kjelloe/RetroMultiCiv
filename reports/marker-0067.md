# marker-0067 — ws-timeout connection fix: busy-tolerant heartbeat (#1732)

**Tag:** `marker-0067` → `25569c4`
**Class:** gamesim-golden-neutral (server/ops only — no engine/data/luau/goldens).
**Breaking:** no. Safe merge.

## Delta since marker-0066

The connection-side fix for the turn-2623 ws-timeout the user reported — a long hosted
game dropped the socket. Delivered by the hardening lane on branch `hardening-heartbeat`,
landed by **cherry-pick** (not FF: the branch forked before marker-0066, so a merge would
have reverted the crash-resilience files — sim-runner #1869 caught this).

### What it does
A **busy-tolerant heartbeat**: the server no longer falsely reaps a live client
connection when the event loop is briefly blocked (a long AI turn-chain at extreme
scale stalls the loop past the old heartbeat window, so the server treated a healthy
socket as dead). The heartbeat now tolerates a busy loop instead of dropping the peer.

This is the CONNECTION half of the turn-2623 diagnosis. The remaining half — the AI
turn-chain itself blocking the loop past the heartbeat window (yielding within the
chain) — is separate hardening work (triage findings in #1863); this marker stops the
false reap so the client survives the stall.

## Verification
- sim-runner clean-clone land (#1869): golden-neutral confirmed by diff (server/* + docs,
  no engine/data/luau); full suite GREEN; cherry-picked onto marker-0066's tip so the
  #1752 crash files are preserved (a plain FF/merge would have reverted them).

## Impact for the user
Composes with marker-0066: crash resilience catches a real crash/OOM; this stops a
*non*-crash (event-loop-block) from being mistaken for a dead connection and dropping the
player. Together they harden the long-hosted-game path the turn-2623 report exposed.
Provenance: original operational hardening (docs/17 lane).
