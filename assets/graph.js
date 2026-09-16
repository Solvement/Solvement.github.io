import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
const TYPE_LABEL = { concept: 'Concept', paper: 'Paper', project: 'Repository', mine: 'My system' };

export function readingGraph(graph, { svg, card, controls, reduced }) {
  const nodes = graph.nodes.map((n) => ({ ...n }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links = graph.links.filter((l) => byId.has(l.source) && byId.has(l.target)).map((l) => ({ ...l }));
  const adj = new Map(nodes.map((n) => [n.id, new Set()]));
  for (const l of links) { adj.get(l.source).add(l.target); adj.get(l.target).add(l.source); }
  const degree = (id) => adj.get(id).size;

  let W = 800, H = 540;
  const gLinks = el('g', { class: 'g-links' }), gNodes = el('g', { class: 'g-nodes' });
  svg.append(gLinks, gNodes);

  const linkEls = links.map((l) => { const line = el('line', { class: 'g-link ' + l.kind }); gLinks.append(line); return line; });
  const nodeEls = nodes.map((n) => {
    const g = el('g', { class: 'g-node ' + n.type, tabindex: '0', role: 'button' });
    const r = n.type === 'concept' ? 5 + Math.min(11, Math.sqrt(n.weight || 1) * 1.7) : n.type === 'mine' ? 9 : 4.5;
    n.r = r;
    if (n.type === 'concept' || n.type === 'mine') g.append(el('circle', { r }));
    else if (n.type === 'paper') g.append(el('rect', { x: -r, y: -r, width: r * 2, height: r * 2 }));
    else g.append(el('path', { d: `M0 ${-r * 1.3} L${r * 1.3} 0 L0 ${r * 1.3} L${-r * 1.3} 0 Z` }));
    if (n.type === 'concept' || n.type === 'mine') {
      const t = el('text', { x: r + 4, y: 3 }); t.textContent = n.label; g.append(t);
    }
    const title = el('title'); title.textContent = n.label; g.append(title);
    g.addEventListener('click', () => select(n.id));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.id); } });
    gNodes.append(g); return g;
  });

  const sim = forceSimulation(nodes)
    .force('link', forceLink(links).id((d) => d.id).distance((l) => l.kind === 'uses' ? 70 : 46).strength(0.5))
    .force('charge', forceManyBody().strength((d) => d.type === 'concept' ? -160 : d.type === 'mine' ? -260 : -40))
    .force('collide', forceCollide().radius((d) => d.r + (d.type === 'concept' ? 14 : 4)))
    .force('x', forceX().strength(0.03)).force('y', forceY().strength(0.05))
    .alphaDecay(0.028)
    .on('tick', draw);

  function size() {
    const b = svg.getBoundingClientRect(); W = Math.max(320, b.width); H = Math.max(320, b.height);
    svg.setAttribute('viewBox', `${-W / 2} ${-H / 2} ${W} ${H}`);
    sim.force('center', forceCenter(0, 0));
  }
  size();
  new ResizeObserver(() => { size(); if (reduced()) { sim.stop(); draw(); } else sim.alpha(0.3).restart(); }).observe(svg.parentElement);
  if (reduced()) { sim.stop(); for (let i = 0; i < 220; i++) sim.tick(); draw(); }

  function draw() {
    const cx = W / 2 - 24, cy = H / 2 - 24;
    for (const n of nodes) { n.x = Math.max(-cx, Math.min(cx, n.x)); n.y = Math.max(-cy, Math.min(cy, n.y)); }
    links.forEach((l, i) => { const L = linkEls[i]; L.setAttribute('x1', l.source.x); L.setAttribute('y1', l.source.y); L.setAttribute('x2', l.target.x); L.setAttribute('y2', l.target.y); });
    nodes.forEach((n, i) => nodeEls[i].setAttribute('transform', `translate(${n.x},${n.y})`));
  }

  /* Drag */
  let dragging = null;
  svg.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.g-node'); if (!g) return;
    const n = nodes[nodeEls.indexOf(g)]; dragging = n; n.fx = n.x; n.fy = n.y;
    svg.setPointerCapture(e.pointerId); if (!reduced()) sim.alphaTarget(0.25).restart();
  });
  svg.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = svgPoint(e); dragging.fx = p.x; dragging.fy = p.y;
    if (reduced()) { dragging.x = p.x; dragging.y = p.y; draw(); }
  });
  const endDrag = () => { if (!dragging) return; dragging.fx = dragging.fy = null; dragging = null; sim.alphaTarget(0); };
  svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag);
  function svgPoint(e) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }

  /* Filters */
  let typeFilter = 'all';
  let focusId = null;
  controls.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    typeFilter = b.dataset.filter; controls.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); apply();
  }));
  controls.querySelectorAll('[data-focus]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.focus; if (focusId === id) { select(null); } else select(id);
  }));

  function select(id) {
    focusId = id;
    controls.querySelectorAll('[data-focus]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.focus === id)));
    apply(); renderCard(id ? byId.get(id) : null);
    if (id && !reduced()) sim.alpha(0.15).restart();
  }

  function visibleByType(n) {
    if (typeFilter === 'all') return true;
    if (n.type === 'concept' || n.type === 'mine') return true;
    return n.type === typeFilter;
  }
  function apply() {
    const hood = focusId ? new Set([focusId, ...adj.get(focusId)]) : null;
    // second ring: neighbours of the concepts around a focused "mine" node
    if (hood && byId.get(focusId).type === 'mine') for (const c of [...adj.get(focusId)]) for (const x of adj.get(c)) hood.add(x);
    nodes.forEach((n, i) => {
      const on = visibleByType(n) && (!hood || hood.has(n.id));
      nodeEls[i].classList.toggle('dim', !on);
      nodeEls[i].classList.toggle('sel', n.id === focusId);
    });
    links.forEach((l, i) => {
      const on = visibleByType(l.source) && visibleByType(l.target) && (!hood || (hood.has(l.source.id) && hood.has(l.target.id)));
      const hot = focusId && (l.source.id === focusId || l.target.id === focusId);
      linkEls[i].classList.toggle('dim', !on); linkEls[i].classList.toggle('hot', !!hot);
    });
  }

  function renderCard(n) {
    card.replaceChildren();
    if (!n) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'Click a node — or start from one of my systems — to see what it rests on and where it came from.'; card.append(p); return; }
    const type = document.createElement('div'); type.className = 'type'; type.textContent = TYPE_LABEL[n.type] + (n.date ? ' · first read ' + n.date : '') + (n.score ? ' · score ' + n.score + '/10' : '');
    const h = document.createElement('h4'); h.textContent = n.label;
    card.append(type, h);
    if (n.sub) { const s = document.createElement('div'); s.className = 'meta'; s.textContent = n.sub; card.append(s); }
    if (n.one) { const o = document.createElement('p'); o.className = 'one'; o.lang = 'zh'; o.textContent = n.one; card.append(o); }
    if (n.verdict) { const v = document.createElement('p'); v.className = 'verdict'; v.lang = 'zh'; v.textContent = n.verdict; card.append(v); }
    if (n.type === 'concept') { const m = document.createElement('div'); m.className = 'meta'; m.textContent = `Appears in ${n.weight} readings`; card.append(m); }
    const nbs = [...adj.get(n.id)].map((id) => byId.get(id)).sort((a, b) => (a.type === 'mine' ? -1 : 0) - (b.type === 'mine' ? -1 : 0) || degree(b.id) - degree(a.id)).slice(0, 14);
    if (nbs.length) {
      const lbl = document.createElement('div'); lbl.className = 'meta'; lbl.textContent = n.type === 'mine' ? 'Rests on' : n.type === 'concept' ? 'Connected to' : 'Prerequisites & related';
      const wrap = document.createElement('div'); wrap.className = 'nb';
      for (const m of nbs) { const b = document.createElement('button'); b.type = 'button'; b.textContent = m.type === 'concept' || m.type === 'mine' ? m.label : m.label.length > 34 ? m.label.slice(0, 32) + '…' : m.label; b.title = m.label; b.addEventListener('click', () => select(m.id)); wrap.append(b); }
      card.append(lbl, wrap);
    }
    const out = document.createElement('div'); out.className = 'out';
    if (n.url) { const a = document.createElement('a'); a.href = n.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = n.type === 'paper' ? 'Paper ↗' : 'Repository ↗'; out.append(a); }
    if (n.code) { const a = document.createElement('a'); a.href = n.code; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Code ↗'; out.append(a); }
    if (n.href) { const a = document.createElement('a'); a.href = n.href; a.textContent = 'See the project ↓'; out.append(a); }
    if (out.children.length) card.append(out);
  }
  apply();
  return () => {
    if (reduced()) { sim.alphaTarget(0); sim.stop(); }
    else sim.alpha(0.15).restart();
  };
}
