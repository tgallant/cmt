# Hide the tab strip and sidebar

This is optional. It changes Firefox's interface, not CMT.

Firefox calls its own interface **chrome**. The file `userChrome.css` can change that interface. This file is not the Google Chrome browser.

**Warning:** Firefox updates can change the CSS selectors. Test CMT's shortcuts before you hide tabs. Keep the address bar visible. Do not replace an existing CSS file without a backup.

A temporary CMT installation ends when Firefox restarts. Load `dist/manifest.json` again after each restart before you rely on the palette. Use a signed permanent installation for regular use.

## Apply the file

1. Open CMT on a normal page with its shortcut.
2. Open CMT on `about:config` with its shortcut. Check that the popup works.
3. Close the Tree Style Tab sidebar with Firefox's sidebar controls.
4. Open `about:support`.
5. Find **Profile Folder** or **Profile Directory**. Open that folder.
6. Back up any existing `chrome/userChrome.css` file.
7. Create a folder named `chrome` if it does not exist.
8. Copy this project's `docs/userChrome.css` to `chrome/userChrome.css` in your profile. If you already use custom CSS, add the rules to your existing file instead.
9. In `about:config`, set `toolkit.legacyUserProfileCustomizations.stylesheets` to `true`.
10. Restart Firefox.
11. If CMT is temporary, load it again from `about:debugging#/runtime/this-firefox`.
12. Check the palette and popup shortcuts again.

The file hides the horizontal tab strip and the sidebar containers. It leaves the navigation toolbar visible. The sidebar rules also hide bookmark, history, and built-in vertical-tab sidebars. Delete that rule block if you want to use those sidebars.

On some systems, window buttons are in the tab strip. These rules can hide those buttons. In Firefox's toolbar customization view, enable the separate title bar before you apply the file if you need those buttons. If controls are missing, restore the CSS backup. macOS and custom themes can behave differently.

Use CMT's shortcut to switch tabs. Use **Open manager** for cleanup. Firefox's tab shortcuts still work even when the tab strip is hidden.

## Undo the change

1. Open your Firefox profile folder from `about:support`.
2. Remove the CMT rules from `chrome/userChrome.css`, or restore your backup.
3. Restart Firefox.

If you cannot open Firefox normally, close it first. Restore the file from the profile folder with your system's file manager. Do not delete the profile folder or your session files.

You can also set `toolkit.legacyUserProfileCustomizations.stylesheets` to `false`. This disables all profile CSS, not only the CMT rules.

The automated tests do not apply this file to your profile. Review the result with your theme and operating system.
