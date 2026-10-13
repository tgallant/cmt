# Search relevance implementation plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Remove weak fuzzy matches without disabling useful abbreviations.

**Architecture:** Keep search in `src/model.js`. Apply one matching algorithm to titles and complete URLs, including query strings and fragments. Find the best subsequence alignment, charge for every skipped character, and reject scores below a query-length-scaled quality threshold. Rank literal matches first when sorting by relevance. Do not add URL-format exceptions, dependencies, permissions, or stored tab data.

**Tech stack:** JavaScript modules, Node test runner, Selenium, Firefox 143.0.

## Scope and evidence

The user reports unrelated results after searching for `youtube`. The current matcher caps each gap penalty at 10 and accepts every completed subsequence. It also chooses the first alignment. The user requested an algorithm fix, not URL-format restrictions. Existing tests pass on `fix/search-relevance`. Preserve the layout fix and the user's untracked screenshots.

Options considered:
1. Restrict URL fields. Rejected: this changes where search works rather than fixing matching quality.
2. Require literal substrings. Rejected: this removes useful abbreviations.
3. Improve alignment scoring and reject weak matches. Use this option.

## Task 1: Algorithm regressions

**TDD scenario:** New bug coverage, full red-green cycle.

**Files:** `tests/model.test.js`, `tests/browser/firefox.test.js`.

1. Add model cases for widely separated letters in both fields, literal-first ranking, later better alignments, and all-word matching. Preserve fuzzy matching within complete URLs, forced sort order, empty search, and missing fields.
2. Add a warmed 995-tab noisy-URL fixture. Only a genuine YouTube match should remain; the query must stay below 200 ms.
3. Add a Firefox test using disposable discarded tabs. Check the displayed result IDs for `youtube`, a later good `mzla` alignment, and a fuzzy URL query-string match.
4. Run `node --test tests/model.test.js` and the Firefox suite. Confirm failures concern extra results or incorrect order, not setup errors.

## Task 2: Matcher fix

**TDD scenario:** New matching behavior, full red-green cycle.

**File:** `src/model.js`.

1. Add a literal-match fast path.
2. Use two score rows to find the best alignment. Reward matches, word boundaries, camel-case boundaries, and consecutive letters. Charge a gap-opening cost and an uncapped per-character gap cost. Ignore text before the first match and after the last match.
3. Normalize against a strong contiguous match of the same query length. Reject weak results. Retain `ffdoc` and `mzla docs` coverage.
4. Prioritize the number of literal query-word matches before score in relevance sorting. Leave explicit sorts unchanged.
5. Run `npm test` and the Firefox suite. Inspect performance and search evidence before continuing.

## Task 3: Verification and records

**Files:** `README.md`, `GOALS.md`, `docs/TESTING.md`.

1. Describe the relevance rule in plain language. Document that full URLs use the same algorithm.
2. Run `npm run verify`, the disposable-profile Firefox suite, `npm audit`, and `git diff --check`.
3. Review search correctness, safety, privacy, unchanged permissions, and the final diff. Record observed counts and performance.
4. Commit only relevant source, tests, and records. Rebuild `dist/` and the ZIP. Tell the user how to reload CMT without a file picker.
