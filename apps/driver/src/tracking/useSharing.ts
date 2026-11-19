import { useEffect, useState } from 'react';

import { type Sharing, onSharingChange, tidySharing } from './sharing';

/** The job being shared right now (or null), kept up to date by the location task. */
export function useSharing(): Sharing | null {
  const [sharing, setSharing] = useState<Sharing | null>(null);
  useEffect(() => {
    let alive = true;
    void tidySharing().then((s) => alive && setSharing(s));
    const off = onSharingChange((s) => alive && setSharing(s));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return sharing;
}
