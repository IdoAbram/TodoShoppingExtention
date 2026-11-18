"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/** Keeps the phone screen on while shopping (Screen Wake Lock API). */
export function useWakeLock() {
  const supported = useSyncExternalStore(
    subscribeNoop,
    () => "wakeLock" in navigator,
    () => false,
  );
  const [active, setActive] = useState(false);
  const sentinel = useRef<WakeLockSentinel | null>(null);

  const acquire = useCallback(async () => {
    try {
      sentinel.current = await navigator.wakeLock.request("screen");
      sentinel.current.addEventListener("release", () => {
        sentinel.current = null;
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const toggle = useCallback(async () => {
    if (active) {
      await sentinel.current?.release().catch(() => {});
      sentinel.current = null;
      setActive(false);
    } else {
      setActive(await acquire());
    }
  }, [active, acquire]);

  // The browser drops the lock when the tab is hidden; take it again on return.
  useEffect(() => {
    if (!active) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && !sentinel.current) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [active, acquire]);

  useEffect(() => () => void sentinel.current?.release().catch(() => {}), []);

  return { supported, active, toggle };
}
