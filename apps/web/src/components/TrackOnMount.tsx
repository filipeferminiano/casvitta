'use client';

import { useEffect, useRef } from 'react';

import { track, type TrackEvent } from '@/lib/analytics';

/** Sends one event when a (server-rendered) screen mounts, e.g. `view_item`. */
export function TrackOnMount({ event }: { event: TrackEvent }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(event);
  }, [event]);
  return null;
}
