# Goals and acceptance tests

## Scope

Manage at least 995 open Firefox tabs. Keep many tabs open without a required tab bar or sidebar. Make cleanup deliberate and safe. Keep all tab data on this device.

## Goals

1. Open a keyboard-first command palette over a normal web page. Use a popup on pages where Firefox blocks overlays.
2. Switch between recent tabs, pinned tabs, and all tabs. Activate the previous tab with a command.
3. Search titles and complete URLs with fuzzy matching. Find the best alignment and exclude weak matches. Put literal matches first in relevance order. Apply one algorithm to all searchable text. Combine filters for window, host, pinned, discarded, audible, duplicates, and age.
4. Sort by relevance, last access, title, host, and tab order. Show counts and tab state.
5. Select one tab, a range, or all matching tabs. Keep selection independent of the visible page.
6. Pin, unpin, mute, unmute, discard, and close selected tabs. Require confirmation to close. Protect pinned tabs by default. Report failures.
7. Find exact duplicate URLs. Select extra copies while keeping a pinned or active copy first. Find tabs not accessed for a chosen number of days.
8. Use a modern terminal-style interface. Support keyboard navigation, visible focus, labels, and readable status text. Align filter fields and fit the palette to its viewport. Keep scrolling inside the results, not the whole palette.
9. Work with standard Firefox tab APIs. Do not need Tree Style Tab or Auto Tab Discard. Do not change their settings or trees.
10. Supply installation steps, permissions, shortcuts, and optional instructions to hide Firefox's tab strip. Explain how to undo those changes.

## Acceptance tests

| ID | Test | Required evidence |
| --- | --- | --- |
| A01 | A fixture with 995 tabs can be searched and sorted. A query takes less than 200 ms in a warmed model test. | Model test and Firefox fixture |
| A02 | Strong fuzzy search matches titles and complete URLs. Weak, widely separated matches are excluded. The best alignment wins; literal matches come first in relevance order. Filters combine and explicit sorts keep their order. | Model and Firefox tests |
| A03 | Recent and pinned modes work. The previous-tab command switches to the last active tab in the current window. | Service, DOM, and Firefox tests |
| A04 | A command opens an isolated overlay. Escape removes it and restores focus. Restricted-page injection failure opens a popup. | Firefox tests |
| A05 | Keyboard arrows change the active result. Enter activates it. Mode and manager commands are visible. | DOM and Firefox tests |
| A06 | Selection supports single rows, Shift ranges, and all matches beyond the first 100 rows. | DOM tests |
| A07 | Pin/unpin, mute/unmute, discard, and close act on the chosen tabs. Close needs confirmation. Pinned tabs stay open unless explicitly permitted. | Service and Firefox tests |
| A08 | Duplicate cleanup keeps one exact URL copy. Different fragments and queries stay separate. Pinned and active copies are preferred. | Model and Firefox tests |
| A09 | Age uses last access. Unknown times do not count as old. Stale tabs and partial failures do not abort the full action. | Model and service tests |
| A10 | Untrusted titles appear as text. Private-tab metadata is not stored. No network services or host access at startup are required. | DOM, service, manifest tests, and code review |
| A11 | Build, unit tests, Firefox tests, and manifest lint pass. The ZIP contains all runtime files. | Verification commands |
| A12 | User instructions cover install, shortcuts, safety, permissions, chrome hiding, rollback, and Firefox limits in plain language. | Documentation review |
| A13 | Filter fields have equal size and align in each row. Overlay, popup document, and manager fit the tested viewports with no outer scroll or clipped controls. Results scroll independently. Expanded filters, help, and reports keep page buttons visible. | Firefox geometry and screenshot checks |

## Platform boundaries

- Firefox does not let extensions hide the native tab strip. Optional profile CSS can hide it. The user must apply this file.
- Firefox blocks content scripts on internal pages, add-on pages, and some protected sites. The popup is the fallback.
- Tree Style Tab tree preservation and Auto Tab Discard scheduling need a manual check with those add-ons. Automated tests cover standard tab API behavior, not those add-ons.
- Permanent installation in normal Firefox needs Mozilla signing. The project produces an unsigned ZIP for testing and signing.

## Results

All 13 automated or documentation acceptance checks pass. `npm run verify` passes 34 tests and reports no lint errors, warnings, or notices. The Firefox suite passes 13 tests with a 995-tab fixture and layout checks in Firefox 143.0. Build, ZIP validation, and the full dependency audit pass. See `docs/TESTING.md` for the acceptance map and environment.

The platform boundaries above still apply. Signed installation, optional profile CSS, screen-reader checks, and the user's Tree Style Tab and Auto Tab Discard rules are manual release checks. They are not claimed as completed.
