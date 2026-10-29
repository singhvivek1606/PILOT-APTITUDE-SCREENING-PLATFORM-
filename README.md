# AeroVector — Windows and macOS Electron Desktop Project

**Version 2.3 · Source project for Aviation Pilot Aptitude Hackathon Brief v2.0**

AeroVector is a **desktop application** made with Electron, HTML, CSS, and JavaScript. The **same source code** runs on Windows and on Apple **Mac** computers. This download contains the source code, not an already compiled Windows `.exe` or macOS `.dmg`.

> **Hackathon requirement:** The supplied assignment specifically requires a **working Windows native executable/installer**. macOS support is an additional convenience for teammates; it does **not** replace submitting or demonstrating the Windows build.

## 1. Requirements

- A Windows PC (Windows 10/11) **or an Apple Mac** (macOS, Intel x64 or Apple Silicon M-series arm64).
- Node.js LTS and npm (`node -v`, `npm -v` in Terminal).
- Internet connection only for the first dependency installation, and to download build dependencies.
- VS Code is optional. Any terminal works.

## 2. Running on a Mac (Apple laptop/desktop)

1. Download and **extract** the project ZIP fully.
2. Open **Terminal** and move into the extracted project folder containing `package.json`. Example: `cd ~/Downloads/AeroVector_Electron_Windows_Mac_Ready` (adjust if the extracted folder is elsewhere).
3. Run the following commands:

   ```bash
   npm install
   npm start
   ```

AeroVector opens as a desktop window; it is **not** a Safari/Chrome browser tab. `npm start` runs a development build; it does **not** require an Apple Developer account or a compiled installer.

**Alternative:** On macOS, double-click `RUN_ELECTRON_MAC.command` to install dependencies (if needed) and start the app. If the downloaded file isn't executable, open Terminal in the project folder and run `chmod +x RUN_ELECTRON_MAC.command BUILD_MAC_APP.command`, or simply use `npm install` / `npm start` above.

### Creating a Mac application installer (`.dmg`)

On the **Mac** itself, run:

```bash
npm run dist:mac
```

This builds `.dmg` and `.zip` outputs for the current Mac CPU architecture in `dist/`. Or run `BUILD_MAC_APP.command`.

**Other build options (run on a Mac):**

```bash
npm run dist:mac:arm64      # M1 / M2 / M3 / M4 / later Apple Silicon (arm64)
npm run dist:mac:x64        # Intel Mac
npm run dist:mac:universal  # Both architectures in one Mac binary (larger)
```

A `.dmg` is a macOS installer disk image (not a Windows `.exe`). **The ZIP does not include a prebuilt `.dmg`.** The project includes a macOS `.icns` app icon and app menu/Dock support.

**Signing note:** The Mac build configuration is **unsigned and unnotarized** for local hackathon testing. macOS Gatekeeper may warn or block an app distributed to a different Mac. For sharing more widely, sign and notarize the Mac build with an Apple Developer ID; do not assume unsigned builds will open with no warnings. No signing is needed to run with `npm start` during development.

## 3. Running on Windows (unchanged)

Extract the project. Open VS Code in the extracted folder, open Terminal, then:

```powershell
npm install
npm start
```

Or double-click `RUN_ELECTRON.cmd`.

Build the **required Windows installer** on a Windows computer:

```powershell
npm run dist:win
```

For a portable `.exe` rather than an installer:

```powershell
npm run dist:win:portable
```

The files appear under `dist/` after a successful build. `BUILD_WINDOWS_INSTALLER.cmd` provides a Windows double-click helper. Windows output is unsigned and may show SmartScreen warnings until appropriately signed.

### Checks and pre-commit hook

`npm install` also enables a [Husky](https://typicode.github.io/husky/) pre-commit hook. Every `git commit` runs these steps and is aborted if one fails:

```bash
npm run lint           # ESLint
npm run check:syntax   # node --check on all app scripts
npm test               # smoke tests
npm run build          # electron-builder --dir (unpacked app in dist/, no installer)
```

Run them all manually with `npm run verify`.

## 4. Core features

- Welcome screen and candidate registration before starting assessments.
- Six modules: Memory, Control, Mathematics, Slalom, Orientation, Task Manager.
- In-module Practice or Scored Assessment choices; only scored results save to History.
- Control instrument needle and ball run in **separate stages** (customized design).
- Slalom accelerates and adds hazards during the run.
- Results: score, demo PASS/NEEDS PRACTICE, trends, module averages.
- History: saved completed scored attempts and JSON export.
- Customizable keyboard bindings under Controls.

**Scoring note:** The 60% demo PASS rule is not an official pilot selection standard. The project is a hackathon prototype and not an official COMPASS™ system.

**Local data:** Candidate and scored result records use Electron's local application profile (`localStorage`). Each Windows/Mac user, browser, and Electron installation keeps its **own** data. Records are not synchronized across devices; export JSON from History if needed. A new install/app profile begins with an empty History.

## 5. Folder structure

```text
AeroVector_Electron_Windows_Mac_Ready/
├── index.html
├── css/main.css
├── js/
│   ├── core.js
│   ├── ui.js
│   ├── screens.js
│   ├── assessment.js
│   └── app.js
├── electron/main.cjs
├── assets/
│   ├── aerovector.ico        Windows icon
│   ├── aerovector.icns       macOS icon
│   └── aerovector.png        Dock and UI icon
├── package.json
├── RUN_ELECTRON.cmd
├── BUILD_WINDOWS_INSTALLER.cmd
├── RUN_ELECTRON_MAC.command
├── BUILD_MAC_APP.command
└── README.md
```

## 6. Troubleshooting

- **`npm: command not found`** on Mac: install Node.js LTS; restart Terminal; verify `node -v` and `npm -v`.
- **`electron: command not found`**: run `npm install` in the exact folder containing `package.json`.
- **Mac says it cannot run `.cmd`**: `.cmd` files are Windows-only; use the `.command` files or `npm` commands instead.
- **Mac downloaded file won't open**: extract the ZIP first, then run `npm start` via Terminal rather than trying to open source files as an app.
- **No results or blank history**: complete a **Scored Assessment**, not Practice; results are stored locally per user and device.
- **Electron on one OS doesn't show results from another device**: local storage is not shared automatically.
- **Missing dependency after copy**: do not copy `node_modules` from Windows to Mac; run `npm install` on each computer to get the correct Electron binary.
- **A distributed Mac `.dmg` triggers macOS warnings**: this unsigned sample build is for local testing only. Production distribution requires Apple signing/notarization.

## 7. Hackathon deliverables from the brief

1. Working **Windows executable/installer** (`npm run dist:win` on Windows).
2. Source code repository (this ZIP can be committed to GitHub).
3. README with build instructions and feature list (this document).
4. A 3–5-minute demo video **or** live presentation.

The assignment's original Control reference shows simultaneous tracking, but this implementation intentionally uses sequential needle/ball stages as requested by the project owner. Mention that design change during the demo.
