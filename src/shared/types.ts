/**
 * KILN — shared vocabulary.
 *
 * Everything here is plain data. No DOM, no server APIs: the same types are
 * imported by the React client, by the Hono server and by the tests.
 */

export type WareKind = 'yingqing' | 'qinghua' | 'jihong';

/** Thin bodies are the ones that crack when the fire moves too fast. */
export type Body = 'thin' | 'thick';

export type WareShape = 'bowl' | 'vase' | 'jar';

export type Verdict = 'over' | 'under' | 'good' | 'excellent' | 'flambe' | 'cracked';

export type WareDef = {
  id: string;
  kind: WareKind;
  shape: WareShape;
  /** English display name, e.g. "Celadon lotus bowl". */
  name: string;
  /** The name a Jingdezhen potter would use. */
  zh: string;
  /** Ideal effective heat, normalised 0..1. */
  mid: number;
  /** Half-width of the acceptable band. Narrower = harder day. */
  half: number;
  body: Body;
  /** One line the kiln says when it comes out well. */
  praise: string;
  /** One line when it is overfired. */
  overNote: string;
  /** One line when it is underfired. */
  underNote: string;
  /** A line for the 瓷谱: what this ware is in the real craft. */
  culture: string;
};

/** One finished pot as it sits in the day's kiln map. */
export type PotMark = {
  /** Display name of the player (never a user id). */
  n: string;
  /** 0..1 */
  q: number;
  v: Verdict;
};

export type Outcome = {
  verdict: Verdict;
  /** 0..1, how close the pot landed to the middle of its band. */
  quality: number;
  /** 0..100, what the leaderboard shows. */
  score: number;
  /** Peak heat × chamber factor × crowding. */
  eff: number;
  note: string;
  flambe: boolean;
};

/** What a player sends after a firing. Raw trace, so the server can recount it. */
export type FireSample = {
  /** Seconds since the round started. */
  t: number;
  /** 0..1.05 */
  temp: number;
};
