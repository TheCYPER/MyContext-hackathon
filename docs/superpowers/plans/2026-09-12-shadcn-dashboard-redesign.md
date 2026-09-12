# Shadcn Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vanilla MyContext dashboard with a responsive React/shadcn interface that preserves every read-only workflow and adds a persisted light, dark, and system theme.

**Architecture:** Keep the existing Node server, Ruby projector, `/api/v1` contract, and pure graph model. Build a React/TypeScript single-page application with Vite, local shadcn primitives, Zustand UI stores, and the existing hash-based view URLs; serve compiled assets from `dashboard/dist`.

**Tech Stack:** Node.js 20+, React 19, TypeScript, Vite, Tailwind CSS, local shadcn components, Radix UI, Zustand, Lucide React, Vitest, Testing Library, and the existing Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-12-shadcn-dashboard-redesign-design.md`

## Global Constraints

- Preserve all `/api/v1` response shapes and all server-side read-only, origin, traversal, privacy, and Git-HEAD boundaries.
- Keep the existing hash values: `desk`, `workstreams`, `ideas`, `runs`, `people`, `projects`, `experience`, `atlas`, and `system`.
- Expose Runs only when `capabilities.operations === true`.
- Never render projected Markdown as HTML and never infer semantics for generic graph links.
- Default theme preference to `system`; persist only `light`, `dark`, or `system`.
- Keep the server bound to `127.0.0.1` and do not add hosted services, authentication, writes, sending, or scheduling.
- Run the complete `npm test` suite and a production build before reporting completion.

## Planned file structure

- `dashboard/src/main.tsx`: React entry point and theme bootstrap handoff.
- `dashboard/src/app.tsx`: data bootstrap, hash navigation, error boundary, and top-level composition.
- `dashboard/src/index.css`: Tailwind import, shadcn tokens, typography, SVG, and responsive layout styles.
- `dashboard/src/types.ts`: API and entity interfaces shared across views.
- `dashboard/src/lib/api.ts`: bounded JSON requests and typed endpoint helpers.
- `dashboard/src/lib/model.mjs`: preserved ranking, relation, and graph-layout algorithms.
- `dashboard/src/lib/utils.ts`: class merging and formatting helpers.
- `dashboard/src/stores/theme-store.ts`: persisted theme preference and system resolution.
- `dashboard/src/components/ui/*.tsx`: local shadcn primitives.
- `dashboard/src/components/layout/*.tsx`: sidebar, header, search, theme menu, review sheet, and shell.
- `dashboard/src/components/entity-inspector.tsx`: lazy record detail dialog.
- `dashboard/src/components/relation-trail.tsx`: reusable generic-link navigation.
- `dashboard/src/views/*.tsx`: view-specific rendering.
- `dashboard/src/test/*.test.tsx`: component and interaction tests.
- `dashboard/vite.config.ts`, `dashboard/tsconfig.json`, `dashboard/components.json`: frontend toolchain configuration.
- `dashboard/public/index.html`, `dashboard/public/app.js`, `dashboard/public/styles.css`: removed after React equivalents pass.
- `dashboard/server.mjs`, `dashboard/test/frontend-model.test.mjs`: production asset path and behavior-focused regression updates.
- `package.json`, `dashboard/package.json`, `README.md`, `dashboard/README.md`: local commands and dependency documentation.

---

### Task 1: Establish the React, Tailwind, and shadcn build boundary

**Files:**
- Modify: `package.json`
- Modify: `dashboard/package.json`
- Create: `dashboard/vite.config.ts`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/components.json`
- Create: `dashboard/index.html`
- Create: `dashboard/src/main.tsx`
- Create: `dashboard/src/app.tsx`
- Create: `dashboard/src/index.css`
- Create: `dashboard/src/lib/utils.ts`
- Create: `dashboard/src/test/setup.ts`
- Create: `dashboard/src/test/app-shell.test.tsx`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string`, a Vite development server on `127.0.0.1:5173`, and a production bundle in `dashboard/dist`.
- Consumes: existing `/api/v1` endpoints via Vite proxy target `http://127.0.0.1:4319`.

- [ ] **Step 1: Add a failing application-shell test**

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "../app";

test("renders the MyContext application landmark", () => {
  render(<App />);
  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(screen.getByText("MyContext")).toBeInTheDocument();
});
```

- [ ] **Step 2: Install the declared dependencies and verify the test fails**

Run: `npm install`

Run: `npm --prefix dashboard test -- --run src/test/app-shell.test.tsx`

Expected: FAIL because `dashboard/src/app.tsx` and the React test configuration do not exist.

- [ ] **Step 3: Add the minimum Vite/React application and Tailwind token sheet**

```tsx
// dashboard/src/app.tsx
export function App() {
  return <main><h1>MyContext</h1></main>;
}
```

```ts
// dashboard/vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: "127.0.0.1", proxy: { "/api": "http://127.0.0.1:4319" } },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"] },
});
```

Set `dashboard/package.json` scripts to `dev: vite`, `build: tsc -b && vite build`, `test: vitest`, and `backend:test: node --test test/*.test.mjs`. Add root scripts `dev`, `build`, and retain `start` for the Node production server.

- [ ] **Step 4: Run the focused test and production build**

Run: `npm --prefix dashboard test -- --run src/test/app-shell.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: Vite writes `dashboard/dist/index.html` and hashed assets.

- [ ] **Step 5: Commit the toolchain boundary**

```bash
git add package.json package-lock.json dashboard/package.json dashboard/vite.config.ts dashboard/tsconfig.json dashboard/components.json dashboard/index.html dashboard/src
git commit -m "build: add React shadcn dashboard toolchain"
```

### Task 2: Add shadcn primitives and persisted theme state

**Files:**
- Create: `dashboard/src/components/ui/button.tsx`
- Create: `dashboard/src/components/ui/card.tsx`
- Create: `dashboard/src/components/ui/badge.tsx`
- Create: `dashboard/src/components/ui/dialog.tsx`
- Create: `dashboard/src/components/ui/sheet.tsx`
- Create: `dashboard/src/components/ui/dropdown-menu.tsx`
- Create: `dashboard/src/components/ui/select.tsx`
- Create: `dashboard/src/components/ui/tooltip.tsx`
- Create: `dashboard/src/components/ui/scroll-area.tsx`
- Create: `dashboard/src/components/ui/separator.tsx`
- Create: `dashboard/src/components/ui/skeleton.tsx`
- Create: `dashboard/src/stores/theme-store.ts`
- Create: `dashboard/src/components/layout/theme-menu.tsx`
- Create: `dashboard/src/test/theme-store.test.tsx`
- Modify: `dashboard/index.html`
- Modify: `dashboard/src/app.tsx`

**Interfaces:**
- Produces: `Theme = "light" | "dark" | "system"`, `useThemeStore`, `resolveTheme(theme, matchesDark): "light" | "dark"`, and `<ThemeMenu />`.
- Consumes: `cn` from Task 1 and localStorage key `mycontext-theme`.

- [ ] **Step 1: Write failing theme tests**

```tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolveTheme, useThemeStore } from "../stores/theme-store";
import { ThemeMenu } from "../components/layout/theme-menu";

test("resolves system theme and persists an explicit choice", async () => {
  expect(resolveTheme("system", true)).toBe("dark");
  render(<ThemeMenu />);
  await userEvent.click(screen.getByRole("button", { name: /theme/i }));
  await userEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));
  expect(useThemeStore.getState().theme).toBe("dark");
  expect(document.documentElement).toHaveClass("dark");
});
```

- [ ] **Step 2: Run the theme test and verify failure**

Run: `npm --prefix dashboard test -- --run src/test/theme-store.test.tsx`

Expected: FAIL because the store and menu do not exist.

- [ ] **Step 3: Implement the Zustand store and root-class synchronizer**

```ts
export type Theme = "light" | "dark" | "system";
export const resolveTheme = (theme: Theme, matchesDark: boolean) =>
  theme === "system" ? (matchesDark ? "dark" : "light") : theme;

export const useThemeStore = create<ThemeState>()(persist(
  (set) => ({ theme: "system", setTheme: (theme) => set({ theme }) }),
  { name: "mycontext-theme", partialize: ({ theme }) => ({ theme }) },
));
```

Add an inline bootstrap in `dashboard/index.html` that reads the persisted Zustand value, resolves system preference, and applies `.dark` before the stylesheet loads. Subscribe in React to both store changes and `prefers-color-scheme` changes.

- [ ] **Step 4: Implement accessible local shadcn primitives and ThemeMenu**

Use Radix primitives with shadcn-style variants. The theme trigger must have `aria-label="Change color theme"`; menu choices use radio semantics and labels System, Light, and Dark.

- [ ] **Step 5: Run theme and build verification**

Run: `npm --prefix dashboard test -- --run src/test/theme-store.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit theme and primitives**

```bash
git add dashboard
git commit -m "feat: add shadcn primitives and persisted themes"
```

### Task 3: Type the API and build the responsive application shell

**Files:**
- Create: `dashboard/src/types.ts`
- Create: `dashboard/src/lib/api.ts`
- Create: `dashboard/src/hooks/use-dashboard-data.ts`
- Create: `dashboard/src/hooks/use-hash-view.ts`
- Create: `dashboard/src/components/layout/app-shell.tsx`
- Create: `dashboard/src/components/layout/sidebar.tsx`
- Create: `dashboard/src/components/layout/header.tsx`
- Create: `dashboard/src/components/layout/global-search.tsx`
- Create: `dashboard/src/components/layout/repository-status.tsx`
- Create: `dashboard/src/components/layout/review-sheet.tsx`
- Create: `dashboard/src/test/app-data.test.tsx`
- Create: `dashboard/src/test/navigation-search.test.tsx`
- Modify: `dashboard/src/app.tsx`

**Interfaces:**
- Produces: `DashboardDataState`, `getSnapshot()`, `getRepo()`, `getEntity(id)`, `useDashboardData()`, `useHashView(capabilities)`, and `AppShellProps`.
- Consumes: the exact existing response envelope `{ snapshot }`, `{ repo }`, and `{ entity }`.

- [ ] **Step 1: Write failing bootstrap and navigation tests**

```tsx
test("keeps usable snapshot content when repository status fails", async () => {
  server.use(repoFailureHandler, snapshotSuccessHandler);
  render(<App />);
  expect(await screen.findByText("Motion Atlas")).toBeInTheDocument();
  expect(screen.getByText(/repository status unavailable/i)).toBeInTheDocument();
});

test("hides Runs without an exact operations capability", async () => {
  render(<App />);
  expect(await screen.findByRole("button", { name: "Overview" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Runs" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify the focused tests fail**

Run: `npm --prefix dashboard test -- --run src/test/app-data.test.tsx src/test/navigation-search.test.tsx`

Expected: FAIL because typed loading and navigation are absent.

- [ ] **Step 3: Implement bounded API helpers and data bootstrap**

```ts
export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}
```

Use independent `Promise.allSettled` handling for snapshot and repository data and a 10-second AbortController timeout. Do not combine their error states.

- [ ] **Step 4: Implement responsive navigation, header, search, and review Sheet**

Define a single navigation metadata array with labels and Lucide icons. Desktop uses a fixed sidebar; mobile uses a Sheet. Global search filters by query and scope, exposes keyboard shortcut `/`, and returns buttons that open the entity inspector. Review Sheet renders every snapshot review item and the explicit read-only boundary.

- [ ] **Step 5: Run focused tests and build**

Run: `npm --prefix dashboard test -- --run src/test/app-data.test.tsx src/test/navigation-search.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit the application shell**

```bash
git add dashboard/src
git commit -m "feat: build responsive dashboard shell"
```

### Task 4: Port overview, focus, ideas, record, and system views

**Files:**
- Create: `dashboard/src/components/empty-state.tsx`
- Create: `dashboard/src/components/loading-state.tsx`
- Create: `dashboard/src/components/status-badge.tsx`
- Create: `dashboard/src/components/relation-trail.tsx`
- Create: `dashboard/src/components/record-card.tsx`
- Create: `dashboard/src/components/workstream-card.tsx`
- Create: `dashboard/src/views/overview-view.tsx`
- Create: `dashboard/src/views/workstreams-view.tsx`
- Create: `dashboard/src/views/ideas-view.tsx`
- Create: `dashboard/src/views/records-view.tsx`
- Create: `dashboard/src/views/runs-view.tsx`
- Create: `dashboard/src/views/system-view.tsx`
- Create: `dashboard/src/test/views.test.tsx`
- Move: `dashboard/public/model.mjs` to `dashboard/src/lib/model.mjs`
- Modify: `dashboard/test/frontend-model.test.mjs`
- Modify: `dashboard/src/app.tsx`

**Interfaces:**
- Produces: React views accepting typed snapshot/entity data and callbacks `onOpenEntity(id)` and `onOpenGraph(id)`.
- Consumes: `rankWorkstreams`, `academicContextCounts`, `relationTrail`, `isSyntheticDemo`, and `viewAvailable` from the preserved model module.

- [ ] **Step 1: Add failing view-content tests**

```tsx
test("overview preserves counts, ranked work, and draft preview", async () => {
  render(<App />);
  expect(await screen.findByText("10 Projects")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Current focus" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Needs your review" })).toBeInTheDocument();
});

test("ideas remain separated by research and project kind", async () => {
  window.location.hash = "ideas";
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Research ideas" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Project ideas" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify the view tests fail**

Run: `npm --prefix dashboard test -- --run src/test/views.test.tsx`

Expected: FAIL because the views are not implemented.

- [ ] **Step 3: Move the pure model unchanged and update its Node tests**

Update imports in `dashboard/test/frontend-model.test.mjs` to `../src/lib/model.mjs`. Preserve function bodies and expected layout results exactly.

- [ ] **Step 4: Implement reusable cards and all non-graph views**

Use `Card`, `Badge`, `Button`, `Separator`, and empty/loading states. Preserve current strings that define read-only boundaries, including "not finalized, signed, sent, or otherwise recorded as used" and "Reason not structured". Render record body summaries as plain text.

- [ ] **Step 5: Run view, model, and build checks**

Run: `npm --prefix dashboard test -- --run src/test/views.test.tsx`

Expected: PASS.

Run: `node --test dashboard/test/frontend-model.test.mjs`

Expected: all model tests PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit content views**

```bash
git add dashboard
git commit -m "feat: port dashboard content views"
```

### Task 5: Port the lazy entity inspector safely

**Files:**
- Create: `dashboard/src/components/entity-inspector.tsx`
- Create: `dashboard/src/test/entity-inspector.test.tsx`
- Modify: `dashboard/src/app.tsx`

**Interfaces:**
- Produces: `<EntityInspector entityId open onOpenChange summary revision />` with session detail caching.
- Consumes: `getEntity(id)` from Task 3 and plain string `body`, `sourcePath`, and entity metadata fields.

- [ ] **Step 1: Write failing dialog and safety tests**

```tsx
test("loads canonical detail once and renders record text without HTML execution", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /Motion Atlas/i }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText(/Read from tracked Git HEAD/i)).toBeInTheDocument();
  expect(document.querySelector("script[data-record]")).toBeNull();
});
```

- [ ] **Step 2: Verify the inspector test fails**

Run: `npm --prefix dashboard test -- --run src/test/entity-inspector.test.tsx`

Expected: FAIL because the inspector does not exist.

- [ ] **Step 3: Implement the inspector with Dialog and a detail cache**

Fetch on open only when the ID is absent from `Map<string, EntityDetail>`. Render body inside a text container with `white-space: pre-wrap`; never use `dangerouslySetInnerHTML`. Show loading Skeletons, a localized fetch error, metadata, source path, and revision.

- [ ] **Step 4: Run inspector tests and build**

Run: `npm --prefix dashboard test -- --run src/test/entity-inspector.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit the inspector**

```bash
git add dashboard/src
git commit -m "feat: add safe canonical record inspector"
```

### Task 6: Port focused graph exploration and accessible fallbacks

**Files:**
- Create: `dashboard/src/components/graph/focus-graph.tsx`
- Create: `dashboard/src/components/graph/global-graph.tsx`
- Create: `dashboard/src/components/graph/relation-panel.tsx`
- Create: `dashboard/src/views/graph-view.tsx`
- Create: `dashboard/src/test/graph-view.test.tsx`
- Modify: `dashboard/src/app.tsx`
- Modify: `dashboard/src/index.css`

**Interfaces:**
- Produces: `<GraphView nodes relations onOpenEntity />` with focus, depth, selected relation, target, and traced path state.
- Consumes: `chooseFocusNode`, `layoutFocusGraph`, `layoutAtlas`, `relationReferences`, `relationTrail`, and `shortestPath` from the preserved model.

- [ ] **Step 1: Write failing graph interaction tests**

```tsx
test("expands to two hops and traces a connection without inventing semantics", async () => {
  const user = userEvent.setup();
  window.location.hash = "atlas";
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Expand to 2" }));
  expect(screen.getByText(/at most two hops/i)).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Connection target"), "person.rhea-sen");
  await user.click(screen.getByRole("button", { name: "Trace" }));
  expect(screen.getByText(/reachability only/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify graph tests fail**

Run: `npm --prefix dashboard test -- --run src/test/graph-view.test.tsx`

Expected: FAIL because the React graph view does not exist.

- [ ] **Step 3: Implement the theme-aware SVG focus and overview graphs**

Use the preserved layout coordinates, `<g role="button" tabIndex={0}>` controls, visible focus rings, CSS variables for theme-aware fills/strokes, and Enter/Space handlers. Keep the mobile relationship list, incoming/outgoing counts, declaration provenance, generic-link warnings, and clear-path action.

- [ ] **Step 4: Run graph, model, and build checks**

Run: `npm --prefix dashboard test -- --run src/test/graph-view.test.tsx`

Expected: PASS.

Run: `node --test dashboard/test/frontend-model.test.mjs`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit graph behavior**

```bash
git add dashboard/src
git commit -m "feat: port relationship graph explorer"
```

### Task 7: Switch production serving, remove the legacy frontend, and document commands

**Files:**
- Modify: `dashboard/server.mjs`
- Modify: `dashboard/test/backend.test.mjs`
- Modify: `dashboard/test/frontend-model.test.mjs`
- Modify: `scripts/check.sh`
- Modify: `README.md`
- Modify: `dashboard/README.md`
- Delete: `dashboard/public/index.html`
- Delete: `dashboard/public/app.js`
- Delete: `dashboard/public/styles.css`

**Interfaces:**
- Produces: production `npm start` serving `dashboard/dist`, development `npm run dev`, and documented build prerequisites.
- Consumes: Vite output from Task 1 and the unchanged `createDashboardServer({ root, publicDir, projectorPath })` testing interface.

- [ ] **Step 1: Add a failing production static-entry test**

```js
test("default production root points at the Vite bundle", async () => {
  const serverSource = await readFile(path.join(DASHBOARD_DIR, "server.mjs"), "utf8");
  assert.match(serverSource, /dashboard["'], ["']dist|path\.join\(DASHBOARD_DIR, "dist"\)/);
});
```

- [ ] **Step 2: Verify the production-root assertion fails**

Run: `node --test dashboard/test/backend.test.mjs`

Expected: FAIL on the new default production-root assertion.

- [ ] **Step 3: Point the server at `dist` and preserve custom test roots**

Change only the default public directory resolution. Keep caller-supplied `publicDir`, MIME handling, CSP/security headers, traversal protection, SPA index fallback, API routing, and localhost binding intact. Emit a clear startup error when `dist/index.html` is absent.

- [ ] **Step 4: Replace source-string frontend assertions with built behavior checks**

Keep model invariants in the Node test. Move UI interaction expectations to Vitest tests from Tasks 2–6. Make `npm test` run `npm run build`, Vitest once, Node backend/model tests, and the existing Ruby/shell checks.

- [ ] **Step 5: Update documentation and remove legacy frontend files**

Document `npm install`, `npm run setup`, `npm run dev`, `npm run build`, `npm start`, and `npm test`. State that the app stays local/read-only and that Vite dependencies are frontend build tooling only.

- [ ] **Step 6: Run the full check suite**

Run: `npm test`

Expected: all shell, Ruby, Node, Vitest, and build checks PASS.

- [ ] **Step 7: Commit production integration**

```bash
git add package.json package-lock.json dashboard scripts/check.sh README.md
git commit -m "chore: serve and document the React dashboard"
```

### Task 8: Perform browser QA across themes, breakpoints, and core workflows

**Files:**
- Modify as needed: `dashboard/src/**/*.tsx`
- Modify as needed: `dashboard/src/index.css`
- Test: `dashboard/src/test/*.test.tsx`

**Interfaces:**
- Consumes: production URL `http://127.0.0.1:4318` after `npm run build && npm start`.
- Produces: verified desktop/mobile UI with no console errors or failed application requests.

- [ ] **Step 1: Start the production dashboard**

Run: `npm run build && npm start`

Expected: `MyContext dashboard: http://127.0.0.1:4318`.

- [ ] **Step 2: Verify desktop light and dark layouts**

At a desktop viewport, verify Overview, Ideas, Current Focus, Graph, and System. Open theme menu and select Light, Dark, and System; reload after an explicit selection and confirm it persists. Confirm headings, body text, borders, SVG labels, focus indicators, hover states, and soft CTA hierarchy are readable in both themes.

- [ ] **Step 3: Verify responsive behavior**

At a narrow mobile viewport, verify sidebar navigation opens in a Sheet, the review queue opens in a Sheet, search results fit the viewport, cards become one column, graph controls wrap, and the accessible graph list remains usable.

- [ ] **Step 4: Exercise preserved interactions**

Use search and scope filtering, navigate every available view, open and close a canonical record, inspect a review draft, focus a graph node, expand to two hops, select a relation, trace and clear a path, and confirm Runs is absent for the demo capability response.

- [ ] **Step 5: Check runtime health**

Verify `/api/v1/health` returns success, the browser console has no errors, and no application request fails. Confirm the synthetic-data label and read-only boundary copy are visible.

- [ ] **Step 6: Repair any QA issue test-first and rerun full verification**

For each issue, add or tighten a focused Vitest assertion, confirm failure, implement the smallest repair, and rerun that test. Then run:

```bash
npm test
npm run build
```

Expected: both commands PASS.

- [ ] **Step 7: Commit final polish and leave the app running**

```bash
git add dashboard
git commit -m "fix: polish responsive dashboard interactions"
```

Start `npm start`, verify `http://127.0.0.1:4318/api/v1/health`, and leave the server process running for local review.
