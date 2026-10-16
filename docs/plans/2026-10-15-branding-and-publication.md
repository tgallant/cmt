# Close My Tabs branding and publication plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Use the full CMT name consistently, publish the code at the user's requested public repository, and explain permanent Firefox installation.

**Architecture:** Change names and documentation only. Preserve the add-on ID, permissions, search rules, tab safety rules, and build layout. Publish tracked source and records, not local screenshots, build files, profiles, or agent session data.

**Tech stack:** JavaScript modules, Firefox Manifest V2, npm, Git, GitHub CLI.

## Task 1: Branding and release guide

**TDD scenario:** Trivial string/configuration changes; existing tests apply.

**Files:** `README.md`, `AGENTS.md`, `GOALS.md`, `docs/TESTING.md`, `docs/RELEASING.md`, `package.json`, `.gitignore`, `src/manifest.json`, `src/ui.js`, `src/content.js`, `src/manager.html`, `src/popup.html`, `src/overlay.html`.

1. Run existing tests before changes. Confirm the current branch contains both fixes.
2. Use `CMT — Close My Tabs` in the README, manifest, page titles, and metadata. Use `CMT / Close My Tabs` in the interface. Preserve `cmt@local.example` as the add-on ID.
3. Add the intended repository and issue URLs to package metadata. Keep npm publication disabled.
4. Ignore local root-level screenshots because they can contain private tab data.
5. Explain listed and unlisted Mozilla signing, separate source uploads for bundled code, reviewer build commands, licensing, privacy declarations, safe fixture screenshots, and signed XPI installation. Link the official Mozilla guidance checked on 2026-10-15.
6. Do not choose a license, accept Mozilla terms, submit an add-on, or claim approval on the user's behalf.

## Task 2: Verification and public-data review

**Files:** `GOALS.md`, `docs/TESTING.md`.

1. Run `npm run verify` and the disposable-profile Firefox suite with the separate Firefox 143.0 binary.
2. Run `npm audit` and `git diff --check`.
3. Review tracked files and reachable Git history for credentials, private tab data, screenshots, profiles, and accidental artifacts. Report the limitations of pattern-based checks; do not claim a formal security audit.
4. Commit only the relevant files. Keep both user screenshots local. Create a source archive with `git archive` after the commit and compare a clean-source rebuild's runtime files with `dist/`.

## Task 3: GitHub publication

1. Verify authenticated GitHub identity and whether `tgallant/cmt` exists.
2. If authentication is unavailable, ask the user to authenticate through `gh auth login --hostname github.com --web`. Do not request or print credentials. Continue local work while publication is blocked.
3. For a new repository, publish the verified history as `main`. Create `tgallant/cmt` with public visibility, the Close My Tabs description, and the local source. Push without force.
4. Verify repository visibility, default branch, remote commit, and the absence of private screenshots in its tree. Report the actual URL only after publication succeeds.
5. If the repository already contains unrelated work, do not overwrite it; ask before integrating.
