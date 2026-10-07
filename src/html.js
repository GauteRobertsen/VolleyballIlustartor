// htm bound to Preact: JSX-like templates without a build step.
import { h } from 'https://unpkg.com/preact@10.24.3/dist/preact.module.js';
import htm from 'https://unpkg.com/htm@3.1.1/dist/htm.module.js';

export const html = htm.bind(h);
