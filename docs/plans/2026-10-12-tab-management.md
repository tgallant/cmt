# Tab management implementation plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Make a Firefox extension that can manage 995 or more tabs without a sidebar.

**Architecture:** Use a persistent Firefox background page as the only source of tab data and tab actions. Share one small, bundled interface between an isolated in-page frame, a toolbar popup, and a full manager page. Keep search and action rules in pure modules.

**Tech stack:** JavaScript modules, Firefox Manifest V2 WebExtensions, esbuild, Node test runner, Selenium, geckodriver, Mozilla addons-linter, ZIP.js.

## Design decisions

The user asked for autonomous work through completion. Continue in this repository on a feature branch. Do not change the user's Firefox profile.

Options considered:
1. A toolbar popup only. Simple, but too small for bulk work.
2. An injected overlay only. Good keyboard access, but Firefox blocks injection on some pages.
3. A shared overlay, popup, and manager. Use this option. It covers restricted pages and large selections.

Use Manifest V2 for Firefox's persistent background page and reliable popup fallback. Do not request Tree Style Tab or Auto Tab Discard integration permissions. Standard tab actions must coexist with those extensions. Do not infer or change tab trees.

Use a monospace font, dark neutral colors, fine borders, and one bright accent. Use native controls with labels. Support the keyboard and a pointer. Keep tab titles as text, never HTML. Do not fetch favicons or send data to a server.

A shortcut opens the overlay on normal pages. On restricted pages, open the toolbar popup. A second shortcut activates the previous tab in the current window. Recent and pinned modes remain easy to reach. The manager supports bulk selection across all matching results, not only rendered results.

Close actions require confirmation. Pinned tabs are protected unless the user explicitly permits them. Duplicate cleanup keeps one tab per exact URL, with pinned and active tabs preferred. Do not treat URLs with different fragments or query strings as duplicates. Old means time since last access, not creation time. Missing last-access data is not old.

The extension cannot hide Firefox's tab strip or another extension's sidebar. Supply optional userChrome.css and rollback instructions. Explain this limit in the goals and user guide.

## Task 1: Project records and tooling

Create `AGENTS.md`, `GOALS.md`, `package.json`, `.gitignore`, and this plan. Add scripts for unit tests, Firefox tests, lint, build, and package. Commit the project records.

## Task 2: Query and selection rules

Files: `src/model.js`, `tests/model.test.js`.
Write failing tests for fuzzy title and URL search, AND filters, recent/pinned modes, stable sorts, exact duplicates, old tabs, missing times, all-result selection, and 995-tab performance. Run `node --test tests/model.test.js`. Implement and rerun until green.

## Task 3: Firefox service and safety

Files: `src/service.js`, `src/background.js`, `src/manifest.json`, `src/content.js`, `tests/service.test.js`.
Write failing service tests for activation, pin/unpin, discard, mute/unmute, close confirmation, pinned protection, stale IDs, partial failures, private data, and previous-tab switching. Use a browser API fake only at the external boundary. Implement the service and Firefox adapters. Run `npm test`.

## Task 4: Interface

Files: `src/ui.js`, `src/ui.css`, `src/manager.html`, `src/popup.html`, `src/overlay.html`, `tests/ui.test.js`.
Write failing DOM tests for search, keyboard navigation, mode switching, selection, range selection, close confirmation, and escaped titles. Implement the shared interface. Limit rendered rows to a page of 100 while selection can span the full result set. Include a visible next/previous page control. Run `npm test`.

## Task 5: Firefox acceptance and release

Files: `tests/firefox.test.js`, `scripts/build.mjs`, `README.md`, `docs/TESTING.md`, `docs/userChrome.css`, `.github/workflows/ci.yml`.
Build an unsigned ZIP. Run `addons-linter dist --warnings-as-errors`. Test the installed extension in a new, disposable Firefox profile with Selenium. Exercise real tab operations, overlay and fallback, keyboard input, and a 995-tab fixture. Record measured performance and test outcomes. Document installation, shortcuts, permissions, limits, and optional chrome hiding. Do not claim manual interoperability checks were run unless they were run.

## Verification commands

- `npm test`: all pure, service, and DOM tests pass.
- `npm run build`: produces `dist/` with no remote code.
- `npm run lint`: no errors or warnings.
- `npm run test:firefox`: real Firefox acceptance tests pass in a disposable profile.
- `npm run package`: produces `artifacts/cmt.zip`.

Review the final diff, rerun all checks, and map each goal to evidence in `GOALS.md`.

## Implementation notes

- Use Mozilla addons-linter directly and ZIP.js for packaging. This removes unused runner and Android tools from development dependencies. The final dependency audit is clean.
- Use Control-based shortcuts on macOS. Option-based shortcuts can be consumed by text input.
- Open the popup synchronously for known restricted pages. Use Firefox's command event tab argument rather than a later current-window query.
- Authorize the overlay with a per-tab token. Keep its frame in a closed shadow root. Revoke access when it closes.
- Make other controls inert while close confirmation is open.
- Install the unpacked build in the disposable browser test. Packed temporary geckodriver installation had content-script file-descriptor errors on macOS. Validate the ZIP separately.
- Final evidence uses a separate Firefox 143.0 copy. Do not use the user's live browser or profile.
