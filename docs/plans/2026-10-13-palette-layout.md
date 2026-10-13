# Palette layout fix

## Request

Make filter inputs the same size and align them. Fit the palette to its frame. Scroll the results, not the whole palette. Keep the footer and controls visible.

## Cause

Native Firefox input and select controls have different automatic heights. The results use a 52vh limit inside a normal-flow page. The total height of controls, results, and footer can exceed the overlay frame. The popup also allows body scrolling.

## Approach

Use explicit, equal field heights and a four-column grid that changes to two columns in narrow windows. Put checkbox options and reset in one wrapping row. Use a height-constrained flex layout. Give the remaining space to the results with a zero minimum size. Keep the controls and footer outside the results scroller. Use compact spacing in short frames. Keep expanded help out of normal flow so it does not enlarge the palette.

Do not hide overflowing controls to remove a scrollbar. Do not change search, selection, or tab action behavior. Keep `screen1.png` unchanged and out of the implementation commit.

## Steps

1. Run existing tests. Add real Firefox regression tests for field heights, widths, and alignment; outer document overflow; a scrollable results list; and visible footer controls. Test overlay, popup, and manager, with filters open and closed.
2. Run the new tests against the current layout. Confirm the expected failures.
3. Update `src/ui.css` and filter/help markup in `src/ui.js`. Run the new tests again. Inspect screenshots from the fixed overlay and popup.
4. Run `npm run verify`, `npm run test:firefox`, `npm audit`, and `git diff --check`. Update `GOALS.md`, `docs/TESTING.md`, and `AGENTS.md`. Commit only the fix and its records.

## Acceptance

- Text, number, and select fields have equal widths and heights in each grid row.
- Checkbox controls have equal size and consistent label spacing.
- The document and main container have no vertical or horizontal overflow.
- The results have a positive viewport height and scroll when many tabs match.
- Header, actions, result count, page buttons, and help remain in the viewport.
- Expanded filters, expanded help, action status, and failure details do not make the document scroll.
- Check a normal overlay, a short overlay, a 760-by-590 popup document, and a manager window. Keep existing action and keyboard tests green.
