# Freznel terminal system monitor

A Node.js terminal application inspired by the supplied system-monitor reference. Built with vanilla JavaScript classes, Blessed for terminal widgets, and systeminformation for OS data. Firebase Authentication handles email/password signup and login through its REST API. There is no browser server or hosted web URL.

## Run

Use Node.js 22 or newer in Windows Terminal, PowerShell, macOS Terminal or a Linux terminal.

```sh
npm install
npm run preview
```

Preview displays **real local system data** and is visibly labelled LOCAL PREVIEW. It explicitly skips authentication for UI development. Normal `npm start` always opens the Firebase account screen.

## Firebase setup

1. Create a project in the Firebase console.
2. Open Authentication > Sign-in method and enable Email/Password.
3. Find the project's Web API Key in Project settings (register a web app if needed).
4. Copy `.env.example` to `.env` and set `FIREBASE_API_KEY`.
5. Run `npm start`, enter your email and password, then choose Create account. Existing accounts can choose Sign in.

PowerShell copy command: `Copy-Item .env.example .env`

Tab / Shift+Tab navigates the form. Enter activates the focused button. Password input is masked. Credentials and authentication tokens are never written to disk; closing the app ends the local session. Firebase needs internet access. No service-account key, Firestore database, or deployed Firebase server is required. System metrics remain local and are never uploaded to Firebase.

## Keyboard controls

| Key | Action |
| --- | --- |
| Up / Down or j / k | Select process |
| PageUp / PageDown | Scroll process list |
| / | Search processes by name, PID or user |
| Esc | Clear filter or dismiss dialog |
| s | Cycle CPU, memory, PID and name sorting |
| c | Page through CPU core meters |
| v | Cycle process, process-tree and services views |
| r | Reverse sorting |
| Space | Pause/resume sampling |
| Enter | View selected process details |
| + / - | Increase/decrease polling delay |
| ? or h | Keyboard help |
| q or Ctrl+C | Exit |

The layout rearranges below 100 columns. Minimum size is 60 columns by 20 rows; 120 by 35 or larger is recommended for the reference-style layout. Panels show multicolor CPU history and paged core meters, temperature and battery, memory/swap, disks, mirrored download/upload history, and processes. Command, threads and user columns appear when the process panel has at least 60 usable columns. Graphs fill from the right as real samples arrive. Processes retain selection by PID across updates.

## Verification

```sh
npm test
npm run check
```

`check` prints one real OS sample without needing an interactive terminal. Tests cover sorting/filtering, formatting, Firebase success/error handling and partial system-probe failures. Manually verify keyboard navigation, resizing, pause/resume, process details and Firebase signup/login in a real terminal.

## Structure

- `src/index.js`: entry point and diagnostic mode.
- `src/components/TerminalApp.js`: terminal screens, keyboard input and responsive panels.
- `src/api/SystemService.js`: bounded asynchronous OS sampling with partial-failure handling.
- `src/api/WindowsProcessDetails.js`: cached Windows thread counts and non-admin session-based user labels.
- `src/auth/FirebaseAuth.js`: Firebase signup/signin, validation and safe errors.
- `src/models/ProcessStore.js`: filtering and sorting without mutating raw samples.
- `src/utils/format.js`: terminal-safe text and metric formatting.
- `test/`: Node built-in test runner suites.

Other empty folders/configuration files came from the supplied template and are not used by this terminal application. No Vite or TypeScript build is required.

## Platform limits

Hardware sensor availability depends on the OS, drivers and permissions. Unsupported temperature, GPU or battery readings display N/A. Failed or slow probes retain prior data with an unavailable/stale notice. A collection cycle finishes before the next starts, so actual refresh time includes collection time. Disks/interfaces that exceed panel height are clipped. The services view identifies Windows service-host processes from the process snapshot; it does not query or modify the Service Control Manager. The app does not terminate processes or modify services.

On Windows, exact process-owner APIs require elevation. Without administrator rights, interactive-session processes are labelled with the signed-in Windows user and session-zero processes as `NT AUTHORITY\SYSTEM` or `NT AUTHORITY\SERVICE`. Thread counts come directly from `Win32_Process`.

## References

- [Blessed terminal UI](https://github.com/chjj/blessed)
- [systeminformation documentation](https://systeminformation.io/)
- [Firebase Authentication REST API](https://firebase.google.com/docs/reference/rest/auth)
