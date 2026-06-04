# Repository Guidelines

## Project Structure & Module Organization

This is a Manifest V3 browser extension for collecting AI provider usage and forwarding payloads to Home Assistant. The extension entry point is `manifest.json`. Runtime code lives in `src/`:

- `src/background/` contains the service worker and page-probe logic.
- `src/options/` contains the options UI HTML, CSS, and JavaScript.
- `src/providers/` contains provider collectors such as Codex and Ollama Cloud.
- `src/services/` contains storage, scheduler, and Home Assistant delivery code.
- `src/utils/` contains shared constants, normalization, and Chrome API promise wrappers.

Documentation is in `docs/`, including provider notes and `docs/payload-contract.md`. Icons are in `icons/`.

## Build, Test, and Development Commands

- `npm run check`: syntax-checks every JavaScript file under `src/` with `node --check`.

There is no bundler or install-time build step. Load the repository as an unpacked extension in a Chromium-based browser. After code changes, reload it from the browser extensions page.

## Coding Style & Naming Conventions

Use JavaScript ES modules (`import`/`export`) and keep files focused by responsibility. Follow the existing style: two-space indentation, single quotes, semicolons, trailing commas in multiline literals, and `async`/`await`.

Use `camelCase` for variables and functions, `PascalCase` only for classes if introduced, and uppercase `SNAKE_CASE` for constants. Provider IDs should stay stable and lowercase with hyphens, for example `ollama-cloud`.

## Testing Guidelines

Automated tests are not currently configured. Before submitting changes, run `npm run check` and manually verify the affected extension workflow. For provider changes, test authenticated and unauthenticated states where practical, and confirm payload shape against `docs/payload-contract.md`.

If adding tests later, place them near the code they cover or under a clearly named `tests/` directory, and use names that identify the behavior, such as `normalize-usage.test.js`.

## Commit & Pull Request Guidelines

Recent history uses concise, imperative commit messages such as `add icons` and `refactor payload contract and update data extraction for Codex and Ollama Cloud`. Keep commits focused.

Pull requests should include a short summary, manual verification steps, and any provider or permission changes. Include screenshots when the options UI changes. Link related issues when applicable and call out changes to `manifest.json`, host permissions, storage schema, or the payload contract.

## Security & Configuration Tips

Do not commit tokens, webhook URLs, exported browser profiles, or captured provider responses containing account data. Treat Home Assistant credentials and authenticated provider session data as secrets. Keep optional host permissions broad only when needed for user-configured webhook delivery.
