#!/usr/bin/env node
import { execFile as execFileCallback } from "node:child_process";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
const execFile = promisify(execFileCallback);
const THIS_FILE = fileURLToPath(import.meta.url);
const DASHBOARD_DIR = path.dirname(THIS_FILE);
const DEFAULT_PUBLIC_DIR = path.join(DASHBOARD_DIR, "public");
const DEFAULT_PROJECTOR = path.join(DASHBOARD_DIR, "projector.rb");
const DEFAULT_ROOT = path.join(path.dirname(DASHBOARD_DIR), ".local", "demo");
const BIND_HOST = "127.0.0.1";
const ENTITY_ID = /^[a-z0-9][a-z0-9._-]*$/;
const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": ["default-src 'self'", "script-src 'self'", "style-src 'self'",
    "img-src 'self' data:", "connect-src 'self'", "object-src 'none'", "base-uri 'none'",
    "frame-ancestors 'none'", "form-action 'self'"].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});
const CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
});
function withSecurity(headers = {}) {
  return { ...SECURITY_HEADERS, ...headers };
}
function sendJson(response, statusCode, value, headOnly = false) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, withSecurity({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  }));
  response.end(headOnly ? undefined : body);
}
function apiError(response, statusCode, code, message, headOnly = false) {
  sendJson(response, statusCode, { ok: false, error: { code, message } }, headOnly);
}
function loopbackHost(hostHeader) {
  if (typeof hostHeader !== "string" || hostHeader.length > 255) return false;
  return /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(hostHeader);
}
function safeOrigin(originHeader) {
  if (!originHeader) return true;
  try {
    const origin = new URL(originHeader);
    return origin.protocol === "http:" && ["127.0.0.1", "localhost"].includes(origin.hostname);
  } catch {
    return false;
  }
}
function rawPathIsSafe(rawUrl) {
  const rawPath = String(rawUrl || "/").split(/[?#]/, 1)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return false;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return false;
  return !decoded.split("/").includes("..");
}
function entitySummary(entity) {
  const { body: _body, sections: _sections, ...summary } = entity;
  return summary;
}
function publicSnapshot(projection) {
  return {
    schemaVersion: projection.schemaVersion,
    revision: projection.revision,
    generatedAt: projection.generatedAt,
    counts: projection.counts,
    entities: projection.entities.map(entitySummary),
    reviewItems: projection.reviewItems,
    workstreams: projection.workstreams,
    operations: [],
    graph: projection.graph,
    boundaries: projection.boundaries,
    capabilities: projection.capabilities,
  };
}
async function git(root, args, maxBuffer = 1024 * 1024) {
  const result = await execFile("git", ["-C", root, ...args], {
    encoding: "utf8", maxBuffer, shell: false,
  });
  return result.stdout;
}
async function resolveRepository(root) {
  let configured;
  try {
    configured = await realpath(root);
  } catch (error) {
    if (error.code === "ENOENT" && path.resolve(root) === DEFAULT_ROOT) {
      throw new Error("Demo context is missing. From the MyContext source directory, run: bash scripts/setup.sh demo");
    }
    throw error;
  }
  const worktreeOutput = await git(configured, ["rev-parse", "--show-toplevel"]);
  const worktree = await realpath(worktreeOutput.trim());
  if (configured !== worktree) throw new Error("configured root is not the Git worktree root");
  return configured;
}
async function currentRevision(root) {
  const revision = (await git(root, ["rev-parse", "--verify", "HEAD"])).trim();
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error("invalid Git HEAD");
  return revision;
}
async function liveRepositoryState(root, projection) {
  const [branchOutput, statusOutput] = await Promise.all([
    git(root, ["branch", "--show-current"]),
    git(root, ["status", "--porcelain=v1", "--untracked-files=normal"]),
  ]);
  return { ...projection.repo, branch: branchOutput.trim() || null, dirty: statusOutput.length > 0 };
}
async function createProjectionLoader({ root, projectorPath, ruby = "ruby" }) {
  let cached = null;
  let inFlight = null;
  async function refreshProjection() {
    // A capture may commit while Ruby is starting or reading. Only publish a
    // complete projection of a revision that is still HEAD after projection.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const revision = await currentRevision(root);
      if (cached?.revision === revision) return cached;
      const result = await execFile(ruby, [projectorPath, root], {
        encoding: "utf8", maxBuffer: 16 * 1024 * 1024, shell: false,
      });
      const parsed = JSON.parse(result.stdout);
      if (!/^[0-9a-f]{40}$/.test(parsed.revision) || !Array.isArray(parsed.entities)) {
        throw new Error("projector returned an inconsistent snapshot");
      }
      if (parsed.revision !== revision || await currentRevision(root) !== revision) continue;
      cached = parsed;
      return cached;
    }
    throw new Error("context changed repeatedly during projection");
  }
  return async function loadProjection() {
    // Snapshot, graph, repo and detail requests share one expensive projection.
    // Failed refreshes are cleared so the next request can recover normally.
    if (!inFlight) {
      inFlight = refreshProjection().finally(() => { inFlight = null; });
    }
    return inFlight;
  };
}
async function resolveStaticFile(publicDir, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!relative || !/^[A-Za-z0-9._/-]+$/.test(relative)) return null;
  const candidate = path.resolve(publicDir, relative);
  if (candidate !== publicDir && !candidate.startsWith(`${publicDir}${path.sep}`)) return null;
  let resolved;
  try {
    resolved = await realpath(candidate);
  } catch {
    return null;
  }
  if (resolved !== publicDir && !resolved.startsWith(`${publicDir}${path.sep}`)) return null;
  const info = await stat(resolved);
  return info.isFile() ? { path: resolved, size: info.size } : null;
}
async function serveStatic(response, publicDir, pathname, headOnly) {
  const file = await resolveStaticFile(publicDir, pathname);
  if (!file) {
    apiError(response, 404, "not_found", "Resource not found", headOnly);
    return;
  }
  const contentType = CONTENT_TYPES[path.extname(file.path).toLowerCase()] || "application/octet-stream";
  response.writeHead(200, withSecurity({
    "Cache-Control": "no-cache", "Content-Type": contentType, "Content-Length": file.size,
  }));
  if (headOnly) {
    response.end();
    return;
  }
  const stream = createReadStream(file.path);
  stream.on("error", () => {
    if (!response.headersSent) apiError(response, 500, "static_read_failed", "Unable to read resource");
    else response.destroy();
  });
  stream.pipe(response);
}
function parseEntityId(pathname) {
  const prefix = "/api/v1/entities/";
  if (!pathname.startsWith(prefix)) return null;
  const encoded = pathname.slice(prefix.length);
  if (!encoded || encoded.includes("/")) return false;
  try {
    const id = decodeURIComponent(encoded);
    return ENTITY_ID.test(id) ? id : false;
  } catch {
    return false;
  }
}
export async function createDashboardServer(options = {}) {
  const root = await resolveRepository(options.root || process.env.MY_CONTEXT_ROOT || process.env.MYCONTEXT_ROOT || DEFAULT_ROOT);
  const publicDir = await realpath(options.publicDir || DEFAULT_PUBLIC_DIR);
  const projectorPath = await realpath(options.projectorPath || DEFAULT_PROJECTOR);
  const loadProjection = await createProjectionLoader({ root, projectorPath,
    ruby: options.ruby || process.env.MYCONTEXT_RUBY || "ruby" });
  const server = http.createServer(async (request, response) => {
    const headOnly = request.method === "HEAD";
    const isApi = String(request.url || "").startsWith("/api/");
    try {
      if (!loopbackHost(request.headers.host)) {
        apiError(response, 421, "invalid_host", "Dashboard accepts loopback hosts only", headOnly);
        return;
      }
      if (!safeOrigin(request.headers.origin)) {
        apiError(response, 403, "cross_origin_denied", "Cross-origin requests are not allowed", headOnly);
        return;
      }
      if (!rawPathIsSafe(request.url)) {
        apiError(response, 400, "invalid_path", "Invalid request path", headOnly);
        return;
      }
      if (!["GET", "HEAD"].includes(request.method)) {
        response.setHeader("Allow", "GET, HEAD");
        apiError(response, 405, "read_only", "Dashboard is read-only", headOnly);
        return;
      }
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const pathname = url.pathname;
      if (pathname === "/api/v1/health") {
        const projection = await loadProjection();
        sendJson(response, 200, {
          ok: true,
          health: { status: "ok", revision: projection.revision,
            entities: projection.entities.length, readOnly: true },
          capabilities: projection.capabilities,
        }, headOnly);
        return;
      }
      if (pathname === "/api/v1/repo") {
        const projection = await loadProjection();
        const repo = await liveRepositoryState(root, projection);
        sendJson(response, 200, { ok: true, repo, capabilities: projection.capabilities,
          boundaries: projection.boundaries }, headOnly);
        return;
      }
      if (pathname === "/api/v1/snapshot") {
        const projection = await loadProjection();
        sendJson(response, 200, { ok: true, snapshot: publicSnapshot(projection) }, headOnly);
        return;
      }
      if (pathname === "/api/v1/graph") {
        const projection = await loadProjection();
        sendJson(response, 200, { ok: true, schemaVersion: projection.schemaVersion,
          revision: projection.revision, graph: projection.graph,
          boundaries: projection.boundaries }, headOnly);
        return;
      }
      const entityId = parseEntityId(pathname);
      if (entityId === false) {
        apiError(response, 400, "invalid_entity_id", "Entity ID is invalid", headOnly);
        return;
      }
      if (entityId) {
        const requestedRevision = url.searchParams.get("revision");
        if (requestedRevision !== null && !/^[0-9a-f]{40}$/.test(requestedRevision)) {
          apiError(response, 400, "invalid_revision", "Revision must be a Git commit ID", headOnly);
          return;
        }
        const projection = await loadProjection();
        if (requestedRevision && requestedRevision !== projection.revision) {
          apiError(response, 409, "revision_changed", "Context changed; refresh the page before opening this record", headOnly);
          return;
        }
        const entity = projection.entities.find((candidate) => candidate.id === entityId);
        if (!entity) {
          apiError(response, 404, "entity_not_found", "Entity not found", headOnly);
          return;
        }
        sendJson(response, 200, { ok: true, entity, revision: projection.revision }, headOnly);
        return;
      }
      if (isApi) {
        apiError(response, 404, "api_not_found", "API route not found", headOnly);
        return;
      }
      await serveStatic(response, publicDir, pathname, headOnly);
    } catch (error) {
      const code = isApi ? "projection_unavailable" : "server_error";
      apiError(response, 503, code, "Dashboard data is unavailable", headOnly);
    }
  });
  return { server, root, publicDir, loadProjection };
}
function parseArguments(argv) {
  const options = { root: process.env.MY_CONTEXT_ROOT || process.env.MYCONTEXT_ROOT || DEFAULT_ROOT,
    port: Number(process.env.MYCONTEXT_MARGIN_PORT || 4318) };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") options.root = argv[++index];
    else if (argument === "--port") options.port = Number(argv[++index]);
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (!options.root) throw new Error("--root requires a path");
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65_535) {
    throw new Error("--port must be an integer from 0 to 65535");
  }
  return options;
}
async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("usage: node dashboard/server.mjs [--root <context-repo>] [--port <port>]\nDefaults: .local/demo context, port 4318. Create the demo with: bash scripts/setup.sh demo\n");
    return;
  }
  const { server } = await createDashboardServer({ root: options.root });
  server.listen(options.port, BIND_HOST, () => {
    const address = server.address();
    process.stdout.write(`MyContext dashboard: http://${BIND_HOST}:${address.port}\n`);
  });
  const close = () => server.close(() => process.exit(0));
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
const entryFile = process.argv[1] ? await realpath(process.argv[1]).catch(() => null) : null;
if (entryFile === THIS_FILE) {
  main().catch((error) => {
    process.stderr.write(`dashboard: ${error.message}\n`);
    process.exitCode = 1;
  });
}
