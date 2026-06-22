# Changelog

## Parent task priority over subtasks (2026-06-22)

### Changed
- Parent tasks keep their own t-shirt size in the detail sheet; subtask sizes no longer replace it.
- Gantt bars for tasks with subtasks use the task's own dates/size as the baseline and only expand when a subtask falls outside that window.
- Editing a parent task's start or end date clips subtasks that extend past the new bounds.
- Projects still roll up dates and size points across all descendant leaves.

## Rebase PR #14 onto main (2026-06-19)

### Fixed
- Rebased `cursor/add-task-comments-0037` onto `main` (replacing the merge commit) so GitHub can rebase/update the branch cleanly.
- Kept comment textarea support from the PR plus `syncTaskDates`, `normalizeSize`, and legacy size migration from `main`.

## Rebase PR #13 onto main (2026-06-19)

### Fixed
- Rebased `cursor/expand-size-range-0037` onto `main` (replacing the merge commit) so GitHub can update/rebase the branch cleanly.
- Bar menu keeps expanded `SIZE_KEYS` (S-XXL) from the PR and Start/End date fields from `main`.
- `updTask` keeps `normalizeSize` for size and `syncTaskDates` for start/end from `main`.

## Rebase PR #10 onto main (2026-06-19)

### Fixed
- Rebased `cursor/fix-new-task-display-0037` onto `main` (replacing the merge commit) so GitHub can update the branch cleanly.
- Kept both `revealDetailScroll` on add and `restoreDetailScroll` on same-task reopen in `openDetail`.

## Fix manual task add button (2026-06-17)

### Fixed
- Board sync no longer overwrites projects or tasks added manually while the server board is still loading.
- Manual **Add** in the detail sheet no longer throws when the open task was removed during sync; the sheet closes or refreshes instead.
- Enter key submits the manual task input; saves are enabled after sync even when using fallback data.

### Reasoning
- `startBoardSync` replaced in-memory `DATA` when the fetch completed, so quick manual adds (New project + Add task) disappeared and the Add handler could crash on a stale id.

## Fix sidebar blocked after offline mode (2026-06-17)

### Fixed
- Left sidebar stays clickable while the assistant capture panel is open (including after **Offline mode** on the ChatGPT key dialog).
- Escape dismisses the API key dialog without closing the whole assistant.
- Hover reflow no longer leaves `pointer-events: none` stuck on the page body.

### Reasoning
- `#vmodal` is full-screen at z-index 60 (sidebar is 45) and was intercepting clicks even with a transparent background.

## Fix New project render crash (2026-06-17)

### Fixed
- **New project** no longer crashes the gantt when the project has no due date (detail sheet now opens and **Add** works).
- Manual tasks get a default due date so they appear on the timeline immediately.
- `barSpan` tolerates missing due dates instead of throwing during render.

### Reasoning
- `addProject()` created a due-less project; `rollupSpan` called `barSpan`, which called `parseLocalIso(null)` and aborted `renderAll()` before `openDetail()` ran.

## Fix blank screen on boot (2026-06-17)

### Fixed
- Render the gantt shell immediately on load instead of waiting for `/api/board` (empty chart area looked like a blank screen on slow networks).
- Reject persisted boards whose tasks reference unknown owners; recover with sample fallback if rendering still fails.
- Add a 10s fetch timeout so a hung API does not leave the UI empty indefinitely.

### Reasoning
- The no-flash boot path deferred the first `renderAll()` until after the board fetch, so `#gantt` stayed empty until the server responded.
- A corrupt owner id on a loaded board threw inside `renderGantt`, which aborted the first render and left the page blank.

## Rebased onto Summon-RnD/task-manager main (2026-06-16)

### Changed
- Rebased local `main` onto upstream `3ea07a1` (Summon-RnD/task-manager main).
- Kept realtime today column on top of board-sync / no-flash boot path already on upstream.

## Rebase conflict resolution (2026-06-16)

### Fixed
- Resolved rebase conflicts onto `main` (real-time today column + board-sync boot path).
- Kept `board-sync.js` / empty `DATA` startup (no pre-load flash) while preserving `syncToday`, midnight refresh, and tab visibility refresh from main.
- Dropped early `renderAll()` before board fetch; first render still happens inside `startBoardSync` after load or fallback.

## Remove sample-data flash on load (2026-06-16)

### Changed
- App starts with an empty in-memory board and waits for `GET /api/board` before the first render.
- Sample tasks moved to `src/data/sample-tasks.js` and used only when the server is unreachable (static `npx serve` mode).

### Reasoning
- Rendering built-in sample data first, then swapping in the DB board caused a visible flash on every refresh when running `python server.py`.

## Manual new project button (2026-06-16)

### Added
- Sidebar **New project** button (`addProject`) - creates a blank project and opens the detail sheet for naming and adding tasks, with no assistant or chat required.

### Reasoning
- Tasks and subtasks could already be added manually under existing projects via the detail sheet; top-level projects were only reachable through the assistant or transcript flows.

## Remove sample-data flash on load (2026-06-16)

### Changed
- App starts with an empty in-memory board and waits for `GET /api/board` before the first render.
- Sample tasks moved to `src/data/sample-tasks.js` and used only when the server is unreachable (static `npx serve` mode).

### Reasoning
- Rendering built-in sample data first, then swapping in the DB board caused a visible flash on every refresh when running `python server.py`.

## SQLite persistence (2026-06-15)

### Added
- `server.py` - Flask app on port 8090 serving `index.html` and `/api/board`
- `db.py` - SQLite storage in `data/taskboard.db`
- `seed_data.py` - default team/tasks seeded on first run
- `requirements.txt` - Flask dependency
- `src/lib/board-sync.js` - background load/save (500ms debounce after edits)

### Changed
- `src/app/main.js` - restored main-branch UI boot (sync `renderAll()`), persistence loads in background
- `src/lib/board-sync.js` - thin save/load layer; only replaces data when server has a real board
- Removed `board-store.js` / `sample-tasks.js` split that broke the initial render

### Reasoning
- Single JSON blob in SQLite keeps v1 simple and matches the in-memory tree model
- Debounced PUT after `snap()` covers all task mutations without touching every handler
- Python fits the existing port-8090 hosting setup

### Fixed
- `seed_data.py` nested `make()` was re-processing already-built child nodes, stripping due/size/children
- `board-sync.js` now rejects corrupt server boards so inline sample data is kept

## Testing infrastructure (2026-06-15)

### Added
- Extracted pure logic into `src/data/constants.js` and `src/lib/*` modules (domain, tree, dates, capture).
- Moved the app script to `src/app/main.js` and wired `index.html` as an ES module entry point.
- Vitest unit tests under `tests/` for domain inference, task tree math, gantt dates, and capture parsing.
- `package.json` with `npm test` / `npm run test:watch`.
- GitHub Actions workflow (`.github/workflows/ci.yml`) to run tests on push and PR.
- GitHub Actions CD workflow (`.github/workflows/deploy.yml`) to deploy the static app to GitHub Pages after tests pass on `main`.

### Public repo / Pages (2026-06-15)

### Changed
- Restored GitHub Pages PR previews (`pr-preview/pr-<n>/`) and automatic production deploy on `main`.
- Removed private-repo artifact-only preview and `ENABLE_GITHUB_PAGES` gate.

### Setup
- Pages source: **Deploy from branch → gh-pages → / (root)**
- Actions: **Read and write permissions**

- The prototype was a single 1700+ line inline script with no automated checks.
- Pulling testable logic into modules gives a stable base for refactors and new features without changing UI behavior.
- ES modules keep the zero-build-step workflow (open `index.html` or serve statically) while enabling Node-based unit tests.
