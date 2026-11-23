import { useEffect, useRef } from "react";

export const refreshSeconds = 8;

// Schedule the next check after the previous one settles. Suspend polling in
// hidden tabs, and check immediately when the user returns or reconnects.
export function useLiveRefresh(enabled, request, dependencies = []) {
  const latest = useRef(request);
  useEffect(() => {
    latest.current = request;
  }, [request]);
  useEffect(() => {
    if (!enabled) return;
    let timer;
    let controller;

    function plan() {
      clearTimeout(timer);
      if (document.visibilityState !== "hidden") {
        timer = setTimeout(refresh, refreshSeconds * 1000);
      }
    }

    async function refresh() {
      if (document.visibilityState === "hidden" || controller) return;
      clearTimeout(timer);
      const running = new AbortController();
      controller = running;
      try {
        await latest.current(running.signal);
      } finally {
        controller = undefined;
        if (!running.signal.aborted) plan();
      }
    }

    function visibility() {
      if (document.visibilityState === "hidden") clearTimeout(timer);
      else void refresh();
    }

    void refresh();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [enabled, ...dependencies]);
}
