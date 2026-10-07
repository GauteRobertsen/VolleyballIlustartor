// Keyframe interpolation. A "view" is the drawable state of the court at one instant.
// Transitions blend from whatever is on screen (even mid-animation) to the target frame,
// so jumping between positions never teleports anything.

import { ease } from './geometry.js';

export function frameView(frame, play) {
  const players = [];
  for (const id of play.roster) {
    const q = frame.pos[id];
    if (!q || q.hidden) continue;
    players.push({ id, x: q.x, y: q.y, o: 1 });
  }
  return {
    players,
    ball: { x: frame.ball.x, y: frame.ball.y, o: frame.ball.hidden ? 0 : 1 },
    arrows: frame.arrows.map(a => Object.assign({}, a, { o: 1, prog: 1 })),
    zones: frame.zones.map(z => Object.assign({}, z, { o: 1, pts: z.pts ? z.pts.map(p => p.slice()) : null })),
    strokes: frame.strokes.map(s => Object.assign({}, s, { o: 1, pts: s.pts.map(p => p.slice()) }))
  };
}

export function indexView(v) {
  const m = a => { const o = {}; a.forEach(x => { o[x.id] = x; }); return o; };
  return { players: m(v.players), ball: v.ball, arrows: m(v.arrows), zones: m(v.zones), strokes: m(v.strokes) };
}

export function animProgress(anim, now) {
  if (!anim) return 1;
  return ease(Math.min(1, Math.max(0, (now - anim.start) / anim.dur)));
}

// F: indexed view captured when the transition started; tf: target frame; t: eased progress.
// useVia: follow the edited movement path (only when stepping forward one position from rest).
export function interpolate(F, tf, play, t, useVia) {
  const to = frameView(tf, play);
  const lp = (a, b) => a + (b - a) * t;
  const qb = (a, c, b) => { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }; };

  const players = [], seen = {};
  for (const p of to.players) {
    seen[p.id] = 1;
    const f = F.players[p.id];
    if (f) {
      const via = useVia && tf.pos[p.id] && tf.pos[p.id].via;
      const q = via ? qb(f, via, p) : { x: lp(f.x, p.x), y: lp(f.y, p.y) };
      players.push({ id: p.id, x: q.x, y: q.y, o: lp(f.o, 1) });
    } else players.push({ id: p.id, x: p.x, y: p.y, o: t });
  }
  for (const id in F.players) if (!seen[id]) { const f = F.players[id]; players.push({ id, x: f.x, y: f.y, o: f.o * (1 - t) }); }

  const fb = F.ball, tb = to.ball;
  let ball;
  if (tb.o === 0) ball = { x: fb.x, y: fb.y, o: fb.o * (1 - t) };
  else if (fb.o < 0.01) ball = { x: tb.x, y: tb.y, o: t };
  else {
    const via = useVia && tf.ball.via;
    const q = via ? qb(fb, via, tb) : { x: lp(fb.x, tb.x), y: lp(fb.y, tb.y) };
    ball = { x: q.x, y: q.y, o: lp(fb.o, 1) };
  }

  const ctl = (a, k) => (a.curved ? a['c' + k] : (a[k + '1'] + a[k + '2']) / 2);
  const arrows = [], aseen = {};
  for (const a of to.arrows) {
    aseen[a.id] = 1;
    const f = F.arrows[a.id];
    if (f) arrows.push(Object.assign({}, a, {
      x1: lp(f.x1, a.x1), y1: lp(f.y1, a.y1), x2: lp(f.x2, a.x2), y2: lp(f.y2, a.y2),
      cx: lp(ctl(f, 'x'), ctl(a, 'x')), cy: lp(ctl(f, 'y'), ctl(a, 'y')), curved: true,
      width: lp(f.width, a.width), o: lp(f.o, 1), prog: lp(f.prog, 1)
    }));
    else arrows.push(Object.assign({}, a, { o: Math.min(1, t * 1.6), prog: t }));
  }
  for (const id in F.arrows) if (!aseen[id]) { const f = F.arrows[id]; arrows.push(Object.assign({}, f, { o: f.o * (1 - t) })); }

  const compat = (a, b) => a.shape === b.shape && (a.shape === 'rect' || a.shape === 'ellipse' || (a.pts && b.pts && a.pts.length === b.pts.length));
  const zones = [], zseen = {};
  for (const z of to.zones) {
    const f = F.zones[z.id];
    if (f && compat(f, z)) {
      zseen[z.id] = 1;
      const nz = Object.assign({}, z, { o: lp(f.o, 1), opacity: lp(f.opacity, z.opacity) });
      if (z.shape === 'rect' || z.shape === 'ellipse') { nz.x = lp(f.x, z.x); nz.y = lp(f.y, z.y); nz.w = lp(f.w, z.w); nz.h = lp(f.h, z.h); }
      else nz.pts = z.pts.map((p, i) => [lp(f.pts[i][0], p[0]), lp(f.pts[i][1], p[1])]);
      zones.push(nz);
    } else zones.push(Object.assign({}, z, { o: t }));
  }
  for (const id in F.zones) if (!zseen[id]) { const f = F.zones[id]; zones.push(Object.assign({}, f, { o: f.o * (1 - t) })); }

  const strokes = [], sseen = {};
  for (const s of to.strokes) {
    const f = F.strokes[s.id];
    if (f && f.pts.length === s.pts.length) {
      sseen[s.id] = 1;
      strokes.push(Object.assign({}, s, { o: lp(f.o, 1), pts: s.pts.map((p, i) => [lp(f.pts[i][0], p[0]), lp(f.pts[i][1], p[1])]) }));
    } else strokes.push(Object.assign({}, s, { o: t }));
  }
  for (const id in F.strokes) if (!sseen[id]) { const f = F.strokes[id]; strokes.push(Object.assign({}, f, { o: f.o * (1 - t) })); }

  return { players, ball, arrows, zones, strokes };
}
