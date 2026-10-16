# CMT — Close My Tabs

CMT means **Close My Tabs**. It is a Firefox extension for people who keep many tabs open. It has a small command palette and a full tab manager. It does not need a sidebar.

The interface uses a dark background, a monospace font, and clear borders. All tab data stays on your device. CMT does not send data to a server.

## Install for testing

Use desktop Firefox 142 or later. Use Node.js 26 for the build tools.

1. Open a terminal in this folder.
2. Run `npm ci`.
3. Run `npm run verify`.
4. In Firefox, open `about:debugging#/runtime/this-firefox`.
5. Select **Load Temporary Add-on**.
6. Open `dist/manifest.json`.

This installation ends when Firefox closes. Load the extension again after a restart. It uses your existing tabs. It does not import or copy them.

## Install permanently

Normal Firefox needs a Mozilla-signed extension. A public GitHub repository or an unsigned ZIP is not enough. This project does not include a signed release yet.

You can get CMT signed without putting it in the public Firefox add-on store. Submit it to Mozilla for **self-distribution**, then install the signed `.xpi` file. This installation survives browser restarts. For public discovery and managed updates, publish a listing on addons.mozilla.org instead.

See [the release guide](docs/RELEASING.md) for both routes, the source upload, and the remaining release checks.

## Project

The repository address is [github.com/tgallant/cmt](https://github.com/tgallant/cmt). Use [GitHub issues](https://github.com/tgallant/cmt/issues) for bug reports. Do not attach screenshots or tab URLs that contain private information.

## Open CMT

| Command | Windows and Linux | macOS |
| --- | --- | --- |
| Open or close the palette | Alt+Shift+K | Control+Shift+K |
| Switch to the previous tab | Alt+Shift+J | Control+Shift+J |

On macOS, use **Control**, not Command, for these two shortcuts.

Use the Firefox toolbar button to open the popup. Select **Open manager** for bulk work. You can keep the manager in a pinned tab.

To change a shortcut, open `about:addons`. Open the gear menu. Select **Manage Extension Shortcuts**. Choose keys that do not conflict with other extensions or your operating system.

The palette opens over a normal web page. Firefox blocks overlays on some pages, such as `about:config` and Mozilla add-on pages. CMT opens the popup on those pages. If a page prevents the overlay from working, use the toolbar button.

## Switch tabs

1. Open the palette.
2. Select **All**, **Recent**, or **Pinned**.
3. Type a search term.
4. Use the arrow keys to choose a result.
5. Press Enter to switch to that tab.

You can also click a result. CMT focuses its window. A discarded tab loads when you switch to it. Search does not load discarded tabs.

Search uses fuzzy matching. Type letters in the same order as the title or URL. You do not need to type adjacent letters. For example, `ffdoc` can match `Firefox documentation`. Each space-separated word must match the title or URL.

CMT finds the strongest match for each word. It favors adjacent letters and word starts. Long gaps reduce the score. Weak matches do not appear in the results. Titles and complete URLs use the same rules, including URL query strings and fragments. With **Relevance** sort, words that match without gaps come first.

The previous-tab command uses recent tab changes in the current window. It can switch back and forth between two tabs. This record resets when the extension restarts. It does not restore your full past navigation record.

## Filter and sort

Open **Filters and sort**. You can combine these filters:

- Window: all windows, the current window, or one window.
- Host: part of a website name, such as `mozilla.org`.
- Not accessed for: a number of days since last access.
- Pinned, discarded, audible, or exact duplicates.

A discarded tab is still open. Firefox has removed its page from memory.

An old tab is a tab that you have not accessed for the chosen time. This is not its creation time. Firefox can change last-access times after session restore. Tabs with an unknown time do not match the age filter.

Sort by relevance, recent first, oldest first, title, host, or tab order. The **Recent** view uses recent-first order unless you choose another sort. **Reset filters** clears filters and restores relevance sort. It keeps the search term and selected view.

CMT shows 100 results per page. Use **Next page** and **Previous page** to view more results. The count includes all matches. The results area scrolls. The palette controls and page buttons stay in place.

## Select tabs

- Click a checkbox to select one tab.
- Hold Shift and click another checkbox to select a range.
- Select **Select all matches** to select every match, including other result pages.
- Select **Clear selection** to remove the selection.
- Select **Select duplicate extras** to replace the selection with extra exact URL copies in the current results.

**Important:** Selection stays when you change filters or views. An action affects all selected tabs, including tabs outside the current filters. The selection count shows how many selected tabs are outside the filters. Clear the selection if you want to start a new group.

Selection lasts only while this interface is open. The popup loses its selection when it closes. Use the full manager for longer tasks.

## Act on selected tabs

Choose **Pin**, **Unpin**, **Mute**, **Unmute**, **Discard**, or **Close…**.

**Warning:** Discard can lose unsaved page data. Do not discard a form that you are editing.

Discard frees memory. It does not close a tab. CMT skips active and audible tabs when you discard a selection. Firefox can also reject a discard request. CMT shows skipped tabs and failures.

**Warning:** Closing a tab can lose unsaved page data.

To close tabs:

1. Review the selection count.
2. Select **Close…**.
3. Review the warning.
4. Leave **Also close pinned tabs** off to protect pinned tabs.
5. Select **Close tabs** to confirm, or **Cancel** to stop.

If an action skips or fails to change tabs, select **Skipped or failed tabs** below the page buttons. The report opens above those buttons. Select the same heading to close it. **Keys and safety** opens in the same area. Only one of these panels can be open at a time.

CMT checks pinned state again before each close request. It does not directly close protected pinned tabs. This protection applies to CMT's requests, not another extension's close rules. It reports a tab that was already closed or could not be changed. A failed request does not stop the other requests.

Firefox's **Undo Close Tab** command can restore recently closed tabs. Do not use it as a backup. Firefox limits its restore record.

## Clean up duplicates

1. Clear the selection.
2. Open **Filters and sort**.
3. Select **Exact duplicates**.
4. Select **Select duplicate extras**.
5. Review the selection.
6. Select **Close…**.
7. Confirm the close request.

Duplicate URLs must be exactly equal. Different query strings and page fragments remain separate. CMT does not remove tracking parameters or compare page content.

CMT keeps one copy per exact URL. It prefers a pinned copy, then an active copy, then the most recent copy. It chooses the copy to keep from all open tabs, even when filters hide that copy. Pinned extra copies stay open unless you permit their closure.

## Keys inside CMT

Use Control on Windows and Linux. You can use Control or Command on macOS for the keys in this table.

| Key | Action |
| --- | --- |
| Up or Down arrow | Move between results |
| Enter | Switch to the chosen result |
| Space on a result | Select or clear that result |
| Shift+Space on a result | Select a range |
| Control+Shift+1, 2, or 3 | Show all, recent, or pinned tabs |
| Control+Shift+A | Select all matching tabs |
| Control+K | Focus the search field |
| Escape | Cancel a close request or close the palette |
| Tab or Shift+Tab | Move between controls |

In the full manager, Escape focuses the search field. It does not close the manager tab.

## Use no tab strip or sidebar

CMT does not need either one. However, a Firefox extension cannot hide the native tab strip or another extension's sidebar.

First test the shortcuts on a normal page and an internal page. Then follow [the optional chrome guide](docs/CHROME.md). Keep the address bar and toolbar button available as a recovery path.

## Permissions and privacy

- `tabs`: reads tab titles, URLs, state, and last-access times. It also lets CMT change tabs.
- `activeTab`: permits the overlay after you use its command. It does not grant access to every website at startup.

CMT does not use history, bookmarks, downloads, remote scripts, analytics, or network services. It does not store titles or URLs on disk. Recent-tab identifiers and overlay access tokens stay in memory. The overlay uses an extension frame inside a closed shadow root. The page cannot read the frame's tab data. A background check permits an overlay only after its command has run for that tab.

Private tabs are visible only if you allow the extension in private windows in Firefox. CMT does not save their metadata. Bulk actions can affect private tabs if they are visible and selected.

## Tree Style Tab and Auto Tab Discard

You can leave these extensions installed. CMT uses standard Firefox tab actions. It does not read or change tab trees, discard schedules, or those extensions' settings.

When you close a parent tab, Tree Style Tab applies its own close rules. These rules can affect child tabs beyond a CMT selection. Before a large cleanup, test those rules with a small group of disposable tabs. See [the manual checks](docs/TESTING.md#manual-checks-before-a-large-cleanup).

## Development

- `npm test`: run model, service, access, manifest, and interface tests.
- `npm run verify`: run tests, build, and Mozilla manifest lint.
- `npm run test:firefox`: build a ZIP and run Firefox acceptance tests in a new test profile.
- `npm run package`: create `artifacts/cmt.zip`.
- `npm audit`: check development tools for known dependency issues.

Set `FIREFOX_BINARY` to a Firefox executable if it is not in the default location. The tests use Firefox Developer Edition on macOS and `/usr/bin/firefox` on Linux by default. They do not use your Firefox profile. They download a test driver on the first run. Internet access is needed to install tools and download that driver, not to run CMT.

After a code change, run `npm run build`. Reload CMT in `about:debugging` to use the new build.

See [GOALS.md](GOALS.md) for acceptance tests, [docs/TESTING.md](docs/TESTING.md) for evidence and limits, and [AGENTS.md](AGENTS.md) for project rules.
