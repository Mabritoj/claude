# _template

Not a real plugin — a starter scaffold for creating new ones.

## How to use

1. Copy this directory: `plugins/_template/` → `plugins/<new-plugin-name>/`.
2. Edit `.claude-plugin/plugin.json`: set `name`, `description`, and keep
   `version`/`author` filled in.
3. Delete whichever content-type folders/files don't apply
   (`skills/`, `agents/`, `commands/`, `hooks/`, `.mcp.json`) — a plugin
   only needs the ones it actually uses.
4. Rewrite the frontmatter and body of whichever files you kept.
5. Register the new plugin in the root `.claude-plugin/marketplace.json`:

   ```json
   {
     "name": "<new-plugin-name>",
     "description": "<one-line description>",
     "source": "./plugins/<new-plugin-name>"
   }
   ```

6. Validate: `claude plugin validate plugins/<new-plugin-name> --strict`
7. Commit.
