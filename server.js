import { createExports } from '@astrojs/cloudflare/server';
import { App } from './dist/server/entry.mjs';

const { onRequest } = createExports(App);

export { onRequest };