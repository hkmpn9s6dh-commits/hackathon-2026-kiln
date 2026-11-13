/**
 * File-backed store for local play and for tests. Same interface as the Redis
 * one, so `scripts/preview.mjs` can serve the real client with the real routes
 * on a laptop, and `npm test` can fire a thousand kilns without a platform.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { GameStore, PotRecord, Streak } from './service.ts';

type FileShape = {
  days: Record<string, PotRecord[]>;
  streaks: Record<string, Streak>;
};

export type FileStore = GameStore & { flush(): Promise<void> };

export async function fileStore(path: string): Promise<FileStore> {
  let data: FileShape = { days: {}, streaks: {} };
  try {
    data = JSON.parse(await readFile(path, 'utf8')) as FileShape;
  } catch {
    // First run, or a corrupt file: start clean rather than refuse to boot.
  }
  if (!data.days) data.days = {};
  if (!data.streaks) data.streaks = {};

  let writing: Promise<void> = Promise.resolve();
  const flush = (): Promise<void> => {
    writing = writing
      .then(async () => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, JSON.stringify(data), 'utf8');
      })
      .catch(() => undefined);
    return writing;
  };

  return {
    async pots(day) {
      return (data.days[day] ?? []).map((p) => ({ ...p }));
    },
    async pot(day, user) {
      const found = (data.days[day] ?? []).find((p) => p.u === user);
      return found ? { ...found } : null;
    },
    async savePot(day, pot) {
      const list = data.days[day] ?? [];
      const at = list.findIndex((p) => p.u === pot.u);
      if (at >= 0) list[at] = { ...pot };
      else list.push({ ...pot });
      data.days[day] = list;
      await flush();
    },
    async streak(user) {
      const found = data.streaks[user];
      return found ? { ...found } : null;
    },
    async saveStreak(user, streak) {
      data.streaks[user] = { ...streak };
      await flush();
    },
    flush,
  };
}
