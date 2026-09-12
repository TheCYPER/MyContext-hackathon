import type { DashboardSnapshot, Entity, RepoStatus } from "../types";

interface ApiEnvelope<T> {
  ok: boolean;
  error?: { message?: string };
  snapshot?: DashboardSnapshot;
  repo?: RepoStatus;
  entity?: Entity;
  revision?: string;
}

export async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(path, { headers: { Accept: "application/json" }, signal: controller.signal });
    const payload = await response.json().catch(() => null) as ApiEnvelope<unknown> | null;
    if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message || `Request failed (${response.status})`);
    return payload as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getSnapshot() {
  const payload = await getJson<ApiEnvelope<DashboardSnapshot>>("/api/v1/snapshot");
  if (!payload.snapshot) throw new Error("Snapshot response was incomplete");
  return payload.snapshot;
}

export async function getRepo() {
  const payload = await getJson<ApiEnvelope<RepoStatus>>("/api/v1/repo");
  if (!payload.repo) throw new Error("Repository response was incomplete");
  return payload.repo;
}

export async function getEntity(id: string) {
  const payload = await getJson<ApiEnvelope<Entity>>(`/api/v1/entities/${encodeURIComponent(id)}`);
  if (!payload.entity) throw new Error("Entity response was incomplete");
  return { entity: payload.entity, revision: payload.revision || "" };
}
