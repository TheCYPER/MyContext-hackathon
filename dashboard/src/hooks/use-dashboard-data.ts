import { useCallback, useEffect, useRef, useState } from "react";

import { getRepo, getSnapshot } from "../lib/api";
import type { DashboardSnapshot, RepoStatus } from "../types";

export interface DashboardDataState {
  snapshot: DashboardSnapshot | null;
  repo: RepoStatus | null;
  snapshotError: string | null;
  repoError: string | null;
  loading: boolean;
  retry: () => void;
}

const message = (error: unknown) => error instanceof Error ? error.message : "Unknown error";

export function useDashboardData(): DashboardDataState {
  const refresh = useRef<() => void>(() => undefined);
  const [state, setState] = useState<Omit<DashboardDataState, "retry">>({
    snapshot: null, repo: null, snapshotError: null, repoError: null, loading: true,
  });

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const load = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      setState((current) => ({ ...current, loading: !current.snapshot }));
      try {
        // The server shares one projection for concurrent snapshot/repo requests.
        const [snapshotResult, repoResult] = await Promise.allSettled([getSnapshot(), getRepo()]);
        if (!active) return;
        setState((current) => {
          const incoming = snapshotResult.status === "fulfilled" ? snapshotResult.value : null;
          // An unchanged revision must not reset graph selections and open details.
          const snapshot = incoming && incoming.revision !== current.snapshot?.revision
            ? incoming : current.snapshot;
          const matchingRepo = repoResult.status === "fulfilled" && repoResult.value.revision === snapshot?.revision;
          const snapshotError = snapshotResult.status === "rejected" ? message(snapshotResult.reason) : null;
          return {
            snapshot,
            repo: matchingRepo ? repoResult.value : null,
            snapshotError,
            // The existing shell displays repoError alongside usable snapshot content.
            repoError: snapshotError && snapshot
              ? `Context refresh failed; showing the last loaded revision: ${snapshotError}`
              : repoResult.status === "rejected" ? message(repoResult.reason)
              : matchingRepo ? null : "Repository revision changed during refresh; checking again shortly",
            loading: false,
          };
        });
      } finally {
        inFlight = false;
      }
    };
    const loadWhenVisible = () => {
      if (!document.hidden) void load();
    };
    refresh.current = () => { void load(); };
    void load();
    const timer = window.setInterval(loadWhenVisible, 5_000);
    document.addEventListener("visibilitychange", loadWhenVisible);
    window.addEventListener("focus", loadWhenVisible);
    return () => {
      active = false;
      refresh.current = () => undefined;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", loadWhenVisible);
      window.removeEventListener("focus", loadWhenVisible);
    };
  }, []);

  const retry = useCallback(() => refresh.current(), []);
  return { ...state, retry };
}
