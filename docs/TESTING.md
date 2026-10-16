# Test record

## Automated checks

The checks use test data. They do not use the user's Firefox profile.

Run:

```sh
npm ci
npm run verify
npm run test:firefox
npm audit
```

`test:firefox` builds the current code and its ZIP before it starts. It creates a new Firefox profile. It starts a local HTTP server for test pages. It creates discarded tabs with test URLs for the large-tab fixture. It closes the test browser when the test ends.

Set `FIREFOX_BINARY` to the executable path if needed. Example on macOS:

```sh
FIREFOX_BINARY='/path/to/Firefox.app/Contents/MacOS/firefox' npm run test:firefox
```

The test driver is geckodriver 0.37.1. You can set `GECKODRIVER_VERSION` to test another version. The first run downloads the driver. The tests enable browser-interface access only in the test process. This lets them inspect the popup and install the unpacked extension. It does not change your normal Firefox settings.

## Evidence

Verified on macOS ARM64 with Node.js 26.10.0, Firefox 143.0, and geckodriver 0.37.1.

- Model, service, access, manifest, and interface tests: 34 passed.
- Real Firefox acceptance tests: 13 passed, including the parent test.
- Mozilla add-on lint: 0 errors, 0 warnings, 0 notices.
- Dependency audit: 0 known vulnerabilities, including development tools.
- Build and ZIP creation: passed.
- The ZIP has the eight required runtime files and no development tools.
- The large Firefox fixture has 995 non-CMT tabs. The interface renders at most 100 rows at a time. Selection covers all 995 tabs.
- The warmed 995-tab model query is below the 200 ms limit. The test prints the measured time on each run.
- Screenshots from the real Firefox tests are in `artifacts/manager.png`, `artifacts/overlay-normal.png`, `artifacts/overlay-short.png`, and `artifacts/popup-layout.png`. Help screenshots have a `-help` suffix. These images were reviewed.

The Firefox tests use real keyboard events for the palette and previous-tab commands. They check the registered keys. They check focus after Escape. They also check a popup document on a restricted page.

A packed temporary installation through geckodriver produced content-script file-descriptor errors on this macOS system. The test installs the unpacked `dist/` folder through Firefox's temporary add-on API. It separately checks the ZIP contents. This is the same build used in the installation guide. These tests do not prove signed ZIP installation.

Firefox Developer Edition 156.0 was present, but it had intermittent startup failures in this environment. The final browser evidence uses a separate Firefox 143.0 copy and a fresh profile. No user profile was used. Do not treat the initial startup failures as passing checks.

## Layout regression checks

The layout checks use Firefox's real control sizes and scroll measurements, not a simulated DOM layout.

- Text, number, and select fields have equal size and align in each grid row.
- At a 1073-by-919 manager viewport, the four fields are each 248 pixels wide and 34 pixels high.
- At a 560-by-900 manager viewport, filters use two equal columns. Fields align within each row.
- The overlay is checked in 1073-by-919 and 850-by-760 parent-page viewports. The overlay frame is smaller than its parent page.
- The popup document is checked at 760 by 590 pixels. The native popup opening is checked separately.
- Both the document and main container fit. Tests check that hidden overflow does not simply clip controls.
- Results keep a positive height and can scroll without scrolling the document.
- Opening filters, help, or a long failure report does not add an outer scrollbar. Page buttons remain visible and work.
- Help and failure reports open above the page buttons. Only one report panel is open at a time.

These tests reproduce the reported height mismatch and outer scrollbar before the fix. They check normal, short, and narrow layouts. They do not prove that every screen size, font setting, or zoom level fits. The manual zoom and screen-reader checks below still apply.

## Search relevance regression checks

The original matcher accepted any completed subsequence. It capped each gap penalty and chose the first alignment. Regression tests first reproduced extra results and incorrect ordering. Firefox showed six matches where four were expected.

- Titles and complete URLs use the same best-alignment algorithm. No URL formats or URL fields are excluded.
- Every skipped character reduces the score. A fuzzy match must reach 65% of the reference score for a contiguous, word-start match of the same length.
- Literal query words rank first with relevance sort. A later strong alignment is not weakened by an earlier poor one.
- `ffdoc` and `mzla docs` still work. Compact fuzzy matches work in hosts, paths, query strings, fragments, and text that is not a valid URL.
- Empty searches, missing fields, all-word matching, stable ties, and explicit sort order are checked.
- An independent exhaustive scorer checks the result order for 2,500 generated query/text cases. It enumerates alignments instead of using the production algorithm's score rows.
- A warmed 995-tab noisy-URL fixture keeps only the genuine YouTube match. It remains below the 200 ms limit; the test prints each measured time.
- Firefox checks actual result IDs for `youtube`, `mzla`, and `ytb` among 1,003 disposable tabs, then removes the eight added test tabs. `artifacts/search-relevance.png` shows the literal matches before the compact fuzzy match. This image was reviewed.

The cutoff is a text-match rule, not a semantic judgment about the page. Closely matching text can still describe a different topic. These checks use synthetic data, not the user's tab list.

## Acceptance map

| Test | Evidence |
| --- | --- |
| A01 | `tests/model.test.js`; Firefox 995-tab fixture |
| A02 | Best alignment, weak-match cutoff, full-URL matching, literal-first relevance, combined filters, and explicit sorts in `tests/model.test.js`; real Firefox search result IDs |
| A03 | Mode tests in model and interface tests; real previous-tab shortcut and pinned view in Firefox |
| A04 | Real palette shortcut, closed shadow root, Escape, focus restoration, and restricted-page popup |
| A05 | Arrow, Enter, and view-key interface tests; real Enter activation and visible mode controls |
| A06 | Single, Shift-range, clear, and 995-result selection tests; real Firefox count |
| A07 | Service safety tests; real pin/unpin, mute/unmute, discard, close, and close dialog |
| A08 | Exact duplicate and keeper tests; real duplicate selection and close |
| A09 | Unknown age, stale identifier, partial batch, and protected discard tests |
| A10 | Title escaping, live private-data fixture, overlay authorization, minimal manifest, and source review |
| A11 | Test commands, build, lint, ZIP content check, and audit |
| A12 | Review of `README.md`, `docs/RELEASING.md`, `docs/CHROME.md`, and the CSS warnings |
| A13 | Firefox field dimensions, document and main overflow, independently scrollable results, visible page buttons, and layout screenshots |

## Branding and release records

CMT means Close My Tabs. The README, add-on name, toolbar label, interface header, page titles, and palette frame label use this name. The add-on ID and permissions are unchanged. The same 34 unit/interface tests and 13 Firefox checks apply after the name changes.

[RELEASING.md](RELEASING.md) explains listed and unlisted signing, the separate source upload, reviewer build commands, privacy declarations, licensing, and signed installation. These steps do not claim that Mozilla has received or approved CMT. The publisher must still select a license and complete the manual release checks.

Local root-level screenshots are ignored because they can contain private tab data. Build output, test screenshots, dependencies, and agent session files remain excluded from Git. A source archive made with `git archive` contains tracked files only.

## Manual checks before a large cleanup

These checks require your own extensions, theme, and operating system. They were not run against the user's profile. They are not part of the automated pass count.

Use a small group of disposable tabs first.

1. Leave Tree Style Tab and Auto Tab Discard enabled.
2. Make a parent tab with two child tabs in Tree Style Tab.
3. Select and close only one child tab in CMT.
4. Check that the other two tabs remain open.
5. Check Tree Style Tab's setting for closing a parent tab.
6. Close a disposable parent in CMT. Check which child tabs Tree Style Tab closes or moves.
7. Open CMT after Auto Tab Discard discards a tab. Check the **DISCARDED** label.
8. Switch to that tab with CMT. Check that Firefox loads the page.
9. Test both CMT shortcuts with your keyboard layout and other extensions.
10. Apply the optional CSS only after the shortcuts work. Check window buttons, the address bar, and the toolbar button.
11. Undo the CSS change. Check that the tab strip and sidebar can be shown again.

CMT does not override another extension's rules. Tree Style Tab can close child tabs when a parent closes. Auto Tab Discard can change tab state while CMT is open. Review your settings before a large close request.

## Release checks

Before a permanent release:

1. Run the automated commands above.
2. Run the manual checks with both tab extensions.
3. Test keyboard focus and text at 200% zoom.
4. Test with a screen reader and a second operating system.
5. Submit the ZIP and source to Mozilla for signing.
6. Install the signed file in a fresh normal Firefox profile.

Formal ASD-STE100 compliance has not been certified. User text follows its plain-language principles. Screen-reader behavior, signed installation, optional profile CSS, and third-party extension rules still need the manual checks above.
