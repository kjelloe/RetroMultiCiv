# Coordinator role alias + escalation convention (2026-07-19, user-requested)

> User ask (2026-07-19): "Add a special role flag for the coordinator — any
> agent being stuck should ping `coordinator` (currently the architect) for
> instructions, so we don't assume helper agents are working along when we
> hear nothing in the mailbox." Design + record + implement.

## Problem

`agent-mail.py` roles are free-form strings matched literally. The
coordination/arbitration role is hardcoded as the string `architect`
everywhere (specs, prompts, agent habits). Two costs:

1. **Coupling.** If the coordination baton ever moves (a different session or
   name), every spec that says "mail the architect" is stale.
2. **Silence ≠ progress.** A blocked agent that simply goes quiet is
   indistinguishable from one making progress. The 2026-07-19 dev-PC reboot
   showed the failure mode: silence meant "hub down / session killed," and the
   coordinator had to *infer* liveness rather than being *told*.

## Design — two additive pieces

### 1. A read-time `coordinator` alias (decouples ROLE from NAME)

An editable alias map at `.agent-mail/roles`, format `alias = canonical` per
line (`#` comments, `:` also accepted). Currently:

```
coordinator = architect
```

**Read-time, additive, backward-compatible** — no stored message is rewritten:
- `send --to coordinator …` stores `coordinator` literally; delivery resolves
  at read time.
- `canon(role)` maps an alias to its canonical role (one hop — a canonical
  must be a real role, never another alias); unknown roles map to themselves.
- `addressed(to_field, role)` matches on the CANONICAL role, so a message to
  `coordinator` reaches a query as either `architect` or `coordinator`, and a
  message to `architect` reaches a query as `coordinator`.
- `cursor_file(role)` keys on `canon(role)`, so an alias and its target SHARE
  ONE cursor — no double-reads, no split unread counts.
- `unread_for` uses `addressed()` + a canonical from-guard (your own sent mail
  is still excluded from your unread).
- `who` collapses aliases into the canonical row and prints the alias map
  (`(alias) coordinator → architect`).
- `--to architect` is entirely unaffected.

**Re-point cost:** edit one line in `.agent-mail/roles`. Local lanes (fresh CLI
process each call) see it instantly; the long-lived `serve` hub caches aliases
per process, so remote lanes proxying through it see a re-point on the next hub
restart — the same restart requirement as any `agent-mail.py` change.

### 2. Escalation convention (the "silence ≠ progress" fix)

Written into the role specs + `tools/agent-mail.md`:

- **A blocked agent, or one that needs a ruling, mails `coordinator` (tag
  `blocked`) rather than idling — silence is never a status.** This flips the
  default from "the coordinator polls for stalls" to "a stuck agent raises its
  hand," and via the alias no spec hardcodes `architect`.
- **Emit a one-line status on task PICKUP and on DONE** (most lanes already do
  at inbox check-in/check-out). Staleness then shows up in `who` + message
  timestamps; the coordinator's recurring status pass flags stale lanes. Keep
  it to pickup/done — no chatty per-step heartbeats (they bury the signal).

## Implementation (landed 2026-07-19)

- `tools/agent-mail.py`: `ALIASES` const, `load_aliases()` (cached per
  process), `canon()`, `addressed()`; `cursor_file`/`unread_for`/`who` made
  canonical. Purely additive.
- `.agent-mail/roles`: the alias file. The `.agent-mail/` store is gitignored,
  so this data file is per-machine — but only the **HUB's** copy matters:
  remote lanes with a `.agent-mail/remote` proxy EVERY command to the hub, so
  the hub resolves their `--to coordinator` server-side; they never read their
  own store. Local dev-PC lanes share the hub clone's file. So one
  `.agent-mail/roles` on the dev PC (the hub) covers all lanes. The MECHANISM
  travels via git (`tools/agent-mail.py` is tracked); only this one-line data
  file is local, and it lives where the hub runs.
- Hub restarted so remote lanes get the new code.
- Verified: `canon`/`addressed` unit checks; `peek --as coordinator` returns
  the identical unread set as `peek --as architect`; shared cursor confirmed;
  `who` shows the alias with no phantom row.

## Part 3 — the status board (2026-07-19, user-requested follow-on)

The user asked for a "waiting" semantic + every lane reporting ≤10 min so no lane is
silently dead. A literal mail heartbeat was rejected (it floods the log — the
reporting-style rule warns against that — and is unenforceable for long synchronous
ops and undriven idle sessions). Instead: a **presence board**.

- `agent-mail.py status --as <role> "<state>"` overwrites a one-line per-role status
  (`.agent-mail/status-<role>`, JSON `{state, ts}`, canonical role) — NOT a message,
  so it never appends to the log. `agent-mail.py status` prints the board (each lane's
  state + age; a `working` status >15m not marked `long` gets a ⚠STALE hint).
- Three states: **`waiting`** (idle/queue-empty — a request for work, an old one is
  fine), **`working <X>`**, **`working <X> (long ~Nm)`** (set before a blocking op so
  silence is expected). Update at pickup/done/state-change + before long ops.
- The coordinator reads the board each sweep and pings only working-and-stale
  (>15m, not `long`) lanes — silence becomes legible (waiting / long-op / stale)
  instead of ambiguous. Blocked lanes still MAIL `coordinator` (board = liveness,
  mail = the ask).
- Implementation: `status_file`/`set_status`/`get_status`/`all_statuses` +
  `STATUS_STALE_MIN=15` + the `status` subcommand in `tools/agent-mail.py` (canonical,
  proxies over the hub like every command). Verified: set/read, alias-shared status,
  hub restart.

## Records updated

`tools/agent-mail.md` (alias + roles file + escalation convention + who
output), `CLAUDE.md` Workflow (blocked → coordinator), the role specs
(docs/10 roblox, docs/17 hardening, docs/18 reviewer), and the workflow
memories (coder-helper, bugfixer). Memory: `coordinator-role-alias`.
