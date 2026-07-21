// XII.6 Part A — the graphical tech tree (client-only, golden-neutral). A 🌳
// overlay ALONGSIDE the research list: era-colored nodes laid out left→right by
// `level` (every prereq is a strictly-lower level, so the DAG flows forward),
// prereq edges on an SVG layer, pan by drag. Node state comes from the VIEWER's
// own techs (fog-honest): ✓ known / ○ available / · locked, with the current
// `researching` highlighted and the beeline goal + its path picked out. Click an
// available node → setResearch; click a locked/distant node → set the beeline
// goal (Part B). Name labels first; glyphs (Part C) layer in later.
import { nextBeelineStep, goalReached, prereqClosure } from '../../shared/beeline.js';
import { TECH_BLURBS } from './tech-blurbs.js';
import { glyphImg } from './tech-glyphs.js';

const ERA_ORDER = ['ancient', 'renaissance', 'industrial', 'modern'];
const NODE_W = 132, NODE_H = 40, COL_GAP = 56, ROW_GAP = 14, PAD = 40;

export function initTechTree(ctx) {
  const { session } = ctx;
  const techs = session.ruleset.techs;

  const GOAL_KEY = () => 'retromulticiv-researchgoal-' + (session.gameId || 'local');
  let researchGoal = null;
  try { researchGoal = localStorage.getItem(GOAL_KEY()) || null; } catch (e) { /* private mode */ }
  if (researchGoal && !techs[researchGoal]) researchGoal = null;
  function setGoal(id) {
    researchGoal = id;
    try { id ? localStorage.setItem(GOAL_KEY(), id) : localStorage.removeItem(GOAL_KEY()); } catch (e) { /* */ }
  }

  // --- overlay skeleton ------------------------------------------------------
  const overlay = document.createElement('div');
  overlay.id = 'tech-tree';
  overlay.className = 'hidden';
  overlay.innerHTML =
    '<div id="tech-tree-head">🌳 Technology tree'
    + '<span id="tech-tree-legend"><span class="tt-k known">✓ known</span>'
    + '<span class="tt-k avail">○ available</span><span class="tt-k locked">· locked</span>'
    + '<span class="tt-k goalk">◇ beeline goal</span></span>'
    + '<button id="tech-tree-close" title="close">✕</button></div>'
    + '<div id="tech-tree-scroll"><div id="tech-tree-canvas"><svg id="tech-tree-edges"></svg></div></div>';
  document.body.appendChild(overlay);
  const scroll = overlay.querySelector('#tech-tree-scroll');
  const canvas = overlay.querySelector('#tech-tree-canvas');
  const svg = overlay.querySelector('#tech-tree-edges');
  overlay.querySelector('#tech-tree-close').addEventListener('click', () => toggle(false));

  // --- layout (built once — the DAG shape never changes) ---------------------
  const pos = {};   // id -> { x, y }
  const nodeEl = {}; // id -> DOM node
  const ids = Object.keys(techs);
  const byLevel = {};
  for (const id of ids) (byLevel[techs[id].level] = byLevel[techs[id].level] || []).push(id);
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
  let maxRow = 0;
  for (const lv of levels) {
    const col = byLevel[lv].sort();
    for (let r = 0; r < col.length; r++) {
      pos[col[r]] = { x: PAD + (lv - 1) * (NODE_W + COL_GAP), y: PAD + r * (NODE_H + ROW_GAP) };
      if (r > maxRow) maxRow = r;
    }
  }
  const width = PAD * 2 + (levels[levels.length - 1] - 1) * (NODE_W + COL_GAP) + NODE_W;
  const height = PAD * 2 + maxRow * (NODE_H + ROW_GAP) + NODE_H;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // edges: prereq -> tech (id pair kept so we can highlight the beeline path)
  const edgeEl = {}; // "prereq>id" -> <line>
  const SVGNS = 'http://www.w3.org/2000/svg';
  for (const id of ids) {
    for (const p of techs[id].prereqs || []) {
      if (!pos[p]) continue;
      const line = document.createElementNS(SVGNS, 'line');
      line.setAttribute('x1', pos[p].x + NODE_W); line.setAttribute('y1', pos[p].y + NODE_H / 2);
      line.setAttribute('x2', pos[id].x); line.setAttribute('y2', pos[id].y + NODE_H / 2);
      line.setAttribute('class', 'tt-edge');
      svg.appendChild(line);
      edgeEl[p + '>' + id] = line;
    }
  }
  // nodes
  for (const id of ids) {
    const n = document.createElement('button');
    n.className = 'tt-node era-' + techs[id].era;
    n.style.left = pos[id].x + 'px'; n.style.top = pos[id].y + 'px';
    n.setAttribute('data-id', id);
    n.innerHTML = `<span class="tt-state"></span><span class="tt-name">${esc(techs[id].name)}</span>`;
    n.insertBefore(glyphImg(id, techs[id].era, 26), n.querySelector('.tt-name'));
    const blurb = TECH_BLURBS[id] || '';
    const pre = (techs[id].prereqs || []).map(p => techs[p] ? techs[p].name : p).join(', ') || 'none';
    n.title = `${techs[id].name} (${techs[id].era}, level ${techs[id].level})`
      + `\nneeds: ${pre}` + (blurb ? `\n\n${blurb}` : '');
    n.addEventListener('click', () => onNodeClick(id));
    canvas.appendChild(n);
    nodeEl[id] = n;
  }

  // --- pan by drag -----------------------------------------------------------
  let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
  scroll.addEventListener('pointerdown', e => {
    if (e.target.closest('.tt-node')) return; // let node clicks through
    dragging = true; sx = e.clientX; sy = e.clientY; sl = scroll.scrollLeft; st = scroll.scrollTop;
    scroll.setPointerCapture(e.pointerId);
  });
  scroll.addEventListener('pointermove', e => {
    if (!dragging) return;
    scroll.scrollLeft = sl - (e.clientX - sx); scroll.scrollTop = st - (e.clientY - sy);
  });
  for (const ev of ['pointerup', 'pointercancel']) scroll.addEventListener(ev, () => { dragging = false; });

  // --- state + interaction ---------------------------------------------------
  function knownSet() {
    const me = session.state.players[ctx.HUMAN];
    const out = {};
    for (const t of (me && me.techs) || []) out[t] = true;
    return out;
  }
  function stateOf(id, known) {
    if (known[id]) return 'known';
    for (const p of techs[id].prereqs || []) if (!known[p]) return 'locked';
    return 'avail';
  }

  async function onNodeClick(id) {
    if (ctx.SPECTATOR) return; // view-only
    const known = knownSet();
    if (known[id]) return; // already researched — nothing to do
    const s = stateOf(id, known);
    if (s === 'avail') { setGoal(null); await issueResearch(id); }
    else { setGoal(id); await advance(); } // locked/distant → beeline goal
    render();
  }

  async function issueResearch(id) {
    if (ctx.SPECTATOR) return;
    const me = session.state.players[ctx.HUMAN];
    if (me && me.researching === id) return; // already on it
    await session.apply({ type: 'setResearch', playerId: ctx.HUMAN, tech: id });
  }

  // beeline: issue the next step toward the goal if we aren't already on it
  async function advance() {
    if (!researchGoal || ctx.SPECTATOR) return;
    const me = session.state.players[ctx.HUMAN];
    if (!me) return;
    if (goalReached(me.techs || [], researchGoal)) {
      const name = techs[researchGoal].name;
      setGoal(null);
      if (ctx.turnlog && ctx.turnlog.note) ctx.turnlog.note(`🌳 beeline reached: ${name}`);
      if (ctx.hud && ctx.hud.note) ctx.hud.note(`🌳 beeline reached: ${name}`);
      return;
    }
    const next = nextBeelineStep(techs, me.techs || [], researchGoal);
    if (!next) { setGoal(null); return; } // unreachable / stuck → clear
    await issueResearch(next);
  }

  function render() {
    if (overlay.classList.contains('hidden')) return;
    const known = knownSet();
    const me = session.state.players[ctx.HUMAN];
    const researching = me ? me.researching : null;
    // path to the goal (nodes + edges to dash-highlight)
    const onPath = researchGoal && techs[researchGoal] ? prereqClosure(techs, researchGoal) : {};
    for (const id of ids) {
      const n = nodeEl[id];
      const s = stateOf(id, known);
      n.className = 'tt-node era-' + techs[id].era + ' ' + s
        + (researching === id ? ' current' : '')
        + (researchGoal === id ? ' goal' : '')
        + (onPath[id] && !known[id] ? ' onpath' : '');
      const glyph = s === 'known' ? '✓' : s === 'avail' ? '○' : '·';
      n.querySelector('.tt-state').textContent = researchGoal === id ? '◇' : glyph;
    }
    for (const key of Object.keys(edgeEl)) {
      const [p, id] = key.split('>');
      const lit = onPath[p] && onPath[id] && !known[id];
      edgeEl[key].setAttribute('class', 'tt-edge' + (lit ? ' onpath' : '') + (known[id] ? ' done' : ''));
    }
  }

  function toggle(force) {
    const show = force === undefined ? overlay.classList.contains('hidden') : force;
    overlay.classList.toggle('hidden', !show);
    if (show) { render(); centerOnFrontier(); }
  }
  function centerOnFrontier() {
    // scroll so the current research (or the earliest available tech) is visible
    const me = session.state.players[ctx.HUMAN];
    let focus = me && me.researching;
    if (!focus) {
      const known = knownSet();
      focus = ids.filter(id => stateOf(id, known) === 'avail').sort((a, b) => techs[a].level - techs[b].level)[0];
    }
    if (focus && pos[focus]) {
      scroll.scrollLeft = Math.max(0, pos[focus].x - scroll.clientWidth / 2);
      scroll.scrollTop = Math.max(0, pos[focus].y - scroll.clientHeight / 2);
    }
  }

  // --- entry: 🌳 button + Shift+T. XIV §21: it lives in the research panel's
  // LOWER section, labelled "View technology tree" (was a bare 🌳 by the bar).
  // fillResearchPanel only clears #research-list, so a direct child persists.
  const btn = document.createElement('button');
  btn.id = 'open-tech-tree';
  btn.textContent = '🌳 View technology tree';
  btn.title = 'the whole tech tree (Shift+T)';
  btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  const rp = document.getElementById('research-panel');
  const bar = document.getElementById('research-bar');
  if (rp) rp.appendChild(btn);
  else if (bar && bar.parentNode) bar.parentNode.insertBefore(btn, bar.nextSibling); // fallback

  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'T' && e.shiftKey) { e.preventDefault(); toggle(); }
    else if (e.key === 'Escape' && !overlay.classList.contains('hidden')) toggle(false);
  });

  // beeline auto-advance: when a tech completes (or research idles), push the
  // next step toward the goal. Recomputed per ctx.HUMAN — never cached.
  session.onChange(() => { if (researchGoal) advance(); render(); });

  return { toggle, render, get goal() { return researchGoal; } };
}

function esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }
