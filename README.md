# ironbear-plugins

Personal Claude Code plugin marketplace: skills, agents, slash
commands, hooks, and MCP server configs, each packaged as its own
installable plugin.

## Install

Add this repo as a marketplace, then install whichever plugins you want:

```bash
claude plugin marketplace add /path/to/this/repo
claude plugin install <plugin-name>@ironbear-plugins
```

## Plugins

| Plugin | Description | Contents |
|---|---|---|
| [`aws-sam`](plugins/aws-sam) | Scaffolding, writing, and reviewing AWS SAM (Serverless Application Model) projects using Node.js/TypeScript conventions. | Skill |

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
4. Add a row for it to the [Plugins](#plugins) table above.
5. Validate: `claude plugin validate plugins/<new-plugin-name> --strict`
6. Commit.
