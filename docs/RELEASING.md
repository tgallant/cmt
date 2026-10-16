# Release Close My Tabs for Firefox

CMT means Close My Tabs. This project currently builds an unsigned test extension. It has not been submitted to Mozilla or approved for distribution.

## Choose a distribution route

Normal Firefox release and beta versions require Mozilla signing. A public GitHub repository does not replace signing.

| Route | Mozilla submission choice | Result | Updates |
| --- | --- | --- | --- |
| Self-distribution, also called unlisted | **On your own** | A signed `.xpi` file that you can install or share. No public store listing. | Install each signed update yourself, unless a separate update service is configured. CMT does not configure one. |
| Public listing on addons.mozilla.org, also called AMO | **On this site** | A public add-on page with **Add to Firefox**. | Firefox can install updates published through AMO. |

Use unlisted signing for an initial personal installation. Use a public AMO listing for discovery and simpler updates. Both routes are subject to Mozilla's policies and review. Signing is not the same as a Mozilla Recommended badge or a guarantee of safety. Mozilla can request changes or reject a version.

There is no Mozilla signing fee. You need a Mozilla account and must accept the developer agreement yourself. Do not put account credentials or signing keys in this repository.

## Prepare the release

1. Decide how others may reuse the code before a public release. This repository does not select a license yet. A public repository alone is not an open-source license. An open-source license is not required for signing.
2. Confirm the add-on ID before the first submission. The current ID is `cmt@local.example`. Keep the same ID for all updates. It does not need to be a working email address.
3. Set a release version in `src/manifest.json` and `package.json`. Keep `package-lock.json` in sync. Increase the version for each update.
4. Review the manual checks in [TESTING.md](TESTING.md). These include other tab extensions, zoom, keyboard access, and a screen reader. Automated tests do not replace these checks.
5. For a public listing, prepare the description, support details, an icon, and clear screenshots. Use test tabs in screenshots, not a personal tab list.
6. Explain the `tabs` and `activeTab` permissions. CMT reads tab data locally and does not transmit it or store tab titles and URLs on disk. Keep Mozilla's data declarations accurate. The manifest currently declares `required: ["none"]` for data collection.
7. Read Mozilla's current policies and answer the submission's privacy questions. A privacy policy is required if data is transmitted from the user's device. The current local-only design is described in the README.

## Build and test

Use Node.js 26.10.0 and npm 11.19.1 for the recorded release environment. Install Node from [nodejs.org](https://nodejs.org/). The recorded local environment is macOS ARM64. Firefox is needed for the browser tests, not for the build.

From the repository root:

```sh
npm ci
npm run verify
npm run test:firefox
npm audit
```

Set `FIREFOX_BINARY` for a separate Firefox executable if needed. Do not use a personal Firefox profile for tests. See [TESTING.md](TESTING.md) for the verified Firefox 143.0 setup and remaining manual checks.

The browser test command also runs the package step. To package without browser tests, run:

```sh
npm run package
```

The unsigned extension is `artifacts/cmt.zip`. Its manifest is at the archive root. Do not upload the repository itself as the installable extension.

## Attach the matching source

CMT bundles JavaScript with esbuild. Mozilla requires the original source and reproducible build instructions for bundled code, even when the generated files are readable. A GitHub link alone is not a substitute for the source upload.

Commit the exact release files first. Then create a separate source archive:

```sh
git archive --format=zip --output=artifacts/cmt-source.zip HEAD
```

This includes tracked source, build scripts, the lockfile, and these instructions. It excludes untracked screenshots, `.git`, `node_modules`, and generated files. Check the archive before uploading it. Do not commit credentials or private data before running this command.

Tell the reviewer which commit and environment produced the extension. To rebuild its runtime files from the source archive, extract it, open a terminal in its root, and run:

```sh
npm ci
npm run build
```

The output is `dist/`. Compare those eight runtime files with the unsigned extension ZIP. ZIP timestamps can differ; compare file contents, not whole-ZIP hashes. No private packages, backend services, or runtime libraries are needed. Build tools come from the public npm registry using `package-lock.json`.

Attach matching source for each submitted version.

## Submit to Mozilla

1. Sign in to [the Add-ons Developer Hub](https://addons.mozilla.org/developers/).
2. Select **Submit a New Add-on**.
3. Choose **On your own** or **On this site**.
4. Upload `artifacts/cmt.zip` as the extension.
5. Resolve validation errors. Review warnings before proceeding.
6. Upload `artifacts/cmt-source.zip` as the source package.
7. Supply the build instructions, permission explanations, and test steps in the reviewer notes.
8. Complete the listing and license details if you chose a public listing.
9. Submit the version and respond to any reviewer requests.

Mozilla runs automated checks and can also perform manual review. Timing varies. Passing this project's linter does not guarantee Mozilla acceptance. Nothing in this repository has submitted the extension, accepted terms, or created a developer account for you.

## Install the signed extension

For a public AMO listing, open the add-on page and select **Add to Firefox**.

For an unlisted extension:

1. Download the signed `.xpi` from the version page in the Developer Hub.
2. Open `about:addons` in Firefox.
3. Open the gear menu.
4. Select **Install Add-on From File…**.
5. Choose the signed `.xpi` and review the permission prompt.

Install Mozilla's signed file, not the original unsigned ZIP. The signed installation survives browser restarts. It does not require `about:debugging` or disabling Firefox's signature checks.

If Firefox's native file picker still fails, signing does not repair it. A public AMO listing provides a browser-based **Add to Firefox** path without a local file picker.

Test the signed build in a fresh profile before using it for a large cleanup. For later versions, keep the ID, increase the version, and repeat signing. Do not change the add-on ID to ship an update.

## Official references

Checked on 2026-10-15:

- [Signing and distribution overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
- [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/)
- [Add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)
