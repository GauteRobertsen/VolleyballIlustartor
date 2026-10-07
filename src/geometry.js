// Pure geometry helpers for arrows, zones, freehand strokes and colours.

export const r3 = n => Math.round(n * 1000) / 1000;

export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Arrows are quadratic curves; `prog` (0..1) draws only the first part, used to "draw on" new arrows.
export function arrowGeom(a) {
  const P0 = { x: a.x1, y: a.y1 }, P2 = { x: a.x2, y: a.y2 };
  const C = a.curved ? { x: a.cx, y: a.cy } : { x: (a.x1 + a.x2) / 2, y: (a.y1 + a.y2) / 2 };
  const t = Math.max(0.001, Math.min(1, a.prog == null ? 1 : a.prog));
  const L1 = (p, q, s) => ({ x: p.x + (q.x - p.x) * s, y: p.y + (q.y - p.y) * s });
  const A1 = L1(P0, C, t), A2 = L1(C, P2, t), B = L1(A1, A2, t);
  const chord = Math.hypot(B.x - P0.x, B.y - P0.y);
  const L = Math.min(Math.max(0.26, a.width * 3.4), chord * 0.55 + 0.001), H = L * 0.55;
  let dx = B.x - A1.x, dy = B.y - A1.y, len = Math.hypot(dx, dy);
  if (len < 1e-6) { dx = B.x - P0.x; dy = B.y - P0.y; len = Math.hypot(dx, dy) || 1; }
  const ux = dx / len, uy = dy / len;
  let sx = A1.x - P0.x, sy = A1.y - P0.y, sl = Math.hypot(sx, sy);
  if (sl < 1e-6) { sx = ux; sy = uy; sl = 1; }
  sx /= sl; sy /= sl;
  const endH = a.head !== 'none', startH = a.head === 'both';
  const end = endH ? { x: B.x - ux * L * 0.7, y: B.y - uy * L * 0.7 } : B;
  const start = startH ? { x: P0.x + sx * L * 0.7, y: P0.y + sy * L * 0.7 } : P0;
  const tri = (tip, ex, ey) => {
    const bx = tip.x - ex * L, by = tip.y - ey * L;
    return `M${r3(tip.x)} ${r3(tip.y)}L${r3(bx - ey * H)} ${r3(by + ex * H)}L${r3(bx + ey * H)} ${r3(by - ex * H)}Z`;
  };
  const fullC = a.curved ? { x: a.cx, y: a.cy } : C;
  return {
    d: `M${r3(start.x)} ${r3(start.y)}Q${r3(A1.x)} ${r3(A1.y)} ${r3(end.x)} ${r3(end.y)}`,
    head: endH ? tri(B, ux, uy) : '',
    head2: startH ? tri(P0, -sx, -sy) : '',
    hit: `M${r3(a.x1)} ${r3(a.y1)}Q${r3(fullC.x)} ${r3(fullC.y)} ${r3(a.x2)} ${r3(a.y2)}`,
    mid: { x: 0.25 * a.x1 + 0.5 * fullC.x + 0.25 * a.x2, y: 0.25 * a.y1 + 0.5 * fullC.y + 0.25 * a.y2 }
  };
}

export function zonePath(z) {
  if (z.shape === 'rect') return `M${r3(z.x)} ${r3(z.y)}H${r3(z.x + z.w)}V${r3(z.y + z.h)}H${r3(z.x)}Z`;
  if (z.shape === 'ellipse') {
    const rx = z.w / 2, ry = z.h / 2, cx = z.x + rx, cy = z.y + ry;
    return `M${r3(cx - rx)} ${r3(cy)}A${r3(rx)} ${r3(ry)} 0 1 0 ${r3(cx + rx)} ${r3(cy)}A${r3(rx)} ${r3(ry)} 0 1 0 ${r3(cx - rx)} ${r3(cy)}Z`;
  }
  const pts = z.pts || [];
  if (pts.length < 2) return '';
  if (z.shape === 'poly') return 'M' + pts.map(p => r3(p[0]) + ' ' + r3(p[1])).join('L') + 'Z';
  const n = pts.length;
  const mid = i => { const a = pts[i % n], b = pts[(i + 1) % n]; return r3((a[0] + b[0]) / 2) + ' ' + r3((a[1] + b[1]) / 2); };
  let d = 'M' + mid(n - 1);
  for (let i = 0; i < n; i++) d += 'Q' + r3(pts[i][0]) + ' ' + r3(pts[i][1]) + ' ' + mid(i);
  return d + 'Z';
}

export function zoneCenter(z) {
  if (z.shape === 'rect' || z.shape === 'ellipse') return { x: z.x + z.w / 2, y: z.y + z.h / 2 };
  const pts = z.pts || [[0, 0]];
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return { x: x / pts.length, y: y / pts.length };
}

export function strokePath(pts) {
  if (!pts || !pts.length) return '';
  if (pts.length < 3) return 'M' + pts.map(p => r3(p[0]) + ' ' + r3(p[1])).join('L');
  let d = 'M' + r3(pts[0][0]) + ' ' + r3(pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    d += 'Q' + r3(a[0]) + ' ' + r3(a[1]) + ' ' + r3((a[0] + b[0]) / 2) + ' ' + r3((a[1] + b[1]) / 2);
  }
  const l = pts[pts.length - 1];
  return d + 'L' + r3(l[0]) + ' ' + r3(l[1]);
}

// Readable text colour (dark or white) on top of a fill colour.
export function textOn(hex) {
  const h = String(hex || '#000').replace('#', '');
  if (h.length < 6) return '#FFFFFF';
  const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return L > 0.36 ? '#0E1726' : '#FFFFFF';
}

export function darken(hex) {
  const h = String(hex || '#000').replace('#', '');
  if (h.length < 6) return '#0E1726';
  return '#' + [0, 2, 4].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.55).toString(16).padStart(2, '0')).join('');
}
