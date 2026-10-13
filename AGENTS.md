# Agent rules

## Product

CMT is a local-only Firefox tab manager. Read `GOALS.md` and `docs/plans/2026-10-12-tab-management.md` before changes. The user has about 995 tabs and uses Tree Style Tab and Auto Tab Discard. Do not require a sidebar. Do not change tree relationships or another extension's settings. Never use the user's Firefox profile for tests.

## Writing

Use ASD-STE100 principles in all user-facing text: short sentences, simple words, active voice, one instruction per step, and one name for each concept. Define technical words when needed. Use explicit warnings before destructive steps. Do not claim formal ASD-STE100 certification. Keep Markdown plain. Avoid marketing language, jokes in errors, and unexplained abbreviations.

## Code and design

Use JavaScript ES modules, two-space indentation, semicolons, and named exports. Keep search and safety rules independent of the DOM and browser API. Use the background service for all tab actions. Do not render tab data as HTML. No remote code, telemetry, or runtime dependencies. Use a monospace font, neutral dark colors, thin borders, visible focus, and a restrained accent. Keep the interface usable with a keyboard and a pointer.

## Process

1. Work on a feature branch. Keep unrelated user files unchanged.
2. Write a failing test before new behavior or a bug fix. Run it and check the failure reason.
3. Implement the smallest change. Run the tests again.
4. Run `npm run verify` before a completion claim. Run `npm run test:firefox` for browser behavior.
5. Update acceptance evidence in `GOALS.md` and test details in `docs/TESTING.md`.
6. Review safety, permissions, accessibility, privacy, and documentation before release.
7. Keep the lockfile. Do not commit `node_modules`, `dist`, `artifacts`, test profiles, or secrets.

## Safety and limits

Keep exact URL equality for duplicates. Prefer pinned and active tabs as duplicate keepers. Do not close pinned tabs without explicit consent. Recheck tab state when an action runs. Report per-tab failures. Do not silently normalize URLs, restore discarded pages, or close tabs to make tests pass. Treat unknown last-access times as unknown, not old. Firefox chrome cannot be hidden by a WebExtension; the optional CSS is a separate user step. Signed installation and real interoperability checks are separate from automated tests.

## Commands

- `npm ci`: install development tools.
- `npm test`: model, service, and interface tests.
- `npm run verify`: tests, build, and manifest lint.
- `npm run test:firefox`: disposable-profile Firefox tests.
- `npm run package`: make `artifacts/cmt.zip`.
