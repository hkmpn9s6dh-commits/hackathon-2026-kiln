import { Hono } from 'hono';
import type { TaskResponse } from '@devvit/web/server';
import { context } from '@devvit/web/server';

import { createPost } from '../core/post';

export const tasks = new Hono();

/**
 * 00:05 UTC every day: light the new kiln.
 *
 * The daily post is the whole return loop. Without it the game only exists
 * while somebody happens to scroll past yesterday's post.
 */
tasks.post('/daily-kiln', async (c) => {
  try {
    const post = await createPost();
    console.log(`daily-kiln: lit ${post.id} in r/${context.subredditName}`);
    return c.json<TaskResponse>({ status: 'ok' }, 200);
  } catch (error) {
    console.error('daily-kiln failed', error);
    return c.json<TaskResponse>({ status: 'error', message: 'could not post today’s kiln' }, 500);
  }
});
