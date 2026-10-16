# CI popup timeout implementation plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Explain and fix the Linux Firefox popup timeout, then confirm a passing GitHub Actions run on main.

**Architecture:** Trace the failing browser-test boundary before changing extension behavior. Keep the exact popup geometry, real-browser assertions, and browser version coverage. Use disposable test profiles only. Do not skip checks, hide overflow, pin an older browser to mask the issue, or merely lengthen the timeout.

**Tech stack:** Node test runner, Selenium, Firefox, GitHub Actions.

## Task 1: Obtain a reproducible failure

**Files:** `tests/browser/firefox.test.js`, `.github/workflows/ci.yml`.

1. Inspect run 38851395432. Unit tests, build, and lint passed. Linux Firefox 158.0 timed out in the popup layout subtest; Firefox 143.0 on macOS passed earlier.
2. Work on `fix/ci-popup-viewport`. Do not start the user's Docker daemon or use a personal browser profile. Docker is installed but its daemon is unavailable.
3. Add stage-specific diagnostics around viewport resizing and popup readiness. Record requested and actual inner/outer dimensions, URL, and a screenshot on failure.
4. Upload synthetic test artifacts even if the browser suite fails.
5. Run local verification, commit the diagnostics, push the feature branch, and inspect its CI run. Confirm the exact failing wait and actual browser state before proposing a fix.

## Task 2: Fix the confirmed cause

**TDD scenario:** Full red-green regression cycle, with the observed CI failure as browser evidence.

1. Add a focused regression for the confirmed faulty assumption or behavior.
2. Run it and inspect the expected failure.
3. Apply the smallest platform-independent fix. Keep exact 760-by-590 popup coverage and all existing geometry checks.
4. Run the regression and full local unit/build/lint and Firefox suites.
5. Push the feature branch and confirm the latest Linux Firefox job passes all steps, including audit and artifact upload.

## Task 3: Record and publish verified evidence

**Files:** `AGENTS.md`, `GOALS.md`, `docs/TESTING.md` as relevant.

1. Record the root cause, regression, actual browser versions, test counts, and CI result. Do not claim screenshots were reviewed until they have been inspected.
2. Review the diff for safety, unchanged permissions, meaningful assertions, and preservation of private local files.
3. Fast-forward main only after the fix is verified. Push without force.
4. Wait for the main-branch workflow to finish and check the result. Report a passing run URL only after every required job succeeds.

## Results

- Diagnostic run `38852514051` confirmed that popup loading succeeded: the document was complete and 100 rows were present. The requested viewport was 760 by 590; the actual viewport was 760 by 602, with an outer height of 676.
- The helper's initial chrome-height measurement was 86 pixels. After resizing, the actual inset was 74 pixels. Waiting alone could not repair this 12-pixel difference.
- Extracted the viewport helper and observed two failing unit checks before the correction: the observed inset change timed out, and an already correct viewport was still resized.
- The helper now remeasures and corrects geometry on each bounded wait attempt. Its original ten-second timeout and one-pixel tolerance remain. No extension code, permissions, viewport targets, or layout assertions changed.
- Five viewport-helper tests cover stable insets, the observed inset change, an already correct viewport, unreachable dimensions, and browser errors. All 39 unit/interface/helper tests and 13 Firefox tests pass locally with Firefox 143.0. Build, lint, audit, and whitespace checks pass.
- Feature-branch run [38852997344](https://github.com/tgallant/cmt/actions/runs/38852997344) passes all steps on Ubuntu 24.04.5 with Firefox 158.0. It logs a 760-by-590 popup viewport. The failure and passing popup screenshots were reviewed.
- Diff review confirms that only tests, workflow artifact handling, and documentation changed. The final integration gate is a passing workflow on `main`.
