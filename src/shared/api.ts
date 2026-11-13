/** The wire contract between the webview and the Hono server. */

import type { FireSample, Outcome, Verdict, WareDef } from './types.ts';

export type PotView = {
  /** Display name only — no user ids ever leave the server. */
  n: string;
  x: number;
  y: number;
  /** 0..1 */
  q: number;
  v: Verdict;
  s: number;
};

export type BoardRow = {
  rank: number;
  n: string;
  s: number;
  v: Verdict;
};

export type MeView = {
  name: string;
  loggedIn: boolean;
  played: PotView | null;
  /** Consecutive days with a firing, today included. */
  streak: number;
  rank: number | null;
  /** Pots fired by other people today. */
  others: number;
};

export type InitResponse = {
  type: 'init';
  day: string;
  /** UTC ms when the kiln resets. */
  endsAt: number;
  now: number;
  ware: WareDef;
  nextWare: { name: string; zh: string };
  /** Peak of today's schedule, 0.42..0.70. */
  peak: number;
  schedule: string;
  shape: string;
  /** Eight absolute targets, 3s apart. */
  curve: number[];
  /** Pots already standing in each of the twelve setters' cells. */
  cells: number[];
  /** Pots already fired today, for the map. Capped for payload size. */
  pots: PotView[];
  total: number;
  me: MeView;
  board: BoardRow[];
};

export type FireRequest = {
  x: number;
  y: number;
  samples: FireSample[];
};

export type FireResponse = {
  type: 'fire';
  outcome: Outcome;
  pot: PotView;
  rank: number;
  streak: number;
  cells: number[];
  total: number;
  board: BoardRow[];
};

export type ErrorResponse = {
  type: 'error';
  message: string;
};

export type ApiResponse = InitResponse | FireResponse | ErrorResponse;
