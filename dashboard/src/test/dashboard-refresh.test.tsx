import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDashboardData } from "../hooks/use-dashboard-data";
import { getRepo, getSnapshot } from "../lib/api";
import type { DashboardSnapshot } from "../types";
import { repo, snapshot } from "./fixtures";

vi.mock("../lib/api", () => ({ getRepo: vi.fn(), getSnapshot: vi.fn() }));

const first = snapshot as DashboardSnapshot;
const next = { ...first, revision: "next-committed-revision", entities: first.entities.slice(1) };
const flush = () => act(async () => { await Promise.resolve(); });

describe("committed context refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getSnapshot).mockReset().mockResolvedValue(first);
    vi.mocked(getRepo).mockReset().mockResolvedValue(repo);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("polls committed revisions and retains the snapshot object while HEAD is unchanged", async () => {
    const { result } = renderHook(() => useDashboardData());
    await flush();
    expect(result.current.snapshot).toBe(first);
    vi.mocked(getSnapshot).mockResolvedValue({ ...first });
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(result.current.snapshot).toBe(first);

    vi.mocked(getSnapshot).mockResolvedValue(next);
    vi.mocked(getRepo).mockResolvedValue({ ...repo, revision: next.revision });
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(result.current.snapshot).toBe(next);
    expect(result.current.snapshot?.entities).not.toContain(first.entities[0]);
    expect(result.current.repo?.revision).toBe(next.revision);
    expect(result.current.loading).toBe(false);
  });

  it("pauses hidden-page polling and refreshes when visible or focused again", async () => {
    renderHook(() => useDashboardData());
    await flush();
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(getSnapshot).toHaveBeenCalledTimes(1);

    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(getSnapshot).toHaveBeenCalledTimes(2);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(getSnapshot).toHaveBeenCalledTimes(3);
  });

  it("keeps the loaded revision through a temporary failure and recovers on retry", async () => {
    const { result } = renderHook(() => useDashboardData());
    await flush();
    vi.mocked(getSnapshot).mockRejectedValueOnce(new Error("Temporary projection failure"));
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(result.current.snapshot).toBe(first);
    expect(result.current.loading).toBe(false);
    expect(result.current.snapshotError).toBe("Temporary projection failure");
    expect(result.current.repoError).toMatch(/showing the last loaded revision/);

    vi.mocked(getSnapshot).mockResolvedValue(next);
    vi.mocked(getRepo).mockResolvedValue({ ...repo, revision: next.revision });
    await act(async () => { result.current.retry(); });
    expect(result.current.snapshot).toBe(next);
    expect(result.current.snapshotError).toBeNull();
    expect(result.current.repoError).toBeNull();
  });

  it("shares an in-flight refresh across timer, focus, visibility and retry events", async () => {
    let resolveSnapshot!: (value: DashboardSnapshot) => void;
    vi.mocked(getSnapshot).mockReturnValueOnce(new Promise((resolve) => { resolveSnapshot = resolve; }));
    const { result } = renderHook(() => useDashboardData());
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      result.current.retry();
    });
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(getRepo).toHaveBeenCalledTimes(1);
    await act(async () => { resolveSnapshot(first); });
    expect(result.current.snapshot).toBe(first);
    await act(async () => { result.current.retry(); });
    expect(getSnapshot).toHaveBeenCalledTimes(2);
  });

  it("does not report a repository revision newer than the displayed snapshot", async () => {
    vi.mocked(getRepo).mockResolvedValue({ ...repo, revision: next.revision });
    const { result } = renderHook(() => useDashboardData());
    await flush();
    expect(result.current.snapshot).toBe(first);
    expect(result.current.repo).toBeNull();
    expect(result.current.repoError).toMatch(/revision changed/);
  });

  it("cancels subscriptions and ignores a response after unmount", async () => {
    let resolveSnapshot!: (value: DashboardSnapshot) => void;
    vi.mocked(getSnapshot).mockReturnValueOnce(new Promise((resolve) => { resolveSnapshot = resolve; }));
    const { result, unmount } = renderHook(() => useDashboardData());
    const retry = result.current.retry;
    unmount();
    await act(async () => {
      resolveSnapshot(first);
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      retry();
    });
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot).toBeNull();
  });
});
