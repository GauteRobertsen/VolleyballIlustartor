// App controller: owns state, pointer interaction, editing operations and playback,
// and builds the view model consumed by view.js.

import { Component } from 'https://unpkg.com/preact@10.24.3/dist/preact.module.js';
import { ARROWS, SPEEDS, SWATCHES, SWATCH_NAMES, roleOf } from './constants.js';
import { r3, arrowGeom, zonePath, zoneCenter, strokePath, textOn, darken } from './geometry.js';
import { uid, clone, newFrame, makePlayer, makePlay, sampleProject } from './model.js';
import { PRESETS, buildPreset, simulateRally } from './presets.js';
import { frameView, indexView, interpolate, animProgress } from './animation.js';
import { loadLocal, saveLocal, downloadJson, parseProject, readFile } from './storage.js';
import { History } from './history.js';
import { view } from './view.js';

export class App extends Component {
  constructor(props) {
    super(props);
    this.history = new History();
    this.anim = null; this.drag = null; this.poly = null; this.hover = null;
    this.raf = null; this.holdT = null; this.saveT = null;
    this.dragFrom = null; this.dragOverIdx = null; this.playingFlag = false;
    this.state = {
      project: loadLocal() || sampleProject(), frameIdx: 0, tool: 'select', arrowMode: 'straight', arrowKind: 'run',
      zoneShape: 'rect', zoneColor: '#2563EB', zoneOpacity: 0.25, penColor: '#0F172A', penWidth: 0.08,
      placeChoice: 'next', snap: false, selection: null, playing: false, speed: 'normal', loop: false,
      showGrid: false, showZones: false, showPaths: true, labelMode: 'name', present: false,
      tab: 'plays', autoRally: false, ioOpen: false, confirm: null, newPlay: null, jsonText: '', saveMsg: '', ioMsg: ''
    };
  }

  componentWillUnmount() { cancelAnimationFrame(this.raf); clearTimeout(this.holdT); clearTimeout(this.saveT); }
  render() { return view(this.viewModel()); }

  /* ---------- accessors ---------- */
  play() { const p = this.state.project; return p.plays.find(x => x.id === p.activePlayId) || p.plays[0]; }
  fi() { return Math.max(0, Math.min(this.state.frameIdx, this.play().frames.length - 1)); }
  frame() { return this.play().frames[this.fi()]; }
  teamMap() { const m = {}; for (const t of this.state.project.team) m[t.id] = t; return m; }
  homeColor() { const h = this.state.project.team.find(t => t.side === 'home' && t.role !== 'L'); return h ? h.color : '#2563EB'; }

  /* ---------- history & persistence ---------- */
  commit(mut, key) {
    this.history.record(JSON.stringify(this.state.project), key);
    mut(this.state.project);
    this.changed();
  }
  pushPast(before) { this.history.push(before); this.changed(); }
  changed() { this.setState({}); clearTimeout(this.saveT); this.saveT = setTimeout(() => this.persist(false), 500); }
  persist(announce) {
    const ok = saveLocal(this.state.project);
    const t = new Date(), hh = String(t.getHours()).padStart(2, '0'), mm = String(t.getMinutes()).padStart(2, '0');
    this.setState({ saveMsg: ok ? 'Saved ' + hh + ':' + mm : (announce ? 'Use Export to keep a copy' : '') });
  }
  undo() {
    const snap = this.history.undo(JSON.stringify(this.state.project)); if (!snap) return;
    this.stopAll(); this.state.project = JSON.parse(snap); this.setState({ selection: null }); this.changed();
  }
  redo() {
    const snap = this.history.redo(JSON.stringify(this.state.project)); if (!snap) return;
    this.stopAll(); this.state.project = JSON.parse(snap); this.setState({ selection: null }); this.changed();
  }
  replaceProject(p, msg) {
    this.stopAll(); this.history.push(JSON.stringify(this.state.project));
    this.state.project = p; this.setState({ frameIdx: 0, selection: null, ioMsg: msg || '' }); this.changed();
  }

  /* ---------- pointer coordinates ---------- */
  clampPt(p) {
    let x = Math.max(-3.3, Math.min(21.3, p.x)), y = Math.max(-1.85, Math.min(10.85, p.y));
    if (this.state.snap) { x = Math.round(x * 2) / 2; y = Math.round(y * 2) / 2; }
    return { x, y };
  }
  pt(e) {
    const svg = this.svgEl; if (!svg || !svg.getScreenCTM) return { x: 0, y: 0 };
    const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(m.inverse()); return { x: q.x, y: q.y };
  }

  /* ---------- animation / playback ---------- */
  liveView() {
    const play = this.play();
    if (!this.anim || !play.frames[this.anim.toIdx]) return frameView(this.frame(), play);
    return interpolate(this.anim.from, play.frames[this.anim.toIdx], play, animProgress(this.anim, performance.now()), this.anim.useVia);
  }
  animPos() { if (!this.anim) return this.fi(); const t = animProgress(this.anim, performance.now()); return this.anim.fromPos + (this.anim.toIdx - this.anim.fromPos) * t; }
  startAnim(toIdx) {
    const n = this.play().frames.length;
    if (toIdx < 0 || toIdx >= n) return;
    const cur = this.fi();
    const from = indexView(this.liveView());
    const fromPos = this.anim ? this.animPos() : cur;
    const useVia = !this.anim && toIdx === cur + 1;
    this.drag = null; this.poly = null;
    this.anim = { from, toIdx, fromPos, start: performance.now(), dur: SPEEDS[this.state.speed].dur, useVia };
    const sel = this.state.selection;
    this.setState({ frameIdx: toIdx, selection: sel && (sel.type === 'player' || sel.type === 'ball') ? sel : null });
    this.tick();
  }
  tick() {
    if (this.raf) return;
    const step = () => {
      this.raf = null;
      if (!this.anim) return;
      if (performance.now() - this.anim.start >= this.anim.dur) { this.anim = null; this.setState({}); this.onAnimDone(); return; }
      this.setState({});
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  finishAnim() {
    if (this.anim) { this.anim = null; cancelAnimationFrame(this.raf); this.raf = null; }
    clearTimeout(this.holdT); this.playingFlag = false;
    this.setState({ playing: false });
  }
  stopAll() { this.finishAnim(); this.drag = null; this.poly = null; }
  onAnimDone() {
    if (!this.playingFlag) return;
    const n = this.play().frames.length, i = this.fi(), hold = SPEEDS[this.state.speed].hold;
    clearTimeout(this.holdT);
    if (i < n - 1) this.holdT = setTimeout(() => { if (this.playingFlag) this.startAnim(i + 1); }, hold);
    else if (this.state.autoRally && this.play().sim) this.holdT = setTimeout(() => { if (this.playingFlag) this.runRally(true); }, hold * 3);
    else if (this.state.loop && n > 1) this.holdT = setTimeout(() => { if (this.playingFlag) this.startAnim(0); }, hold * 2.2);
    else { this.playingFlag = false; this.setState({ playing: false }); }
  }
  playAll() {
    const n = this.play().frames.length; if (n < 2) return;
    this.playingFlag = true; this.poly = null; this.setState({ playing: true });
    if (this.anim) return;
    this.startAnim(this.fi() >= n - 1 ? 0 : this.fi() + 1);
  }
  pause() { this.playingFlag = false; clearTimeout(this.holdT); this.setState({ playing: false }); }
  togglePlay() { if (this.state.playing) this.pause(); else this.playAll(); }
  goTo(i) { this.pause(); if (i === this.fi() && !this.anim) return; this.startAnim(i); }
  step(d) { this.pause(); const base = this.anim ? this.anim.toIdx : this.fi(); this.startAnim(base + d); }
  restart() { this.pause(); if (this.fi() !== 0 || this.anim) this.startAnim(0); }

  /* ---------- pointer interaction ---------- */
  beginDrag(e, d) {
    d.before = JSON.stringify(this.state.project); d.moved = false;
    this.drag = d;
    try { this.svgEl.setPointerCapture(e.pointerId); } catch (err) { /* capture is best-effort */ }
  }
  svgDown(e) {
    if (e.button != null && e.button !== 0) return;
    this.svgEl = e.currentTarget;
    if (this.anim || this.state.playing) this.finishAnim();
    this.createAt(e, this.clampPt(this.pt(e)), null);
  }
  createAt(e, p, hitPoint) {
    const s = this.state, tool = s.tool;
    if (tool === 'select' || tool === 'delete') { if (s.selection) this.setState({ selection: null }); return; }
    if (tool === 'player') { this.placePlayer(p); return; }
    if (tool === 'ball') {
      this.commit(() => { const f = this.frame(); f.ball.x = p.x; f.ball.y = p.y; f.ball.hidden = false; });
      this.setState({ selection: { type: 'ball' } });
      this.beginDrag(e, { type: 'ball', p0: p, o: { x: p.x, y: p.y } });
      return;
    }
    if (tool === 'arrow') { const st = hitPoint || p; this.beginDrag(e, { type: 'd-arrow', p0: p, x1: st.x, y1: st.y, x2: st.x, y2: st.y }); this.setState({}); return; }
    if (tool === 'zone') {
      if (s.zoneShape === 'poly') { this.addPolyPoint(p); return; }
      if (s.zoneShape === 'free') this.beginDrag(e, { type: 'd-free', p0: p, pts: [[p.x, p.y]] });
      else this.beginDrag(e, { type: 'd-zone', p0: p, x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      this.setState({}); return;
    }
    if (tool === 'draw') { this.beginDrag(e, { type: 'd-stroke', p0: p, pts: [[p.x, p.y]] }); this.setState({}); }
  }
  objDown(e, type, id) {
    if (e.button != null && e.button !== 0) return;
    e.stopPropagation();
    this.svgEl = (e.currentTarget && e.currentTarget.ownerSVGElement) || this.svgEl;
    if (this.anim || this.state.playing) this.finishAnim();
    const tool = this.state.tool, p = this.clampPt(this.pt(e)), f = this.frame();
    if (tool === 'arrow' || tool === 'zone' || tool === 'draw') {
      let hit = null;
      if (tool === 'arrow' && type === 'player' && f.pos[id]) hit = { x: f.pos[id].x, y: f.pos[id].y };
      if (tool === 'arrow' && type === 'ball') hit = { x: f.ball.x, y: f.ball.y };
      this.createAt(e, p, hit); return;
    }
    if (tool === 'delete') { this.deleteObj(type, id); return; }
    this.setState({ selection: { type, id } });
    if (type === 'player') { const q = f.pos[id]; if (q) this.beginDrag(e, { type: 'player', id, p0: p, o: { x: q.x, y: q.y } }); }
    else if (type === 'ball') this.beginDrag(e, { type: 'ball', p0: p, o: { x: f.ball.x, y: f.ball.y } });
    else {
      const list = type === 'arrow' ? f.arrows : type === 'zone' ? f.zones : f.strokes;
      const o = list.find(x => x.id === id);
      if (o) this.beginDrag(e, { type, id, p0: p, o: clone(o) });
    }
  }
  handleDown(e, h) {
    if (e.button != null && e.button !== 0) return;
    e.stopPropagation();
    this.svgEl = (e.currentTarget && e.currentTarget.ownerSVGElement) || this.svgEl;
    this.beginDrag(e, Object.assign({ type: 'handle', p0: this.clampPt(this.pt(e)) }, h));
  }
  svgMove(e) {
    this.svgEl = e.currentTarget;
    const d = this.drag;
    if (!d) { if (this.poly) { this.hover = this.clampPt(this.pt(e)); this.setState({}); } return; }
    const p = this.clampPt(this.pt(e));
    const dx = p.x - d.p0.x, dy = p.y - d.p0.y;
    if (!d.moved && Math.hypot(dx, dy) < 0.03) return;
    d.moved = true;
    const f = this.frame(), cl = v => this.clampPt(v);
    if (d.type === 'player') { const q = f.pos[d.id]; if (q) { const c = cl({ x: d.o.x + dx, y: d.o.y + dy }); q.x = c.x; q.y = c.y; } }
    else if (d.type === 'ball') { const c = cl({ x: d.o.x + dx, y: d.o.y + dy }); f.ball.x = c.x; f.ball.y = c.y; }
    else if (d.type === 'arrow') { const a = f.arrows.find(x => x.id === d.id); if (a) { a.x1 = d.o.x1 + dx; a.y1 = d.o.y1 + dy; a.x2 = d.o.x2 + dx; a.y2 = d.o.y2 + dy; a.cx = d.o.cx + dx; a.cy = d.o.cy + dy; } }
    else if (d.type === 'zone') { const z = f.zones.find(x => x.id === d.id); if (z) { if (z.pts) z.pts = d.o.pts.map(q => [q[0] + dx, q[1] + dy]); else { z.x = d.o.x + dx; z.y = d.o.y + dy; } } }
    else if (d.type === 'stroke') { const st = f.strokes.find(x => x.id === d.id); if (st) st.pts = d.o.pts.map(q => [q[0] + dx, q[1] + dy]); }
    else if (d.type === 'handle') this.dragHandle(d, p, f);
    else if (d.type === 'd-arrow') { d.x2 = p.x; d.y2 = p.y; }
    else if (d.type === 'd-zone') { d.x1 = p.x; d.y1 = p.y; }
    else if (d.type === 'd-free' || d.type === 'd-stroke') { const l = d.pts[d.pts.length - 1]; if (Math.hypot(p.x - l[0], p.y - l[1]) > 0.12) d.pts.push([p.x, p.y]); }
    this.setState({});
  }
  dragHandle(d, p, f) {
    if (d.kind === 'arrow') {
      const a = f.arrows.find(x => x.id === d.id); if (!a) return;
      if (d.which === 'start') { if (!a.curved) { a.cx = (p.x + a.x2) / 2; a.cy = (p.y + a.y2) / 2; } a.x1 = p.x; a.y1 = p.y; }
      else if (d.which === 'end') { if (!a.curved) { a.cx = (a.x1 + p.x) / 2; a.cy = (a.y1 + p.y) / 2; } a.x2 = p.x; a.y2 = p.y; }
      else { a.curved = true; a.cx = 2 * p.x - (a.x1 + a.x2) / 2; a.cy = 2 * p.y - (a.y1 + a.y2) / 2; }
    } else if (d.kind === 'zone') {
      const z = f.zones.find(x => x.id === d.id); if (!z) return;
      if (z.pts) { if (z.pts[d.idx]) z.pts[d.idx] = [p.x, p.y]; return; }
      const o = d.oz || (d.oz = { x: z.x, y: z.y, w: z.w, h: z.h });
      const corners = [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]];
      const opp = corners[(d.idx + 2) % 4];
      z.x = Math.min(opp[0], p.x); z.y = Math.min(opp[1], p.y);
      z.w = Math.max(0.2, Math.abs(p.x - opp[0])); z.h = Math.max(0.2, Math.abs(p.y - opp[1]));
    } else if (d.kind === 'path') {
      // The handle sits on the curve midpoint; convert it back to the quadratic control point.
      const prev = this.play().frames[this.fi() - 1]; if (!prev) return;
      const a = d.target === 'ball' ? prev.ball : prev.pos[d.id];
      const b = d.target === 'ball' ? f.ball : f.pos[d.id];
      if (!a || !b) return;
      const cx = 2 * p.x - (a.x + b.x) / 2, cy = 2 * p.y - (a.y + b.y) / 2;
      b.via = Math.hypot(cx - (a.x + b.x) / 2, cy - (a.y + b.y) / 2) < 0.12 ? null : { x: cx, y: cy };
    }
  }
  svgUp(e) {
    const d = this.drag; this.drag = null;
    try { if (this.svgEl) this.svgEl.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (!d) return;
    const s = this.state;
    const addTo = (list, obj, type) => { this.commit(() => { this.frame()[list].push(obj); }); this.setState({ selection: type ? { type, id: obj.id } : s.selection }); };
    if (d.type === 'd-arrow') {
      const len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1);
      if (len <= 0.35) { this.setState({}); return; }
      const k = ARROWS[s.arrowKind] || ARROWS.run, curved = s.arrowMode === 'curved';
      const mx = (d.x1 + d.x2) / 2, my = (d.y1 + d.y2) / 2, nx = -(d.y2 - d.y1) / len, ny = (d.x2 - d.x1) / len;
      addTo('arrows', { id: uid(), kind: s.arrowKind, x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, cx: curved ? mx + nx * len * 0.22 : mx, cy: curved ? my + ny * len * 0.22 : my, curved, color: k.color, width: k.width, dash: k.dash, head: 'end' }, 'arrow');
      return;
    }
    if (d.type === 'd-zone') {
      const w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
      if (w > 0.3 && h > 0.3) addTo('zones', { id: uid(), shape: s.zoneShape === 'ellipse' ? 'ellipse' : 'rect', x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w, h, color: s.zoneColor, opacity: s.zoneOpacity, label: '', dashed: false }, 'zone');
      else this.setState({});
      return;
    }
    if (d.type === 'd-free') {
      if (d.pts.length >= 4) addTo('zones', { id: uid(), shape: 'free', pts: d.pts, color: s.zoneColor, opacity: s.zoneOpacity, label: '', dashed: false }, 'zone');
      else this.setState({});
      return;
    }
    if (d.type === 'd-stroke') {
      if (d.pts.length >= 2) addTo('strokes', { id: uid(), pts: d.pts, color: s.penColor, width: s.penWidth }, null);
      else this.setState({});
      return;
    }
    if (d.moved) this.pushPast(d.before); else this.setState({});
  }
  addPolyPoint(p) {
    if (!this.poly) { this.poly = { pts: [[p.x, p.y]] }; this.hover = p; this.setState({}); return; }
    const pts = this.poly.pts, f0 = pts[0], l = pts[pts.length - 1];
    if (pts.length >= 3 && Math.hypot(p.x - f0[0], p.y - f0[1]) < 0.4) { this.finishPoly(); return; }
    if (Math.hypot(p.x - l[0], p.y - l[1]) > 0.08) pts.push([p.x, p.y]);
    this.setState({});
  }
  finishPoly() {
    const poly = this.poly; this.poly = null; this.hover = null;
    if (!poly) return;
    const pts = [];
    for (const q of poly.pts) { const l = pts[pts.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.1) pts.push(q); }
    if (pts.length < 3) { this.setState({}); return; }
    const s = this.state, z = { id: uid(), shape: 'poly', pts, color: s.zoneColor, opacity: s.zoneOpacity, label: '', dashed: false };
    this.commit(() => { this.frame().zones.push(z); });
    this.setState({ selection: { type: 'zone', id: z.id } });
  }
  cancelPoly() { this.poly = null; this.hover = null; this.setState({}); }

  /* ---------- object operations ---------- */
  placePlayer(p) {
    const s = this.state, play = this.play(), ch = s.placeChoice, team = s.project.team;
    let newP = null, pid = null;
    if (ch === 'new' || ch === 'newopp') newP = makePlayer(team, ch === 'newopp' ? 'opp' : 'home', this.homeColor());
    else if (ch === 'next') {
      const b = team.find(t => t.side === 'home' && !play.roster.includes(t.id)) || team.find(t => !play.roster.includes(t.id));
      if (b) pid = b.id; else newP = makePlayer(team, 'home', this.homeColor());
    } else pid = ch;
    if (newP) pid = newP.id;
    this.commit(pr => {
      if (newP) pr.team.push(newP);
      const pl = this.play();
      if (!pl.roster.includes(pid)) { pl.roster.push(pid); pl.frames.forEach(f => { f.pos[pid] = { x: p.x, y: p.y, hidden: false, via: null }; }); }
      else { const f = this.frame(), q = f.pos[pid]; if (q) { q.x = p.x; q.y = p.y; q.hidden = false; } else f.pos[pid] = { x: p.x, y: p.y, hidden: false, via: null }; }
    });
    this.setState({ selection: { type: 'player', id: pid }, placeChoice: 'next' });
  }
  addToPlay(pid) {
    const t = this.teamMap()[pid]; if (!t) return;
    const home = t.side !== 'opp', used = Object.values(this.frame().pos);
    let x = home ? 4.5 : 13.5, y = 4.5, k = 0;
    while (used.some(q => Math.hypot(q.x - x, q.y - y) < 0.8) && k < 12) { y = 1 + ((k * 1.7) % 7.5); x = (home ? 3 : 12) + (k % 3) * 1.5; k++; }
    this.commit(() => { const pl = this.play(); if (!pl.roster.includes(pid)) { pl.roster.push(pid); pl.frames.forEach(f => { f.pos[pid] = { x, y, hidden: false, via: null }; }); } });
  }
  removeFromPlay(pid) {
    this.commit(() => { const pl = this.play(); pl.roster = pl.roster.filter(x => x !== pid); pl.frames.forEach(f => { delete f.pos[pid]; }); });
    this.setState({ selection: null });
  }
  deleteTeamPlayer(pid) {
    this.commit(pr => { pr.team = pr.team.filter(t => t.id !== pid); pr.plays.forEach(pl => { pl.roster = pl.roster.filter(x => x !== pid); pl.frames.forEach(f => { delete f.pos[pid]; }); }); });
    this.setState({ selection: null, confirm: null });
  }
  deleteObj(type, id) {
    if (type === 'player') { this.removeFromPlay(id); return; }
    this.commit(() => {
      const f = this.frame();
      if (type === 'ball') f.ball.hidden = true;
      if (type === 'arrow') f.arrows = f.arrows.filter(a => a.id !== id);
      if (type === 'zone') f.zones = f.zones.filter(z => z.id !== id);
      if (type === 'stroke') f.strokes = f.strokes.filter(z => z.id !== id);
    });
    this.setState({ selection: null });
  }
  deleteSel() { const s = this.state.selection; if (s) this.deleteObj(s.type, s.id); }
  editSel(fn, key) {
    const s = this.state.selection; if (!s) return;
    this.commit(() => {
      const f = this.frame();
      const list = s.type === 'arrow' ? f.arrows : s.type === 'zone' ? f.zones : s.type === 'stroke' ? f.strokes : [];
      const o = list.find(x => x.id === s.id);
      if (o) fn(o);
    }, key);
  }
  editTeam(pid, fn, key) { this.commit(pr => { const t = pr.team.find(x => x.id === pid); if (t) fn(t); }, key); }

  /* ---------- frames & plays ---------- */
  addFrame() {
    this.stopAll();
    const pl = this.play(), cur = this.frame(), i = this.fi();
    const f = newFrame('Position ' + (pl.frames.length + 1));
    for (const k in cur.pos) { const q = cur.pos[k]; f.pos[k] = { x: q.x, y: q.y, hidden: !!q.hidden, via: null }; }
    f.ball = { x: cur.ball.x, y: cur.ball.y, hidden: !!cur.ball.hidden, via: null };
    this.commit(() => { this.play().frames.splice(i + 1, 0, f); });
    this.setState({ frameIdx: i + 1, selection: null });
  }
  dupFrame() {
    this.stopAll();
    const i = this.fi(), f = clone(this.frame()); f.id = uid(); f.name = f.name + ' (copy)';
    this.commit(() => { this.play().frames.splice(i + 1, 0, f); });
    this.setState({ frameIdx: i + 1, selection: null });
  }
  delFrame() {
    const pl = this.play(); if (pl.frames.length < 2) return;
    this.stopAll();
    const i = this.fi();
    this.commit(() => { this.play().frames.splice(i, 1); });
    this.setState({ frameIdx: Math.max(0, Math.min(i, pl.frames.length - 1)), selection: null });
  }
  moveFrame(from, to) {
    const pl = this.play(); if (to < 0 || to >= pl.frames.length || from === to) return;
    this.stopAll();
    this.commit(() => { const fr = this.play().frames; const [f] = fr.splice(from, 1); fr.splice(to, 0, f); });
    this.setState({ frameIdx: to });
  }
  openPlay(id) {
    this.stopAll(); this.state.project.activePlayId = id;
    this.setState({ frameIdx: 0, selection: null, confirm: null }); this.changed();
  }
  createPlay() {
    const np = this.state.newPlay || {};
    const play = makePlay(this.state.project.team, (np.name || '').trim() || np.cat || 'Custom Play', np.cat || 'Custom Play');
    this.stopAll();
    this.commit(p => { p.plays.push(play); p.activePlayId = play.id; });
    this.setState({ newPlay: null, frameIdx: 0, selection: null });
  }
  addPreset(id) {
    const { play, added } = buildPreset(id, this.state.project.team, this.homeColor());
    this.stopAll();
    this.commit(p => { p.team.push(...added); p.plays.push(play); p.activePlayId = play.id; });
    this.setState({ frameIdx: 0, selection: null, showZones: true });
  }
  // Rally simulator: replaces the "Rally simulation" play's positions with a new random rally and plays it.
  runRally(auto) {
    const pr = this.state.project;
    let play = pr.plays.find(p => p.sim);
    const showing = play && this.play() === play;
    const from = showing ? indexView(this.liveView()) : null;
    const res = simulateRally(pr.team, this.homeColor(), play ? play.sim : null);
    clearTimeout(this.holdT); cancelAnimationFrame(this.raf); this.raf = null; this.anim = null; this.drag = null; this.poly = null;
    if (!auto) this.history.push(JSON.stringify(pr));
    pr.team.push(...res.added);
    if (!play) { play = { id: uid(), name: res.title, category: 'Custom Play', roster: res.roster, frames: res.frames, sim: res.sim }; pr.plays.push(play); }
    else Object.assign(play, { name: res.title, roster: res.roster, frames: res.frames, sim: res.sim });
    pr.activePlayId = play.id;
    this.playingFlag = true;
    this.setState({ frameIdx: 0, selection: null, playing: true, confirm: null });
    this.changed();
    if (from) { this.anim = { from, toIdx: 0, fromPos: 0, start: performance.now(), dur: SPEEDS[this.state.speed].dur, useVia: false }; this.tick(); }
    else this.holdT = setTimeout(() => { if (this.playingFlag) this.startAnim(1); }, SPEEDS[this.state.speed].hold * 2);
  }
  toggleAutoRally() {
    const on = !this.state.autoRally;
    this.setState({ autoRally: on });
    if (on && !this.state.playing) this.runRally(true);
  }
  dupPlay(id) {
    const src = this.state.project.plays.find(p => p.id === id); if (!src) return;
    const c = clone(src); c.id = uid(); c.name = src.name + ' (copy)';
    this.stopAll();
    this.commit(p => { const i = p.plays.findIndex(x => x.id === id); p.plays.splice(i + 1, 0, c); p.activePlayId = c.id; });
    this.setState({ frameIdx: 0, selection: null });
  }
  delPlay(id) {
    if (this.state.project.plays.length < 2) return;
    this.stopAll();
    this.commit(p => { p.plays = p.plays.filter(x => x.id !== id); if (!p.plays.some(x => x.id === p.activePlayId)) p.activePlayId = p.plays[0].id; });
    this.setState({ frameIdx: 0, selection: null, confirm: null });
  }

  /* ---------- import / export ---------- */
  download() {
    try { downloadJson(this.state.project); this.setState({ ioMsg: 'File downloaded.' }); }
    catch (e) { this.setState({ ioMsg: 'Download blocked. Copy the text below instead.' }); }
  }
  async loadFile(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const txt = await readFile(file); e.target.value = '';
    this.importJson(txt);
  }
  importJson(txt) {
    const p = parseProject(txt);
    if (!p) { this.setState({ ioMsg: 'That does not look like a tactics file.' }); return; }
    this.replaceProject(p, 'Loaded ' + p.plays.length + ' play' + (p.plays.length === 1 ? '' : 's') + '.');
    this.setState({ jsonText: JSON.stringify(p) });
  }

  /* ---------- keyboard ---------- */
  onKey(e) {
    const tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const k = e.key, mod = e.ctrlKey || e.metaKey, lk = (k || '').toLowerCase();
    if (mod && lk === 'z') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
    if (mod && lk === 'y') { e.preventDefault(); this.redo(); return; }
    if (mod) return;
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); this.deleteSel(); return; }
    if (k === ' ') { e.preventDefault(); this.togglePlay(); return; }
    if (k === 'ArrowRight') { e.preventDefault(); this.step(1); return; }
    if (k === 'ArrowLeft') { e.preventDefault(); this.step(-1); return; }
    if (k === 'Enter' && this.poly) { this.finishPoly(); return; }
    if (k === 'Escape') { if (this.poly) this.cancelPoly(); else if (this.state.present) this.setState({ present: false }); else this.setState({ selection: null }); return; }
    if (this.state.present) return;
    const map = { v: 'select', p: 'player', b: 'ball', a: 'arrow', z: 'zone', d: 'draw', x: 'delete' };
    if (map[lk]) this.setTool(map[lk]);
  }
  setTool(t) { this.poly = null; this.hover = null; this.setState({ tool: t }); }

  /* ---------- view model ---------- */
  viewModel() {
    const s = this.state, pr = s.project, play = this.play(), frames = play.frames;
    const fi = this.fi(), frame = frames[fi], tm = this.teamMap();
    const animating = !!this.anim, live = this.liveView(), editing = !animating && !s.present;
    let sel = s.selection;
    const exists = (list, id) => list.some(a => a.id === id);
    if (sel && ((sel.type === 'arrow' && !exists(frame.arrows, sel.id)) || (sel.type === 'zone' && !exists(frame.zones, sel.id)) ||
      (sel.type === 'stroke' && !exists(frame.strokes, sel.id)) || (sel.type === 'player' && !tm[sel.id]))) sel = null;
    const isSel = (type, id) => !!sel && sel.type === type && (type === 'ball' || sel.id === id);

    /* players, labels, ball */
    const pv = live.players.filter(p => tm[p.id]).sort((a, b) => (isSel('player', a.id) ? 1 : 0) - (isSel('player', b.id) ? 1 : 0));
    const players = pv.map(p => {
      // The role sits inside the marker, the shirt number in the badge at the top right.
      const t = tm[p.id], role = roleOf(t.role), num = String(t.number), bw = num.length * 0.13 + 0.17;
      return {
        key: p.id, tf: `translate(${r3(p.x)} ${r3(p.y)})`, op: r3(p.o), color: t.color, txt: textOn(t.color), num, abbr: role.abbr,
        fs: role.abbr.length > 2 ? 0.27 : role.abbr.length > 1 ? 0.33 : 0.42, selected: isSel('player', p.id) && editing,
        bw: r3(bw), bx: r3(-bw / 2),
        down: e => this.objDown(e, 'player', p.id)
      };
    });
    const labels = s.labelMode === 'none' ? [] : pv.map(p => {
      const t = tm[p.id], role = roleOf(t.role);
      const text = s.labelMode === 'name-role' ? t.name + ' · ' + role.name : s.labelMode === 'role' ? role.name : t.name;
      const w = text.length * 0.148 + 0.34;
      return { key: p.id, tf: `translate(${r3(p.x)} ${r3(p.y)})`, op: r3(p.o), text, w: r3(w), x: r3(-w / 2) };
    });
    const ball = { show: live.ball.o > 0.01, tf: `translate(${r3(live.ball.x)} ${r3(live.ball.y)})`, op: r3(live.ball.o), selected: isSel('ball') && editing, down: e => this.objDown(e, 'ball', 'ball') };

    /* tactical objects */
    const arrows = live.arrows.map((a, i) => {
      const g = arrowGeom(a), w = a.width;
      return { key: a.id + i, d: g.d, head: g.head, head2: g.head2, hit: g.hit, color: a.color, w: r3(w), glow: r3(w + 0.12),
        dash: a.dash ? r3(w * 2.4) + ' ' + r3(w * 1.7) : 'none', op: r3(a.o), selected: isSel('arrow', a.id) && editing, down: e => this.objDown(e, 'arrow', a.id) };
    });
    const zones = live.zones.map((z, i) => {
      const c = zoneCenter(z), selz = isSel('zone', z.id) && editing;
      return { key: z.id + i, d: zonePath(z), color: z.color, fo: r3(z.opacity), sw: selz ? 0.09 : 0.05, dash: selz || z.dashed ? '0.2 0.12' : 'none',
        op: r3(z.o), label: z.label || '', lx: r3(c.x), ly: r3(c.y), textColor: darken(z.color), down: e => this.objDown(e, 'zone', z.id) };
    });
    const strokes = live.strokes.map((st, i) => ({ key: st.id + i, d: strokePath(st.pts), color: st.color, w: r3(st.width), op: r3(st.o), selected: isSel('stroke', st.id) && editing, down: e => this.objDown(e, 'stroke', st.id) }));

    /* movement paths from the previous position + edit handles */
    const ghosts = [], handles = [];
    const prev = fi > 0 ? frames[fi - 1] : null;
    const pathOf = (a, b) => { const c = b.via || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; return { c, d: `M${r3(a.x)} ${r3(a.y)}Q${r3(c.x)} ${r3(c.y)} ${r3(b.x)} ${r3(b.y)}` }; };
    const midH = (a, c, b, h) => ({ x: r3(0.25 * a.x + 0.5 * c.x + 0.25 * b.x), y: r3(0.25 * a.y + 0.5 * c.y + 0.25 * b.y), r: 0.17, fill: '#FB923C', stroke: '#FFFFFF', down: e => this.handleDown(e, h) });
    if (prev && s.showPaths && editing) {
      for (const id of play.roster) {
        const a = prev.pos[id], b = frame.pos[id], t = tm[id];
        if (!a || !b || a.hidden || b.hidden || !t || Math.hypot(a.x - b.x, a.y - b.y) <= 0.05) continue;
        const on = isSel('player', id), pp = pathOf(a, b);
        ghosts.push({ key: id, d: pp.d, color: on ? '#FFFFFF' : t.color, w: on ? 0.07 : 0.045, so: on ? 0.95 : 0.6, x: r3(a.x), y: r3(a.y), r: 0.43 });
        if (on) handles.push(midH(a, pp.c, b, { kind: 'path', target: 'player', id }));
      }
      const a = prev.ball, b = frame.ball;
      if (!a.hidden && !b.hidden && Math.hypot(a.x - b.x, a.y - b.y) > 0.05) {
        const on = isSel('ball'), pp = pathOf(a, b);
        ghosts.push({ key: 'ball', d: pp.d, color: on ? '#FFFFFF' : '#FDE047', w: on ? 0.06 : 0.04, so: on ? 0.95 : 0.7, x: r3(a.x), y: r3(a.y), r: 0.27 });
        if (on) handles.push(midH(a, pp.c, b, { kind: 'path', target: 'ball' }));
      }
    }
    const hnd = (x, y, fill, stroke, h) => ({ x: r3(x), y: r3(y), r: 0.15, fill, stroke, down: e => this.handleDown(e, h) });
    if (editing && sel && sel.type === 'arrow') {
      const a = frame.arrows.find(x => x.id === sel.id), g = arrowGeom(Object.assign({}, a, { prog: 1 }));
      handles.push(hnd(a.x1, a.y1, '#FFFFFF', '#0E1726', { kind: 'arrow', id: a.id, which: 'start' }));
      handles.push(hnd(a.x2, a.y2, '#FFFFFF', '#0E1726', { kind: 'arrow', id: a.id, which: 'end' }));
      handles.push(hnd(g.mid.x, g.mid.y, '#FB923C', '#FFFFFF', { kind: 'arrow', id: a.id, which: 'mid' }));
    }
    if (editing && sel && sel.type === 'zone') {
      const z = frame.zones.find(x => x.id === sel.id);
      const pts = z.pts ? (z.shape === 'poly' ? z.pts : []) : [[z.x, z.y], [z.x + z.w, z.y], [z.x + z.w, z.y + z.h], [z.x, z.y + z.h]];
      pts.forEach((q, idx) => handles.push(hnd(q[0], q[1], '#FFFFFF', '#0E1726', { kind: 'zone', id: z.id, idx })));
    }

    /* in-progress drawing */
    const draft = { d: '', head: '', fill: 'none', fo: 0, stroke: '#FFFFFF', w: 0.06, dash: 'none', pts: [] };
    const d = this.drag;
    if (d && d.type === 'd-arrow') {
      const k = ARROWS[s.arrowKind] || ARROWS.run, curved = s.arrowMode === 'curved';
      const len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) || 1, mx = (d.x1 + d.x2) / 2, my = (d.y1 + d.y2) / 2, nx = -(d.y2 - d.y1) / len, ny = (d.x2 - d.x1) / len;
      const g = arrowGeom({ x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, cx: curved ? mx + nx * len * 0.22 : mx, cy: curved ? my + ny * len * 0.22 : my, curved, width: k.width, head: 'end', prog: 1 });
      Object.assign(draft, { d: g.d, head: g.head, stroke: k.color, w: k.width, dash: k.dash ? r3(k.width * 2.4) + ' ' + r3(k.width * 1.7) : 'none' });
    } else if (d && d.type === 'd-zone') {
      const z = { shape: s.zoneShape === 'ellipse' ? 'ellipse' : 'rect', x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) };
      Object.assign(draft, { d: zonePath(z), fill: s.zoneColor, fo: s.zoneOpacity, stroke: s.zoneColor, dash: '0.2 0.12' });
    } else if (d && d.type === 'd-free') {
      Object.assign(draft, { d: zonePath({ shape: 'free', pts: d.pts }), fill: s.zoneColor, fo: s.zoneOpacity, stroke: s.zoneColor, dash: '0.2 0.12' });
    } else if (d && d.type === 'd-stroke') {
      Object.assign(draft, { d: strokePath(d.pts), stroke: s.penColor, w: s.penWidth });
    } else if (this.poly) {
      const pts = this.poly.pts, hv = this.hover;
      let dd = 'M' + pts.map(q => r3(q[0]) + ' ' + r3(q[1])).join('L');
      if (hv) dd += 'L' + r3(hv.x) + ' ' + r3(hv.y);
      Object.assign(draft, { d: dd, fill: s.zoneColor, fo: s.zoneOpacity * 0.7, stroke: s.zoneColor, dash: '0.2 0.12', pts: pts.map((q, i) => ({ x: r3(q[0]), y: r3(q[1]), r: i === 0 ? 0.2 : 0.11 })) });
    }

    /* timeline */
    const n = frames.length, pos = animating ? this.animPos() : fi, pct = n > 1 ? (pos / (n - 1)) * 100 : 100;
    const ticks = frames.map((f, i) => ({ cls: i <= pos + 0.001 ? 'tick done' : 'tick', left: (n > 1 ? (i / (n - 1)) * 100 : 100) + '%' }));
    const cards = frames.map((f, i) => {
      const dots = [];
      for (const id of play.roster) { const q = f.pos[id], t = tm[id]; if (q && !q.hidden && t) dots.push({ x: r3(q.x), y: r3(q.y), color: t.color }); }
      return {
        key: f.id, cls: 'card' + (i === fi ? ' on' : '') + (this.dragOverIdx === i ? ' dragover' : ''), num: i + 1, name: f.name, aria: 'Position ' + (i + 1) + ': ' + f.name,
        dots, ball: !f.ball.hidden, bx: r3(f.ball.x), by: r3(f.ball.y),
        zones: f.zones.map(z => ({ d: zonePath(z), color: z.color, fo: z.opacity })),
        arrows: f.arrows.map(a => ({ d: arrowGeom(Object.assign({}, a, { prog: 1, head: 'none' })).d, color: a.color })),
        click: () => this.goTo(i),
        dragStart: e => { this.dragFrom = i; try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } catch (err) { /* ignore */ } },
        dragOver: e => { if (this.dragFrom == null) return; e.preventDefault(); if (this.dragOverIdx !== i) { this.dragOverIdx = i; this.setState({}); } },
        dragLeave: () => { if (this.dragOverIdx === i) { this.dragOverIdx = null; this.setState({}); } },
        drop: e => { e.preventDefault(); const from = this.dragFrom; this.dragFrom = null; this.dragOverIdx = null; if (from != null) this.moveFrame(from, i); else this.setState({}); },
        dragEnd: () => { this.dragFrom = null; this.dragOverIdx = null; this.setState({}); }
      };
    });

    /* sidebars */
    const plays = pr.plays.map(p => ({
      key: p.id, name: p.name, cat: p.category, count: p.frames.length + (p.frames.length === 1 ? ' position' : ' positions'),
      cls: 'item' + (p.id === play.id ? ' on' : ''), active: p.id === play.id && s.confirm !== 'play:' + p.id, onlyOne: pr.plays.length < 2,
      confirming: s.confirm === 'play:' + p.id,
      open: () => { if (p.id !== play.id) this.openPlay(p.id); }, dup: () => this.dupPlay(p.id), del: () => this.setState({ confirm: 'play:' + p.id }),
      yes: () => this.delPlay(p.id), no: () => this.setState({ confirm: null })
    }));
    const teamItem = t => {
      const inPlay = play.roster.includes(t.id);
      return { key: t.id, name: t.name, num: t.number, role: roleOf(t.role).name, dotStyle: `background:${t.color};color:${textOn(t.color)}`,
        cls: 'item' + (isSel('player', t.id) ? ' on' : ''), chip: inPlay ? 'On court' : 'Bench', chipCls: inPlay ? 'chip court' : 'chip',
        pick: () => this.setState({ selection: { type: 'player', id: t.id }, confirm: null }) };
    };
    const swList = (cur, pick) => SWATCHES.map((c, i) => ({ key: c, style: 'background:' + c, cls: 'sw' + (String(cur).toLowerCase() === c.toLowerCase() ? ' on' : ''), label: SWATCH_NAMES[i], pick: () => pick(c) }));
    const bench = pr.team.filter(t => !play.roster.includes(t.id));
    const placeOptions = [{ v: 'next', label: 'Next player' }]
      .concat(bench.map(t => ({ v: t.id, label: '#' + t.number + ' ' + t.name })), [{ v: 'new', label: '+ New player' }, { v: 'newopp', label: '+ New opponent' }])
      .map(o => ({ key: o.v, label: o.label, cls: 'toggle' + (s.placeChoice === o.v ? ' on' : ''), pick: () => this.setState({ placeChoice: o.v }) }));
    const arrowKinds = Object.keys(ARROWS).map(k => ({ key: k, label: ARROWS[k].label, color: ARROWS[k].color, dash: ARROWS[k].dash ? '3 2' : 'none', cls: 'toggle' + (s.arrowKind === k ? ' on' : ''), pick: () => this.setState({ arrowKind: k }) }));

    /* properties panel for the selection */
    let sp = null, sa = null, sz = null, ss = null;
    if (sel && sel.type === 'player') {
      const t = tm[sel.id], id = sel.id, inPlay = play.roster.includes(id), q = frame.pos[id], role = roleOf(t.role);
      sp = {
        name: t.name, number: t.number, role: t.role, side: t.side, color: t.color, title: `${t.name} #${t.number} – ${role.name}`,
        dotStyle: `background:${t.color};color:${textOn(t.color)}`, inPlay, visible: !!(q && !q.hidden),
        hasPathCtl: inPlay && fi > 0 && s.showPaths, noVia: !(q && q.via), confirming: s.confirm === 'tp:' + id,
        swatches: swList(t.color, c => this.editTeam(id, x => { x.color = c; })),
        setName: e => { const v = e.target.value; this.editTeam(id, x => { x.name = v; }, 'pn' + id); },
        setNumber: e => { const v = parseInt(e.target.value, 10); this.editTeam(id, x => { x.number = isNaN(v) ? 0 : Math.max(0, Math.min(99, v)); }, 'pnum' + id); },
        setRole: e => { const v = e.target.value; this.editTeam(id, x => { x.role = v; }); },
        setSide: e => { const v = e.target.value; this.editTeam(id, x => { x.side = v; }); },
        setColor: e => { const v = e.target.value; this.editTeam(id, x => { x.color = v; }, 'pc' + id); },
        toggleVisible: () => this.commit(() => { const f = this.frame(), qq = f.pos[id]; if (qq) qq.hidden = !qq.hidden; else f.pos[id] = { x: 4.5, y: 4.5, hidden: false, via: null }; }),
        straighten: () => this.commit(() => { const qq = this.frame().pos[id]; if (qq) qq.via = null; }),
        removeFromPlay: () => this.removeFromPlay(id), addToPlay: () => this.addToPlay(id),
        askDelete: () => this.setState({ confirm: 'tp:' + id }), yes: () => this.deleteTeamPlayer(id), no: () => this.setState({ confirm: null })
      };
    }
    if (sel && sel.type === 'arrow') {
      const a = frame.arrows.find(x => x.id === sel.id);
      sa = {
        color: a.color, width: a.width, head: a.head || 'end', curved: !!a.curved, dash: !!a.dash,
        kinds: Object.keys(ARROWS).map(k => ({ key: k, label: ARROWS[k].label, cls: 'toggle' + (a.kind === k ? ' on' : ''), pick: () => this.editSel(o => { const st = ARROWS[k]; o.kind = k; o.color = st.color; o.width = st.width; o.dash = st.dash; }) })),
        swatches: swList(a.color, c => this.editSel(o => { o.color = c; })),
        setColor: e => { const v = e.target.value; this.editSel(o => { o.color = v; }, 'ac' + a.id); },
        setWidth: e => { const v = parseFloat(e.target.value); this.editSel(o => { o.width = v; }, 'aw' + a.id); },
        setHead: e => { const v = e.target.value; this.editSel(o => { o.head = v; }); },
        toggleCurved: () => this.editSel(o => {
          o.cx = (o.x1 + o.x2) / 2; o.cy = (o.y1 + o.y2) / 2;
          if (!o.curved) { o.cx -= (o.y2 - o.y1) * 0.22; o.cy += (o.x2 - o.x1) * 0.22; }
          o.curved = !o.curved;
        }),
        toggleDash: () => this.editSel(o => { o.dash = !o.dash; })
      };
    }
    if (sel && sel.type === 'zone') {
      const z = frame.zones.find(x => x.id === sel.id);
      sz = {
        label: z.label || '', color: z.color, opacity: z.opacity, pct: Math.round(z.opacity * 100) + '% fill', dashed: !!z.dashed,
        shapeName: { rect: 'Rectangle', ellipse: 'Circle', poly: 'Polygon', free: 'Freeform' }[z.shape] || 'Area',
        swatches: swList(z.color, c => this.editSel(o => { o.color = c; })),
        setLabel: e => { const v = e.target.value; this.editSel(o => { o.label = v; }, 'zl' + z.id); },
        setColor: e => { const v = e.target.value; this.editSel(o => { o.color = v; }, 'zc' + z.id); },
        setOpacity: e => { const v = parseFloat(e.target.value); this.editSel(o => { o.opacity = v; }, 'zo' + z.id); },
        toggleDashed: () => this.editSel(o => { o.dashed = !o.dashed; })
      };
    }
    if (sel && sel.type === 'stroke') {
      const st = frame.strokes.find(x => x.id === sel.id);
      ss = { width: st.width, swatches: swList(st.color, c => this.editSel(o => { o.color = c; })), setWidth: e => { const v = parseFloat(e.target.value); this.editSel(o => { o.width = v; }, 'sw' + st.id); } };
    }

    const viewToggles = [['grid', 'Grid', 'showGrid'], ['zones', 'Zones 1–6', 'showZones'], ['paths', 'Paths', 'showPaths'], ['snap', 'Snap', 'snap']]
      .map(([key, label, k]) => ({ key, label, on: !!s[k], toggle: () => this.setState({ [k]: !s[k] }) }));
    const pwKey = s.penWidth <= 0.05 ? 'thin' : s.penWidth >= 0.12 ? 'thick' : 'mid';
    const counts = [play.roster.filter(id => frame.pos[id] && !frame.pos[id].hidden).length + ' players', frame.arrows.length + ' arrows', frame.zones.length + ' zones'];

    return {
      s, present: s.present, editing,
      onKey: e => this.onKey(e),
      play: { name: play.name, category: play.category },
      setPlayName: e => { const v = e.target.value; this.commit(() => { this.play().name = v; }, 'playname' + play.id); },
      setPlayCat: e => { const v = e.target.value; this.commit(() => { this.play().category = v; }); },
      undo: () => this.undo(), redo: () => this.redo(), canUndo: this.history.canUndo, canRedo: this.history.canRedo,
      saveNow: () => { clearTimeout(this.saveT); this.persist(true); },
      openIO: () => this.setState({ ioOpen: true, ioMsg: '', jsonText: JSON.stringify(this.state.project) }),
      closeIO: () => this.setState({ ioOpen: false }),
      setJsonText: e => this.setState({ jsonText: e.target.value }),
      importText: () => this.importJson(s.jsonText), download: () => this.download(), loadFile: e => this.loadFile(e),
      loadSample: () => this.replaceProject(sampleProject(), 'Example plays loaded (Undo brings yours back).'),
      togglePresent: () => { this.poly = null; this.setState({ present: !s.present, selection: null }); },
      setTab: tab => this.setState({ tab }),
      startNewPlay: () => this.setState({ newPlay: { name: '', cat: 'Serve Receive' } }), cancelNewPlay: () => this.setState({ newPlay: null }),
      setNewPlayName: e => this.setState({ newPlay: Object.assign({}, s.newPlay, { name: e.target.value }) }),
      setNewPlayCat: e => this.setState({ newPlay: Object.assign({}, s.newPlay, { cat: e.target.value }) }),
      createPlay: () => this.createPlay(), plays, runRally: () => this.runRally(false), toggleAutoRally: () => this.toggleAutoRally(),
      presets: PRESETS.map(p => ({ key: p.id, label: p.label, add: () => this.addPreset(p.id) })),
      homeList: pr.team.filter(t => t.side === 'home').map(teamItem), oppList: pr.team.filter(t => t.side === 'opp').map(teamItem),
      teamSwatches: swList(this.homeColor(), c => this.commit(p => { p.team.forEach(t => { if (t.side === 'home' && t.role !== 'L') t.color = c; }); })),
      addPlayer: side => { const t = makePlayer(pr.team, side, this.homeColor()); this.commit(p => { p.team.push(t); }); this.setState({ selection: { type: 'player', id: t.id } }); },
      setTool: t => this.setTool(t), viewToggles, setLabelMode: e => this.setState({ labelMode: e.target.value }),
      placeOptions, arrowKinds, setArrowMode: m => this.setState({ arrowMode: m }),
      setZoneShape: sh => { if (sh !== 'poly') this.poly = null; this.setState({ zoneShape: sh }); },
      zoneSwatches: swList(s.zoneColor, c => this.setState({ zoneColor: c })), setZoneOpacity: e => this.setState({ zoneOpacity: parseFloat(e.target.value) }),
      polyActive: !!this.poly, finishPoly: () => this.finishPoly(), cancelPoly: () => this.cancelPoly(),
      penSwatches: swList(s.penColor, c => this.setState({ penColor: c })), pwKey, setPenWidth: w => this.setState({ penWidth: w }),
      svgDown: e => this.svgDown(e), svgMove: e => this.svgMove(e), svgUp: e => this.svgUp(e), svgDbl: () => { if (this.poly) this.finishPoly(); },
      zones, strokes, ghosts, arrows, players, ball, labels, handles, draft,
      frameNum: fi + 1, frameCount: n, frame: { name: frame.name, note: frame.note, ballVisible: !frame.ball.hidden, ballVia: !!frame.ball.via },
      restart: () => this.restart(), prev: () => this.step(-1), next: () => this.step(1), togglePlay: () => this.togglePlay(),
      atStart: fi === 0, atEnd: fi >= n - 1, pct: Math.max(0, Math.min(100, pct)), ticks,
      setSpeed: sp => this.setState({ speed: sp }), toggleLoop: () => this.setState({ loop: !s.loop }),
      addFrame: () => this.addFrame(), dupFrame: () => this.dupFrame(), delFrame: () => this.delFrame(),
      moveLeft: () => this.moveFrame(fi, fi - 1), moveRight: () => this.moveFrame(fi, fi + 1), cards,
      sel, sp, sa, sz, ss, deleteSel: () => this.deleteSel(),
      setFrameName: e => { const v = e.target.value; this.commit(() => { this.frame().name = v; }, 'fn' + frame.id); },
      setFrameNote: e => { const v = e.target.value; this.commit(() => { this.frame().note = v; }, 'fnote' + frame.id); },
      toggleBallVisible: () => this.commit(() => { const b = this.frame().ball; b.hidden = !b.hidden; }),
      straightenBall: () => this.commit(() => { this.frame().ball.via = null; }),
      frameSummary: counts.join(' · ')
    };
  }
}
