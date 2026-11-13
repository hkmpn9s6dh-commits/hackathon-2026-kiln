/**
 * The two endpoints the webview is allowed to call. Kept free of Devvit imports
 * so the same routes run under `scripts/preview.mjs` on a laptop.
 */

import { Hono } from 'hono';
import type { ErrorResponse, FireRequest } from '../shared/api.ts';
import { buildInit, playFire, type GameStore, type Session } from './service.ts';

export type AppDeps = {
  store: GameStore;
  session: () => Session;
  now: () => Date;
};

export function createApi(deps: AppDeps): Hono {
  const api = new Hono();

  api.get('/api/init', async (c) => {
    try {
      return c.json(await buildInit(deps.store, deps.session(), deps.now()));
    } catch (error) {
      console.error('init failed', error);
      return c.json<ErrorResponse>({ type: 'error', message: 'The kiln did not open.' }, 500);
    }
  });

  api.post('/api/fire', async (c) => {
    let body: FireRequest;
    try {
      body = await c.req.json<FireRequest>();
    } catch {
      return c.json<ErrorResponse>({ type: 'error', message: 'Malformed request.' }, 400);
    }
    try {
      const result = await playFire(deps.store, deps.session(), body, deps.now());
      if (!result.ok) {
        return c.json<ErrorResponse>({ type: 'error', message: result.message }, 400);
      }
      return c.json(result.value);
    } catch (error) {
      console.error('fire failed', error);
      return c.json<ErrorResponse>({ type: 'error', message: 'The fire went out.' }, 500);
    }
  });

  return api;
}
