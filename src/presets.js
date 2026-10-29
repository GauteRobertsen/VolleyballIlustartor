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
// The middle of each rotational zone, used to show the rotation before players move.
const ZONE_SPOT = { 4: [7.5, 1.6], 3: [7.5, 4.6], 2: [7.5, 7.6], 5: [3.0, 1.6], 6: [3.0, 4.6], 1: [3.0, 7.6] };
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
function pickPlayers(team, slots, homeColor, side = 'home') {
  const used = new Set(), added = [], ids = {}, numbers = new Set(team.map(t => t.number));
  for (const slot of slots) {
    const role = SLOT_ROLE[slot];
    const t = team.find(x => x.side === side && x.role === role && !used.has(x.id));
    if (t) { used.add(t.id); ids[slot] = t.id; continue; }
    let number = 1;
    while (numbers.has(number)) number++;
    numbers.add(number);
    const same = added.filter(p => p.role === role).length + team.filter(x => x.side === side && x.role === role).length;
    const opp = side === 'opp';
    const p = { id: uid(), name: (opp ? 'Opp ' : '') + ROLES[role].name + (same ? ' ' + (same + 1) : ''), number, role,
      color: role === 'L' ? (opp ? '#B45309' : '#0D9488') : (opp ? '#DC2626' : homeColor), side };
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

// Two positions per rotation: everyone in their rotational zone, then the serve-receive formation.
// Serve-receive formation for a rotation: { spots, out (the middle the libero replaces), note, setter (who sets) }.
function receiveSpots(system, rot) {
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
  return { spots, out, note, setter };
}

function receiveFrames(system, rot, ids) {
  const { spots, out, note, setter } = receiveSpots(system, rot);
  const z = zonesFor(system, rot), zoneSpots = {}, moves = [];
  for (let n = 1; n <= 6; n++) zoneSpots[z[n] === out ? 'L' : z[n]] = ZONE_SPOT[n];
  for (const k in zoneSpots) {
    const a = zoneSpots[k], b = spots[k];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1) moves.push(runArrow('mv-' + k, a, b, true));
  }
  const zoneNote = 'Rotation ' + rot + ': everyone starts in their rotational zone (numbers in each zone corner). '
    + 'The libero is in for the back-row middle. The arrows show where each player moves to receive the serve.';
  const s = spots[setter], arrows = [];
  if (Math.hypot(s[0] - SET_TARGET[0], s[1] - SET_TARGET[1]) > 1) arrows.push(runArrow('release', s, SET_TARGET, true));
  return [
    makeFrame('Rotation ' + rot + ' · zones', zoneNote, ids, zoneSpots, [20.0, 6.0], moves),
    makeFrame('Rotation ' + rot + ' · serve receive', note, ids, spots, [20.0, 6.0], arrows)
  ];
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
    if (P.kind === 'receive') frames.push(...receiveFrames(P.system, rot, ids));
    else frames.push(...servingFrames(P.system, rot, ids));
  }
  const play = { id: uid(), name: P.label, category: P.kind === 'receive' ? 'Serve Receive' : 'Block Defense', roster: Object.values(ids), frames };
  return { play, added };
}

// ---------- Rally simulator ----------
// Plays a random rally between the two teams (both in a 5-1) and returns one position per touch:
// serve, pass, set, attack, then block / dig / kill / error, with transition back and forth.
// Each team is computed in its own coordinates (net at x = 9); the opponent is mirrored onto the far half.
const TEAM_NAME = { home: 'My team', opp: 'Opponent' };
const ATTACK = { // approach start -> contact point, in the attacking team's coordinates
  left: { from: [5.6, 0.8], at: [8.5, 1.0], label: 'from the left' },
  middle: { from: [7.0, 4.0], at: [8.6, 4.9], label: 'with a quick in the middle' },
  right: { from: [5.8, 8.3], at: [8.5, 8.0], label: 'from the right' },
  backright: { from: [3.2, 7.8], at: [5.6, 7.5], label: 'from the back row' },
  pipe: { from: [3.0, 4.4], at: [5.6, 4.4], label: 'with a pipe' }
};
const PERIMETER = { LB: [2.6, 1.0], MBK: [0.9, 4.5], RB: [2.6, 8.0] };
const rnd = (a, b) => a + Math.random() * (b - a);
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const jit = (p, r) => [p[0] + rnd(-r, r), p[1] + rnd(-r, r)];
const clampIn = p => [Math.max(0.4, Math.min(8.6, p[0])), Math.max(0.4, Math.min(8.6, p[1]))];
const toWorld = (side, p) => (side === 'home' ? [p[0], p[1]] : [18 - p[0], 9 - p[1]]);
const baseRole = (k, front) => (front ? (isOH(k) ? 'LF' : isMB(k) ? 'MF' : 'RF') : (isRight(k) ? 'RB' : isOH(k) ? 'MBK' : 'LB'));

function rallyTeam(side, rot, serving, system) {
  const z = zonesFor(system, rot), mbBack = [5, 6, 1].map(n => z[n]).find(isMB);
  const liberoIn = mbBack && !(serving && z[1] === mbBack); // the libero never serves
  const at = n => (liberoIn && z[n] === mbBack ? 'L' : z[n]);
  const back = [5, 6, 1].map(at);
  // 5-1: the setter always sets. 6-2: whichever setter is in the back row sets; the front-row setter attacks.
  const setter = system === '5-1' ? 'S' : back.find(k => k === 'S1' || k === 'S2');
  return { side, rot, system, zones: z, front: [4, 3, 2].map(at), back, server: at(1), setter, pos: {} };
}
function baseSpots(t) {
  const out = {};
  t.front.forEach(k => { out[k] = jit(BASE_SPOT[baseRole(k, true)], 0.2); });
  t.back.forEach(k => { out[k] = jit(BASE_SPOT[baseRole(k, false)], 0.3); });
  return out;
}
function defendSpots(t, lane) {
  const out = {}, y = Math.max(0.9, Math.min(8.1, lane));
  const mb = t.front.find(isMB), wing = t.front.find(k => baseRole(k, true) === (lane < 4.5 ? 'LF' : 'RF'));
  const off = t.front.find(k => k !== mb && k !== wing), dir = lane < 4.5 ? -1 : 1;
  out[wing] = [8.6, Math.max(0.4, Math.min(8.6, y + dir * 0.45))];
  out[mb] = [8.6, y - dir * 0.45];
  out[off] = [6.3, BASE_SPOT[baseRole(off, true)][1]];
  t.back.forEach(k => { out[k] = jit(PERIMETER[baseRole(k, false)], 0.35); });
  return { spots: out, blockers: [wing, mb], off };
}
function coverSpots(t, hitter, setter, at) {
  const out = {}, ring = [[-1.3, -1.1], [-1.3, 1.1], [-2.9, 0], [-3.4, -2.3], [-3.4, 2.3]].map(o => clampIn([at[0] + o[0], at[1] + o[1]]));
  const left = Object.keys(t.pos).filter(k => k !== hitter && k !== setter);
  for (const spot of ring) {
    if (!left.length) break;
    left.sort((a, b) => Math.hypot(t.pos[a][0] - spot[0], t.pos[a][1] - spot[1]) - Math.hypot(t.pos[b][0] - spot[0], t.pos[b][1] - spot[1]));
    out[left.shift()] = spot;
  }
  out[setter] = [7.5, SET_TARGET[1] + (at[1] < SET_TARGET[1] ? -0.6 : 0.6)];
  return out;
}

// sim = { rot: { home, opp } (index into ROT_ORDER), serving, score: { home, opp }, sets: { home, opp } }
// systems = { home: '5-1' | '6-2', opp: '5-1' | '6-2' }
export function simulateRally(team, homeColor, sim, systems) {
  sim = sim ? JSON.parse(JSON.stringify(sim)) : { rot: { home: 0, opp: 0 }, serving: 'home', score: { home: 0, opp: 0 }, sets: { home: 0, opp: 0 } };
  const sys = { home: '5-1', opp: '5-1', ...(sim.systems || {}), ...(systems || {}) };
  sim.systems = sys;
  const H = pickPlayers(team, LINEUP[sys.home].concat('L'), homeColor, 'home');
  const O = pickPlayers(team.concat(H.added), LINEUP[sys.opp].concat('L'), homeColor, 'opp');
  const ids = { home: H.ids, opp: O.ids }, all = team.concat(H.added, O.added);
  const nm = (side, k) => { const p = all.find(x => x.id === ids[side][k]); return p ? p.name : k; };
  const S = sim.serving, R = S === 'home' ? 'opp' : 'home';
  const T = { [S]: rallyTeam(S, ROT_ORDER[sim.rot[S]], true, sys[S]), [R]: rallyTeam(R, ROT_ORDER[sim.rot[R]], false, sys[R]) };
  const snaps = [];
  const snap = (name, note, side, ballOwn, kind) => snaps.push({ name, note, kind, ball: toWorld(side, ballOwn),
    pos: { home: JSON.parse(JSON.stringify(T.home.pos)), opp: JSON.parse(JSON.stringify(T.opp.pos)) } });
  const scoreText = () => TEAM_NAME.home + ' ' + sim.score.home + ' – ' + sim.score.opp + ' ' + TEAM_NAME.opp;
  const title = 'Rally simulation · ' + scoreText();

  // Serve: rotational order for the server's team, receive formation for the other.
  const sv = T[S], rc = T[R];
  const zoneSlot = { 4: sv.front[0], 3: sv.front[1], 2: sv.front[2], 5: sv.back[0], 6: sv.back[1], 1: sv.back[2] };
  for (let n = 1; n <= 6; n++) sv.pos[zoneSlot[n]] = SERVE_SPOT[n];
  const rec = receiveSpots(rc.system, rc.rot).spots;
  for (const k of rc.front.concat(rc.back)) rc.pos[k] = rec[k];
  snap('Serve · ' + nm(S, sv.server), TEAM_NAME[S] + ' (' + sys[S] + ') serves to ' + TEAM_NAME[R].toLowerCase() + ' (' + sys[R] + '). ' + scoreText(), S, [-0.7, 7.3], 'ball');

  let winner = null, attacking = R, touch = null, attacks = 0;
  const r0 = Math.random();
  if (r0 < 0.07) {
    snap('Serve error', nm(S, sv.server) + ' serves into the net.', S, [8.8, rnd(2, 7)], 'ball'); winner = R;
  } else if (r0 < 0.14) {
    sv.pos = baseSpots(sv);
    snap('Ace!', nm(S, sv.server) + ' serves an ace.', R, [rnd(1.5, 5), rnd(1, 8)], 'ball'); winner = S;
  } else {
    const passers = ['OH1', 'OH2', 'L'].filter(k => rc.back.includes(k) || (rc.pos[k] && rc.pos[k][0] < 6));
    touch = pickOne(passers.length ? passers : rc.back);
    const land = clampIn(jit(rc.pos[touch], 0.8));
    rc.pos[touch] = land;
    rc.pos[rc.setter] = jit(SET_TARGET, 0.2);
    sv.pos = baseSpots(sv);
    snap('Pass · ' + nm(R, touch), nm(R, touch) + ' passes to the target; the setter releases. ' + TEAM_NAME[S] + ' switches to base defense.', R, [land[0] + 0.3, land[1] - 0.3], 'ball');
  }

  while (!winner) {
    const A = T[attacking], D = T[attacking === 'home' ? 'opp' : 'home'], aSide = attacking, dSide = D.side;
    attacks++;
    // Set: the setter (or the libero/opposite if the setter took the first ball) goes to the target, hitters to their approach.
    // If the setter took the first ball, the libero (or the opposite / other setter) sets instead.
    const setter = touch !== A.setter ? A.setter : (A.pos.L && touch !== 'L' ? 'L' : A.system === '5-1' ? 'OPP' : A.front.find(k => k === 'S1' || k === 'S2'));
    const opts = [];
    A.front.forEach(k => { if (k === setter) return; if (isOH(k)) opts.push([k, 'left', 5]); else if (isMB(k)) opts.push([k, 'middle', 3]); else if (isRight(k)) opts.push([k, 'right', 4]); });
    A.back.forEach(k => { if (k === setter) return; if (k === 'OPP') opts.push([k, 'backright', 2]); else if (isOH(k)) opts.push([k, 'pipe', 1]); });
    let roll = rnd(0, opts.reduce((a, o) => a + o[2], 0)), choice = opts[0];
    for (const o of opts) { roll -= o[2]; if (roll <= 0) { choice = o; break; } }
    const [hitter, lane] = choice, atk = ATTACK[lane];
    A.pos[setter] = jit(SET_TARGET, 0.15);
    opts.forEach(([k, l]) => { A.pos[k] = jit(ATTACK[l].from, 0.25); });
    D.pos = baseSpots(D);
    snap('Set · ' + nm(aSide, setter), nm(aSide, setter) + ' sets ' + nm(aSide, hitter) + ' ' + atk.label + '.', aSide, [SET_TARGET[0] + 0.25, SET_TARGET[1] - 0.25], 'ball');

    // Attack: hitter at the ball, teammates cover; defenders form the block and dig positions.
    const at = jit(atk.at, 0.15), cover = coverSpots(A, hitter, setter, at);
    A.pos[hitter] = at; Object.assign(A.pos, cover);
    const def = defendSpots(D, 9 - at[1]);
    D.pos = def.spots;
    snap('Attack · ' + nm(aSide, hitter), nm(aSide, hitter) + ' attacks ' + atk.label + '. ' + nm(dSide, def.blockers[0]) + ' and ' + nm(dSide, def.blockers[1]) + ' block; the rest cover.', aSide, [at[0] + 0.2, at[1]], 'attack');

    const r = Math.random(), force = attacks >= 5;
    if (force || r < 0.36) {
      let land = null, best = -1;
      for (let i = 0; i < 10; i++) { const c = [rnd(0.6, 8.0), rnd(0.5, 8.5)], d = Math.min(...Object.values(D.pos).map(p => Math.hypot(p[0] - c[0], p[1] - c[1]))); if (d > best) { best = d; land = c; } }
      const near = Object.keys(D.pos).sort((a, b) => Math.hypot(D.pos[a][0] - land[0], D.pos[a][1] - land[1]) - Math.hypot(D.pos[b][0] - land[0], D.pos[b][1] - land[1]))[0];
      D.pos[near] = [D.pos[near][0] + (land[0] - D.pos[near][0]) * 0.55, D.pos[near][1] + (land[1] - D.pos[near][1]) * 0.55];
      snap('Kill · point ' + TEAM_NAME[aSide], nm(aSide, hitter) + ' puts it away; ' + nm(dSide, near) + ' cannot reach it.', dSide, land, 'ball'); winner = aSide;
    } else if (r < 0.48) {
      snap('Block · point ' + TEAM_NAME[dSide], nm(dSide, def.blockers[1]) + ' and ' + nm(dSide, def.blockers[0]) + ' stuff the attack.', aSide, [rnd(6.6, 8.4), Math.max(0.6, Math.min(8.4, at[1]))], 'ball'); winner = dSide;
    } else if (r < 0.6) {
      const out = Math.random() < 0.5 ? [rnd(-1.6, -0.6), rnd(0.5, 8.5)] : [rnd(1, 8), pickOne([-0.8, 9.8])];
      snap('Out · point ' + TEAM_NAME[dSide], nm(aSide, hitter) + ' hits it out.', dSide, out, 'ball'); winner = dSide;
    } else {
      const diggers = D.back.concat(def.off);
      const digger = pickOne(diggers), land = clampIn(jit(D.pos[digger], 0.9));
      D.pos[digger] = land;
      snap('Dig · ' + nm(dSide, digger), nm(dSide, digger) + ' digs it up. Transition: ' + TEAM_NAME[dSide] + ' attacks next.', dSide, [land[0] + 0.3, land[1] - 0.3], 'ball');
      attacking = dSide; touch = digger;
    }
  }

  // Score, side-out rotation and set end.
  sim.score[winner]++;
  let tail = '';
  if (winner !== S) { sim.rot[winner] = (sim.rot[winner] + 1) % 6; sim.serving = winner; tail = ' Side-out: ' + TEAM_NAME[winner] + ' rotates and serves.'; }
  const lead = sim.score[winner] - sim.score[winner === 'home' ? 'opp' : 'home'];
  if (sim.score[winner] >= 25 && lead >= 2) { sim.sets[winner]++; tail += ' ' + TEAM_NAME[winner] + ' wins the set!'; sim.score = { home: 0, opp: 0 }; }
  const last = snaps[snaps.length - 1];
  last.note += ' ' + scoreText() + '.' + tail;

  const roster = Object.values(ids.home).concat(Object.values(ids.opp));
  const frames = snaps.map((sn, i) => {
    const f = newFrame(sn.name); f.note = sn.note;
    for (const side of ['home', 'opp']) for (const k in ids[side]) {
      const p = sn.pos[side][k];
      if (p) { const w = toWorld(side, p); f.pos[ids[side][k]] = { x: w[0], y: w[1], hidden: false, via: null }; }
      else f.pos[ids[side][k]] = { x: HIDDEN[0], y: HIDDEN[1], hidden: true, via: null };
    }
    f.ball = { x: sn.ball[0], y: sn.ball[1], hidden: false, via: null };
    const nx = snaps[i + 1];
    if (nx) {
      const k = ARROWS[sn.kind === 'attack' ? 'attack' : 'ball'];
      f.arrows.push({ id: 'b' + i, kind: sn.kind, x1: sn.ball[0], y1: sn.ball[1], x2: nx.ball[0], y2: nx.ball[1], cx: (sn.ball[0] + nx.ball[0]) / 2, cy: (sn.ball[1] + nx.ball[1]) / 2, curved: false, color: k.color, width: k.width, dash: k.dash, head: 'end' });
    }
    return f;
  });
  return { frames, roster, sim, added: H.added.concat(O.added), title };
}
// PRESETS-END
