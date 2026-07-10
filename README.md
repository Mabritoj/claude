# ironbear-plugins

Claude Code plugin marketplace: skills, agents, slash
commands, hooks, and MCP server configs, each packaged as its own
installable plugin.

## Install

Add this repo as a marketplace once, then install whichever plugins you want:

```bash
claude plugin marketplace add https://github.com/Mabritoj/claude
```

Then run the install command for whichever plugin you want from the table below.

## Plugins

| Plugin | Description | Contents | Install |
|---|---|---|---|
| [`aws-sam`](plugins/aws-sam) | Scaffolding, writing, and reviewing AWS SAM (Serverless Application Model) projects using Node.js/TypeScript conventions. | Skill | `claude plugin install aws-sam@ironbear-plugins` |
| [`building-icue-widgets`](plugins/building-icue-widgets) | Scaffold, build, debug, and package Corsair iCUE / Xeneon Edge widgets (QtWebEngine sandbox). | Skill | `claude plugin install building-icue-widgets@ironbear-plugins` |

`plugins/_template/` is also present but is a starter scaffold, not an
installable plugin — see [Adding a new plugin](#adding-a-new-plugin).

## Repo layout

```
.claude-plugin/marketplace.json   # registers every plugin below
plugins/
  _template/                      # starter scaffold — not installable, copy from it
  <plugin-name>/
    .claude-plugin/plugin.json
    skills/<skill-name>/SKILL.md
    agents/<agent-name>.md
    commands/<command-name>.md
    hooks/hooks.json
    .mcp.json
```

Each plugin only includes the subfolders it actually needs.

## Adding a new plugin

1. Copy `plugins/_template/` to `plugins/<new-plugin-name>/`.
2. Edit `.claude-plugin/plugin.json` and delete whichever content-type
   folders don't apply.
3. Register it in `.claude-plugin/marketplace.json`:
   ```json
   {
     "name": "<new-plugin-name>",
     "description": "<one-line description>",
     "source": "./plugins/<new-plugin-name>"
   }
   ```
4. Add a row for it to the [Plugins](#plugins) table above, including
   its install command: `claude plugin install <new-plugin-name>@ironbear-plugins`
5. Validate: `claude plugin validate plugins/<new-plugin-name> --strict`
6. Commit.
