---
name: building-icue-widgets
description: >-
  Scaffold, build, debug, and package Corsair iCUE / Xeneon Edge widgets
  (QtWebEngine sandbox). Use when creating an iCUE widget, editing
  manifest.json or x-icue-property, wiring a widget to a local data source,
  adding a localhost bridge, or diagnosing a blank or failed-to-import widget.
---

# Building iCUE Widgets

## Quick start — scaffold a new project

1. Copy templates from this skill into a new repo (preserve folder structure):
   - `templates/` → `widget/` (index.html, scripts/, styles/, translation.json, manifest.json, resources/)
   - If the widget needs secrets, local files, or non-CORS APIs: also copy `templates/bridge-server.mjs`, `start-bridge.ps1` → `bridge/`
2. **Copy the guardrail rule** into the repo:
   - `templates/icue-widget.mdc` → `.cursor/rules/icue-widget.mdc`
3. Customize manifest (`id`, `name`, `description`), properties, and data logic.
4. Validate and package:
   ```powershell
   npm install -g @icue/icuewidget-cli
   icuewidget validate widget
   icuewidget package widget
   ```
5. Import the `.icuewidget` in iCUE; enable on Xeneon Edge at desired tile size.

## Architecture

```
[Local secrets/files] ─► bridge (Node, 127.0.0.1) ─► upstream API
                              │
                              └─► http://127.0.0.1:PORT/data ─► iCUE widget ─► Xeneon Edge
```

Widgets run in a sandboxed QtWebEngine. They **cannot** read local files or call APIs without CORS. `fetch("http://127.0.0.1:PORT")` works. See [bridge-pattern.md](bridge-pattern.md) when a bridge is needed.

## Non-negotiables (top gotchas)

### 1. Property-name / global collision → blank widget

Every `<meta name="x-icue-property" content="foo">` is injected as a global `var foo`. A `function foo()` or `var foo` in JS is a redeclaration `SyntaxError` that kills the entire script.

```javascript
// BAD — pollSeconds is a property name
function pollSeconds() { ... }

// GOOD
function getPollSeconds() {
  return parseInt(prop("pollSeconds"), 10) || 60;
}
function prop(name) {
  return (typeof window[name] !== "undefined" && window[name] !== "")
    ? window[name] : DEFAULTS[name];
}
```

### 2. Strict HTML parser → import failure

iCUE's importer is stricter than `icuewidget validate`. Required:

- `<!DOCTYPE html>` (uppercase)
- NO self-closing void tags: `<meta ...>` not `<meta ... />`
- A real `<title>` element
- `<meta name="viewport" content="width=device-width, initial-scale=1.0">`

### 3. Unreliable lifecycle → blank widget

`iCUE_initialized` is `false` at load; `onICUEInitialized` may fire late. Never gate rendering on it.

- Make `start()` idempotent (`if (state.started) return`)
- Call `start()` on `DOMContentLoaded` unconditionally
- Use `window.icueEvents.onDataUpdated` only to re-theme / re-poll after property changes

### 4. Responsive sizing

Tiles resize (small / medium / large). Use `rem` units + JS `fitFont()` that adjusts `document.documentElement.style.fontSize` with `ResizeObserver`. Avoid `vh`/`vw` clamps — illegible on small tiles.

### 5. Deploy cache trap

iCUE caches widget code under `%APPDATA%\Corsair\CUE5\`. Re-import may run stale code.

**Reliable reload:** quit iCUE fully (tray) → remove widget instance + definition → re-import fresh `.icuewidget`. Bump a version string in the widget to confirm the new build loaded.

## Build checklist

```
- [ ] manifest.json: unique id, min_app_version 5.47+, supported_devices dashboard_lcd
- [ ] index.html: DOCTYPE, no self-closing tags, title, x-icue-property meta tags, x-icue-groups
- [ ] translation.json: all tr('...') keys present
- [ ] widget.js: prop()/getX() pattern, idempotent start(), no property-name collisions
- [ ] style.css: rem-based sizing, html { font-size } fallback
- [ ] .cursor/rules/icue-widget.mdc copied from template
- [ ] icuewidget validate widget && icuewidget package widget
- [ ] Full iCUE restart + re-import to test
```

## Debugging blank or broken widgets

1. Check CUE5 logs: `%LOCALAPPDATA%\Corsair\Logs\CUE5\*.log` — search for `js:` or `Uncaught`.
2. `console.error(...)` in widget JS is forwarded to those logs.
3. `node --check widget/scripts/widget.js` catches plain syntax errors but **not** property-global collisions (those only fail inside iCUE).
4. If logs show old debug strings, you are running a cached build — full re-import required.

## Additional resources

- Property model, lifecycle, sizing, packaging: [reference.md](reference.md)
- Localhost bridge pattern: [bridge-pattern.md](bridge-pattern.md)
- Starter files: `templates/` directory in this skill
