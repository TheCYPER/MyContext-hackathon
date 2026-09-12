# MyContext shadcn dashboard redesign

Date: 2026-09-12
Status: Approved for implementation planning

## Objective

Replace the current dependency-free dashboard frontend with a clean, responsive React interface built from local shadcn components. Preserve the dashboard's existing read-only behavior, API contract, privacy boundaries, search, record inspection, review queue, relationship exploration, and conditional operations view. Add a persistent light, dark, and system theme preference managed by Zustand.

The redesign is presentation-focused. It must not turn the dashboard into an editor, infer semantic meaning for generic graph links, expose excluded records, inspect unrelated tasks, or add sending, scheduling, or mutation capabilities.

## Technical direction

The dashboard frontend will move from hand-authored DOM rendering in `dashboard/public/app.js` to React and TypeScript under `dashboard/src/`. Vite will compile production assets for the existing Node server and provide a development server that proxies `/api/v1` to the local backend. Tailwind CSS will provide design tokens and utilities. shadcn components will be stored in the repository as application code rather than consumed as an opaque runtime package.

The existing `dashboard/server.mjs`, `dashboard/projector.rb`, and `/api/v1` response shapes remain authoritative. Existing pure graph and ranking logic in `dashboard/public/model.mjs` will be preserved, moved only when necessary for imports and typing, and covered by the current behavioral tests. No backend framework or database will be introduced.

## Application structure

The React application will be divided into focused modules:

- `app`: application shell, route/hash selection, responsive layout, error boundary, and data bootstrap.
- `components/ui`: local shadcn primitives such as Button, Card, Badge, Dialog, Sheet, Select, Dropdown Menu, Command, Tooltip, Scroll Area, Separator, and Skeleton.
- `components/layout`: sidebar navigation, mobile navigation, header search, repository status, review drawer, and page heading.
- `components/views`: Overview, Current Focus, Ideas, Runs, People, Projects, Experience, Graph, and System.
- `components/entities`: reusable record cards, relation trails, status badges, review items, and the record inspector.
- `components/graph`: focused relationship graph, global overview, connection tracing, and accessible list fallback.
- `stores`: Zustand stores for theme and lightweight interface state.
- `lib`: API access, shared types, formatting helpers, class-name utilities, and preserved model algorithms.

View selection will continue to use the existing URL hash values so direct links and browser navigation keep working. Runs remains unavailable unless the API reports `capabilities.operations === true`.

## Data flow and state

At startup, the application requests `/api/v1/snapshot` and `/api/v1/repo` concurrently. Successful responses populate a typed application data layer. Each request may fail independently: snapshot failure produces a primary blocking error state, while repository-status failure produces a localized status warning without hiding otherwise usable context.

Canonical entity details remain lazy-loaded from `/api/v1/entities/:id` and cached for the current session. Search filters the projected in-memory entity summaries and keeps its existing type scope. The review queue is derived only from the snapshot. Graph relationships are built from projected links using the preserved model functions; their meaning remains explicitly labeled as generic and unstructured.

Zustand will own UI state that benefits from persistence or cross-component access:

- Theme preference: `light`, `dark`, or `system`, persisted in local storage.
- Resolved theme: computed from the preference and `prefers-color-scheme`; system changes update the UI immediately.
- Review drawer state, inspector state, and sidebar state where shared access simplifies responsive behavior.

Server data will not be written to local storage. The repository revision remains the source identifier shown to the user.

## Visual system

The interface will use a neutral shadcn foundation with a restrained indigo accent in both themes. Light mode will use warm-white or neutral surfaces with subtle borders; dark mode will use charcoal/slate surfaces rather than the current high-saturation navy grid. Color will communicate status sparingly and meet accessible contrast requirements.

Typography will prioritize reading dense project and research context. Headings will be visually confident without oversized display treatment. Body text will use comfortable line height and width constraints. Spacing will follow a consistent 4/8-pixel rhythm, with page sections separated by whitespace instead of heavy rules or decorative geometry.

Calls to action will be deliberately soft:

- Primary emphasis is reserved for the current task or selected state.
- Record-opening and inspection actions use secondary, outline, or ghost treatments.
- Relation chips and tags remain compact and low contrast until hovered or focused.
- Destructive styling is not introduced because the dashboard has no destructive actions.

The desktop shell will use a compact sidebar, a sticky header with global search, and a generous centered content column. The current permanently visible review column will become a Sheet opened from a review button with a count badge, reducing visual competition while keeping every review item accessible. On mobile, navigation and review use sheets and the content becomes a single column.

## View behavior

The Overview keeps its context counts, prioritized project list, and draft-review preview. Its large hero will become a compact welcome heading followed by summary cards and scannable sections.

Current Focus keeps ranked workstreams, recorded next actions, and related-record navigation. Ideas keeps distinct research and project treatments, submission fields, tags, and relation trails. People, Projects, and Experience remain searchable record collections. System retains repository, capability, knowledge-count, and boundary information.

The Graph keeps one-hop and two-hop focus, connection target selection, path tracing, selectable relationships, global overview, keyboard activation, and the accessible relationship list. Its presentation will use shadcn controls and theme-aware SVG tokens without altering graph layout or inventing relation semantics.

The record inspector becomes a responsive shadcn Dialog on desktop and an appropriately sized overlay on smaller screens. It continues to show canonical metadata, body text, source path, and revision without executing Markdown HTML.

## Theme behavior

A compact theme menu in the header will offer System, Light, and Dark. The first visit defaults to System. Zustand's persistence middleware stores only the chosen preference. Before React paints, a small inline bootstrap script applies the resolved class to the root element to avoid a visible theme flash. A media-query listener updates the resolved theme when the operating system changes while System is selected.

Both themes must be verified on the overview, a dense list view, the graph, the review drawer, search results, and the record inspector. Theme controls require accessible names and visible selected-state feedback.

## Local development and production

The repository root will expose clear commands:

- `npm install` installs the frontend toolchain and runtime dependencies.
- `npm run dev` runs the backend and Vite development server with API proxying.
- `npm run build` creates production frontend assets.
- `npm start` serves the built dashboard locally through the existing Node server.
- `npm test` continues to execute the complete repository check suite, including frontend unit tests.

The server remains bound to `127.0.0.1`. Production startup will fail with a clear message if required built assets are missing, rather than silently serving a partial application. The README and dashboard documentation will be updated to describe installation, development, build, and startup.

## Error, loading, and empty states

Loading uses shadcn Skeleton components sized to resemble the destination content. API failures show concise Alert-style messages with a retry action where retry is meaningful. Empty search results and empty views explain the active filter or boundary without suggesting that hidden data was inspected. The repository status area distinguishes a clean tree, local unprojected changes, detached HEAD, and unavailable status.

Client rendering must not interpolate record content as HTML. All projected Markdown remains text, preserving the current script-injection boundary. Dialogs and sheets must restore focus when closed, support Escape, and trap focus while open.

## Testing and verification

Implementation will keep all existing backend, projection, privacy, setup, retrieval, and model tests passing. Frontend assertions that currently inspect string patterns in vanilla source will be replaced with behavior-focused tests for the React application.

Tests will cover:

- Theme preference persistence and system-theme resolution.
- View availability and hash navigation.
- Snapshot/repository success and independent failure states.
- Search and scope filtering.
- Review drawer and entity inspector interactions.
- Runs capability gating.
- Graph focus depth, relationship selection, and shortest-path tracing.
- Read-only and semantic-boundary copy that must remain explicit.

Browser verification will exercise desktop and mobile layouts in both themes, search, navigation, record inspection, review drawer, and graph controls. Console errors and failed network requests will be checked. The final `npm test` and production build must pass before completion is reported.

## Non-goals

- Changing the `/api/v1` contract or projection schema.
- Adding record editing, approval, sending, scheduling, authentication, hosted services, or synchronization.
- Reinterpreting generic links as collaboration, causality, endorsement, or evidence.
- Importing personal context or changing the synthetic demo records.
- Adding animation beyond short, reduced-motion-safe interaction transitions.
