# iCUE Widget Reference

## manifest.json

Required fields for Xeneon Edge widgets:

```json
{
  "author": "Your Name",
  "id": "com.you.appname",
  "name": "Display Name",
  "description": "Short description",
  "version": "1.0.0",
  "preview_icon": "resources/icon.svg",
  "min_app_version": "5.47",
  "min_framework_version": "1.0.0",
  "os": [{ "platform": "windows" }],
  "supported_devices": [{ "type": "dashboard_lcd" }],
  "interactive": false
}
```

- `id` must be globally unique (reverse-DNS).
- Bump `version` on every release so you can confirm iCUE loaded the new build.

## User-configurable properties

Declare in `index.html`:

```html
<meta
  name="x-icue-property"
  content="bridgePort"
  data-label="tr('Bridge Port')"
  data-type="textfield"
  data-default="'37650'"
>
<meta
  name="x-icue-property"
  content="accentColor"
  data-label="tr('Accent Color')"
  data-type="color"
  data-default="'#D97757'"
>
```

Property types: `textfield`, `color`, `checkbox`, `dropdown`.

Group them for the iCUE settings panel:

```html
<script type="application/json" id="x-icue-groups">
  [
    { "title": "tr('Connection')", "properties": ["bridgePort", "pollSeconds"] },
    { "title": "tr('Appearance')", "properties": ["accentColor", "textColor", "backgroundColor"] }
  ]
</script>
```

Every `tr('...')` key must exist in `translation.json`:

```json
{
  "en": {
    "translation": {
      "Bridge Port": "Bridge Port",
      "Accent Color": "Accent Color"
    }
  }
}
```

**Critical:** iCUE injects each property `content` value as a global JS variable. Never declare functions or variables with the same name. Always read via `prop("bridgePort")` and name accessors `getBridgePort()`.

## Lifecycle hooks

In `index.html`:

```html
<script>
  window.icueEvents = {
    onICUEInitialized: function () {
      if (window.MyWidget) window.MyWidget.start();
    },
    onDataUpdated: function () {
      if (window.MyWidget) window.MyWidget.onDataUpdated();
    },
  };
</script>
<script src="scripts/widget.js"></script>
```

In `widget.js`:

```javascript
function start() {
  if (state.started) return;
  state.started = true;
  applyTheme();
  observeResize();
  poll();
  startPolling();
}

function onDataUpdated() {
  applyTheme();
  poll();
  startPolling(); // restart interval if pollSeconds changed
}

window.MyWidget = { start: start, onDataUpdated: onDataUpdated };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
```

Do not wait for `iCUE_initialized` or `onICUEInitialized` before first render.

## Responsive sizing (fitFont)

Pattern used on Xeneon Edge tiles:

1. Express all sizes in `rem` (padding, gaps, font sizes, bar heights).
2. Set a fallback on `html { font-size: 15px; }` for first paint.
3. At runtime, adjust root font size to fit the tile:

```javascript
var FONT_MIN_PX = 10;
var FONT_MAX_PX = 20;

function fitFont() {
  var widget = document.getElementById("widget");
  if (!widget) return;
  var rootStyle = document.documentElement.style;
  var widthCap = Math.max(FONT_MIN_PX, widget.clientWidth / 26);
  var size = Math.min(FONT_MAX_PX, widthCap);
  rootStyle.fontSize = size + "px";
  while (size > FONT_MIN_PX && widget.scrollHeight > widget.clientHeight + 1) {
    size -= 0.5;
    rootStyle.fontSize = size + "px";
  }
}

function observeResize() {
  var widget = document.getElementById("widget");
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(fitFont).observe(widget);
  } else {
    window.addEventListener("resize", fitFont);
  }
  fitFont();
}
```

Call `fitFont()` after rendering dynamic content (row count changes).

## Polling pattern

Separate widget poll interval from bridge cache TTL:

- Widget: user-configurable `pollSeconds` (e.g. 10–3600s), restart timer in `onDataUpdated`.
- Bridge: fixed cache (e.g. 60s) to avoid hammering upstream APIs.

```javascript
function getPollMs() {
  var n = parseInt(String(prop("pollSeconds")).replace(/[^0-9]/g, ""), 10);
  if (isNaN(n)) n = 60;
  return Math.max(10, Math.min(3600, n)) * 1000;
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(poll, getPollMs());
}
```

Use `AbortController` + timeout on fetch (8s is reasonable).

## Packaging and deployment

```powershell
icuewidget validate widget    # catches many issues; NOT as strict as iCUE importer
icuewidget package widget     # produces .icuewidget zip
```

Import: iCUE Widgets panel → `+` → select file, or double-click `.icuewidget`.

### iCUE cache trap

iCUE stores deployed widget code internally. Editing source and re-packaging is not enough if iCUE still serves the old copy.

**Full reload procedure:**

1. Quit iCUE completely (system tray → Exit).
2. Remove the widget instance from the Xeneon Edge layout.
3. Remove the widget definition from the Widgets panel.
4. Re-import the fresh `.icuewidget`.
5. Re-add to the Edge at desired tile size.
6. Confirm via a version string or unique debug marker in the UI.

## Debugging

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Import error "Missing title" / corrupted | HTML parser strictness | Uppercase DOCTYPE, no `/>` on void tags |
| Blank widget, no errors in validate | Property/global name collision | Rename JS identifiers; use `getX()` |
| Blank widget, stale behavior | iCUE cache | Full quit + re-import |
| "Bridge offline" message | Bridge not running | Start bridge; check port |
| Data stale but widget works | Bridge cache or upstream | Expected; check bridge TTL |

Log location (Windows): `%LOCALAPPDATA%\Corsair\Logs\CUE5\`

Search for: `js:`, `Uncaught`, `SyntaxError`, widget id.

`console.error("debug:", ...)` in widget JS appears in CUE5 logs.

## icuewidget CLI

Install globally: `npm install -g @icue/icuewidget-cli`

Commands:

- `icuewidget create <name>` — scaffold (still customize for strict HTML rules)
- `icuewidget validate <dir>` — pre-flight checks
- `icuewidget package <dir>` — build `.icuewidget`

Docs: https://docs.elgato.com/icue/widgets/
