// A88 drift gate: the asset-recipe table must cover every unit, city, and prop
// the renderer builds, the primitives must be well-formed, and the committed
// data/asset-recipes.json must match its source module (run
// tools/export-asset-recipes.js after any recipe change). PURE — recipes.js has
// no three.js/DOM, so this runs headless. Mirrors test/mock-state.test.js's
// terrain-coverage pattern.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const RULESET = require('./ruleset.js');

async function load() { return import('../client/renderer/three/recipes.js'); }

// three.js constructor arity per shape (size array length)
const SHAPE_ARITY = { box: 3, cyl: 3, cone: 2, sphere: 1, dodeca: 1, torus: 2 };

test('every data/units.json id maps to a silhouette recipe', async () => {
  const { UNIT_SILHOUETTE, UNIT_RECIPES } = await load();
  for (const id of Object.keys(RULESET.units)) {
    const recipe = UNIT_SILHOUETTE[id];
    assert.ok(recipe, `unit "${id}" has no UNIT_SILHOUETTE mapping`);
    assert.ok(UNIT_RECIPES[recipe], `unit "${id}" → "${recipe}" is not a UNIT_RECIPES key`);
  }
});

test('recipe primitives are well-formed (shape / size arity / color role / pos)', async () => {
  const { UNIT_RECIPES, CITY_RECIPE, PROP_SHAPES, COLOR_ROLES } = await load();
  const validColor = c => c === 'primary' || c === 'secondary' || COLOR_ROLES[c] !== undefined;
  const checkPrim = (p, where) => {
    assert.ok(SHAPE_ARITY[p.shape] !== undefined, `${where}: unknown shape "${p.shape}"`);
    assert.strictEqual(p.size.length, SHAPE_ARITY[p.shape], `${where}: ${p.shape} size arity`);
  };
  for (const [name, recipe] of Object.entries(UNIT_RECIPES)) {
    for (const p of recipe) {
      checkPrim(p, name);
      assert.ok(validColor(p.color), `${name}: bad color role "${p.color}"`);
      assert.strictEqual(p.pos.length, 3, `${name}: pos must be [x,y,z]`);
    }
  }
  assert.ok(CITY_RECIPE.house && CITY_RECIPE.roof, 'city recipe carries house + roof');
  checkPrim(CITY_RECIPE.house, 'city.house');
  checkPrim(CITY_RECIPE.roof, 'city.roof');
  for (const [k, p] of Object.entries(PROP_SHAPES)) checkPrim(p, `prop ${k}`);
});

test('PROP_SHAPES covers every tile prop kind the renderer instances', async () => {
  const { PROP_SHAPES } = await load();
  // the prop kinds props.js builds InstancedMeshes for (its `items` buckets)
  const kinds = ['strip', 'roadSeg', 'mine', 'tree', 'scrub', 'rock', 'peak', 'snow',
    'special', 'fortress', 'tie', 'mineDoor', 'mineBeam', 'fieldPatch', 'foam'];
  for (const k of kinds) assert.ok(PROP_SHAPES[k], `prop kind "${k}" missing from PROP_SHAPES`);
  assert.strictEqual(Object.keys(PROP_SHAPES).length, kinds.length, 'no stray/unused prop shapes');
});

test('committed data/asset-recipes.json is in sync with the module', async () => {
  const r = await load();
  const committed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'assets', 'asset-recipes.json'), 'utf8'));
  assert.deepStrictEqual(committed.unitRecipes, r.UNIT_RECIPES, 'unitRecipes drift — run tools/export-asset-recipes.js');
  assert.deepStrictEqual(committed.unitSilhouette, r.UNIT_SILHOUETTE, 'unitSilhouette drift');
  assert.deepStrictEqual(committed.cityRecipe, r.CITY_RECIPE, 'cityRecipe drift');
  assert.deepStrictEqual(committed.propShapes, r.PROP_SHAPES, 'propShapes drift');
  assert.deepStrictEqual(committed.colorRoles, r.COLOR_ROLES, 'colorRoles drift');
});

// A88b coverage gate: createUnitMesh is now data-driven from UNIT_SILHOUETTE +
// unit-chrome.js. Every recipe a unit maps to MUST have a RECIPE_CHROME entry,
// or that unit would render with no pennant/naval base (an unstyled path). This
// gate is what makes deleting the per-type function ladder safe.
test('every UNIT_SILHOUETTE recipe has a RECIPE_CHROME entry (dispatch coverage)', async () => {
  const { UNIT_SILHOUETTE, UNIT_RECIPES } = await load();
  const { RECIPE_CHROME, TYPE_EXTRA } = await import('../client/renderer/three/unit-chrome.js');
  // the fallback target the dispatch defaults to must be styled
  assert.ok(RECIPE_CHROME.fallback, 'RECIPE_CHROME.fallback exists (the default dispatch target)');
  for (const type of Object.keys(UNIT_SILHOUETTE)) {
    const recipe = UNIT_SILHOUETTE[type];
    assert.ok(RECIPE_CHROME[recipe], `unit "${type}" → recipe "${recipe}" has no RECIPE_CHROME entry`);
  }
  // pennant offsets, where present, are [x,y,scale] triples
  for (const [recipe, c] of Object.entries(RECIPE_CHROME)) {
    if (c.pennant !== undefined) assert.strictEqual(c.pennant.length, 3, `${recipe}: pennant must be [x,y,scale]`);
  }
  // every type-level extra names a real recipe body
  for (const [type, extra] of Object.entries(TYPE_EXTRA)) {
    assert.ok(UNIT_RECIPES[extra], `TYPE_EXTRA "${type}" → "${extra}" is not a UNIT_RECIPES key`);
  }
});
