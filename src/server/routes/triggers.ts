import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';

import { createPost } from '../core/post';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();
    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Lit the first kiln in r/${context.subredditName} as ${post.id} (${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error lighting the first kiln: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Could not light the first kiln' }, 400);
  }
});
