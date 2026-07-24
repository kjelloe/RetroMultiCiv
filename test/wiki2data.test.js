const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { cleanCell, extractTables, parseYields, scanDump } = require('../tools/wiki2data.js');

test('parseYields counts icon tokens and modifiers', () => {
  assert.deepStrictEqual(parseYields('[food][food] / / [trade] ↑'),
    { food: 2, shields: 0, trade: 1, republicBonus: true, despotismPenalty: false });
  assert.deepStrictEqual(parseYields('[food][food][food] ↓ / [shield][shield] /'),
    { food: 3, shields: 2, trade: 0, republicBonus: false, despotismPenalty: true });
  assert.deepStrictEqual(parseYields('/ /'),
    { food: 0, shields: 0, trade: 0, republicBonus: false, despotismPenalty: false });
});

test('cleanCell strips wiki markup', () => {
  assert.strictEqual(cleanCell('[[Phalanx (Civ1)|Phalanx]]'), 'Phalanx');
  assert.strictEqual(cleanCell('[[Legion (Civ1)]]'), 'Legion (Civ1)');
  assert.strictEqual(cleanCell("'''bold''' and ''italic''"), 'bold and italic');
  assert.strictEqual(cleanCell('style="text-align:center" | 10'), '10');
  assert.strictEqual(cleanCell('{{link|Bronze Working}}'), 'Bronze Working');
  assert.strictEqual(cleanCell('3<ref>manual p.12</ref>'), '3');
  assert.strictEqual(cleanCell('a<br/>b'), 'a / b');
});

test('cleanCell handles wiki icon templates and artifacts', () => {
  assert.strictEqual(
    cleanCell('&nbsp;{{FoodIcon1}}{{FoodIcon1}}<br/>&nbsp;{{ShieldIcon1}}<br/>&nbsp;'),
    '[food][food] / [shield] /'
  );
  assert.strictEqual(cleanCell('[[File:Grassland (Civ1).png|link=Grassland (Civ1)]]'), '');
  assert.strictEqual(cleanCell('Nuclear {{icon|30}}'), 'Nuclear');
  assert.strictEqual(cleanCell('[[Nuclear (Civ1)|Nuclear]] 30'), 'Nuclear');
  assert.strictEqual(cleanCell('cost is 160'), 'cost is'); // known tradeoff: trailing 2-3 digit numbers are treated as icon sizes
});

test('extractTables parses a wikitable with headers, rows, caption', () => {
  const wikitext = [
    'prose', '',
    '{| class="wikitable"',
    '|+ My caption',
    '! H1 !! H2',
    '|-',
    '| a || b',
    '|-',
    '| c',
    '| d',
    '|}',
    'more prose'
  ].join('\n');
  const tables = extractTables(wikitext);
  assert.strictEqual(tables.length, 1);
  assert.strictEqual(tables[0].caption, 'My caption');
  assert.deepStrictEqual(tables[0].headers, ['H1', 'H2']);
  assert.deepStrictEqual(tables[0].rows, [['a', 'b'], ['c', 'd']]);
});

test('scanDump extracts only target pages from XML', async () => {
  const pages = {};
  const { found, scanned } = await scanDump(
    path.join(__dirname, 'fixtures', 'sample-dump.xml'),
    ['List of units in Civ1'],
    (title, text) => { pages[title] = text; }
  );
  assert.strictEqual(scanned, 2);
  assert.deepStrictEqual(found, ['List of units in Civ1']);

  const tables = extractTables(pages['List of units in Civ1']);
  assert.strictEqual(tables.length, 1);
  assert.strictEqual(tables[0].caption, 'Units in Civ1');
  assert.deepStrictEqual(tables[0].headers, ['Unit', 'Attack', 'Defense', 'Moves', 'Cost', 'Requires']);
  assert.strictEqual(tables[0].rows.length, 3);
  assert.deepStrictEqual(tables[0].rows[0], ['Militia', '1', '1', '1', '10', 'None']);
  assert.deepStrictEqual(tables[0].rows[1], ['Phalanx', '1', '2', '1', '20', 'Bronze Working']);
  assert.deepStrictEqual(tables[0].rows[2], ['Legion (Civ1)', '3', '1', '1', '20', 'Iron Working']);
});
