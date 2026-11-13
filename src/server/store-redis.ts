/**
 * Redis-backed store. One hash for the day's kiln (a field per player, so
 * concurrent firings never overwrite each other) and one hash for streaks.
 */

import { redis } from '@devvit/web/server';
import type { GameStore, PotRecord, Streak } from './service.ts';

export function redisStore(): GameStore {
  return {
    async pots(day) {
      const hash = (await redis.hGetAll(`kiln:${day}`)) ?? {};
      const out: PotRecord[] = [];
      for (const raw of Object.values(hash)) {
        if (typeof raw !== 'string') continue;
        try {
          out.push(JSON.parse(raw) as PotRecord);
        } catch {
          // A malformed row should cost one pot, not the whole day.
        }
      }
      return out;
    },

    async pot(day, user) {
      const raw = await redis.hGet(`kiln:${day}`, user);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as PotRecord;
      } catch {
        return null;
      }
    },

    async savePot(day, pot) {
      await redis.hSet(`kiln:${day}`, { [pot.u]: JSON.stringify(pot) });
      // Kilns are per-day; let yesterday's hash fall out of storage by itself.
      await redis.expire(`kiln:${day}`, 60 * 60 * 24 * 45);
    },

    async streak(user) {
      const raw = await redis.hGet('streaks', user);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as Streak;
      } catch {
        return null;
      }
    },

    async saveStreak(user, streak) {
      await redis.hSet('streaks', { [user]: JSON.stringify(streak) });
    },
  };
}
