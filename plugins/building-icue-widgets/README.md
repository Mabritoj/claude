# building-icue-widgets

Scaffold, build, debug, and package Corsair iCUE / Xeneon Edge widgets
(QtWebEngine sandbox).

## What's in here

One skill, `skills/building-icue-widgets/`, covering:

- Scaffolding a new widget from `templates/` (HTML/JS/CSS, manifest,
  resources, and an optional localhost bridge server)
- The `x-icue-property` / property-global collision gotcha, strict
  HTML parsing requirements, and widget lifecycle quirks
- The localhost bridge pattern for secrets, local files, or non-CORS APIs
- Debugging blank or failed-to-import widgets

See `skills/building-icue-widgets/SKILL.md` for the entry point and
its reference files.
