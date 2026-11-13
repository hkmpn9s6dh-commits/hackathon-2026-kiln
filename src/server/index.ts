/**
 * Devvit entry point: the shared API plus the platform-only parts — Journeys
 * telemetry, the moderator menu, the install trigger and the daily post.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort, context, reddit, settings } from '@devvit/web/server';
import { telemetry } from '@devvit/analytics/server/reddit';
import type { UiResponse } from '@devvit/web/shared';
import { createApi } from './app.ts';
import { redisStore } from './store-redis.ts';
import type { Session } from './service.ts';
import { dayKeyOf, specForDay } from '../shared/sim/daily.ts';

function sessionOf(): Session {
  const loggedIn = Boolean(context.userId);
  const user = context.userId ?? `loid:${context.loid ?? 'unknown'}`;
  const name = context.username ?? guestName(context.loid);
  return { user, name, loggedIn };
}

/** Logged-out players still get a consistent name on the map, never a real one. */
function guestName(loid: string | undefined): string {
  if (!loid) return 'A passer-by';
  let h = 0;
  for (let i = 0; i < loid.length; i++) h = (Math.imul(h, 31) + loid.charCodeAt(i)) >>> 0;
  return `Guest ${(h % 89) + 10}`;
}

function todaysPostTitle(): string {
  const day = dayKeyOf(new Date());
  const spec = specForDay(day);
  return `KILN · ${spec.ware.name} (${spec.ware.zh}) — ${day}`;
}

async function newPost(): Promise<{ id: string }> {
  return reddit.submitCustomPost({ title: todaysPostTitle() });
}

const app = new Hono();
app.route('/', createApi({ store: redisStore(), session: sessionOf, now: () => new Date() }));

app.post('/internal/menu/post-create', async (c) => {
  try {
    const post = await newPost();
    return c.json<UiResponse>(
      { navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}` },
      200,
    );
  } catch (error) {
    console.error('menu post-create failed', error);
    return c.json<UiResponse>({ showToast: 'Could not light the kiln.' }, 400);
  }
});

app.post('/internal/triggers/on-app-install', async (c) => {
  try {
    const post = await newPost();
    return c.json(
      { status: 'success', message: `Posted ${post.id} in ${context.subredditName}` },
      200,
    );
  } catch (error) {
    console.error('on-app-install failed', error);
    return c.json({ status: 'error', message: 'Could not create the first kiln post.' }, 400);
  }
});

app.post('/internal/cron/daily-post', async (c) => {
  try {
    const enabled = await settings.get<boolean>('dailyPost');
    if (enabled === false) {
      return c.json({ status: 'success', message: 'Daily post is off in app settings.' }, 200);
    }
    const post = await newPost();
    return c.json({ status: 'success', message: `Posted ${post.id} for ${dayKeyOf(new Date())}` }, 200);
  } catch (error) {
    console.error('daily-post failed', error);
    return c.json({ status: 'error', message: 'Could not create the daily post.' }, 400);
  }
});

/**
 * Journeys. The stock router is Express; this app is Hono, so the same five
 * endpoints are wired by hand onto the official server-side client.
 */
app.post('/api/telemetry/journey/start', async (c) => {
  try {
    return c.json(await telemetry.startJourney());
  } catch {
    return c.json({ journeyId: '', receipt: { status: 'JOURNEY_RECEIPT_UNSPECIFIED', message: 'offline' } });
  }
});

app.post('/api/telemetry/journey/progress', async (c) => {
  try {
    const b = await c.req.json<{ journeyId?: string; progress?: number; action?: string }>();
    return c.json(
      await telemetry.journeyProgress({
        journeyId: b.journeyId ?? '',
        progress: b.progress ?? 0,
        action: b.action ?? '',
      }),
    );
  } catch {
    return c.json({ receipt: { status: 'JOURNEY_RECEIPT_UNSPECIFIED', message: 'offline' } });
  }
});

app.post('/api/telemetry/journey/interaction', async (c) => {
  try {
    const b = await c.req.json<{ journeyId?: string; action?: string; actionDetails?: string }>();
    return c.json(
      await telemetry.journeyInteraction({
        journeyId: b.journeyId ?? '',
        action: b.action ?? 'interaction',
        actionDetails: b.actionDetails ?? '',
      }),
    );
  } catch {
    return c.json({ receipt: { status: 'JOURNEY_RECEIPT_UNSPECIFIED', message: 'offline' } });
  }
});

app.post('/api/telemetry/journey/end', async (c) => {
  try {
    const b = await c.req.json<{
      journeyId?: string;
      complete?: boolean;
      win?: boolean;
      score?: number;
    }>();
    return c.json(
      await telemetry.endJourney({
        journeyId: b.journeyId ?? '',
        complete: b.complete ?? false,
        game:
          typeof b.score === 'number'
            ? { win: b.win ?? false, score: b.score }
            : { win: false, score: 0 },
      }),
    );
  } catch {
    return c.json({ receipt: { status: 'JOURNEY_RECEIPT_UNSPECIFIED', message: 'offline' } });
  }
});

app.post('/api/telemetry/journey/app-ready', async (c) => {
  try {
    return c.json(await telemetry.appReady());
  } catch {
    return c.json({ receipt: { status: 'JOURNEY_RECEIPT_UNSPECIFIED', message: 'offline' } });
  }
});

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
