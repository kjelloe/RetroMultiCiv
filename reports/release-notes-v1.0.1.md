A patch on top of [v1.0.0](https://github.com/kjelloe/RetroMultiCiv/releases/tag/v1.0.0),
released the following day. No engine or rules changes — every golden hash is
unmoved, so saves, recordings and cross-language parity are untouched.

**Play: <https://aworldbegun.kjell.today>** · **[on Roblox](https://www.roblox.com/games/78821734305285/A-World-Begun)**

## The Roblox client is published

*A World Begun* is live on Roblox, running the same engine ported
module-by-module to Luau. The browser setup screen now shows a **Play on Roblox**
button — it was hidden until the experience URL existed, so this is the first
build where that entry point appears at all.

The Roblox UI does not yet reach browser parity; the browser client remains the
complete one.

## If the 3D map cannot start, the page now says something useful

A player hit `WebGL unavailable` in Firefox and was shown help telling them to
open `chrome://settings/system` — three URLs that do not exist in that browser.
The single message a blocked player ever sees pointed at a browser they were not
using.

Now there is a centered card that quotes **the browser's own reason** for
refusing a 3D context and gives steps for the browser in use: Firefox gets
`about:support` and `webgl.angle.force-warp` (with the reminder to restart the
whole browser, without which the fix silently does nothing), Safari gets its
experimental-features path and the Lockdown Mode note, Chrome and Edge keep
`chrome://gpu`.

The reason string comes from `webglcontextcreationerror`, so a player can see
`FEATURE_FAILURE_EGL_NO_CONFIG` on screen rather than discovering it only by
digging through browser diagnostics.

## Graphics diagnostics moved into Options

They used to sit permanently in the HUD for **every** WebGL1 player — six lines
of driver strings in the corner of a game that was working perfectly well. They
are now in **Options → Graphics**: one line saying what is actually rendering,
Details on demand, and a **Test this setting** button that attempts a context and
reports the browser's error where you are making the choice rather than after a
reload into a broken game.

There is also a real renderer preference — automatic, or force WebGL 1 — for
drivers whose WebGL2 is present but unreliable. `?diag=1` still forces the old
on-screen block for support conversations.

## The mobile compass starts hidden

The per-unit arrows carry navigation well enough that the compass mostly cost
screen space. The 🧭 button still brings it back, and anyone who had explicitly
turned it on keeps their setting — this changes the default, not your choice.

## Smaller things

- **View technology tree** shares a row with **Start research** in the research
  panel, at the same height and type size, instead of dropping onto a line of its
  own below it.
- The prebuilt container image is published and public:
  `docker run -p 8123:8123 ghcr.io/kjelloe/retromulticiv:latest`.

## Why the version moved at all

`GAME_VERSION` is stamped into save envelopes, recordings and bug reports.
Leaving it at 1.0.0 while the deployed client carried these changes would have
every report from the live server name a version whose code it was not running —
and send whoever read it hunting the wrong tree.
