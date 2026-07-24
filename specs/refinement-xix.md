# Refinement XIX — live-box playtest batch (user, 2026-07-25)

8 items from testing https://multiciv.kjell.today at marker-0101;
diagnostics recording: `debugging/logs/retromulticiv-diag-turn546.json`
(dev-PC local — replay for context). The user also VERIFIED the
tab-close → new-tab → resume flow works live (the test-resume-flow
feature holding up in production). All items are client-lane,
golden-neutral; helper takes the batch AFTER #34 Founder's Record.

1. First-game "AI regency" hint box: move 50% DOWN vertically from
   its current position (follows XVII §4's lower-right move — the
   user wants it lower still, beside/nearer the button).
2. Top bar: +10ch width so the GOVERNMENT NAME (Despotism, Democracy,
   …) always shows un-truncated (extends XVII §22's +26ch).
3. Game-end "View statistics": SLOW — briefly triggers Firefox's
   tab-hang warning. Apply the ff-chunking precedent (a ~30ms
   time-budget batching loop, shared/fastforward.js pattern) to the
   stats computation, or precompute during the endscreen fade.
   Measure before/after on the diag recording's game.
4. Replay view: the AI-regency button must be HIDDEN after GAME END
   (a regency toggle makes no sense over a finished game's replay).
5. Replay view: the select-civ dropdown is default light-gray —
   restyle to match the project's other dropdowns.
6. Replay playback: stepping sometimes trips the Firefox hang
   warning — same fix family as §3: time-budget the replay stepping
   loop (it replays engine commands synchronously on the main
   thread today).
7. Replay view: the map influence overlay defaults ON for history
   playback (the viewer wants to see empires wax/wane; keep the
   toggle to turn it off).
8. Research panel: the "View technology tree" button REGRESSED to
   upper-right, slightly OUTSIDE the panel (XV §3 placed it lower
   left; the XVII top-bar/panel rework likely displaced it) —
   restore lower-left inside the panel.

Verification: screenshots per visual item in debugging/usergenerated/
xix-*; the §3/§6 perf items report before/after timings on the diag
recording; play-lane specs stay green (the replay/regency specs
especially).
