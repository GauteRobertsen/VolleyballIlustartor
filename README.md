# Volleyball Tactics Board

A visual editor for volleyball formations and plays. Place players, the ball, arrows and
zones on a court, save each moment as a **position** (keyframe), then press **Play** to watch
everyone glide from position to position. Think "PowerPoint + animation timeline + tactics board".

## Run it

No build step. Serve the folder with any static file server and open `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(ES modules must be served over http; opening the file directly from disk will not load them.)
Preact and htm load from unpkg.com, so the browser needs internet access.

## Features

- **Court**: full 18 × 9 m court with net, antennae, attack lines and their dashed extensions,
  centre line, service zones and free zone. You can toggle a 1 m grid, rotation zone numbers (1–6)
  and snap-to-grid.
- **Players**: shared team roster (name, number, role, colour, my team / opponent). Supported roles:
  Setter, Middle Blocker, Wing Spiker, Opposite, Libero and Defensive Specialist. Labels can show
  the name, name + role, the role only, or nothing. Renaming a player updates every play.
- **Ball**: stored per position and animated between positions.
- **Arrows**: straight or curved, with presets (player run, ball path, attack, block, defense,
  pattern), colour, thickness, dashed style and arrowheads at the end, both ends or neither.
  You can drag the end handles, or drag the middle handle to bend an arrow.
- **Zones**: rectangle, circle, polygon or freeform shapes, with colour, transparency, a label
  and an optional dashed outline.
- **Draw**: freehand sketching.
- **Positions / keyframes**: add, duplicate, rename, add notes to, reorder (drag cards or use the
  move buttons) and delete positions, with no limit on how many.
- **Smooth movement**: players, the ball, arrows (which draw on, morph and fade) and zones
  interpolate between positions with easing. Clicking any position animates to it; nothing
  teleports. When "Paths" is on, select a player or the ball to see its path from the previous
  position. Drag the orange handle to curve that path.
- **Playback**: play all positions, pause, previous, next, restart and loop, at slow, normal or
  fast speed, with a progress bar.
- **Presentation mode**: shows a large court with captions taken from each position's coach notes.
- **System presets**: one click adds a 5-1 or 6-2 play with one position per rotation (in game
  order). The presets are serve receive, and serving followed by the switch to base defense. Every
  formation is overlap-legal, and the libero replaces the back-row middle. Presets use your team's
  roles and create any missing players (for example a second setter for 6-2).
- **Player markers** show the role (S, MB, WS, OPP, L, DS) inside the circle and the shirt number in
  the badge at the top right.
- **Tactics library**: separate plays with categories (Serve Receive, Free Ball, Attack
  Combination, Block Defense, Transition, Opponent Serve, Custom Play).
- **Undo / redo**, autosave to the browser, and JSON export / import (download a file or copy and
  paste the data).
- Keyboard shortcuts: `V P B A Z D X` pick tools, `Space` plays, `←` / `→` step through positions,
  `Delete` removes the selection, `Ctrl+Z` / `Ctrl+Y` undo and redo, `Esc` cancels.

## Code structure

| File | Responsibility |
| --- | --- |
| `src/constants.js` | Roles, arrow presets, speeds, palette |
| `src/model.js` | Data model, normalisation, example plays, factories |
| `src/presets.js` | 5-1 and 6-2 system presets (serve receive, serving, base defense) |
| `src/geometry.js` | Arrow, zone and stroke path geometry; colour helpers |
| `src/animation.js` | Frame → view conversion and keyframe interpolation |
| `src/history.js` | Undo / redo snapshots with edit coalescing |
| `src/storage.js` | localStorage autosave, JSON export / import |
| `src/court.js` | Court markings and the tactical SVG layers |
| `src/view.js` | UI layout: header, sidebars, toolbar, timeline, properties |
| `src/app.js` | Controller: state, pointer interaction, editing and playback |

### Data model

```
Project { team: Player[], plays: Play[], activePlayId }
Player  { id, name, number, role, color, side }              // shared across plays
Play    { id, name, category, roster: playerId[], frames: Frame[] }
Frame   { id, name, note,
          pos:   { [playerId]: { x, y, hidden, via } },       // via = curved path control point
          ball:  { x, y, hidden, via },
          arrows, zones, strokes }
```

Coordinates are in metres, measured from the home team's back-left corner (18 × 9 court, net at x = 9).
Every frame stores the complete court state, so each position is deterministic and can be edited
on its own. A duplicated frame keeps its arrow and zone ids, so those objects morph smoothly into
the copy instead of fading out and back in.
