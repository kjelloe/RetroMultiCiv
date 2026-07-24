# README v1.0 draft — assembled around the ally's three blocks (RC step 5)

Drafted 2026-07-25 (away window, marker-0101). TITLE-SWAPPABLE: every
`{TITLE}` becomes "A World Begun" when the trademark search clears,
else stays "RetroMultiCiv". The three quoted blocks are the ally's
release copy VERBATIM (specs/ally-response-2026-07-24-naming-release.md)
— do not edit them, only the frame. At RC this replaces README.md's
header sections; the technical sections below the fold (hosting,
architecture, testing) carry over from the current README largely
as-is.

---

# {TITLE}

> **What this is**
> *{TITLE}* is a faithful recreation of the 1991 Civilization
> ruleset — rebuilt for the browser and Roblox, with real
> multiplayer, a full historical arc from 4000 BC to the space age,
> and a deterministic engine that can replay any game exactly as it
> happened. The rules are authentic. The AI plays by them too.

**Play now:** [multiciv.kjell.today](https://multiciv.kjell.today/client/)
— or press **Find game** to join anyone's public server, or share a
lobby's **QR / join link** and friends drop straight into your game.
Late joining is on by default: running games list publicly and a
newcomer takes over an AI civilization mid-history.

> **What makes the AI worth playing against**
> The civilizations in *{TITLE}* have character. Scientists
> research toward democracy and race libraries. Builders raise
> monuments before armies. Conquerors stage overseas invasions when
> the odds are right. Every AI civilization governs, modernizes, and
> manages unhappiness in a way that reflects what it is — not just
> what the numbers suggest. It will not always win. But it will
> always be doing something recognizable.

**Features at 1.0:** all Civ 1 systems (12 terrains, 68 techs, the
21 wonders with real effects, governments, happiness, disasters, the
space race), 14 civilizations with personalities, hotseat + LAN +
public-server multiplayer with AI regency for absent players,
starting-age fast starts, a graphical tech tree, an in-game
Civilopedia and advisor, and the Founder's Record — every finished
game's complete replayable history.

> **What the engine guarantees**
> Every game produces a complete, verifiable history. Any session can
> be replayed turn by turn, exactly as it unfolded. The record is
> the game.

**Self-host in one minute** (no build step, one dependency, no
database):

```bash
npm ci && ./run.sh     # → http://localhost:8123/client/?server=1
```

`--announce` lists your server in everyone's Find-game. Full operator
guide: docs/how-to-host.md (caps, TLS, systemd, the master index).

**Roblox:** the same engine, ported module-by-module to Luau — both
runtimes compute byte-identical state, verified by cross-language
golden hashes on every change. (Roblox release follows the browser
1.0 as a point release.)

---

*Technical sections to carry over from the current README below this
line: architecture (engine-as-reducer, determinism), the test
pyramid (886 tests incl. the twins gate), screenshot, development
docs pointer, license.*
