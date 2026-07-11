// The full ruleset every test loads — mirrors what the client fetches.
module.exports = {
  terrain: require('../data/terrain.json'),
  units: require('../data/units.json'),
  techs: require('../data/techs.json'),
  buildings: require('../data/buildings.json'),
  wonders: require('../data/wonders.json'),
  governments: require('../data/governments.json'),
  rules: require('../data/rules.json')
};
