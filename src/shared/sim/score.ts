/** How a firing is spoken about, and what gets shared. */

import type { Outcome, Verdict } from '../types.ts';
import { dayKeyOf } from './daily.ts';
import { cellLabelZh } from './kiln.ts';

export type VerdictLabel = {
  en: string;
  zh: string;
  /** CSS colour token used by the client. */
  tone: 'bad' | 'plain' | 'good' | 'great' | 'rare';
};

export const VERDICT_LABEL: Record<Verdict, VerdictLabel> = {
  over: { en: 'Overfired', zh: '过火', tone: 'bad' },
  under: { en: 'Underfired', zh: '生烧', tone: 'bad' },
  cracked: { en: 'Crazed', zh: '惊釉', tone: 'bad' },
  good: { en: 'Sound', zh: '合格', tone: 'plain' },
  excellent: { en: 'Fine', zh: '精品', tone: 'good' },
  flambe: { en: 'Flambé', zh: '窑变', tone: 'rare' },
};

/** One line per day, the thing people paste into the comments. */
export function shareText(input: {
  dayKey: string;
  ware: string;
  zh: string;
  verdict: Verdict;
  score: number;
  chamber: number;
}): string {
  const label = VERDICT_LABEL[input.verdict];
  const [y, m, d] = input.dayKey.split('-');
  return [
    `KILN · ${d}/${m}/${y?.slice(2)} — ${input.ware} (${input.zh})`,
    `${label.en} ${input.score}/100 · ${cellLabelZh(input.chamber)}`,
  ].join('\n');
}

/** Compact result for the post title / share sheet. */
export function resultLine(outcome: Outcome): string {
  const label = VERDICT_LABEL[outcome.verdict];
  return `${label.zh} ${label.en} · ${outcome.score}`;
}

export function todayKey(now: Date = new Date()): string {
  return dayKeyOf(now);
}

/** The line the card prints for a verdict when only the stored result is known. */
export function noteForVerdict(ware: { praise: string; overNote: string; underNote: string }, verdict: Verdict): string {
  switch (verdict) {
    case 'over':
      return ware.overNote;
    case 'under':
      return ware.underNote;
    case 'cracked':
      return 'A hairline ran through it as it cooled. You heard it happen.';
    case 'flambe':
      return 'The reduction went its own way. Red under green, unrepeatable — a flambé.';
    case 'excellent':
      return ware.praise;
    default:
      return 'Sound, and forgettable.';
  }
}
