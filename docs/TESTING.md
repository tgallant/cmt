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

- Model, service, access, manifest, and interface tests: 24 passed.
- Real Firefox acceptance tests: 7 passed, including the parent test.
- Mozilla add-on lint: 0 errors, 0 warnings, 0 notices.
- Dependency audit: 0 known vulnerabilities, including development tools.
- Build and ZIP creation: passed.
- The ZIP has the eight required runtime files and no development tools.
- The large Firefox fixture has 995 non-CMT tabs. The interface renders at most 100 rows at a time. Selection covers all 995 tabs.
- The warmed 995-tab model query is below the 200 ms limit. The test prints the measured time on each run.
- `artifacts/manager.png` is a screenshot from the real Firefox test. The terminal-style interface was reviewed from this image.

The Firefox tests use real keyboard events for the palette and previous-tab commands. They check the registered keys. They check focus after Escape. They also check a popup document on a restricted page.

A packed temporary installation through geckodriver produced content-script file-descriptor errors on this macOS system. The test installs the unpacked `dist/` folder through Firefox's temporary add-on API. It separately checks the ZIP contents. This is the same build used in the installation guide. These tests do not prove signed ZIP installation.

Firefox Developer Edition 156.0 was present, but it had intermittent startup failures in this environment. The final browser evidence uses a separate Firefox 143.0 copy and a fresh profile. No user profile was used. Do not treat the initial startup failures as passing checks.

## Acceptance map

| Test | Evidence |
| --- | --- |
| A01 | `tests/model.test.js`; Firefox 995-tab fixture |
| A02 | Fuzzy search, combined filters, and each sort in `tests/model.test.js` |
| A03 | Mode tests in model and interface tests; real previous-tab shortcut and pinned view in Firefox |
| A04 | Real palette shortcut, closed shadow root, Escape, focus restoration, and restricted-page popup |
| A05 | Arrow, Enter, and view-key interface tests; real Enter activation and visible mode controls |
| A06 | Single, Shift-range, clear, and 995-result selection tests; real Firefox count |
| A07 | Service safety tests; real pin/unpin, mute/unmute, discard, close, and close dialog |
| A08 | Exact duplicate and keeper tests; real duplicate selection and close |
| A09 | Unknown age, stale identifier, partial batch, and protected discard tests |
| A10 | Title escaping, live private-data fixture, overlay authorization, minimal manifest, and source review |
| A11 | Test commands, build, lint, ZIP content check, and audit |
| A12 | Review of `README.md`, `docs/CHROME.md`, and the CSS warnings |

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
