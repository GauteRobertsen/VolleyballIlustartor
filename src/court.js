// Court rendering: static court markings plus the animated tactical layers.

import { html } from './html.js';

const GRID = [];
for (let x = 0; x <= 18; x++) GRID.push({ x1: x, y1: 0, x2: x, y2: 9, major: x % 3 === 0 });
for (let y = 0; y <= 9; y++) GRID.push({ x1: 0, y1: y, x2: 18, y2: y, major: y % 3 === 0 });

// Rotation zone numbers, drawn in the corner of each zone (as seen by each team facing the net).
const ZONE_NUMS = [
  [6.45, 0.55, '4'], [6.45, 3.55, '3'], [6.45, 6.55, '2'], [0.45, 0.55, '5'], [0.45, 3.55, '6'], [0.45, 6.55, '1'],
  [9.45, 6.55, '4'], [9.45, 3.55, '3'], [9.45, 0.55, '2'], [12.45, 6.55, '5'], [12.45, 3.55, '6'], [12.45, 0.55, '1']
];

const dashedExt = [[6, -1.75, -0.05], [6, 9.05, 10.75], [12, -1.75, -0.05], [12, 9.05, 10.75]];

export function CourtMarkings() {
  return html`
    <rect x="-3.5" y="-2" width="25" height="13" fill="#2B67A8" />
    <rect x="0" y="0" width="18" height="9" fill="#E9A15C" />
    <rect x="6" y="0" width="6" height="9" fill="#E39147" />
    <g fill="#FFFFFF" fill-opacity="0.38" font-size="0.42" font-weight="700" letter-spacing="0.12" text-anchor="middle" style="pointer-events:none">
      <text x="-1.75" y="4.5" transform="rotate(-90 -1.75 4.5)">SERVICE ZONE</text>
      <text x="19.75" y="4.5" transform="rotate(90 19.75 4.5)">SERVICE ZONE</text>
      <text x="4.5" y="-1.25" fill-opacity="0.6">MY TEAM</text>
      <text x="13.5" y="-1.25" fill-opacity="0.6">OPPONENT</text>
    </g>
    <g fill="none" stroke="#FFFFFF" stroke-width="0.05" style="pointer-events:none">
      <rect x="0" y="0" width="18" height="9" />
      <line x1="6" y1="0" x2="6" y2="9" />
      <line x1="12" y1="0" x2="12" y2="9" />
      ${dashedExt.map(([x, a, b]) => html`<line x1=${x} y1=${a} x2=${x} y2=${b} stroke-dasharray="0.15 0.2" />`)}
      <line x1="-0.2" y1="0" x2="-0.35" y2="0" /><line x1="-0.2" y1="9" x2="-0.35" y2="9" />
      <line x1="18.2" y1="0" x2="18.35" y2="0" /><line x1="18.2" y1="9" x2="18.35" y2="9" />
    </g>`;
}

export function Net() {
  return html`
    <g style="pointer-events:none">
      <line x1="9" y1="-1" x2="9" y2="10" stroke="#111827" stroke-width="0.16" />
      <line x1="9" y1="-1" x2="9" y2="10" stroke="#F8FAFC" stroke-width="0.05" stroke-dasharray="0.12 0.08" />
      <rect x="8.9" y="-0.05" width="0.2" height="0.1" fill="#DC2626" />
      <rect x="8.9" y="8.95" width="0.2" height="0.1" fill="#DC2626" />
      <circle cx="9" cy="-1.05" r="0.2" fill="#1F2937" stroke="#F8FAFC" stroke-width="0.04" />
      <circle cx="9" cy="10.05" r="0.2" fill="#1F2937" stroke="#F8FAFC" stroke-width="0.04" />
    </g>`;
}

export function Court(v) {
  const s = v.s;
  const cursor = s.present ? 'cur-select' : { select: 'cur-select', player: 'cur-add', ball: 'cur-add', arrow: 'cur-draw', zone: 'cur-draw', draw: 'cur-draw', delete: 'cur-delete' }[s.tool];
  return html`
  <svg class=${'court ' + cursor} viewBox="-3.5 -2 25 13" preserveAspectRatio="xMidYMid meet" role="application" aria-label="Volleyball court"
    onPointerDown=${v.svgDown} onPointerMove=${v.svgMove} onPointerUp=${v.svgUp} onPointerCancel=${v.svgUp} onDblClick=${v.svgDbl}>
    <${CourtMarkings} />
    ${s.showGrid && html`<g style="pointer-events:none">${GRID.map(g => html`<line x1=${g.x1} y1=${g.y1} x2=${g.x2} y2=${g.y2} stroke="#FFFFFF" stroke-width=${g.major ? 0.03 : 0.015} stroke-opacity=${g.major ? 0.55 : 0.32} />`)}</g>`}
    ${s.showZones && html`<g style="pointer-events:none">
      <line x1="0" y1="3" x2="18" y2="3" stroke="#FFFFFF" stroke-width="0.03" stroke-opacity="0.55" stroke-dasharray="0.2 0.15" />
      <line x1="0" y1="6" x2="18" y2="6" stroke="#FFFFFF" stroke-width="0.03" stroke-opacity="0.55" stroke-dasharray="0.2 0.15" />
      ${ZONE_NUMS.map(([x, y, t]) => html`<text x=${x} y=${y} text-anchor="middle" dominant-baseline="central" font-size="0.7" font-weight="700" fill="#FFFFFF" fill-opacity="0.55">${t}</text>`)}
    </g>`}
    <${Net} />

    <g>${v.zones.map(z => html`
      <g key=${z.key} opacity=${z.op} onPointerDown=${z.down} style="cursor:move">
        <path d=${z.d} fill=${z.color} fill-opacity=${z.fo} stroke=${z.color} stroke-width=${z.sw} stroke-opacity="0.9" stroke-dasharray=${z.dash} stroke-linejoin="round" />
        <text x=${z.lx} y=${z.ly} text-anchor="middle" dominant-baseline="central" font-size="0.36" font-weight="700" fill=${z.textColor} style="pointer-events:none">${z.label}</text>
      </g>`)}</g>

    <g>${v.strokes.map(st => html`
      <g key=${st.key} opacity=${st.op} onPointerDown=${st.down} style="cursor:move">
        <path d=${st.d} fill="none" stroke="transparent" stroke-width="0.45" stroke-linecap="round" />
        <path d=${st.d} fill="none" stroke=${st.color} stroke-width=${st.w} stroke-linecap="round" stroke-linejoin="round" />
        ${st.selected && html`<path d=${st.d} fill="none" stroke="#FB923C" stroke-width="0.03" stroke-dasharray="0.12 0.08" />`}
      </g>`)}</g>

    <g style="pointer-events:none">${v.ghosts.map(g => html`
      <g key=${g.key}>
        <path d=${g.d} fill="none" stroke=${g.color} stroke-width=${g.w} stroke-opacity=${g.so} stroke-dasharray="0.14 0.1" stroke-linecap="round" />
        <circle cx=${g.x} cy=${g.y} r=${g.r} fill=${g.color} fill-opacity="0.22" stroke=${g.color} stroke-opacity="0.5" stroke-width="0.03" stroke-dasharray="0.08 0.06" />
      </g>`)}</g>

    <g>${v.arrows.map(a => html`
      <g key=${a.key} opacity=${a.op} onPointerDown=${a.down} style="cursor:move">
        <path d=${a.hit} fill="none" stroke="transparent" stroke-width="0.5" />
        ${a.selected && html`<path d=${a.d} fill="none" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width=${a.glow} stroke-linecap="round" />`}
        <path d=${a.d} fill="none" stroke=${a.color} stroke-width=${a.w} stroke-dasharray=${a.dash} stroke-linecap="round" />
        ${a.head && html`<path d=${a.head} fill=${a.color} stroke=${a.color} stroke-width="0.02" stroke-linejoin="round" />`}
        ${a.head2 && html`<path d=${a.head2} fill=${a.color} stroke=${a.color} stroke-width="0.02" stroke-linejoin="round" />`}
      </g>`)}</g>

    <g>${v.players.map(p => html`
      <g key=${p.key} transform=${p.tf} opacity=${p.op} onPointerDown=${p.down} style="cursor:grab">
        <circle cx="0.05" cy="0.07" r="0.45" fill="#000000" fill-opacity="0.22" />
        ${p.selected && html`<circle r="0.64" fill="none" stroke="#FFFFFF" stroke-width="0.07" stroke-dasharray="0.16 0.1" />`}
        <circle r="0.43" fill=${p.color} stroke="#FFFFFF" stroke-width="0.07" />
        <text y="0.015" text-anchor="middle" dominant-baseline="central" font-size=${p.fs} font-weight="700" fill=${p.txt} style="pointer-events:none">${p.abbr}</text>
        <g transform="translate(0.36 -0.36)" style="pointer-events:none">
          <rect x=${p.bx} y="-0.17" width=${p.bw} height="0.34" rx="0.17" fill="#0E1726" stroke="#FFFFFF" stroke-width="0.03" />
          <text y="0.005" text-anchor="middle" dominant-baseline="central" font-size="0.22" font-weight="700" fill="#FFFFFF">${p.num}</text>
        </g>
      </g>`)}</g>

    ${v.ball.show && html`
      <g transform=${v.ball.tf} opacity=${v.ball.op} onPointerDown=${v.ball.down} style="cursor:grab">
        <circle cx="0.04" cy="0.06" r="0.28" fill="#000000" fill-opacity="0.25" />
        ${v.ball.selected && html`<circle r="0.44" fill="none" stroke="#FFFFFF" stroke-width="0.06" stroke-dasharray="0.12 0.08" />`}
        <circle r="0.27" fill="#FDE047" stroke="#1E3A8A" stroke-width="0.035" />
        <path d="M0 -0.27 C -0.1 -0.1 -0.08 0.07 0.04 0.14 M -0.25 -0.1 C -0.08 -0.1 0.06 -0.02 0.13 0.1 M 0.04 0.14 C 0.12 0.2 0.2 0.18 0.26 0.1 M -0.2 0.18 C -0.1 0.06 0.02 0.0 0.13 0.1" fill="none" stroke="#1D4ED8" stroke-width="0.035" stroke-linecap="round" style="pointer-events:none" />
      </g>`}

    <g style="pointer-events:none">${v.labels.map(l => html`
      <g key=${l.key} transform=${l.tf} opacity=${l.op}>
        <rect x=${l.x} y="0.56" width=${l.w} height="0.4" rx="0.2" fill="#0E1726" fill-opacity="0.86" />
        <text y="0.765" text-anchor="middle" dominant-baseline="central" font-size="0.27" font-weight="600" fill="#FFFFFF">${l.text}</text>
      </g>`)}</g>

    <g>${v.handles.map(h => html`
      <g onPointerDown=${h.down} style="cursor:pointer">
        <circle cx=${h.x} cy=${h.y} r="0.32" fill="transparent" />
        <circle cx=${h.x} cy=${h.y} r=${h.r} fill=${h.fill} stroke=${h.stroke} stroke-width="0.05" />
      </g>`)}</g>

    <g style="pointer-events:none">
      ${v.draft.d && html`<path d=${v.draft.d} fill=${v.draft.fill} fill-opacity=${v.draft.fo} stroke=${v.draft.stroke} stroke-width=${v.draft.w} stroke-dasharray=${v.draft.dash} stroke-linecap="round" stroke-linejoin="round" />`}
      ${v.draft.head && html`<path d=${v.draft.head} fill=${v.draft.stroke} />`}
      ${v.draft.pts.map(p => html`<circle cx=${p.x} cy=${p.y} r=${p.r} fill="#FFFFFF" stroke="#0E1726" stroke-width="0.04" />`)}
    </g>
  </svg>`;
}

export function Thumb(cd) {
  return html`
  <svg class="thumb" viewBox="-3.5 -2 25 13" aria-hidden="true">
    <rect x="-3.5" y="-2" width="25" height="13" fill="#2B67A8" />
    <rect x="0" y="0" width="18" height="9" fill="#E9A15C" stroke="#FFFFFF" stroke-width="0.12" />
    <line x1="9" y1="-0.8" x2="9" y2="9.8" stroke="#111827" stroke-width="0.3" />
    ${cd.zones.map(z => html`<path d=${z.d} fill=${z.color} fill-opacity=${z.fo} />`)}
    ${cd.arrows.map(a => html`<path d=${a.d} fill="none" stroke=${a.color} stroke-width="0.22" />`)}
    ${cd.dots.map(d => html`<circle cx=${d.x} cy=${d.y} r="0.55" fill=${d.color} stroke="#FFFFFF" stroke-width="0.12" />`)}
    ${cd.ball && html`<circle cx=${cd.bx} cy=${cd.by} r="0.38" fill="#FDE047" stroke="#1E3A8A" stroke-width="0.1" />`}
  </svg>`;
}
