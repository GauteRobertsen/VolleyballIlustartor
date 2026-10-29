// Data model: team roster, plays (tactics library) and frames (saved positions / keyframes).
//
// Project { v, team: Player[], plays: Play[], activePlayId }
// Player  { id, name, number, role, color, side: 'home' | 'opp' }       -- shared by every play
// Play    { id, name, category, roster: playerId[], frames: Frame[] }
// Frame   { id, name, note, pos: { [playerId]: { x, y, hidden, via } },
//           ball: { x, y, hidden, via }, arrows: Arrow[], zones: Zone[], strokes: Stroke[] }
// `via` is the control point of the curved path a player/ball follows when moving INTO this frame.
// Arrow   { id, kind, x1, y1, x2, y2, cx, cy, curved, color, width, dash, head: 'end'|'both'|'none' }
// Zone    { id, shape: 'rect'|'ellipse'|'poly'|'free', x, y, w, h | pts, color, opacity, label, dashed }
// Stroke  { id, pts, color, width }
// Ids of arrows/zones are kept when a frame is duplicated so they morph smoothly between frames.

import { ARROWS, ROLES } from './constants.js';
import { buildPreset } from './presets.js';

export const uid = () => 'i' + Math.random().toString(36).slice(2, 10);
export const clone = o => JSON.parse(JSON.stringify(o));

export function newFrame(name) {
  return { id: uid(), name: name || 'Position', note: '', pos: {}, ball: { x: 4.5, y: 4.5, hidden: false, via: null }, arrows: [], zones: [], strokes: [] };
}

export function normalize(p) {
  if (!p || !Array.isArray(p.team) || !Array.isArray(p.plays) || !p.plays.length) return null;
  p.team = p.team.filter(t => t && t.id).map(t => ({
    id: String(t.id), name: String(t.name || 'Player'), number: Number(t.number) || 0,
    role: ROLES[t.role] ? t.role : 'WS', color: t.color || '#2563EB', side: t.side === 'opp' ? 'opp' : 'home'
  }));
  p.plays.forEach(pl => {
    pl.id = pl.id || uid(); pl.name = pl.name || 'Play'; pl.category = pl.category || 'Custom Play';
    pl.roster = Array.isArray(pl.roster) ? pl.roster.filter(id => p.team.some(t => t.id === id)) : [];
    if (!Array.isArray(pl.frames) || !pl.frames.length) pl.frames = [newFrame('Position 1')];
    pl.frames.forEach((f, i) => {
      f.id = f.id || uid(); f.name = f.name || 'Position ' + (i + 1); f.note = f.note || '';
      f.pos = f.pos || {}; f.ball = f.ball || { x: 4.5, y: 4.5 }; f.ball.via = f.ball.via || null;
      f.arrows = Array.isArray(f.arrows) ? f.arrows : [];
      f.zones = Array.isArray(f.zones) ? f.zones : [];
      f.strokes = Array.isArray(f.strokes) ? f.strokes : [];
    });
  });
  if (!p.plays.some(pl => pl.id === p.activePlayId)) p.activePlayId = p.plays[0].id;
  p.v = 1;
  return p;
}

export function makePlayer(team, side, homeColor) {
  const used = new Set(team.map(t => t.number));
  let number = 1;
  while (used.has(number)) number++;
  const count = team.filter(t => t.side === side).length + 1;
  return { id: uid(), name: side === 'opp' ? 'Opp ' + count : 'Player ' + count, number, role: 'WS', color: side === 'opp' ? '#DC2626' : homeColor, side };
}

// A new play starts with the first six home players (no libero) in base rotation spots.
export function makePlay(team, name, category) {
  const homes = team.filter(t => t.side === 'home' && t.role !== 'L').slice(0, 6);
  const spots = [[3.0, 7.5], [7.5, 7.5], [7.5, 4.5], [7.5, 1.5], [3.0, 1.5], [3.0, 4.5]];
  const f = newFrame('Position 1');
  homes.forEach((t, i) => { f.pos[t.id] = { x: spots[i][0], y: spots[i][1], hidden: false, via: null }; });
  f.ball = { x: -1.2, y: 7.8, hidden: false, via: null };
  return { id: uid(), name, category, roster: homes.map(t => t.id), frames: [f] };
}

export function sampleProject() {
  const P = (name, number, role, color, side) => ({ id: uid(), name, number, role, color, side });
  const team = [
    P('Gaute', 7, 'S', '#2563EB', 'home'), P('Player 2', 2, 'MB', '#2563EB', 'home'), P('Player 3', 3, 'WS', '#2563EB', 'home'),
    P('Player 4', 4, 'OPP', '#2563EB', 'home'), P('Player 5', 5, 'MB', '#2563EB', 'home'), P('Player 6', 6, 'WS', '#2563EB', 'home'),
    P('Libero', 8, 'L', '#0D9488', 'home'), P('Opp 11', 11, 'MB', '#DC2626', 'opp'), P('Opp 14', 14, 'OPP', '#DC2626', 'opp')
  ];
  const [S, , OH1, OPP, MB, OH2, LIB, O1, O2] = team.map(t => t.id);
  const F = (name, note, pos, ball, arrows, zones) => {
    const f = newFrame(name); f.note = note;
    for (const k in pos) { const v = pos[k]; f.pos[k] = { x: v[0], y: v[1], hidden: false, via: v[2] ? { x: v[2][0], y: v[2][1] } : null }; }
    f.ball = { x: ball[0], y: ball[1], hidden: false, via: ball[2] ? { x: ball[2][0], y: ball[2][1] } : null };
    f.arrows = arrows || []; f.zones = zones || [];
    return f;
  };
  const A = (id, kind, x1, y1, x2, y2, c) => {
    const s = ARROWS[kind];
    return { id, kind, x1, y1, x2, y2, cx: c ? c[0] : (x1 + x2) / 2, cy: c ? c[1] : (y1 + y2) / 2, curved: !!c, color: s.color, width: s.width, dash: s.dash, head: 'end' };
  };
  const Z = (id, shape, geo, color, opacity, label) => Object.assign({ id, shape, color, opacity, label, dashed: false }, geo);

  const f1 = F('Serve receive', 'Rotation 1, setter in zone 1. Three passers share the court in lanes; the setter hides behind Player 3 and releases on contact.',
    { [OPP]: [7.6, 1.0], [MB]: [8.0, 4.2], [OH1]: [4.4, 7.0], [OH2]: [4.0, 1.8], [LIB]: [3.8, 4.5], [S]: [2.6, 8.5], [O1]: [10.4, 4.5], [O2]: [10.4, 1.4] },
    [20.0, 6.6], [A('serve', 'ball', 20.0, 6.6, 4.0, 4.3, [12.5, 2.2])],
    [Z('lane1', 'rect', { x: 1.2, y: 0.1, w: 5.0, h: 2.9 }, '#2563EB', 0.18, 'Player 6'),
     Z('lane2', 'rect', { x: 1.2, y: 3.0, w: 5.0, h: 3.0 }, '#16A34A', 0.18, 'Libero'),
     Z('lane3', 'rect', { x: 1.2, y: 6.0, w: 5.0, h: 2.9 }, '#F59E0B', 0.2, 'Player 3')]);
  const f2 = F('Pass to target', 'Libero passes to the target. Setter runs in; Player 3 and Player 4 start their switch.',
    { [OPP]: [7.4, 1.4], [MB]: [7.2, 4.4], [OH1]: [5.6, 6.8], [OH2]: [4.6, 2.0], [LIB]: [3.9, 4.4], [S]: [6.8, 7.0], [O1]: [10.4, 4.5], [O2]: [10.4, 1.4] },
    [3.95, 4.25, [11.0, 3.0]],
    [A('pass', 'ball', 3.95, 4.25, 8.2, 5.5, [5.6, 3.4]), A('setrun', 'run', 6.8, 7.0, 8.2, 5.95),
     A('oh1run', 'run', 5.6, 6.8, 6.0, 2.2, [4.8, 4.6]), A('opprun', 'run', 7.4, 1.4, 6.6, 8.0, [6.9, 5.0])]);
  const f3 = F('Set', 'Setter delivers a high ball to the left. Middle runs a decoy quick; opponents shift their block.',
    { [OPP]: [6.6, 8.0, [6.9, 5.0]], [MB]: [7.7, 4.6], [OH1]: [6.0, 2.2, [4.8, 4.6]], [OH2]: [5.0, 2.6], [LIB]: [4.6, 5.0], [S]: [8.3, 5.85], [O1]: [9.7, 3.4], [O2]: [9.7, 1.4] },
    [8.3, 5.5, [5.6, 3.4]],
    [A('set', 'ball', 8.3, 5.5, 8.6, 1.2, [7.1, 3.3]), A('oh1run', 'run', 6.0, 2.2, 8.2, 1.4),
     A('b1', 'block', 9.7, 3.4, 9.45, 2.15), A('b2', 'block', 9.7, 1.4, 9.45, 0.75)]);
  const f4 = F('Attack and cover', 'Player 3 hits cross-court. Everyone else drops into a cover cup around the hitter.',
    { [OPP]: [7.0, 7.4], [MB]: [7.7, 4.2], [OH1]: [8.35, 1.3], [OH2]: [6.6, 1.5], [LIB]: [6.0, 3.1], [S]: [7.3, 5.75], [O1]: [9.45, 2.15], [O2]: [9.45, 0.75] },
    [8.75, 1.1, [7.1, 3.3]],
    [A('attack', 'attack', 8.9, 1.2, 16.0, 7.4)],
    [Z('cover', 'ellipse', { x: 5.0, y: 0.0, w: 3.8, h: 4.6 }, '#16A34A', 0.22, 'Cover')]);
  const play1 = { id: uid(), name: 'Serve Receive · Rotation 1', category: 'Serve Receive', roster: [S, OH1, MB, OPP, OH2, LIB, O1, O2], frames: [f1, f2, f3, f4] };

  const g1 = F('Base defense', 'Blockers at the net, backcourt deep while the opponent controls the ball.',
    { [OPP]: [8.4, 1.2], [MB]: [8.4, 4.5], [OH1]: [8.4, 7.8], [OH2]: [2.2, 1.2], [LIB]: [1.4, 4.5], [S]: [2.2, 7.8] },
    [13.5, 4.0], [A('fb', 'ball', 13.5, 4.0, 4.2, 6.2, [9.5, 2.0])]);
  const g2 = F('Free ball', 'Call "free!" Front row drops off the net to attack, setter releases, two passers take the court.',
    { [OPP]: [6.0, 1.2, [7.6, 0.6]], [MB]: [6.4, 4.5], [OH1]: [6.0, 7.8], [OH2]: [3.8, 2.6], [LIB]: [3.8, 6.4], [S]: [8.3, 5.8, [5.8, 8.6]] },
    [4.2, 6.2, [9.5, 2.0]], [],
    [Z('pass1', 'poly', { pts: [[1.0, 0.3], [5.4, 0.3], [5.4, 4.5], [1.0, 4.5]] }, '#2563EB', 0.18, 'Player 6'),
     Z('pass2', 'poly', { pts: [[1.0, 4.5], [5.4, 4.5], [5.4, 8.7], [1.0, 8.7]] }, '#0D9488', 0.2, 'Libero')]);
  const play2 = { id: uid(), name: 'Free Ball', category: 'Free Ball', roster: [S, OH1, MB, OPP, OH2, LIB], frames: [g1, g2] };

  const play3 = buildPreset('51-receive', team, '#2563EB').play;
  return { v: 1, team, plays: [play1, play2, play3], activePlayId: play1.id };
}
