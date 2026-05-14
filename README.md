# xAPI LMS Tester

A desktop Electron app for testing interactive LMS content (Articulate Storyline xAPI packages) locally. It replaces the [Articulate LRS Launch Test page](https://cdn.articulate.com/assets/kb/sl360/LRS-Launch-Test.html) and an external LRS with a self-contained tool:

- Drag and drop a Storyline `.zip` and the app extracts it.
- An embedded HTTP server serves the unpacked course and acts as an xAPI 1.0.3 LRS.
- The course is launched in an in-app iframe using Articulate-style query parameters (`endpoint`, `auth`, `actor`, `activity_id`, `registration`).
- Every xAPI statement the course emits is captured and shown live in a side panel, alongside a raw HTTP request log for debugging.

## Quick start

```bash
npm install
npm run dev
```

This starts the renderer with Vite HMR and launches Electron. The embedded LRS picks a free port in the `7000-7999` range and prints it in the title bar.

To build a packaged desktop app:

```bash
npm run package        # current platform
npm run package:mac    # mac dmg
```

## Using the app

1. Drop a Storyline xAPI zip into the main pane (or click **Browse for zip…**).
2. The package is extracted to a temp directory and served at `http://localhost:<port>/content/<id>/`.
3. The course iframe loads with a generated launch URL. Click **▸ Launch parameters** in the toolbar to inspect or edit `endpoint`, `auth`, `actor`, `activity_id`, and `registration`. Hit **Relaunch** to re-open the iframe with the new values.
4. The right pane shows two tabs:
   - **xAPI Statements** — every statement posted to `/xapi/statements`, expandable to its full JSON.
   - **HTTP Log** — raw HTTP request/response log for the LRS (method, status, latency, headers, body snippets).
5. **Open in browser** opens the same launch URL in the system browser, useful for testing the course outside of Electron.
6. **Clear log** wipes the statement and HTTP buffers in-memory.
7. **Unload** removes the current package and returns to the dropzone.

## What gets served

- `GET /content/<pkgId>/*` — static files of the extracted zip.
- `GET /xapi/about` — `{ version: ["1.0.3"] }`.
- `GET|POST|PUT /xapi/statements` — Statement Resource. POST/PUT append to the in-memory store and broadcast to the UI.
- `GET|PUT|POST|DELETE /xapi/activities/state` — State Resource (in-memory, keyed by activity + agent + registration + stateId).
- `GET|PUT|POST|DELETE /xapi/activities/profile` and `/xapi/agents/profile` — Profile Resources.
- `GET /xapi/activities` and `GET /xapi/agents` — minimal stubs.

CORS is permissive and the `X-Experience-API-Version: 1.0.3` header is set on every response.

## Architecture

```
+---------------------+        IPC          +-----------------------+
|  Renderer (React)   | <----------------> |  Electron Main        |
|                     |                     |  ├─ Express server    |
|  - Dropzone         |   iframe HTTP       |  ├─ xAPI router       |
|  - Toolbar          | <-----------------> |  ├─ /content static   |
|  - Content iframe   |                     |  └─ In-memory Store   |
|  - Statement list   | <---- IPC events ---|     (EventEmitter)    |
|  - HTTP log         |                     +-----------------------+
+---------------------+
```

The course inside the iframe POSTs xAPI statements to the local `/xapi/statements` endpoint. The store emits an event for each statement, the main process forwards it over IPC, and the renderer prepends it to the live statement list.

## Out of scope

By design, this build focuses on xAPI debugging. The following are intentionally not implemented:

- **SCORM 1.2 / 2004** — no in-page JS API shim. xAPI / Tin Can content only.
- **Persistence** — statements, state, profiles, and uploaded packages are all in-memory and wiped when the app quits. Temp extraction folders are removed on quit.
- **Multi-learner sessions** — one actor/registration at a time, editable from the toolbar.
- **Statement querying filters** beyond a simple client-side search and the optional `statementId` lookup.

## Project layout

```
electron/
  main.ts             # Electron lifecycle, IPC, server bootstrap
  preload.ts          # contextBridge -> window.lms
  shared/types.ts     # Types and IPC channel constants
  server/
    index.ts          # Express app, CORS, logging, port allocation
    xapi.ts           # xAPI 1.0.3 LRS router
    content.ts        # Zip extraction + static content router
    store.ts          # In-memory EventEmitter-backed store
renderer/
  index.html
  src/
    App.tsx
    main.tsx
    styles.css
    lib/ipc.ts
    components/
      UploadDropzone.tsx
      LaunchToolbar.tsx
      ContentFrame.tsx
      StatementList.tsx
      HttpLog.tsx
electron.vite.config.ts
tsconfig.json / tsconfig.node.json / tsconfig.web.json
package.json
```
