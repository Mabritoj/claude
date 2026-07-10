# Personal Claude Plugin Marketplace — Design

## Purpose

Turn this empty repo into a personal, installable Claude Code plugin
marketplace: a single place to version-control and distribute everything
Jonathan builds for Claude Code — skills, agents, slash commands, hooks,
and MCP server configs. Structured so that:

- `/plugin marketplace add <this repo>` works from any machine.
- Each capability installs independently (`/plugin install <name>`).
- Adding a new plugin later is a copy-paste-fill-in exercise, not a
  from-scratch design decision.

Ground truth for the structure below comes from inspecting Anthropic's
own `claude-plugins-official` marketplace repo (cached locally at
`~/.claude/plugins/marketplaces/claude-plugins-official`), specifically
the `example-plugin`, `hookify`, and `commit-commands` plugins, and the
marketplace's own `marketplace.json`.

## Repo layout

```
claude/                              (repo root)
├── .claude-plugin/
│   └── marketplace.json             # marketplace manifest, lists all plugins
├── plugins/
│   ├── _template/                   # starter scaffold for new plugins
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── skills/example-skill/SKILL.md
│   │   ├── agents/example-agent.md
│   │   ├── commands/example-command.md
│   │   ├── hooks/hooks.json
│   │   ├── .mcp.json
│   │   └── README.md
│   └── <plugin-name>/               # one directory per skill/tool (kebab-case)
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── skills/<skill-name>/SKILL.md
│       ├── agents/<agent-name>.md
│       ├── commands/<command-name>.md
│       ├── hooks/hooks.json
│       ├── .mcp.json                # only if this plugin bundles an MCP server
│       └── README.md
├── README.md
└── .gitignore
```

Each plugin includes only the subfolders it actually needs — a
pure-skill plugin has just `skills/`; a hooks-only plugin has just
`hooks/`. `_template` is excluded from `marketplace.json` (it is not a
real installable plugin, just a copy source).

## Granularity

One plugin per skill (or per tightly-related capability), matching how
`claude-plugins-official` organizes third-party plugins. This allows
independent install/enable per capability rather than all-or-nothing.

## `marketplace.json`

Plugins that live in this same repo are registered with a relative
path source (no git-subdir needed):

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "jonathan-plugins",
  "owner": { "name": "Jonathan Mabrito" },
  "plugins": [
    {
      "name": "my-skill-name",
      "description": "One-line description of what this plugin does.",
      "source": "./plugins/my-skill-name"
    }
  ]
}
```

This is the exact pattern `claude-plugins-official` uses for its own
in-repo plugins (e.g. `hookify` is registered as
`"source": "./plugins/hookify"`).

## `plugin.json` (per plugin)

Minimal required manifest, e.g.:

```json
{
  "name": "my-skill-name",
  "description": "One-line description of what this plugin does.",
  "version": "0.1.0",
  "author": { "name": "Jonathan Mabrito" }
}
```

## Adding a new plugin (workflow)

1. Copy `plugins/_template/` to `plugins/<new-name>/`.
2. Fill in `.claude-plugin/plugin.json` and delete any content-type
   folders (`skills/`, `agents/`, `commands/`, `hooks/`, `.mcp.json`)
   that don't apply.
3. Add one entry to `.claude-plugin/marketplace.json`.
4. Commit.

## Documentation

- **Root `README.md`**: what the repo is, how to install it as a
  marketplace, and the "adding a new plugin" workflow above.
- **`.gitignore`**: OS cruft (`.DS_Store`, `Thumbs.db`) plus
  `*.local.md` / `*.local.json` for personal/local-only overrides
  (matches the `.local.md` convention used by `hookify` for
  rules/config that shouldn't be committed).

## Validation

After scaffolding, run `/plugin marketplace add <local repo path>`
against the real repo to confirm Claude Code parses `marketplace.json`
and loads the template plugin without errors — not just that the JSON
is well-formed, but that Claude Code actually accepts it.

## Out of scope (follow-up work)

Migrating Jonathan's existing skills/plugins (currently scattered
across other machines/drafts) into this structure. That happens after
the scaffold is validated, one skill at a time, once each one is
identified.
