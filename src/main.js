import { render } from 'https://unpkg.com/preact@10.24.3/dist/preact.module.js';
import { html } from './html.js';
import { App } from './app.js';

render(html`<${App} />`, document.getElementById('root'));
