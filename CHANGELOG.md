# Changelog

## Testing infrastructure (2026-06-15)

### Added
- Extracted pure logic into `src/data/constants.js` and `src/lib/*` modules (domain, tree, dates, capture).
- Moved the app script to `src/app/main.js` and wired `index.html` as an ES module entry point.
- Vitest unit tests under `tests/` for domain inference, task tree math, gantt dates, and capture parsing.
- `package.json` with `npm test` / `npm run test:watch`.
- GitHub Actions workflow (`.github/workflows/ci.yml`) to run tests on push and PR.
- GitHub Actions CD workflow (`.github/workflows/deploy.yml`) to deploy the static app to GitHub Pages after tests pass on `main`.

### PR previews (2026-06-15)

### Added
- `preview.yml`: deploys each PR to `gh-pages/pr-preview/pr-<number>/` and posts the preview URL on the PR.
- Switched production CD to deploy to the `gh-pages` branch (same branch PR previews use).
- Preview workflow does not wait on Pages API (avoids failure before Pages is enabled).

### Changed
- Production CD no longer uses the GitHub Actions Pages artifact flow; both previews and production now use the `gh-pages` branch.

### Setup required
- Pages source must be **Deploy from branch → gh-pages → / (root)**.
- Workflow permissions must allow **read and write**.

### Reasoning
- GitHub Actions-based Pages deploy does not support per-PR preview URLs.
- `rossjrw/pr-preview-action` posts a clickable preview link on each PR for UI review before merge.

- The prototype was a single 1700+ line inline script with no automated checks.
- Pulling testable logic into modules gives a stable base for refactors and new features without changing UI behavior.
- ES modules keep the zero-build-step workflow (open `index.html` or serve statically) while enabling Node-based unit tests.
