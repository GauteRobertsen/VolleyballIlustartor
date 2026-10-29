// Presets: how players stand in the 5-1 and 6-2 systems, one position per rotation.
// The block between the PRESETS markers is plain JS that only needs uid, newFrame, ARROWS and ROLES,
// so the canvas version embeds the same code.

import { ARROWS, ROLES } from './constants.js';
import { uid, newFrame } from './model.js';

// PRESETS-START
// Coordinates are metres on our half: x = 0 end line .. 9 net, y = 0 left sideline .. 9 right sideline.
// Rotation-1 lineup by zone 1..6. 5-1: the opposite plays opposite the setter. 6-2: two setters opposite each other.
const LINEUP = { '5-1': ['S', 'OH1', 'MB1', 'OPP', 'OH2', 'MB2'], '6-2': ['S1', 'OH1', 'MB1', 'S2', 'OH2', 'MB2'] };
const SLOT_ROLE = { S: 'S', S1: 'S', S2: 'S', OPP: 'OPP', OH1: 'WS', OH2: 'WS', MB1: 'MB', MB2: 'MB', L: 'L' };
const SWAP = { S1: 'S2', S2: 'S1', OH1: 'OH2', OH2: 'OH1', MB1: 'MB2', MB2: 'MB1', L: 'L' };
const ROT_ORDER = [1, 6, 5, 4, 3, 2]; // game order: rotation named by the (first) setter's zone
const SET_TARGET = [8.3, 5.8];
const HIDDEN = [-2.6, 10.2];

// 5-1 serve receive, overlap-legal at the serve. `out` = the back-row middle the libero replaces.
const RECEIVE_51 = [
  { n: 1, out: 'MB2', note: 'Setter in zone 1 (back row) hides behind the right-side passer and releases on the serve. Libero in for the back-row middle; outsides and libero pass.',
    S: [2.4, 8.4], OH1: [4.6, 7.2], MB1: [8.0, 4.4], OPP: [7.6, 1.0], OH2: [4.0, 1.9], L: [3.8, 4.5] },
  { n: 6, out: 'MB2', note: 'Setter in zone 6 tucks behind the opposite at the net and releases to the target. Passers: outside (front left), libero, outside (back right).',
    S: [7.0, 5.9], OH1: [3.8, 7.2], MB1: [8.0, 7.8], OPP: [8.2, 5.4], OH2: [5.0, 1.6], L: [3.8, 4.0] },
  { n: 5, out: 'MB1', note: 'Setter in zone 5 hides behind the left-front middle, then runs along the net to the target. Opposite hides at the right of the net.',
    S: [7.4, 1.4], OH1: [3.9, 4.8], MB2: [8.4, 0.8], OH2: [4.9, 2.6], OPP: [7.8, 8.0], L: [4.0, 7.2] },
  { n: 4, out: 'MB1', note: 'Setter front row (zone 4): starts at the net on the left and slides to the target. Only two front-row attackers; the back-row opposite hides.',
    S: [8.4, 1.2], MB2: [8.2, 4.0], OH2: [4.8, 7.2], OH1: [4.0, 1.9], L: [3.8, 4.5], OPP: [2.4, 8.4] },
  { n: 3, out: 'MB1', note: 'Setter front row (zone 3) waits at the net in the middle. Opposite hides deep in zone 6 while outsides and libero pass.',
    OH1: [4.9, 1.8], S: [8.4, 4.6], MB2: [8.2, 7.8], L: [3.8, 3.6], OPP: [2.2, 5.6], OH2: [4.0, 7.3] },
  { n: 2, out: 'MB2', note: 'Setter front row (zone 2) is already near the target. Opposite hides back left; libero in for the back-row middle.',
    MB1: [8.3, 0.9], OH1: [5.0, 2.4], S: [8.4, 7.6], OPP: [2.2, 1.2], OH2: [3.9, 4.8], L: [3.9, 7.3] }
];
const RECEIVE_62_NOTES = {
  1: 'The back-row setter (zone 1) hides behind the right-side passer and releases; the other setter attacks from the right front. Three front-row hitters in every rotation.',
  6: 'The back-row setter (zone 6) tucks behind the front-row setter at the net and releases to the target. Outsides and libero pass.',
  5: 'The back-row setter (zone 5) hides behind the left-front middle and runs along the net to the target. The front-row setter hits from the right.'
};
// Where everyone stands at our serve (rotational order, zone 1 is the server) ...
const SERVE_SPOT = { 4: [7.9, 1.4], 3: [7.9, 4.5], 2: [7.9, 7.6], 5: [4.0, 1.6], 6: [3.2, 4.5], 1: [-1.0, 7.6] };
// ... and the base-defense spots they switch to once the ball is served.
const BASE_SPOT = { LF: [8.2, 1.3], MF: [8.2, 4.5], RF: [8.2, 7.7], LB: [3.4, 1.2], MBK: [1.6, 4.5], RB: [3.4, 7.8] };

const isMB = k => k === 'MB1' || k === 'MB2';
const isOH = k => k === 'OH1' || k === 'OH2';
const isRight = k => k === 'S' || k === 'S1' || k === 'S2' || k === 'OPP';
const SLOT_NAME = { S: 'setter', S1: 'setter', S2: 'setter', OPP: 'opposite', OH1: 'outside hitter', OH2: 'outside hitter', MB1: 'middle blocker', MB2: 'middle blocker', L: 'libero' };

export const PRESETS = [
  { id: '51-receive', label: '5-1 · Serve receive', system: '5-1', kind: 'receive' },
  { id: '51-serve', label: '5-1 · Serving & base defense', system: '5-1', kind: 'serve' },
  { id: '62-receive', label: '6-2 · Serve receive', system: '6-2', kind: 'receive' },
  { id: '62-serve', label: '6-2 · Serving & base defense', system: '6-2', kind: 'serve' }
];

function zonesFor(system, rot) {
  const z = {};
  LINEUP[system].forEach((k, i) => { z[((rot - 1 + i) % 6) + 1] = k; });
  return z;
}

// Reuse the team's players by role; create any that are missing (returned in `added`).
function pickPlayers(team, slots, homeColor) {
  const used = new Set(), added = [], ids = {}, numbers = new Set(team.map(t => t.number));
  for (const slot of slots) {
    const role = SLOT_ROLE[slot];
    const t = team.find(x => x.side === 'home' && x.role === role && !used.has(x.id));
    if (t) { used.add(t.id); ids[slot] = t.id; continue; }
    let number = 1;
    while (numbers.has(number)) number++;
    numbers.add(number);
    const same = added.filter(p => p.role === role).length + team.filter(x => x.side === 'home' && x.role === role).length;
    const p = { id: uid(), name: ROLES[role].name + (same ? ' ' + (same + 1) : ''), number, role, color: role === 'L' ? '#0D9488' : homeColor, side: 'home' };
    added.push(p); used.add(p.id); ids[slot] = p.id;
  }
  return { ids, added };
}

function runArrow(id, from, to, dash) {
  // Runs along the net bend away from it; opposite directions bend by different amounts so crossing switches stay apart.
  const k = ARROWS.run, along = Math.abs(from[0] - to[0]) < 1.5 && Math.abs(from[1] - to[1]) > 1.5;
  const bend = along ? (to[1] > from[1] ? 0.8 : 1.7) : 0;
  return { id, kind: 'run', x1: from[0], y1: from[1], x2: to[0], y2: to[1], cx: (from[0] + to[0]) / 2 - bend, cy: (from[1] + to[1]) / 2,
    curved: along, color: k.color, width: k.width, dash: !!dash, head: 'end' };
}

function makeFrame(name, note, ids, spots, ball, arrows) {
  const f = newFrame(name);
  f.note = note;
  for (const slot in ids) {
    const p = spots[slot];
    f.pos[ids[slot]] = p ? { x: p[0], y: p[1], hidden: false, via: null } : { x: HIDDEN[0], y: HIDDEN[1], hidden: true, via: null };
  }
  f.ball = { x: ball[0], y: ball[1], hidden: false, via: null };
  f.arrows = arrows;
  return f;
}

function receiveFrame(system, rot, ids) {
  let spots = {}, out, note, setter;
  if (system === '5-1') {
    const r = RECEIVE_51.find(x => x.n === rot);
    for (const k of ['S', 'OH1', 'MB1', 'OPP', 'OH2', 'MB2', 'L']) if (r[k]) spots[k] = r[k];
    out = r.out; note = r.note; setter = 'S';
  } else {
    // 6-2: the back-row setter always runs the offence, so rotations 4, 3, 2 mirror 1, 6, 5 with each pair swapped.
    const base = { 1: 1, 6: 6, 5: 5, 4: 1, 3: 6, 2: 5 }[rot], swap = base !== rot, r = RECEIVE_51.find(x => x.n === base);
    const map = k => { const s = k === 'S' ? 'S1' : k === 'OPP' ? 'S2' : k; return swap ? SWAP[s] : s; };
    for (const k of ['S', 'OH1', 'MB1', 'OPP', 'OH2', 'MB2', 'L']) if (r[k]) spots[map(k)] = r[k];
    out = map(r.out); note = RECEIVE_62_NOTES[base]; setter = map('S');
  }
  delete spots[out];
  const s = spots[setter], arrows = [];
  if (Math.hypot(s[0] - SET_TARGET[0], s[1] - SET_TARGET[1]) > 1) arrows.push(runArrow('release', s, SET_TARGET, true));
  return makeFrame('Rotation ' + rot + ' · serve receive', note, ids, spots, [20.0, 6.0], arrows);
}

function servingFrames(system, rot, ids) {
  const z = zonesFor(system, rot), server = z[1];
  const mbBack = [5, 6, 1].map(n => z[n]).find(isMB);
  const liberoIn = mbBack && mbBack !== server; // the libero does not serve, so a serving middle stays on
  const slotAt = n => (liberoIn && z[n] === mbBack ? 'L' : z[n]);
  const serve = {}, base = {};
  for (let n = 1; n <= 6; n++) serve[slotAt(n)] = SERVE_SPOT[n];
  for (const n of [4, 3, 2]) { const k = slotAt(n); base[k] = BASE_SPOT[isOH(k) ? 'LF' : isMB(k) ? 'MF' : 'RF']; }
  for (const n of [5, 6, 1]) { const k = slotAt(n); base[k] = BASE_SPOT[isRight(k) ? 'RB' : isOH(k) ? 'MBK' : 'LB']; }
  const arrows = [];
  for (const k in serve) if (Math.hypot(serve[k][0] - base[k][0], serve[k][1] - base[k][1]) > 1.2) arrows.push(runArrow('sw-' + k, serve[k], base[k], true));
  const who = SLOT_NAME[server];
  const serveNote = 'The ' + who + ' serves from zone 1. Everyone else stands in rotational order until the serve is struck; the arrows show the switch.'
    + (liberoIn ? ' Libero in for the back-row middle.' : ' The middle serves here, so the libero sits out this rotation.');
  const baseNote = system === '5-1'
    ? 'Base defense after the switch: outside left, middle in the middle, setter or opposite on the right. Back row: setter/opposite right back, outside middle back, libero left back.'
    : 'Base defense after the switch: outside left, middle in the middle, front-row setter on the right. The back-row setter takes right back to be ready to set.';
  return [
    makeFrame('Rotation ' + rot + ' · serving', serveNote, ids, serve, [-0.75, 7.3], arrows),
    makeFrame('Rotation ' + rot + ' · base defense', baseNote, ids, base, [14.0, 3.5], [])
  ];
}

export function buildPreset(id, team, homeColor) {
  const P = PRESETS.find(p => p.id === id) || PRESETS[0];
  const { ids, added } = pickPlayers(team, LINEUP[P.system].concat('L'), homeColor);
  const frames = [];
  for (const rot of ROT_ORDER) {
    if (P.kind === 'receive') frames.push(receiveFrame(P.system, rot, ids));
    else frames.push(...servingFrames(P.system, rot, ids));
  }
  const play = { id: uid(), name: P.label, category: P.kind === 'receive' ? 'Serve Receive' : 'Block Defense', roster: Object.values(ids), frames };
  return { play, added };
}
// PRESETS-END
