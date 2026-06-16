# Changelog

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
