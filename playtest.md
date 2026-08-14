# Playtest checklist — graphics tiers (Kjell's follow-up list)

_Opened 2026-08-14 at marker-0120+. Report numbers/verdicts back and they
get recorded in `specs/graphics-levels.md` §6._

## 1. The 1440p High measurement (gaming PC — the acceptance number)

1. Boot `https://aworldbegun.kjell.today/?seed=1&size=large` (or local).
2. ⚙ Options → Graphics level → **high** (check the note says no degrade).
3. Chrome DevTools → Ctrl+Shift+P → "Show frames per second (FPS) meter".
4. Pan and zoom around a dense late-game area (or `?age=industrial`).
5. **Record: typical fps at 1440p = ______** (target ≥ 50).
   - If under 50: report it — shadow-map size (2048) and scatter density
     are the tuning levers, both one-line changes.

## 2. Multi-device matrix (one row per device you try)

| Device | Auto-detected tier (setup hint) | Tier played | Feels smooth? | Terrain "reads at a glance"? | Notes |
|---|---|---|---|---|---|
| gaming PC 1440p | | high | | | |
| work laptop (Iris Xe) | | medium | | | |
| phone | | low | | | |
| ... | | | | | |

Per device, worth 60 seconds each:
- Does the **setup hint** name a sensible tier ("detected for this machine: …")?
- On a WebGL1-only device, pick **high** in ⚙ — the note must say it fell
  back to medium (honest degrade).
- **Zoom in close** on a city and a unit at the device's tier — is the
  detail there (facades, helmets) without jank?
- Switch tiers live in ⚙ — the world should rebuild in-place, no reload.

## 3. The original acceptance question (the playtesters who started this)

Ask them at Medium and High: **"Is it clearly visible what each terrain
is — desert, plains, grass — without the tile card?"** That sentence is
the arc's acceptance criterion.

## 4. New affordances to sanity-check (shipped in the H11 batch)

- **First visit** (fresh browser / incognito): the setup screen's arrow
  overlay includes one pointing at the Graphics level picker — and the
  arrows now FOLLOW THE SCROLL (fixed 2026-08-15 from your laptop report:
  on short screens, below-fold buttons get their arrows as you scroll to
  them; before, only the visible ones ever drew).
- **Link pre-selection:** `?gfx=low` / `?gfx=medium` / `?gfx=high` on any
  game URL pre-selects and persists the tier (then vanishes from the URL).
  Try `…/client/?gfx=low` on a phone.
- Auto-detect is GPU-probe based (not user-agent) and already live — the
  "Automatic" entry resolves through it.
