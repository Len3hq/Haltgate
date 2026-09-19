"use client";

import { useEffect, useState } from "react";

/// Current unix seconds, re-rendered on a timer. Reading Date.now() during
/// render is impure and leaves countdowns frozen until something else happens
/// to re-render the component.
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
