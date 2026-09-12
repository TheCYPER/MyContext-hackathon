import { useCallback, useEffect, useState } from "react";

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
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Omit<DashboardDataState, "retry">>({
    snapshot: null, repo: null, snapshotError: null, repoError: null, loading: true,
  });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, snapshotError: null, repoError: null }));
    Promise.allSettled([getSnapshot(), getRepo()]).then(([snapshotResult, repoResult]) => {
      if (!active) return;
      setState({
        snapshot: snapshotResult.status === "fulfilled" ? snapshotResult.value : null,
        repo: repoResult.status === "fulfilled" ? repoResult.value : null,
        snapshotError: snapshotResult.status === "rejected" ? message(snapshotResult.reason) : null,
        repoError: repoResult.status === "rejected" ? message(repoResult.reason) : null,
        loading: false,
      });
    });
    return () => { active = false; };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, retry };
}
