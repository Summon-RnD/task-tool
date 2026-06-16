# Task Management Tool

TaskBoard prototype: a single-page task planner with gantt timeline, balance-scale dashboard, voice capture, and transcript extraction. SQLite-backed persistence when served via `server.py`.

AI-perc:47%

## Run locally (with persistence)

```bash
pip install -r requirements.txt
python server.py
```

Open http://localhost:8090

Data is stored in `data/taskboard.db` (created on first run).

## Run locally (static only, no persistence)

```bash
npx --yes serve .
```

Edits will not survive refresh without the Python server.

## Development

Install dependencies and run tests:

```bash
npm install
npm test
```

Watch mode:

```bash
npm run test:watch
```

## API (Python server)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/board` | Load people, tasks, and config |
| PUT | `/api/board` | Save full board state |
| GET | `/api/health` | Health check |

## Project layout

| Path | Purpose |
|------|---------|
| `index.html` | UI markup and styles |
| `src/app/main.js` | Application logic (DOM, rendering, interactions) |
| `src/data/constants.js` | Team roster, clients, sizes, colors |
| `src/data/sample-tasks.js` | Demo tasks for static-only fallback |
| `src/lib/board-sync.js` | Server load/save (first render after load) |
| `server.py` | Flask app + SQLite API |
| `tests/` | Vitest unit tests |

## Deploy on your server

1. Pull/copy this repo to the server
2. `pip install -r requirements.txt`
3. Run `python server.py --host 0.0.0.0 --port 8090`
4. Ensure `data/` is writable and backed up
5. Use a process manager (systemd) so the server survives reboots

Optional: set `OPENAI_API_KEY` in the environment when you add `/extract` later.

## Before opening a PR

1. Run `npm run ci` and confirm all checks pass.
2. Smoke-check the UI in a browser (filter, gantt, task detail sheet).
3. Update `CHANGELOG.md` if you change behavior.

## CI/CD

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| [CI](.github/workflows/ci.yml) | PR + push to `main` | `npm test`, syntax check, entrypoint verification |
| [PR Preview](.github/workflows/preview.yml) | Pull requests | Tests, deploys preview to Pages, comments URL on the PR |
| [CD](.github/workflows/deploy.yml) | Push to `main` | Tests, deploys production site to `gh-pages` |

### One-time setup (after making the repo public)

1. **Settings → Pages → Build and deployment → Source:** `Deploy from a branch`
2. **Branch:** `gh-pages` / `/ (root)`
3. **Settings → Actions → General → Workflow permissions:** `Read and write permissions`

### See the UI on a pull request

After checks pass, a bot comment on the PR includes a link like:

`https://summon-rnd.github.io/task-manager/pr-preview/pr-<number>/`

### Production URL (after merge to `main`)

`https://summon-rnd.github.io/task-manager/`

Note: GitHub Pages serves static files only. Persistence requires the Python server on your remote host.

### Local preview

```bash
gh pr checkout <PR_NUMBER>
npm install
python server.py
```
