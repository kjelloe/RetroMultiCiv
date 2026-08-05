*A faithful recreation of the 1991 Civilization ruleset — for the browser and
Roblox, with real multiplayer and a deterministic engine that can replay any
game exactly as it happened.*

**Play now: <https://aworldbegun.kjell.today>** — no account, no install.
**Or on Roblox: <https://www.roblox.com/games/78821734305285/A-World-Begun>**

![A Chinese republic in 2784 AD: city population badges, a railroad network across grassland and hills, an Aztec border to the east, the minimap, and a tile card reading out food, shields and trade](https://raw.githubusercontent.com/kjelloe/RetroMultiCiv/40d6cd29aee7698a392483beaeb0632cbcb02aac/docs/screenshot.png)

---

## What this is

*A World Begun* rebuilds the 1991 ruleset: 4000 BC to the space age, the full
68-advance tree, 28 units, 21 buildings, 21 world-unique wonders, one-shot combat
with veterans and zone of control, the government ladder from Despotism to
Democracy with revolutions and war weariness, happiness and civil disorder,
irrigation through railroads and terrain transforms, pollution and global
warming, barbarians, goody huts, and the reckoning at 2100 AD.

Pick any of 14 classic civilizations, start in any age from Ancient to Space —
the world fast-forwards under AI and you take over — and tune difficulty from
Trainer to God-Emperor.

**The rules are authentic. The AI plays by them too:** no resource cheats, no
hidden information, bound by the same deterministic engine you are.

## What makes the AI worth playing against

The civilizations here have character. Scientists research toward democracy and
race libraries. Builders raise monuments before armies. Conquerors stage overseas
invasions when the odds are right. Every AI civilization governs, modernizes and
manages unhappiness in a way that reflects what it is — not just what the numbers
suggest. It will not always win. But it will always be doing something
recognizable.

That claim is measured rather than asserted. A 25-seed headless sweep gates every
release against floors for cities founded, population, improvement coverage,
rush-buys and resource use, and doctrine ships only when the sweep shows it
firing in play. Two examples of what that catches, both from the final windows:

- The economic doctrine issued **624 trade-route commands that produced zero
  routes** — green fixtures, faithful twin, and half inert in play. Fixed and
  re-measured to 3/3.
- The release-candidate sweep failed one seed of 25 on a unit tripwire. It was
  not a harness artifact: barbarians who captured a city kept **running it as a
  normal city**, reaching 695 barbarian units — 69% of everything on the map.
  Root-caused and bounded rather than waved through.

## What the engine guarantees

Every game produces a complete, verifiable history. Any session can be replayed
turn by turn, exactly as it unfolded. **The record is the game.**

Press **Shift+D** in any game to download a recording; `node tools/replay.js
<file>` re-runs it and pinpoints the exact command where anything diverges.

![The graphical technology tree: known advances ticked, available ones circled, locked ones dimmed, dependency edges drawn between them, and a hover card on Monarchy reading "needs: Code of Laws, Ceremonial Burial — Authority is gathered into a single crown"](https://raw.githubusercontent.com/kjelloe/RetroMultiCiv/40d6cd29aee7698a392483beaeb0632cbcb02aac/docs/screenshot-techtree.png)

There are **two** implementations — JavaScript and Luau — and they agree
byte-for-byte. A game played in Roblox Studio replays command-by-command through
the browser engine with identical state hashes at every checkpoint. **1048
headless tests** hold that contract, including 69 rule scenarios that execute
against both engines and a golden 545-turn game pinned to its hash.

## Multiplayer

Hotseat behind an opaque hand-off screen, or host over LAN or the internet with
a 5-letter join code: a lobby with chat and host moderation, seat selection,
spectators, and a private rejoin code per seat. Disconnects reconnect and reclaim
their seat; an **AI regent** plays for you while you step away; the server
autosaves and resumes.

The acceptance test was physical: a two-machine session survived a network cut
*and* a server kill with save-resume, then replayed hash-for-hash.

## Diplomacy

Contact opens an audience — cease-fires and peace treaties, tribute and
technology demands, embassies and diplomat missions, a reputation every AI
remembers, and a senate that refuses to break a treaty under Republic or
Democracy.

## Host your own server

No build step, one dependency, no database.

```bash
docker run -p 8123:8123 ghcr.io/kjelloe/retromulticiv:latest
```

Or from source: `npm ci && ./run.sh`. Full guide including systemd, nginx + TLS
and Raspberry Pi: [docs/how-to-host.md](docs/how-to-host.md). Self-hosted servers
can announce themselves to a public master index, so other players can find them
from the setup screen.

## Also on Roblox

**<https://www.roblox.com/games/78821734305285/A-World-Begun>**

The same engine, ported module-by-module to Luau rather than reimplemented — not
a separate build that happens to agree, but the same modules translated and held
to byte-identical state by CI. A game played there replays command-by-command
through the browser engine with identical hashes at every checkpoint.

![The same game running inside Roblox: an avatar standing on the tile map at turn 288, 870 AD, with cities showing population and what they are building, the unit action bar along the bottom, and the minimap](https://raw.githubusercontent.com/kjelloe/RetroMultiCiv/40d6cd29aee7698a392483beaeb0632cbcb02aac/docs/screenshot-roblox.png)

## Known limits, stated plainly

- **The Roblox client is a v1.x point release.** It is published and playable,
  and the engine parity underneath it is proven and gated in CI — but its UI does
  not yet reach browser parity. The browser client is the complete one.
- **The AI does not expand overseas** unless the map forces it early. Measured
  on the shipped default map as well as the novelty shapes — it is a doctrine
  gap, filed with its acceptance test, not a surprise.
- **Nuclear weapons exist in the ruleset** but no AI doctrine drives them.
- Counter-espionage, and map wrap in both axes, are not implemented.

## Credits

Built AI-assisted (Claude Code) with a human designer and a WebGL specialist
contributing reviews. Ruleset numbers are verified against a wiki reference dump
rather than transcribed by hand.

---

*A World Begun* is an unofficial fan project inspired by the 1991 game
*Sid Meier's Civilization*. It is not affiliated with, endorsed by, or connected
to Take-Two Interactive, Firaxis Games, or MicroProse. "Civilization" is a
trademark of Take-Two Interactive Software, Inc. No original game assets, code,
or content are used. MIT licensed.
