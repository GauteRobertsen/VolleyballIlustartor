// Save / load: browser autosave plus JSON file export and import.

import { STORAGE_KEY } from './constants.js';
import { normalize } from './model.js';

export function loadLocal() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch (e) {
    return null;
  }
}

export function saveLocal(project) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    return true;
  } catch (e) {
    return false;
  }
}

export function downloadJson(project, filename = 'volleyball-tactics.json') {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function parseProject(text) {
  try { return normalize(JSON.parse(text)); } catch (e) { return null; }
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result));
    rd.onerror = reject;
    rd.readAsText(file);
  });
}
