#!/usr/bin/env node
// check.sh gate 28 (SO6 jump-to): the browser turnlog.js gives a located log
// entry a ⌖ button that centres the map (renderer.centerOn(loc.x, loc.y)); the
// Roblox TurnLog must mirror it — a locOf() that reads e.x/e.y or the city, a
// ⌖ button per located row, and ClientState.focusCamera as the centre-on twin.
// String-scan both sides; a dropped affordance / broken wire fails.
import { readFileSync } from 'node:fs';

const U = (p) => new URL(p, import.meta.url);
const browser = readFileSync(U('../../client/ui/turnlog.js'), 'utf8');
const luau = readFileSync(U('../src/client/TurnLog.client.luau'), 'utf8');
const clientState = readFileSync(U('../src/client/ClientState.luau'), 'utf8');

const errs = [];
const need = (src, label, frag, why) => {
  if (!src.includes(frag)) errs.push(`missing in ${label}: ${JSON.stringify(frag)} (${why})`);
};

// the browser contract (a reword there = re-port the roblox side)
need(browser, 'turnlog.js', '⌖', 'browser jump glyph');
need(browser, 'turnlog.js', 'centerOn', 'browser centres the renderer on the loc');
need(browser, 'turnlog.js', '{ x: e.x, y: e.y }', 'browser passes the event tile as the loc');

// the roblox mirror
need(luau, 'TurnLog.client.luau', 'local function locOf', 'roblox resolves the event tile');
need(luau, 'TurnLog.client.luau', 'e.x ~= nil and e.y ~= nil', 'locOf reads a direct event tile');
need(luau, 'TurnLog.client.luau', 'view.cities[e.cityId]', 'locOf resolves a city event via the view');
need(luau, 'TurnLog.client.luau', '⌖', 'roblox jump glyph');
need(luau, 'TurnLog.client.luau', 'ClientState.focusCamera(loc.x, loc.y)', 'roblox centres the camera (centerOn twin)');
need(luau, 'TurnLog.client.luau', 'locOf(view, e)', 'the event loop threads the loc into put');

// the camera hook exists
need(clientState, 'ClientState.luau', 'function M.focusCamera', 'the focusCamera API the jump calls');

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log('turnlog-jumpto-parity: ⌖ jump-to wired — locOf + focusCamera mirror turnlog.js centerOn');
