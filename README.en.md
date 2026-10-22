# Tickwave — Free Timing Diagram Editor & Waveform Drawing Tool (Browser / macOS / Windows)

[日本語](README.md) | **English**

[![Open in browser](https://img.shields.io/badge/Open%20in%20browser-GitHub%20Pages-2ea44f)](https://oud0n.github.io/timing_diagram/)
[![Latest release](https://img.shields.io/github/v/release/oud0n/timing_diagram?label=download)](https://github.com/oud0n/timing_diagram/releases/latest)
![License](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-orange)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-oud0n-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/oud0n)

**Tickwave** is a free, interactive **timing diagram editor** for digital circuit, FPGA and embedded software design. Draw clock, binary and bus **waveforms** with clicks and drags, add markers and timing constraints between signals (setup / hold times and so on), and export the result as **SVG**. Use it to draw datasheet-style timing charts for SPI, I2C, UART and other interfaces — right in your browser, with nothing to install.

- **Browser version (no install):** https://oud0n.github.io/timing_diagram/
- **Desktop app (macOS / Windows):** download from [Releases](https://github.com/oud0n/timing_diagram/releases/latest)

![Tickwave timing diagram editor showing clock, data and bus waveforms (light theme)](./doc/images/editor-light.jpg)

| Editing an expanded bus | Dark theme | Unsaved changes prompt |
| --- | --- | --- |
| ![Editing a cell of an expanded bus](./doc/images/bus-edit.jpg) | ![Dark theme](./doc/images/editor-dark.jpg) | ![Save, discard or cancel prompt on quit](./doc/images/unsaved-prompt.jpg) |

The screenshots were taken during hands-on testing on 2026-10-18, using the macOS app installed from the DMG.

> **The app has only been tested on macOS (27.0.1 / Apple Silicon).** For Windows, only a successful build on GitHub Actions has been confirmed; it has not been run on real Windows or Linux machines.

Built with React 19 + TypeScript + Vite, with a Tauri 2 desktop app.

## Features

- Add, delete and reorder signals; set waveform strings, colors and line widths
- Click a Binary cell to toggle it, cycle bus and other cells through `0 → 1 → = → z → x`, drag to paint, and type `0` / `1` on the selected cell
- Set `0` / `1` / `z` / `x` / `=` with the Segment Painter; edits resolve continuation notation and keep the values of the following cells
- Generate clocks from period, duty cycle and phase; use Convert clock to Binary to edit a clock directly
- Double-click a bus cell to edit its label; Enter confirms, Escape cancels
- The timeline extends automatically when a waveform string runs past the end; `+100 cycles` adds cycles and `Go to end` jumps to the end
- Edit bus values, display format and bit width; expand buses into bits
- Markers, timing constraints between signals, repeat detection and ranges, and time folds
- Dark / light theme
- Undo / Redo buttons and `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z`
- Copy JSON to the clipboard and load pasted JSON
- New / Open / Save / Save As, with save, discard or cancel prompts for unsaved changes
- Desktop menus and `Ctrl/Cmd+S`, `Ctrl/Cmd+Shift+S`, `Ctrl/Cmd+O`, `Ctrl/Cmd+E`
- Copy or download standalone SVG files

Changes to signals, settings, markers, constraints, repeats and folds share one history. Edits in an input field become one history entry when the field loses focus. Shortcuts inside input fields keep their normal text-editing behavior. The theme and the selected cell are not part of the diagram history.

Deleting a signal also deletes the constraints that refer to it. Reducing the number of cycles truncates waveforms and bus values and fits markers, constraints and ranges into the new timeline. All of this can be undone.

The initial 140 ns end comes from the default of 14 cycles × 10 ns. You can also extend the timeline with Total Cycles in Settings. Up to 100,000 cycles (1 ms at 10 ns steps) are supported. The limit reflects SVG width and memory use; it is not unlimited. Long diagrams thin out the tick labels and omit minor ticks. SVG export covers the whole timeline, not just the visible part.

## Download

Download the installers from [Releases](https://github.com/oud0n/timing_diagram/releases/latest).

- macOS (Apple Silicon only): `Tickwave_<version>_aarch64.dmg`
- Windows: `Tickwave_<version>_x64-setup.exe` or `Tickwave_<version>_x64_en-US.msi`

## If macOS says the app "is damaged and can't be opened"

The macOS build is for Apple Silicon (arm64) only. It does not run on Intel Macs.

When you start the app from a DMG downloaded with a browser, macOS may show "“Tickwave” is damaged and can't be opened. You should move it to the Trash."

**Cause:** This is a personal project, so the app has no Developer ID signature or notarization from the paid Apple Developer Program. macOS Gatekeeper marks downloaded files with a quarantine attribute (`com.apple.quarantine`) and blocks apps that are not notarized. The file is not actually damaged.

**Fix:**

1. Copy `Tickwave.app` from the DMG to your Applications folder (`/Applications`).
2. Run this command in Terminal:

```bash
xattr -cr "/Applications/Tickwave.app"
```

- `xattr`: the standard macOS command for viewing and changing extended file attributes.
- `-c`: removes all extended attributes. Removing the quarantine attribute (`com.apple.quarantine`) added at download lifts the Gatekeeper block.
- `-r`: applies it recursively to every file inside the app bundle (.app).

**If it still does not open:** depending on your macOS security policy, the app may still be blocked because of how it is signed. In that case, ad-hoc sign it again on your Mac:

```bash
codesign --force --deep --sign - "/Applications/Tickwave.app"
```

- `--force`: replaces the existing signature.
- `--deep`: signs all code inside the bundle recursively.
- `--sign -`: uses an ad-hoc signature (`-`) instead of a Developer ID, which allows the app to run locally on this Mac.

Then double-click the app as usual, or Control-click it and choose "Open".

## JSON format and unsaved state

Exports use the current SVG editor format with `formatVersion: 1`. A file has the required `config`, `signals`, `markers` and `constraints`, and the optional `repeatRanges` and `folds`. Omitted optional lists are normalized to empty arrays.

Unversioned JSON in the current format can still be loaded. The old Electron format is not supported. Unknown versions, invalid values, duplicate IDs and references to missing signals are rejected, and the current diagram is kept. Colors are `#RGB` or `#RRGGBB`; waveform notation is `0 1 z x = . ~ - h l` (upper case also accepted).

The unsaved indicator compares the diagram with the one at startup, at load, or at the last successful save in the desktop app. Undoing back to the same diagram clears it. Copy JSON and SVG export do not change the saved state. The desktop app saves by replacing the file from a temporary file in the same directory. JSON files are limited to 16 MiB. In the browser version, Save is a download and does not mark the diagram as saved. There is no autosave.

## Support the developer (Buy Me a Coffee)

**Tickwave** is a personal project developed in spare time (free and open source). If it helps you, a coffee (from $3) goes a long way toward new editing features, fixes, and keeping the macOS app and the GitHub Pages version maintained ☕

👉 **[Support oud0n on Buy Me a Coffee](https://buymeacoffee.com/oud0n)**

In the app, the "Support" button in the header, or Help → Support the Developer (Buy Me a Coffee)… in the desktop menu, opens a support dialog with a QR code. The desktop app opens links in the default browser (only the support page and the GitHub repository are allowed).

## Build from source

Requires Node.js 24 or later and npm.

```sh
npm ci
npm run dev
```

Open the local URL that is printed.

```sh
npm test          # regression tests for JSON, history, repeat detection, SVG and UI operations
npm run lint     # TypeScript type check
npm run build    # type check and production build (dist/)
npm run preview  # preview the built web app
```

Pushing to `main` runs `.github/workflows/pages.yml`, which tests, builds and deploys `dist/` to GitHub Pages. The build uses relative paths (Vite `base: './'`), so the same output works under the repository subpath and in the desktop app. The repository's Settings → Pages Source is set to "GitHub Actions". In the browser version, Save downloads a file and Open uses a file picker. Only the Pages build loads the GoatCounter script to count visits (it is added only when the workflow sets `GOATCOUNTER_URL`); the desktop app and local builds do not include it.

The desktop app also needs Rust / Cargo and each OS's native toolchain.

```sh
npm run desktop:dev    # run Tauri + Vite in development
npm run desktop:build  # build the distribution packages
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

On macOS the outputs are `src-tauri/target/release/bundle/macos/Tickwave.app` and `src-tauri/target/release/bundle/dmg/`. GitHub Actions tests and builds the web app on every push to any branch, and builds the macOS / Windows packages when run manually or on a version tag. Windows counts as verified by this successful build; testing on real Windows machines is out of scope.

Pushing a tag such as `v1.0.0` publishes a GitHub Release with the macOS `.dmg` and the Windows `.exe` / `.msi` attached. The tag must match the `version` in `package.json` (otherwise the build stops). Tags with a hyphen, such as `v1.1.0-rc.1`, are published as pre-releases. Outputs of manual runs stay in the Actions artifacts.

```sh
git tag v1.0.0
git push origin v1.0.0
```

The macOS app bundle is ad-hoc signed as a whole. It has no Developer ID signature or notarization, so Gatekeeper asks for confirmation when it is opened on another Mac.

## Project structure

- `src/App.tsx`: wiring between the screen and operations
- `src/components/WaveformCanvas.tsx`: SVG waveform rendering
- `src/components/`: editors for signals, markers, constraints and repeats
- `src/document.ts`: JSON validation, normalization and export
- `src/history.ts` / `src/hooks/useDiagramHistory.ts`: edit history and saved state
- `src/svgExport.ts`: SVG style embedding and export
- `src/waveformEditing.ts`: cell editing that keeps continuation notation, and clock conversion
- `src/fileGateway.ts` / `src/hooks/useDocumentFiles.ts`: web / native file operations and unsaved-changes prompts
- `src-tauri/`: native menus, file dialogs, saving and packaging settings
- `src/utils.ts`: waveform parsing, fold coordinates and repeat validation
- `tests/`: regression tests

## Testing

The app has only been tested on macOS (macOS 27.0.1 / arm64). On 2026-10-18, the following were confirmed with the release app installed from the DMG into `/Applications`:

- Start, edit, save, reload after restart, and SVG export
- Editing with expanded buses and folds, drag painting while scrolled horizontally and releasing the pointer outside the diagram, and editing after changing the zoom
- Cmd+Z in input fields, layout at the minimum window size (640×480), and keeping the theme after restart
- Error messages that keep the diagram for invalid JSON, unreadable files and read-only folders, and save / discard when quitting with unsaved changes

The app is about 10.39 MiB and the DMG about 2.87 MiB. It takes about 0.4 s from launch until the frontend is ready (5 runs; about 0.5 s on the first). The window is shown only after rendering, so no white screen appears at startup. Windows is confirmed only by a successful build; testing on real Windows or Linux machines is out of scope. The test methods and results are recorded in [TODO.md](./TODO.md) (Japanese).

## License

[PolyForm Noncommercial License 1.0.0](LICENSE) (Copyright 2025-2026 oud0n)

- **Free for noncommercial use**: personal use (hobby, learning, research and other uses with no commercial purpose) and use by nonprofits, educational institutions, public research organizations and government bodies are free, including modification and redistribution. When you redistribute it, include `LICENSE` (or the license URL) and the `Required Notice:` line.
- **Commercial use needs prior permission**: for use at work, inclusion in paid products or services, or sale, contact [caliber.trivia66@icloud.com](mailto:caliber.trivia66@icloud.com).
- **When you publish or distribute a modified version**, please make its origin clear:
  - State in a place users will see, such as the README, that it is based on this software ([oud0n/timing_diagram](https://github.com/oud0n/timing_diagram)) and that you changed it
  - Give the modified version a different name, and do not use names or wording that suggest it is the official or an endorsed version
