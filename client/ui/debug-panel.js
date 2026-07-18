// A92: the client debug panel — a thin form over the engine's `debug`
// command family (grantGold / spawnUnit / grantTech / revealMap). The
// ENGINE judges everything (state.debugEnabled gate, per-action legality);
// every action is an ordinary LOGGED command, so recordings replay exactly
// and the first success taints the game PERMANENTLY (state.debugUsed —
// docs/07). The panel exists only when the state says the game allows it.
export function initDebugPanel(ctx) {
  const { session, renderer } = ctx;
  if (!session.state || session.state.debugEnabled !== true) return null;

  const box = document.createElement('div');
  box.id = 'debug-panel';
  box.className = 'hidden';
  box.innerHTML = `
    <div id="debug-head">🐞 debug <span id="debug-taint"></span>
      <button id="debug-close" title="close">✕</button></div>
    <div class="debug-row">
      <input id="debug-gold" type="number" value="100" step="50">
      <button id="debug-grant-gold">💰 Grant gold</button>
    </div>
    <div class="debug-row">
      <select id="debug-unit"></select>
      <button id="debug-spawn" title="at the selected unit's tile, else the camera center">⚔ Spawn unit</button>
    </div>
    <div class="debug-row">
      <select id="debug-tech"></select>
      <button id="debug-grant-tech">🔬 Grant tech</button>
    </div>
    <div class="debug-row">
      <button id="debug-reveal">🗺 Reveal map</button>
      <span class="debug-note">first use marks the game ⚠ DEBUG forever</span>
    </div>`;
  document.body.appendChild(box);

  const btn = document.createElement('button');
  btn.id = 'open-debug'; btn.title = 'debug commands (god mode — taints the game)'; btn.textContent = '🐞';
  const corner = document.getElementById('corner-buttons');
  if (corner) corner.appendChild(btn);
  btn.addEventListener('click', () => { box.classList.toggle('hidden'); refresh(); });
  box.querySelector('#debug-close').addEventListener('click', () => box.classList.add('hidden'));

  function refresh() {
    if (box.classList.contains('hidden')) return;
    const units = session.ruleset.units;
    const unitSel = box.querySelector('#debug-unit');
    if (unitSel.options.length === 0) {
      unitSel.innerHTML = Object.keys(units).sort()
        .map(id => `<option value="${id}">${units[id].name}</option>`).join('');
    }
    const me = session.state.players[ctx.HUMAN];
    const techs = session.ruleset.techs;
    const known = (me && me.techs) || [];
    box.querySelector('#debug-tech').innerHTML = Object.keys(techs).sort()
      .filter(id => known.indexOf(id) === -1)
      .map(id => `<option value="${id}">${techs[id].name}</option>`).join('');
    box.querySelector('#debug-taint').textContent =
      session.state.debugUsed === true ? '⚠ tainted' : '';
  }

  function spawnTarget() {
    const u = ctx.sel && ctx.sel.unitId ? session.state.units[ctx.sel.unitId] : null;
    if (u) return { x: u.x, y: u.y };
    const v = renderer && renderer.getView ? renderer.getView() : { x: 0, y: 0 };
    const W = session.state.map.width, H = session.state.map.height;
    let x = Math.round(v.x), y = Math.round(v.y);
    if (session.state.map.wrapX) x = ((x % W) + W) % W;
    else x = Math.max(0, Math.min(W - 1, x));
    y = Math.max(0, Math.min(H - 1, y));
    return { x, y };
  }

  // ctx.apply = input.js's path: REASON_TEXT flash on rejection
  box.querySelector('#debug-grant-gold').addEventListener('click', () => {
    const amount = Number(box.querySelector('#debug-gold').value) || 0;
    ctx.apply({ type: 'debug', playerId: ctx.HUMAN, action: 'grantGold', amount });
  });
  box.querySelector('#debug-spawn').addEventListener('click', () => {
    const t = spawnTarget();
    ctx.apply({ type: 'debug', playerId: ctx.HUMAN, action: 'spawnUnit',
      unitType: box.querySelector('#debug-unit').value, x: t.x, y: t.y });
  });
  box.querySelector('#debug-grant-tech').addEventListener('click', () => {
    const tech = box.querySelector('#debug-tech').value;
    if (tech) ctx.apply({ type: 'debug', playerId: ctx.HUMAN, action: 'grantTech', tech });
  });
  box.querySelector('#debug-reveal').addEventListener('click', () => {
    ctx.apply({ type: 'debug', playerId: ctx.HUMAN, action: 'revealMap' });
  });

  session.onChange(refresh);
  return { refresh };
}
