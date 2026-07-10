# Localhost Bridge Pattern

Use when the widget needs data that the iCUE sandbox cannot reach directly.

## When you need a bridge

| Need | Sandbox allows? | Bridge? |
|------|-----------------|---------|
| Read local files (tokens, config) | No | Yes |
| Call API without CORS headers | No | Yes |
| Call API requiring secret headers/tokens | No (and never put secrets in widget JS) | Yes |
| Call public CORS-enabled REST API | Yes | No |
| Poll localhost HTTP server | Yes | Maybe (bridge can still normalize/cache) |

## Architecture

```
Widget (QtWebEngine)          Bridge (Node on 127.0.0.1)         Upstream
─────────────────────         ──────────────────────────         ────────
fetch("http://127.0.0.1        read secrets from disk             fetch(api)
  :PORT/data")          ───►   add auth headers            ───►   normalize
                               cache response                     return JSON
                        ◄───   CORS * + clean JSON         ◄───
```

The widget never sees tokens or raw upstream responses.

## Bridge responsibilities

1. **Listen on 127.0.0.1 only** — never `0.0.0.0`.
2. **CORS** — `Access-Control-Allow-Origin: *` on all responses (widget origin is opaque).
3. **Endpoints:**
   - `GET /health` — `{ ok: true, service: "...", port: N }` for quick checks
   - `GET /data` (or `/usage`) — normalized JSON the widget renders
4. **Cache** — in-memory TTL (e.g. 60s) so rapid widget polls don't hammer upstream.
5. **Error shape** — always return JSON, even on failure:
   ```json
   { "ok": false, "error": "NO_AUTH", "message": "Sign in required" }
   ```
6. **Stale fallback** — on upstream failure, serve last good cache with `"stale": true`.

## Token / credential handling

- Read credentials from a known path (e.g. `~/.app/.credentials.json`).
- **Never** expose tokens in bridge responses.
- **Atomic writes** when refreshing credentials (temp file + rename):

```javascript
import { writeFile, rename } from "node:fs/promises";
import crypto from "node:crypto";

async function writeAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.tmp.${crypto.randomBytes(6).toString("hex")}`);
  await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(tmp, filePath);
}
```

- **Reactive refresh only:** refresh tokens on 401 from upstream, retry once. Do not poll refresh endpoints on a timer — let the primary app (e.g. Claude Code) handle normal refresh.

## Widget side

```javascript
function poll() {
  var port = String(prop("bridgePort")).replace(/[^0-9]/g, "") || "37650";
  var url = "http://127.0.0.1:" + port + "/data";
  var controller = new AbortController();
  var to = setTimeout(function () { controller.abort(); }, 8000);
  fetch(url, { signal: controller.signal, cache: "no-store" })
    .then(function (res) { return res.json(); })
    .then(function (payload) {
      clearTimeout(to);
      if (payload.ok === false) { showError(payload); return; }
      render(payload);
    })
    .catch(function () {
      clearTimeout(to);
      showError("Bridge offline — start the local service.");
    });
}
```

Widget poll interval and bridge cache TTL are independent:

- Widget `pollSeconds`: how often the tile refreshes (user-configurable, 10–3600s).
- Bridge `CACHE_TTL_MS`: how often upstream is actually called (fixed, e.g. 60s).

## Windows auto-start

Register a hidden Scheduled Task at login:

```powershell
# install-autostart.ps1 pattern
$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "server.mjs" -WorkingDirectory $bridgeDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "MyWidgetBridge" -Action $action -Trigger $trigger -RunLevel Limited
```

Provide matching `uninstall-autostart.ps1`.

## Starter template

Copy `templates/bridge-server.mjs` and `templates/start-bridge.ps1` from this skill. Customize:

- `PORT` (default pick an unused high port, e.g. 37650)
- Upstream fetch logic and normalization
- Credential path and refresh flow
- Cache TTL via `CACHE_TTL_MS` env var

Verify: `curl http://127.0.0.1:PORT/health` and open `/data` in a browser before testing the widget.
