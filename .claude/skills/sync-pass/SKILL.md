---
name: sync-pass
description: The user's recurring "update use-case, specs, MDs, tests, documentation, skills and memories as applicable" request — the checklist so nothing is missed and nothing is duplicated
---

# /sync-pass — propagate recent decisions/deliveries into every record

The user asks for this verbatim after eventful stretches. It is a
CHECKLIST, not a rewrite pass: touch only what actually drifted.

## Gather first (quietly)

What changed since the last sync? Sources: this conversation's rulings,
`agent-mail.py log -n 30`, `git log --oneline` since the last sync commit,
the status board. List the deltas BEFORE editing anything.

## The checklist

1. **Test counts**: `debugging/sync-check.sh` — fix stale counts via sed in
   README.md / plan-update.md / agent-workitems.md. Re-run until `ok`.
2. **Specs** (`specs/*.md`): new rulings appended to the spec they rule on
   (dated, with mail #ids); delivery-tracker lines on triage specs; VERBATIM
   ally responses in their own `ally-*-response-*.md` file, routed by
   pointers.
3. **human-workitems.md + human-workitems.html** — ALWAYS BOTH, same
   content (html uses the card markup + `--play` green for done). Update the
   "Last synced" chip/line. Done items get `[x]` + strike-through in html;
   new user actions get open items.
4. **agent-workitems.md**: done-marks `[done: date — …]` on closed A/B
   items; new sections for architect-executed work (A-numbered) so history
   is greppable.
5. **docs/** (numbered docs): only when a DECISION changed what they state
   (e.g. a new host option → docs/08). Never restate queue status there.
6. **CLAUDE.md**: only for durable rulings that every future agent session
   needs (naming, process, grants). Keep additions inside the relevant
   existing paragraph.
7. **Living plans**: `plan-version1.md` statuses/last-updated;
   `plan-version2.md` if anything was deferred or promoted.
8. **Memories** (`~/.claude/.../memory/`): update existing files over
   creating duplicates; fix stale `description:` frontmatter AND the
   MEMORY.md index line together; NEVER duplicate what the repo already
   records — memories carry what the repo can't (grants, preferences,
   cross-session resume state).
9. **Skills** (`.claude/skills/`): if this session repeated a process 3+
   times or a new standing request arrived, capture it as a skill.
10. **Commit** the batch (dev_night grant) with a one-line summary; leave
    other lanes' in-flight locked files strictly alone.

## Traps (measured)

- The html twin silently diverges from the md — always grep both for the
  text you changed.
- Done-claims: verify against the ENGINE/code (`ls engine/…`, grep) before
  writing "done" — workitem files carry stale stubs.
- Do not stash/edit through another lane's locked files mid-window.
