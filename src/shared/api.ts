import type { CommitResult, Grade, Kiln, ZoneCounts } from './kiln';

export type YardEntry = {
  username: string;
  wareId: string;
  wareName: string;
  slotId: string;
  zone: string;
  grade: Grade;
  temp: number;
  at: number;
};

export type MyRecord = {
  wareId: string;
  wareName: string;
  slotId: string;
  zone: string;
  grade: Grade;
  temp: number;
  ideal: number;
  delta: number;
  stoke: number;
  score: number;
  at: number;
};

export type StateResponse = {
  type: 'state';
  day: string;
  kiln: Kiln;
  counts: ZoneCounts;
  streak: number;
  board: { username: string; score: number }[];
  mine: MyRecord | null;
  hoursLeft: number;
  username: string | null;
};

export type CommitResponse = {
  type: 'committed';
  result: CommitResult;
  mine: MyRecord;
  counts: ZoneCounts;
  streak: number;
  balanced: boolean;
  total: number;
  score: number;
  already: boolean;
};

export type ErrorResponse = {
  type: 'error';
  message: string;
};

export type YardResponse = {
  type: 'yard';
  day: string;
  counts: ZoneCounts;
  entries: YardEntry[];
  balanced: boolean;
  total: number;
};
