import { context, requestExpandedMode } from '@devvit/web/client';

import type { CommitResponse, ErrorResponse, StateResponse, YardResponse } from '../shared/api';

const raw = context as unknown as { username?: string; postId?: string } | undefined;

export const host = {
  onReddit: Boolean(raw),
  username: raw?.username ?? null,
  postId: raw?.postId ?? null,
};

/** A stable-ish id for logged-out players, so two guests do not share one shelf. */
export function guestId(): string {
  if (!host.onReddit) return 'localdev0001';
  try {
    const key = 'kiln.guest';
    const found = window.sessionStorage.getItem(key);
    if (found && /^[a-z0-9]{8,24}$/i.test(found)) return found;
    const made = Math.random().toString(36).slice(2, 14).padEnd(12, '0');
    window.sessionStorage.setItem(key, made);
    return made;
  } catch {
    return 'fallback0001';
  }
}

export function openGame(event: { nativeEvent: MouseEvent } | MouseEvent): void {
  const native = 'nativeEvent' in event ? event.nativeEvent : event;
  if (!host.onReddit) {
    window.location.href = 'game.html';
    return;
  }
  try {
    requestExpandedMode(native, 'game');
  } catch {
    window.location.href = 'game.html';
  }
}

export function backToPost(): void {
  if (!host.onReddit) {
    window.location.href = 'splash.html';
    return;
  }
  try {
    window.parent.postMessage({ type: 'devvit-navigate-back' }, '*');
  } catch {
    /* the platform closes the expanded view itself */
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const body = (await res.json()) as T | ErrorResponse;
  if (!res.ok) {
    const message = (body as ErrorResponse).message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export function fetchState(): Promise<StateResponse> {
  return getJson<StateResponse>('/api/state');
}

export function fetchYard(): Promise<YardResponse> {
  return getJson<YardResponse>('/api/yard');
}

export async function commitPiece(input: {
  wareId: string;
  slotId: string;
  taps: number[];
}): Promise<CommitResponse> {
  const res = await fetch('/api/commit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, guestId: guestId() }),
  });
  const body = (await res.json()) as CommitResponse | ErrorResponse;
  if (!res.ok) throw new Error((body as ErrorResponse).message ?? `HTTP ${res.status}`);
  return body as CommitResponse;
}
