// Undo / redo as JSON snapshots of the whole project. Rapid edits to the same field
// (typing a name, dragging a slider) share a coalesce key and become one undo step.

export class History {
  constructor(limit = 200) {
    this.past = [];
    this.future = [];
    this.limit = limit;
    this.lastKey = null;
    this.lastKeyT = 0;
  }

  record(snapshot, key) {
    const now = Date.now();
    if (!(key && this.lastKey === key && now - this.lastKeyT < 1500)) this.push(snapshot);
    else this.future = [];
    this.lastKey = key || null;
    this.lastKeyT = now;
  }

  push(snapshot) {
    this.past.push(snapshot);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.lastKey = null;
  }

  undo(current) {
    if (!this.past.length) return null;
    this.future.push(current);
    this.lastKey = null;
    return this.past.pop();
  }

  redo(current) {
    if (!this.future.length) return null;
    this.past.push(current);
    this.lastKey = null;
    return this.future.pop();
  }

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}
