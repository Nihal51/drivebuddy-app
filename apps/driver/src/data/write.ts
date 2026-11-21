/**
 * Writes the driver waits on (trip taps, giving a job back, his UPI ID). On a
 * weak mobile network a Firestore write can hang for a long time, so each is
 * given a time limit; the screens watch the documents live, so a write that
 * does reach the server after the limit still shows up by itself.
 */

/** What went wrong, in terms of what the driver can do about it. */
export type WriteFailure = 'network' | 'refused' | 'failed';

export function failureOf(err: unknown): WriteFailure {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  if (code === 'permission-denied') return 'refused';
  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    (err instanceof Error && err.message === 'timeout')
  )
    return 'network';
  return 'failed';
}

export const WRITE_LIMIT_MS = 20_000;

/** The promise, or a rejection with Error('timeout') after `ms`. */
export function within<T>(p: Promise<T>, ms: number = WRITE_LIMIT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
