# v1.0.x patch plan — post-release review

_LIVING DOCUMENT. Opened 2026-08-05, the day after v1.0.0 shipped, from a
read-the-code review rather than a memory dump. Companions: `plan-version1.md`
(the road to 1.0, now closed) and `plan-version2.md` (the v2-or-later shelf).
This file is the middle tier: things worth fixing in a **patch**, not worth
holding a release for._

**Last updated: 2026-08-12 (evening).** Released: `v1.0.0` (2026-08-04), `v1.0.1`
(2026-08-05). Live at aworldbegun.kjell.today and on Roblox.

---

## How this list was made

Evidence-first, so each item can be re-checked rather than believed:

- module sizes against the `docs/02` policy (`wc -l engine/*.js`)
- `TODO|FIXME|HACK|XXX` across `engine/ shared/ server/ client/ luau/`
- the Civ 1 feature audit (`specs/civ1-feature-audit.md`) re-read against what
  W1–W5 actually shipped
- the wiki dump consulted where a Civ 1 claim was in question
- the operational surface: backups, alerting, what CI actually covers

**Two things it found that are NOT gaps**, recorded so they are not
re-litigated:

- **Civil war is not a Civ 1 mechanic.** All 15 mentions in the dump's Civ1
  pages are Civilopedia prose about Lincoln and Caesar. Its absence is correct.
- **There is no real code debt marker in the whole project.** All eight
  `TODO|FIXME|HACK|XXX` hits are `XXXX` format placeholders in game-code strings.

The Civ 1 feature audit's gaps are **closed**: WLTKD (W4), Mfg. Plant + SDI
(W2), the score happy-term (W3) and the re-home relabel (W5) all shipped.

---

## P1 — Nothing tells you the box is down

**What.** `/healthz` and `/metrics` exist on both the game server and the master
index, and nothing polls either. Today the first alert that the service is down
is a player complaining, or noticing by chance.

**Why it is first.** It is the only item here that fails **silently in
production**. Every other gap is visible when you look; this one is invisible
precisely when it matters.

**The cheap version already exists.** `games.kjell.today` probes every listed
game every 5 minutes and writes `up: true|false` into `public/games.json`. It
has the signal and nowhere to send it. A dozen lines in `generate.js` — compare
against the previous run, and on a transition to down, POST to a webhook or send
a mail — turns the existing prober into an alerter.

**Not recommended:** adding a monitoring stack. This is one small box; an
uptime-check service or the games-index hook is proportionate.

**DONE (code) 2026-08-12** — the games-index prober now alerts on
transitions: DOWN after 2 consecutive misses (~10 min), recovery with
duration, one alert per incident, state in `~/.games-index-alerts.json`
(outside the deploy tree). Any plain-text-POST webhook; ntfy.sh documented
in the gamesindex README. **Remaining = user:** pick an ntfy topic, set
`site.alertWebhook`, deploy.

## P2 — Backups are on-host only, and miss the bug reports

**What.** `docs/hetzner-cloud-init.yaml` installs a nightly `cron.d` job that
tars `saves/` into `/home/<user>/backups`, 30-day retention.

**Three problems, in order:**

1. **Same disk.** Box or disk loss takes the games *and* their backups together.
   An on-host copy protects against `rm`, not against losing the host.
2. **`bugreports/` is not included.** The tar covers `saves` only. Player-
   submitted bug reports are irreplaceable — nobody re-sends one.
3. **It may never have run.** It was installed by cloud-init's `runcmd`, the
   phase `docs/how-to-host.md` itself flags as silently failing. One
   `ls -la ~/backups` settles it.

**Fix.** Verify it exists; add `bugreports` to the tar; push the archive
off-host (`restic`, `rclone`, or an rsync to another machine). The tar is fine —
the location is the defect.

**DONE (agent half) 2026-08-12** — the cloud-init cron tars
`saves/ + bugreports/`; `ops/backup-offhost.sh` (rsync push with a
restricted dedicated key + far-end verify); how-to-host § "Backups, done
properly". **Remaining = user, on the VM:** `ls -la ~/backups` (has the
cron ever run), update `/etc/cron.d/retromulticiv-backup` to the template
line, pick a destination box, fill DEST, install the 03:20 cron.

## P3 — Nukes are asymmetric: a player can, the AI never will

**What.** The engine fully simulates nuclear weapons — blast, fallout, city
meltdown, and SDI as the counter. `engine/ai.js` mentions nuclear only to
**exclude** it from air-unit selection (`if (def.domain !== 'air' ||
def.nuclearBlast === true) continue;`).

**Why it matters more than "no nuke doctrine" suggests.** A human can build and
use nukes against opponents that will never retaliate. The release notes claim
the AI *"has no resource cheats and no hidden information, and is bound by the
same deterministic engine you are."* A one-sided weapon is the sharpest
exception to that claim in the game.

**Cost.** A behavioural engine window: trigger conditions (when is a nuke worth
the reputation and fallout?), target selection, the SDI check on the AI side,
plus the Luau twin and a re-record. Needs its own measurement — an AI that nukes
too readily is worse than one that never does.

**Currently filed as:** v1.x on `plan-version2.md`. This entry raises its
priority and states the reason.

## P4 — Bankruptcy clamps instead of selling

**What.** `engine/tech.js:230` — `if (player.gold < 0) player.gold = 0;` with the
comment *"Civ 1 sells buildings; clamped for now"*.

**Why.** Civ 1 force-sells a building when the treasury cannot pay maintenance.
Clamping **lets the player off** a real consequence, so the pressure that should
make over-building a mistake simply is not there. It is a documented `docs/01
§11` deviation, so it is honest — just not faithful.

**Cost.** Small: the `sellBuilding` machinery (A86) already exists. Choosing
*which* building to sell is the only design question. Behavioural, so a
re-record.

## P5 — `engine/ai.js` is 3,820 lines against a ≤~300 policy

**What.** Twelve times the ceiling `docs/02 §4` sets. Its Luau twin is 4,198.
`engine/cities.js` at 1,052 is second; everything else is within tolerance.

**Why it is not cosmetic.** The policy exists for a stated reason — *"each
becomes a Luau ModuleScript 1:1; small files = reviewable port."* The AI is the
module where reviewability matters most and where it is least available. It is
also the module that changed most during W6–W8.

**Recommendation: do NOT split it opportunistically.** It is byte-matched to a
twin across nine consecutive honest re-records; a split is a large, high-risk
refactor against a reviewability benefit. Do it deliberately, if the Roblox
parity work forces it, with the split planned along the seams the doctrine
already has (build priorities / war / econ / diplomacy) — not as tidy-up.

**Logged so it is a known, accepted deviation rather than an unnoticed one.**

## P6 — CI covers `main` only

**What.** `nightly-soak` runs on `main`. All work happens on `dev_night`, so CI
verifies nothing until after a merge — which is how the UI lane stayed broken
across several rounds while the local suite was green.

**Compounding:** `node --test test/` does not run `test-ui/`, so the playwright
lane's only regular execution is that same nightly. Two client changes in two
days passed the full suite and broke it (A105/diplomacy, compass/d-pad). The
rule is now in `CLAUDE.md` and the marker skill, but that is discipline, not
coverage.

**Fix.** Either schedule the nightly on `dev_night` as well, or add a light
push-triggered workflow that runs the UI lane on `dev_night` when `client/**`
changes. The second is cheaper and targets the actual gap.

**DONE 2026-08-12** — `.github/workflows/ui-dev-night.yml`: the nightly's
ui-lane job, push-triggered on dev_night for client/test-ui/shared/server
paths, concurrency-superseding. First run fires on this very push.

---

## Already filed elsewhere — listed here only so this is the whole picture

| item | where | note |
|---|---|---|
| AI declines overseas expansion | `specs/unit-doctrine-v1x.md` §8 | measured on the default map too, not only novelty shapes |
| Barbarian hunt radius (`HUNT_RADIUS` 8) | `plan-version2.md` | likelier root of accumulation than the cap that now bounds it |
| Roblox world-space label collision | `roblox/PLAYTHROUGH-UI.md` F2 | legibility, first thing a new player sees |
| Container-boot smoke unproven | `docs/how-to-host.md` §Publishing | registry verified public; boot never tested |
| Counter-espionage, toroidal wrap | `plan-version2.md` | v2 shelf by ruling |
| Graphics levels low/medium/high (playtest 2026-08-05) | `specs/graphics-levels.md` | v2 LADDER COMPLETE 2026-08-13 (marker-0115): TW-watermark High, model-grade 21/21, all picks user-confirmed |

## Fixed since release, for the record

- Barbarian battles emitted no events at all — no turn-log line, no marker
  (2026-08-05, both engines)
- Production-switch penalty compounded per command (2026-08-05, both engines)
- Master index returned a bare 404 to a browser
- No-WebGL players got Chrome-only advice; diagnostics moved to Options
- Mobile compass hidden by default
