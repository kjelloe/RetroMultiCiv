#!/usr/bin/env node
// check.sh gate 53: roblox/tools/after-run.js reads a saved session correctly
// (tour lines, refusals by reason, seconds per turn, diagnostics).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { analyse, render } = require('../tools/after-run.js');

const errs = [];
const check = (name, ok, detail) => { if (!ok) errs.push(`${name}${detail !== undefined ? ': ' + JSON.stringify(detail) : ''}`); };

const lines = [
  '  09:00:00.000  [R4INIT] seed=7 width=40 height=25 civs=romans,zulus humanSeat=p1',
  '  09:00:01.000  [RMC-DIAG] FAIL btn: overlap A x B: 10x10 px shared',
  '  09:00:02.000  [RMC-TOUR] stage: reveal',
  '  09:00:03.000  [RMC-TOUR] 01/03 research PASS',
  '  09:00:04.000  [RMC-TOUR] 02/03 city SKIP no city yet (found one, then run the tour again)',
  "  09:00:05.000  [RMC-TOUR] 03/03 stats FAIL off screen (1300,1 10x10 in 1280x720); 1 clipped text(s), first 'Rome'",
  '  09:00:06.000  [RMC-TOUR] DONE 3 stops: 1 pass, 1 fail, 1 skipped - failed: stats',
  '  09:00:07.000  [R4LOG] {"cmd":{"type":"moveUnit","playerId":"p1"},"ok":true,"t":"cmd","turn":1}',
  '  09:00:07.100  [R4LOG] {"cmd":{"type":"moveUnit","playerId":"p1"},"ok":false,"reason":"zoc","t":"cmd","turn":1}',
  '  09:00:07.200  [R4LOG] {"cmd":{"type":"moveUnit","playerId":"p1"},"ok":false,"reason":"zoc","t":"cmd","turn":1}',
  '  09:00:07.300  [R4LOG] {"cmd":{"type":"startWork","playerId":"p1"},"ok":false,"reason":"techRequired","t":"cmd","turn":1}',
  '  09:00:07.400  [R4LOG] {"t":"round","turn":1}',
  '  09:00:08.000  [Client] rejected (commandId -1): noReplayYet',
  '  09:00:08.500  [Client] AI regency ON (regent plays your seat)',
  '  09:00:08.600  [RMC-BADGE] earned first-city user=101 id=0',
  '  09:00:08.700  [RMC-BADGE] earned first-tech user=101 id=0',
  '  09:00:08.800  [Pedia] picture units/legion kind=unit box=428x240',
  '  09:00:08.800  [WonderScene] play pyramids mode=scene',
  '  09:00:08.800  [WonderScene] beat pyramids open t=0.0',
  '  09:00:08.800  [WonderScene] done pyramids skipped=true camera=restored',
  '  09:00:08.800  [WonderScene] play colossus mode=rival',
  '  09:00:08.900  [CivGallery] open pictures=on',
  '  09:00:08.900  [YieldLabel] icons drawn: food wheat, shields coin, trade arrows',
  '  09:00:08.900  [Overlays] resources on: 310 tile label(s) around 12,9',
  '  09:00:08.810  [Pedia] picture wonders/pyramids kind=structure box=428x240',
  '  09:00:08.820  [Pedia] picture units/militia kind=unit box=428x240',
  '  09:00:08.830  [Pedia] picture concepts/cities kind=none box=428x0',
];
for (let turn = 1; turn <= 9; turn++) {
  // turns 1-5 one second apart, 5-9 three seconds apart
  const secs = 10 + (turn <= 5 ? turn - 1 : 4 + (turn - 5) * 3);
  lines.push(`  09:00:${String(secs).padStart(2, '0')}.000  [R4CODE] turn=${turn} code=AAAA-BBBB-CCCCC`);
}
lines.push('  09:00:40.000  [R4FINAL] hash=0x1234abcd', '  09:00:40.100  [SO7] endscreen sent: score victory, winner p1');

const r = analyse(lines.join('\n'));
check('init', r.init && r.init.startsWith('seed=7'), r.init);
check('last turn', r.lastTurn === 9, r.lastTurn);
check('final', r.final === 'hash=0x1234abcd', r.final);
check('commands (round entries are not commands)', r.commands === 4, r.commands);
check('refused', r.refused === 3, r.refused);
check('refused by reason', r.refusedBy.zoc === 2 && r.refusedBy.techRequired === 1, r.refusedBy);
check('refused by type', r.refusedByType.moveUnit === 2 && r.refusedByType.startWork === 1, r.refusedByType);
check('diag fail', r.diagFail.length === 1 && r.diagFail[0].startsWith('btn: overlap'), r.diagFail);
check('tour stops (the stage line is not a stop)', r.tour.length === 3, r.tour.length);
check('tour verdicts', r.tour.map(s => s.verdict).join(',') === 'PASS,SKIP,FAIL', r.tour);
check('tour fail detail', r.tour[2].detail.includes('off screen') && r.tour[2].detail.includes("first 'Rome'"), r.tour[2].detail);
check('tour done', r.tourDone === 'DONE 3 stops: 1 pass, 1 fail, 1 skipped - failed: stats', r.tourDone);
check('client rejects', r.clientRejects === 1, r.clientRejects);
check('regent', r.regent.join() === 'ON', r.regent);
check('endscreen', r.endscreen === 'score victory, winner p1', r.endscreen);
check('four spans', r.turnTimes.length === 4, r.turnTimes);
check('early turns 1 s', r.turnTimes[0].secs === 1, r.turnTimes[0]);
check('late turns 3 s', r.turnTimes[3].secs === 3, r.turnTimes[3]);

const text = render(r, { session: 'session X: 0 errors', replay: 'R4 ACCEPTANCE: ALL HASHES MATCH' });
check('report: refused share', text.includes('4 logged, 3 refused by the engine (75 %) - zoc 2, techRequired 1'), text);
check('report: only non-passing stops listed', text.includes('FAIL stats') && text.includes('SKIP city') && !text.includes('PASS research'), text);
check('badges', r.badges.join() === 'first-city,first-tech', r.badges);
check('pictures by kind', r.pictures.unit === 2 && r.pictures.structure === 1 && r.pictures.none === 1, r.pictures);
check('report: badges line', text.includes('badges: 2 earned - first-city, first-tech'), text);
check('report: pictures line', text.includes('encyclopedia pictures: unit 2, '), text);
check('scenes', r.scenes.played.scene === 1 && r.scenes.played.rival === 1 && r.scenes.done === 1 && r.scenes.skipped === 1, r.scenes);
check('report: gallery line', text.includes('civ gallery: opened 1, pictures on'), text);
check('report: yield icon line', text.includes('yield icons: drawn; Resources overlay switched on 1 time(s)'), text);
check('report: scenes line', text.includes('wonder scenes: scene 1, rival 1; 1 ended with the camera restored, 1 skipped'), text);
check('report: replay line', text.includes('replay: R4 ACCEPTANCE: ALL HASHES MATCH'));
check('report: seconds per turn', text.includes('seconds per turn: 1 (turns 1-3)'), text);

const twice = analyse([
  '  09:00:00.000  [DebugMenu] UI tour started',
  '  09:00:01.000  [RMC-TOUR] 01/02 research FAIL did not open',
  '  09:00:02.000  [RMC-TOUR] DONE 2 stops: 1 pass, 1 fail, 0 skipped - failed: research',
  '  09:01:00.000  [DebugMenu] UI tour started',
  '  09:01:01.000  [RMC-TOUR] 01/02 research PASS',
  '  09:01:02.000  [RMC-TOUR] 02/02 cities PASS',
  '  09:01:03.000  [RMC-TOUR] DONE 2 stops: 2 pass, 0 fail, 0 skipped',
].join('\n'));
check('two tours: the last one is reported', twice.tourRuns === 2 && twice.tour.length === 2 && twice.tour.every(s => s.verdict === 'PASS') && twice.tourDone.includes('2 pass'), twice);
const acts = analyse([
  '  09:00:00.000  [DebugMenu] UI tour started',
  '  09:00:01.000  [RMC-TOUR] 01/03 city PASS',
  '  09:00:02.000  [RMC-TOUR] 02/03 act-disband PASS',
  '  09:00:03.000  [RMC-TOUR] 03/03 act-city-cycle SKIP one city: found a second to check previous / next',
  '  09:00:04.000  [RMC-TOUR] DONE 3 stops: 2 pass, 0 fail, 1 skipped',
].join('\n'));
check('tour actions counted apart', render(acts, {}).includes('tour actions: 2 pressed - 1 pass, 0 fail, 1 skipped'), render(acts, {}));
check('a skipped action shows its reason', render(acts, {}).includes('SKIP act-city-cycle one city'), render(acts, {}));
check('two tours: the report says so', render(twice, {}).includes('tour (last of 2 runs): DONE 2 stops: 2 pass'), render(twice, {}));
const aborted = analyse(['  09:00:00.000  [DebugMenu] UI tour started', '  09:00:00.100  [RMC-TOUR] ABORT the regent has the seat'].join('\n'));
check('aborted tour', aborted.tourAbort === 'ABORT the regent has the seat' && render(aborted, {}).includes('tour: ABORT'), aborted.tourAbort);

const stale = analyse(['  09:00:00.000  [R4FINAL] hash=0xdead0000', '  09:00:01.000  [R4INIT] seed=1', '  09:00:02.000  [R4CODE] turn=3 code=x'].join('\n'));
check("a final hash printed before the game start is not this game's", stale.final === null && stale.lastTurn === 3, stale.final);

const empty = analyse('  09:00:00.000  [Lobby] up');
check('no game', empty.init === null && empty.commands === 0 && empty.turnTimes.length === 0);
check('no game report', render(empty, {}).includes('game: none started') && render(empty, {}).includes('tour: not run'));
const midnight = analyse(['  23:59:58.000  [R4CODE] turn=1 code=x', ...[2, 3, 4, 5, 6, 7, 8].map(t => `  00:00:${String(t * 2).padStart(2, '0')}.000  [R4CODE] turn=${t} code=x`)].join('\n'));
check('across midnight: no negative times', midnight.turnTimes.every(t => t.secs > 0), midnight.turnTimes);

if (errs.length) {
  console.error('after-run: FAIL');
  for (const e of errs) console.error('  ' + e);
  process.exit(1);
}
console.log('after-run: analysis and report pins pass');
