import { Hono } from 'hono';
import { context, redis } from '@devvit/web/server';

import type { CommitResponse, ErrorResponse, StateResponse, YardResponse } from '../../shared/api';
import { readState, readYard, submitPiece } from '../core/store';

export const api = new Hono();

type CommitBody = {
  wareId?: unknown;
  slotId?: unknown;
  taps?: unknown;
  guestId?: unknown;
};

function whoami(guestId: unknown): { id: string; name: string; guest: boolean } {
  const username = context.username ?? null;
  if (context.userId) {
    return { id: context.userId, name: username ?? 'a passing potter', guest: false };
  }
  const guest =
    typeof guestId === 'string' && /^[a-z0-9]{8,24}$/i.test(guestId) ? guestId : 'anonymous';
  return { id: `guest:${guest}`, name: username ?? 'a guest potter', guest: true };
}

api.get('/state', async (c) => {
  try {
    const me = whoami(undefined);
    const state = await readState(redis, new Date(), context.username ?? null, me.id);
    return c.json<StateResponse>(state);
  } catch (error) {
    console.error('state failed', error);
    return c.json<ErrorResponse>({ type: 'error', message: 'The kiln did not answer.' }, 500);
  }
});

api.get('/yard', async (c) => {
  try {
    const yard = await readYard(redis, new Date());
    return c.json<YardResponse>({ type: 'yard', ...yard });
  } catch (error) {
    console.error('yard failed', error);
    return c.json<ErrorResponse>({ type: 'error', message: 'The kiln yard is closed.' }, 500);
  }
});

api.post('/commit', async (c) => {
  let body: CommitBody;
  try {
    body = await c.req.json<CommitBody>();
  } catch {
    return c.json<ErrorResponse>({ type: 'error', message: 'Nothing was sent.' }, 400);
  }

  const wareId = typeof body.wareId === 'string' ? body.wareId : '';
  const slotId = typeof body.slotId === 'string' ? body.slotId : '';
  const taps = Array.isArray(body.taps) ? body.taps.map((n) => Number(n)) : [];
  if (!wareId || !slotId || taps.length !== 3 || taps.some((n) => !Number.isFinite(n))) {
    return c.json<ErrorResponse>({ type: 'error', message: 'That is not a firing.' }, 400);
  }

  const me = whoami(body.guestId);
  try {
    const outcome = await submitPiece(redis, new Date(), { id: me.id, name: me.name }, { wareId, slotId, taps });
    if (outcome.kind === 'rejected') {
      return c.json<ErrorResponse>({ type: 'error', message: outcome.message }, 400);
    }
    return c.json<CommitResponse>(outcome.response);
  } catch (error) {
    console.error('commit failed', error);
    return c.json<ErrorResponse>({ type: 'error', message: 'The kiln door jammed. Try once more.' }, 500);
  }
});
