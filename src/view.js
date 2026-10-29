// UI layout: header, plays/team sidebar, toolbar, court, timeline and properties panel.

import { html } from './html.js';
import { Court, Thumb } from './court.js';
import { CATEGORIES } from './constants.js';

const I = (d, extra = '') => html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: d + extra }}></svg>`;
const ICONS = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3"/><path d="M8 21v-7h8v7"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v3h16v-3"/>',
  upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 17v3h16v-3"/>',
  present: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4"/><path d="M8 20h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  select: '<path d="M5 3l14 8-6 1.5L10 19z"/>',
  player: '<circle cx="10" cy="8" r="4"/><path d="M3 20c.8-3.6 3.6-6 7-6s6.2 2.4 7 6"/><path d="M19 4v6M16 7h6"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 3c-2 3.5-2 7 0 9 2.6 3 6.5 3.4 9 2"/><path d="M3.4 9c3.8-.6 7 .9 8.6 3"/><path d="M6.5 19.5c.4-3.8 2.4-6.3 5.5-7.5"/>',
  arrow: '<path d="M4 20C7 9 12 6 19 5"/><path d="M14 3.5 19 5l-2.5 4.5"/>',
  zone: '<path d="M4 7l7-3 9 4-2 10-10 2-4-6z" fill="currentColor" fill-opacity=".18"/>',
  draw: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  delete: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  loop: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'
};
const SOLID = {
  prev: '<path d="M6 5h2v14H6zM20 5v14L9 12z"/>',
  next: '<path d="M16 5h2v14h-2zM4 5v14l11-7z"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>'
};
const icon = name => I(ICONS[name]);
const solid = name => html`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: SOLID[name] }}></svg>`;

const TOOLS = [['select', 'Select', 'V'], ['player', 'Player', 'P'], ['ball', 'Ball', 'B'], ['arrow', 'Arrow', 'A'], ['zone', 'Zone', 'Z'], ['draw', 'Draw', 'D'], ['delete', 'Delete', 'X']];
const ROLE_OPTIONS = [['S', 'Setter'], ['MB', 'Middle Blocker'], ['WS', 'Wing Spiker'], ['OPP', 'Opposite'], ['L', 'Libero'], ['DS', 'Defensive Specialist']];

const Swatches = (list, extra) => html`<div class="swatches">
  ${list.map(c => html`<button key=${c.key} class=${c.cls} style=${c.style} onClick=${c.pick} aria-label=${c.label}></button>`)}${extra || ''}
</div>`;
const Seg = (cur, opts, pick) => html`<div class="seg">${opts.map(([k, label]) => html`<button class=${cur === k ? 'on' : ''} onClick=${() => pick(k)}>${label}</button>`)}</div>`;
const CatOptions = () => CATEGORIES.map(c => html`<option value=${c}>${c}</option>`);

function Header(v) {
  const s = v.s;
  return html`
  <header class="hdr">
    <div class="brand">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FB923C" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M12 2.5c-2 3.5-2 7 0 9.5 2.6 3 6.5 3.4 9.4 2" /><path d="M3 9.2c3.9-.6 7.2.8 9 2.8" /><path d="M6.2 19.5c.4-3.8 2.5-6.3 5.8-7.5" /></svg>
      <span>Tactics Board</span>
    </div>
    <div class="playmeta">
      <input class="playname" value=${v.play.name} onInput=${v.setPlayName} aria-label="Play name" />
      <select class="catsel" value=${v.play.category} onChange=${v.setPlayCat} aria-label="Play category">${CatOptions()}</select>
    </div>
    <div class="hdr-actions">
      <span class="savemsg" aria-live="polite">${s.saveMsg}</span>
      <button class="hbtn" onClick=${v.undo} disabled=${!v.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">${icon('undo')}</button>
      <button class="hbtn" onClick=${v.redo} disabled=${!v.canRedo} aria-label="Redo" title="Redo (Ctrl+Y)">${icon('redo')}</button>
      <button class="hbtn" onClick=${v.saveNow} title="Save to this browser">${icon('save')}Save</button>
      <button class="hbtn" onClick=${v.openIO} title="Export or import plays as a file">${icon('download')}Export / Import</button>
      <button class="hbtn accent" onClick=${v.togglePresent}>${icon('present')}${s.present ? 'Exit presentation' : 'Present'}</button>
    </div>
  </header>`;
}

function PlaysTab(v) {
  const np = v.s.newPlay;
  return html`<div class="pad">
    ${!np && html`<button class="btn primary wide" onClick=${v.startNewPlay}>${icon('plus')}New play</button>`}
    ${np && html`<div class="newplay">
      <div class="field"><label for="np-name">Play name</label><input id="np-name" class="inp" value=${np.name} onInput=${v.setNewPlayName} placeholder="e.g. Rotation 2 receive" /></div>
      <div class="field"><label for="np-cat">Category</label><select id="np-cat" class="inp" value=${np.cat} onChange=${v.setNewPlayCat}>${CatOptions()}</select></div>
      <div class="rowbtns"><button class="btn primary sm" onClick=${v.createPlay}>Create play</button><button class="btn sm" onClick=${v.cancelNewPlay}>Cancel</button></div>
    </div>`}
    <p class="ptitle">Rally simulator</p>
    <p class="empty" style="margin:0">Random rallies between both teams in a 5-1: serve, pass, set, attack, block and dig. Score and rotations carry over.</p>
    <div class="rowbtns">
      <button class="btn primary sm" onClick=${v.runRally}>${solid('play')}Simulate a rally</button>
      <button class=${'toggle' + (v.s.autoRally ? ' on' : '')} onClick=${v.toggleAutoRally} aria-pressed=${v.s.autoRally ? 'true' : 'false'}>${icon('loop')}Auto-play rallies</button>
    </div>
    <p class="ptitle">System presets</p>
    <p class="empty" style="margin:0">Adds a play with one position per rotation, using your team's roles.</p>
    <div class="list">${v.presets.map(p => html`<button key=${p.key} class="item" onClick=${p.add}>
      <span class="grow"><span class="t1">${p.label}</span></span>${icon('plus')}</button>`)}</div>
    <p class="ptitle">Tactics library</p>
    <div class="list">
      ${v.plays.map(pl => html`<div class="list" key=${pl.key}>
        <button class=${pl.cls} onClick=${pl.open}>
          <span class="grow"><span class="t1">${pl.name}</span><span class="t2">${pl.cat} · ${pl.count}</span></span>
        </button>
        ${pl.active && html`<div class="rowbtns" style="padding-left:4px">
          <button class="btn sm" onClick=${pl.dup}>${icon('copy')}Duplicate</button>
          <button class="btn sm danger" onClick=${pl.del} disabled=${pl.onlyOne}>Delete</button>
        </div>`}
        ${pl.confirming && html`<div class="confirm"><span>Delete this play and all its positions?</span><button class="btn sm danger" onClick=${pl.yes}>Delete</button><button class="btn sm" onClick=${pl.no}>Keep</button></div>`}
      </div>`)}
    </div>
  </div>`;
}

const TeamRow = tp => html`<button key=${tp.key} class=${tp.cls} onClick=${tp.pick}>
  <span class="dot" style=${tp.dotStyle}>${tp.num}</span>
  <span class="grow"><span class="t1">${tp.name}</span><span class="t2">${tp.role}</span></span>
  <span class=${tp.chipCls}>${tp.chip}</span>
</button>`;

function TeamTab(v) {
  return html`<div class="pad">
    <div class="rowbtns">
      <button class="btn primary sm" onClick=${() => v.addPlayer('home')}>${icon('plus')}Add player</button>
      <button class="btn sm" onClick=${() => v.addPlayer('opp')}>${icon('plus')}Add opponent</button>
    </div>
    <p class="ptitle">Your team</p>
    <div class="list">${v.homeList.map(TeamRow)}</div>
    <p class="ptitle">Opponents</p>
    <div class="list">${v.oppList.map(TeamRow)}${!v.oppList.length && html`<span class="empty">No opponents yet.</span>`}</div>
    <div class="field"><span class="flabel">Team colour (all your players except libero)</span>${Swatches(v.teamSwatches)}</div>
    <p class="empty" style="margin:0">Names, numbers and roles are shared by every play, so editing a player here updates all saved positions.</p>
  </div>`;
}

function Sidebar(v) {
  const tab = v.s.tab;
  return html`<aside class="side left" aria-label="Plays and team">
    <div class="tabs">
      <button class=${'tab' + (tab === 'plays' ? ' on' : '')} onClick=${() => v.setTab('plays')}>Plays</button>
      <button class=${'tab' + (tab === 'team' ? ' on' : '')} onClick=${() => v.setTab('team')}>Team</button>
    </div>
    ${tab === 'plays' ? PlaysTab(v) : TeamTab(v)}
  </aside>`;
}

function Toolbar(v) {
  const s = v.s;
  return html`<div class="toolbar" role="toolbar" aria-label="Tools">
    <div class="tgroup">
      ${TOOLS.map(([k, label, key]) => html`<button class=${'tool' + (s.tool === k ? ' on' : '')} onClick=${() => v.setTool(k)} title=${label + ' (' + key + ')'}>${icon(k)}${label}</button>`)}
    </div>
    <span class="sep"></span>
    <div class="tgroup">
      <button class="tool" onClick=${v.undo} disabled=${!v.canUndo} title="Undo (Ctrl+Z)">${icon('undo')}Undo</button>
      <button class="tool" onClick=${v.redo} disabled=${!v.canRedo} title="Redo (Ctrl+Y)">${icon('redo')}Redo</button>
    </div>
    <span class="sep"></span>
    <div class="tgroup" style="gap:6px">
      ${v.viewToggles.map(t => html`<button class=${'toggle' + (t.on ? ' on' : '')} onClick=${t.toggle} aria-pressed=${t.on ? 'true' : 'false'}>${t.label}</button>`)}
      <select class="miniSel" value=${s.labelMode} onChange=${v.setLabelMode} aria-label="Player labels">
        <option value="name">Label: name</option><option value="name-role">Label: name + role</option>
        <option value="role">Label: role</option><option value="none">Label: none</option>
      </select>
    </div>
  </div>`;
}

function ToolOptions(v) {
  const s = v.s, t = s.tool;
  let body;
  if (t === 'select') body = html`<span class="hint">Drag players, the ball, arrows and zones. Select a player to bend its movement path (orange handle). Click empty court to see position settings.</span>`;
  else if (t === 'delete') body = html`<span class="hint">Click any object on the court to delete it. Players are removed from this play only, never from your team.</span>`;
  else if (t === 'ball') body = html`<span class="hint">Click anywhere to place the ball for this position. Each position stores its own ball spot.</span>`;
  else if (t === 'player') body = html`<span class="flabel">Click the court to place:</span>
    <div class="rowbtns">${v.placeOptions.map(o => html`<button key=${o.key} class=${o.cls} onClick=${o.pick}>${o.label}</button>`)}</div>`;
  else if (t === 'arrow') body = html`${Seg(s.arrowMode, [['straight', 'Straight'], ['curved', 'Curved']], v.setArrowMode)}
    <div class="rowbtns">${v.arrowKinds.map(k => html`<button key=${k.key} class=${k.cls} onClick=${k.pick}>
      <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true"><line x1="1" y1="5" x2="15" y2="5" stroke=${k.color} stroke-width="2.6" stroke-dasharray=${k.dash} /><path d="M14 1l7 4-7 4z" fill=${k.color} /></svg>${k.label}</button>`)}</div>
    <span class="hint">Drag on the court to draw. Start on a player to anchor it.</span>`;
  else if (t === 'zone') body = html`${Seg(s.zoneShape, [['rect', 'Rectangle'], ['ellipse', 'Circle'], ['poly', 'Polygon'], ['free', 'Freeform']], v.setZoneShape)}
    ${Swatches(v.zoneSwatches)}
    <label class="check" style="font-size:13px">Opacity <input type="range" min="0.05" max="0.8" step="0.05" value=${s.zoneOpacity} onInput=${v.setZoneOpacity} style="width:90px" /></label>
    ${v.polyActive && html`<button class="btn sm primary" onClick=${v.finishPoly}>Finish shape</button><button class="btn sm" onClick=${v.cancelPoly}>Cancel</button>`}
    <span class="hint">${s.zoneShape === 'poly' ? 'Click corner points; click the first point or double-click to close.' : s.zoneShape === 'free' ? 'Drag to outline an area.' : 'Drag on the court to draw.'}</span>`;
  else body = html`${Swatches(v.penSwatches)}${Seg(v.pwKey, [['thin', 'Thin'], ['mid', 'Medium'], ['thick', 'Thick']], k => v.setPenWidth({ thin: 0.045, mid: 0.08, thick: 0.14 }[k]))}<span class="hint">Sketch freely on the court.</span>`;
  return html`<div class="optbar">${body}</div>`;
}

function Timeline(v) {
  const s = v.s;
  return html`<section class="timeline" aria-label="Positions timeline">
    <div class="transport">
      <button class="tbtn" onClick=${v.restart} aria-label="Restart" title="Restart">${icon('restart')}</button>
      <button class="tbtn" onClick=${v.prev} disabled=${v.atStart} aria-label="Previous position" title="Previous (Left arrow)">${solid('prev')}</button>
      <button class="tbtn play" onClick=${v.togglePlay} aria-label=${s.playing ? 'Pause' : 'Play all positions'} title="Play all positions (Space)">${solid(s.playing ? 'pause' : 'play')}</button>
      <button class="tbtn" onClick=${v.next} disabled=${v.atEnd} aria-label="Next position" title="Next (Right arrow)">${solid('next')}</button>
      <div class="pos">Position ${v.frameNum}<small>of ${v.frameCount}</small></div>
      <div class="progress" aria-hidden="true">
        <div class="bar" style=${'width:' + v.pct + '%'}></div>
        ${v.ticks.map(t => html`<span class=${t.cls} style=${'left:' + t.left}></span>`)}
      </div>
      ${Seg(s.speed, [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], v.setSpeed)}
      <button class=${'toggle' + (s.loop ? ' on' : '')} onClick=${v.toggleLoop} aria-pressed=${s.loop ? 'true' : 'false'}>${icon('loop')}Loop</button>
    </div>
    ${!s.present && html`<div class="tlhead">
      <span class="ptitle">Saved positions · drag cards to reorder</span>
      <div class="rowbtns">
        <button class="btn sm" onClick=${v.addFrame} title="New position after this one, keeping players and ball where they are">${icon('plus')}Add position</button>
        <button class="btn sm" onClick=${v.dupFrame} title="Exact copy including arrows and zones">Duplicate</button>
        <button class="btn sm" onClick=${v.moveLeft} disabled=${v.atStart} aria-label="Move position earlier">Move ◂</button>
        <button class="btn sm" onClick=${v.moveRight} disabled=${v.atEnd} aria-label="Move position later">Move ▸</button>
        <button class="btn sm danger" onClick=${v.delFrame} disabled=${v.frameCount < 2}>Delete</button>
      </div>
    </div>`}
    <div class="cards">
      ${v.cards.map(cd => html`<button key=${cd.key} class=${cd.cls} draggable="true" onClick=${cd.click} onDragStart=${cd.dragStart} onDragOver=${cd.dragOver}
          onDragLeave=${cd.dragLeave} onDrop=${cd.drop} onDragEnd=${cd.dragEnd} aria-label=${cd.aria}>
        ${Thumb(cd)}
        <span class="cname"><span class="cnum">${cd.num}</span><span class="ctxt">${cd.name}</span></span>
      </button>`)}
      ${!s.present && html`<button class="card add" onClick=${v.addFrame}>${icon('plus')}Add position</button>`}
    </div>
  </section>`;
}

function PositionPanel(v) {
  return html`
    <p class="ptitle">Position ${v.frameNum}</p>
    <div class="field"><label for="f-name">Name</label><input id="f-name" class="inp" value=${v.frame.name} onInput=${v.setFrameName} /></div>
    <div class="field"><label for="f-note">Coach notes (shown when presenting)</label><textarea id="f-note" class="inp" value=${v.frame.note} onInput=${v.setFrameNote} placeholder="What should players focus on here?"></textarea></div>
    <label class="check"><input type="checkbox" checked=${v.frame.ballVisible} onChange=${v.toggleBallVisible} /> Ball visible in this position</label>
    <div class="tip"><strong>${v.frameSummary}</strong></div>
    <div class="tip">
      <strong>Quick start</strong>
      <ol>
        <li>Drag players into place (Player tool adds more).</li>
        <li>Draw arrows and zones for this moment.</li>
        <li>Press <strong>Add position</strong> and move players to the next spot.</li>
        <li>Press Play: everyone glides between positions.</li>
      </ol>
      <div style="margin-top:6px">Keys: <span class="kbd">V</span> <span class="kbd">P</span> <span class="kbd">B</span> <span class="kbd">A</span> <span class="kbd">Z</span> <span class="kbd">D</span> tools · <span class="kbd">Space</span> play · <span class="kbd">←</span><span class="kbd">→</span> step · <span class="kbd">Del</span> delete</div>
    </div>`;
}

function PlayerPanel(v) {
  const p = v.sp;
  return html`
    <div style="display:flex;align-items:center;gap:10px">
      <span class="dot" style=${p.dotStyle}>${p.number}</span>
      <div style="min-width:0"><p class="ptitle">Player</p><div style="font-weight:700;font-size:16px">${p.title}</div></div>
    </div>
    <div class="two">
      <div class="field"><label for="p-name">Name</label><input id="p-name" class="inp" value=${p.name} onInput=${p.setName} /></div>
      <div class="field"><label for="p-num">Number</label><input id="p-num" class="inp" type="number" min="0" max="99" value=${p.number} onInput=${p.setNumber} /></div>
    </div>
    <div class="field"><label for="p-role">Position / role</label>
      <select id="p-role" class="inp" value=${p.role} onChange=${p.setRole}>${ROLE_OPTIONS.map(([k, n]) => html`<option value=${k}>${n}</option>`)}</select></div>
    <div class="field"><label for="p-side">Team</label>
      <select id="p-side" class="inp" value=${p.side} onChange=${p.setSide}><option value="home">My team</option><option value="opp">Opponent</option></select></div>
    <div class="field"><span class="flabel">Colour</span>
      ${Swatches(p.swatches, html`<input class="colorinp" type="color" value=${p.color} onInput=${p.setColor} aria-label="Custom colour" />`)}</div>
    ${p.inPlay ? html`
      <label class="check"><input type="checkbox" checked=${p.visible} onChange=${p.toggleVisible} /> On court in this position</label>
      ${p.hasPathCtl && html`<div class="tip">Movement into this position follows the dashed path. Drag the orange handle on the court to bend it.
        <div style="margin-top:6px"><button class="btn sm" onClick=${p.straighten} disabled=${p.noVia}>Straighten path</button></div></div>`}
      <button class="btn danger" onClick=${p.removeFromPlay}>Remove from this play</button>` : html`
      <div class="tip">Not on court in this play.</div>
      <button class="btn primary" onClick=${p.addToPlay}>Put on court</button>`}
    ${p.confirming ? html`<div class="confirm"><span>Remove ${p.name} from the team and every play?</span><button class="btn sm danger" onClick=${p.yes}>Remove</button><button class="btn sm" onClick=${p.no}>Keep</button></div>`
      : html`<button class="btn sm" onClick=${p.askDelete} style="align-self:flex-start">Delete from team…</button>`}`;
}

function BallPanel(v) {
  return html`
    <p class="ptitle">Ball</p>
    <div style="font-weight:700;font-size:16px">Ball in position ${v.frameNum}</div>
    <label class="check"><input type="checkbox" checked=${v.frame.ballVisible} onChange=${v.toggleBallVisible} /> Visible in this position</label>
    ${v.frameNum > 1 && v.s.showPaths && html`<div class="tip">The ball travels along the dashed path. Drag the orange handle to give it an arc.
      <div style="margin-top:6px"><button class="btn sm" onClick=${v.straightenBall} disabled=${!v.frame.ballVia}>Straighten path</button></div></div>`}
    <div class="tip">Tip: draw a dashed <strong>Ball path</strong> arrow to show where the ball goes next.</div>`;
}

function ArrowPanel(v) {
  const a = v.sa;
  return html`
    <p class="ptitle">Arrow</p>
    <div class="field"><span class="flabel">Type</span>
      <div class="rowbtns">${a.kinds.map(k => html`<button key=${k.key} class=${k.cls} onClick=${k.pick}>${k.label}</button>`)}</div></div>
    <div class="field"><span class="flabel">Colour</span>
      ${Swatches(a.swatches, html`<input class="colorinp" type="color" value=${a.color} onInput=${a.setColor} aria-label="Custom colour" />`)}</div>
    <div class="field"><label for="a-w">Thickness</label><input id="a-w" type="range" min="0.03" max="0.26" step="0.01" value=${a.width} onInput=${a.setWidth} /></div>
    <div class="field"><label for="a-h">Arrowhead</label>
      <select id="a-h" class="inp" value=${a.head} onChange=${a.setHead}><option value="end">At the end</option><option value="both">Both ends</option><option value="none">None</option></select></div>
    <label class="check"><input type="checkbox" checked=${a.curved} onChange=${a.toggleCurved} /> Curved (drag the middle handle)</label>
    <label class="check"><input type="checkbox" checked=${a.dash} onChange=${a.toggleDash} /> Dashed line</label>
    <button class="btn danger" onClick=${v.deleteSel}>Delete arrow</button>`;
}

function ZonePanel(v) {
  const z = v.sz;
  return html`
    <p class="ptitle">Zone · ${z.shapeName}</p>
    <div class="field"><label for="z-l">Label</label><input id="z-l" class="inp" value=${z.label} onInput=${z.setLabel} placeholder="e.g. P1 defence" /></div>
    <div class="field"><span class="flabel">Colour</span>
      ${Swatches(z.swatches, html`<input class="colorinp" type="color" value=${z.color} onInput=${z.setColor} aria-label="Custom colour" />`)}</div>
    <div class="field"><label for="z-o">Transparency · ${z.pct}</label><input id="z-o" type="range" min="0.05" max="0.8" step="0.05" value=${z.opacity} onInput=${z.setOpacity} /></div>
    <label class="check"><input type="checkbox" checked=${z.dashed} onChange=${z.toggleDashed} /> Dashed outline</label>
    <button class="btn danger" onClick=${v.deleteSel}>Delete zone</button>`;
}

function StrokePanel(v) {
  const st = v.ss;
  return html`
    <p class="ptitle">Drawing</p>
    <div class="field"><span class="flabel">Colour</span>${Swatches(st.swatches)}</div>
    <div class="field"><label for="s-w">Thickness</label><input id="s-w" type="range" min="0.03" max="0.25" step="0.01" value=${st.width} onInput=${st.setWidth} /></div>
    <button class="btn danger" onClick=${v.deleteSel}>Delete drawing</button>`;
}

function Properties(v) {
  const t = v.sel && v.sel.type;
  const body = !t ? PositionPanel(v) : t === 'player' ? PlayerPanel(v) : t === 'ball' ? BallPanel(v) : t === 'arrow' ? ArrowPanel(v) : t === 'zone' ? ZonePanel(v) : StrokePanel(v);
  return html`<aside class="side right" aria-label="Properties"><div class="pad">${body}</div></aside>`;
}

function IOModal(v) {
  const s = v.s;
  return html`<div class="modalbg" onPointerDown=${v.closeIO}>
    <div class="modal" role="dialog" aria-label="Export and import" onPointerDown=${e => e.stopPropagation()}>
      <h2>Export / Import</h2>
      <p style="margin:0;color:#526077">Your work saves automatically in this browser. Export a file to keep a backup or share plays with another coach.</p>
      <div class="rowbtns">
        <button class="btn primary" onClick=${v.download}>${icon('download')}Download file</button>
        <label class="btn filelbl">${icon('upload')}Open file…<input type="file" accept=".json,application/json" onChange=${v.loadFile} aria-label="Open a saved tactics file" /></label>
        <button class="btn" onClick=${v.loadSample}>Load example plays</button>
      </div>
      <div class="field"><label for="io-t">Or copy / paste the data</label><textarea id="io-t" class="inp mono" value=${s.jsonText} onInput=${v.setJsonText}></textarea></div>
      <div class="rowbtns" style="justify-content:space-between;align-items:center">
        <span class="iomsg" aria-live="polite">${s.ioMsg}</span>
        <span class="rowbtns"><button class="btn" onClick=${v.importText}>Import pasted data</button><button class="btn primary" onClick=${v.closeIO}>Done</button></span>
      </div>
    </div>
  </div>`;
}

export function view(v) {
  const s = v.s;
  return html`<div class=${'app' + (s.present ? ' present' : '')} tabindex="-1" onKeyDown=${v.onKey}>
    ${Header(v)}
    <div class="body">
      ${!s.present && Sidebar(v)}
      <main class="stage">
        ${!s.present && Toolbar(v)}
        ${!s.present && ToolOptions(v)}
        <div class="courtwrap">
          ${Court(v)}
          ${s.present && html`<div class="caption"><div class="c1">${v.frameNum}. ${v.frame.name}</div>${v.frame.note && html`<div class="c2">${v.frame.note}</div>`}</div>`}
        </div>
        ${Timeline(v)}
      </main>
      ${!s.present && Properties(v)}
    </div>
    ${s.ioOpen && IOModal(v)}
  </div>`;
}
