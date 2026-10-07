// Shared constants: roles, arrow presets, playback speeds and colour palette.

export const ROLES = {
  S: { name: 'Setter', abbr: 'S' },
  MB: { name: 'Middle Blocker', abbr: 'MB' },
  WS: { name: 'Wing Spiker', abbr: 'WS' },
  OPP: { name: 'Opposite', abbr: 'OPP' },
  L: { name: 'Libero', abbr: 'L' },
  DS: { name: 'Defensive Specialist', abbr: 'DS' }
};

export const CATEGORIES = ['Serve Receive', 'Free Ball', 'Attack Combination', 'Block Defense', 'Transition', 'Opponent Serve', 'Custom Play'];

// dur = transition time between positions, hold = pause on each position while playing
export const SPEEDS = {
  slow: { dur: 1800, hold: 900 },
  normal: { dur: 1050, hold: 550 },
  fast: { dur: 560, hold: 260 }
};

export const ARROWS = {
  run: { label: 'Player run', color: '#1D4ED8', width: 0.09, dash: false },
  ball: { label: 'Ball path', color: '#EA580C', width: 0.08, dash: true },
  attack: { label: 'Attack', color: '#DC2626', width: 0.15, dash: false },
  block: { label: 'Block', color: '#7C3AED', width: 0.12, dash: false },
  defense: { label: 'Defense', color: '#047857', width: 0.09, dash: true },
  pattern: { label: 'Pattern', color: '#0F172A', width: 0.07, dash: true }
};

export const SWATCHES = ['#2563EB', '#DC2626', '#16A34A', '#F59E0B', '#7C3AED', '#0D9488', '#DB2777', '#0F172A'];
export const SWATCH_NAMES = ['Blue', 'Red', 'Green', 'Amber', 'Purple', 'Teal', 'Pink', 'Black'];

export const STORAGE_KEY = 'vbTacticsBoard.project.v1';

// Court coordinates are metres: playing court 18 x 9, net at x = 9, home side on the left.
export const VIEWBOX = { x: -3.5, y: -2, w: 25, h: 13 };

export const roleOf = r => ROLES[r] || ROLES.WS;
