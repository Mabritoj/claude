# Personal Claude Plugin Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold this empty repo into a working, installable Claude Code plugin marketplace, with a reusable template plugin for adding future skills/agents/commands/hooks/MCP configs.

**Architecture:** A root `.claude-plugin/marketplace.json` registers plugins that live under `plugins/<name>/`, each with its own `.claude-plugin/plugin.json`. A non-installable `plugins/_template/` directory demonstrates every content type (skill, agent, command, hooks, MCP) as a copy source for future plugins. Validation uses the built-in `claude plugin validate` CLI command rather than a hand-rolled script — it's the authoritative schema checker Anthropic ships, so there's no reason to reinvent it.

**Tech Stack:** Claude Code plugin/marketplace manifest format (JSON), Markdown with YAML frontmatter for skills/agents/commands, Python 3 for the one example hook script.

## Global Constraints

- Plugin directory names and plugin `name` fields are kebab-case, one plugin per skill/capability (spec section "Granularity").
- In-repo plugins are registered in `marketplace.json` via a relative path string, e.g. `"source": "./plugins/my-skill-name"` — not `git-subdir` (spec section "marketplace.json").
- `plugins/_template/` is never listed in `marketplace.json` — it is a copy source only, not an installable plugin (spec section "Repo layout").
- Every `plugin.json` includes `name`, `description`, `version`, and `author` (with email) so `claude plugin validate --strict` passes with zero warnings.
- `.gitignore` excludes OS cruft and `*.local.md` / `*.local.json` (spec section "Documentation").
- All manifest/content file formats (SKILL.md frontmatter, command frontmatter, agent frontmatter, hooks.json shape, .mcp.json shape) match the verified formats from Anthropic's own `claude-plugins-official` marketplace (`example-plugin` and `hookify`), inspected directly during design.

---

### Task 1: Marketplace manifest

**Files:**
- Create: `.claude-plugin/marketplace.json`

**Interfaces:**
- Produces: a marketplace named `jonathan-plugins`, initially with an empty `plugins` array. Task 5 (and future plugin-adding work) appends entries here of the shape `{"name": ..., "description": ..., "source": "./plugins/<name>"}`.

- [ ] **Step 1: Confirm no manifest exists yet**

Run: `claude plugin validate "C:\Users\Jonathan\Documents\GitHub\claude"`
Expected output includes:
```
✘ Found 1 error:

  ❯ directory: No manifest found in directory. Expected .claude-plugin/marketplace.json or .claude-plugin/plugin.json

✘ Validation failed
```
Expected exit code: `1`

- [ ] **Step 2: Create the marketplace manifest**

Create `.claude-plugin/marketplace.json`:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "jonathan-plugins",
  "owner": {
    "name": "Jonathan Mabrito",
    "email": "mabritoj@gmail.com"
  },
  "plugins": []
}
```

- [ ] **Step 3: Validate it passes**

Run: `claude plugin validate "C:\Users\Jonathan\Documents\GitHub\claude" --strict`
Expected output includes:
```
Validating marketplace manifest: C:\Users\Jonathan\Documents\GitHub\claude\.claude-plugin\marketplace.json
```
and ends with a pass message (no `✘`). Expected exit code: `0`

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "Add marketplace manifest"
```

---

### Task 2: Template plugin manifest and docs

**Files:**
- Create: `plugins/_template/.claude-plugin/plugin.json`
- Create: `plugins/_template/README.md`

**Interfaces:**
- Consumes: none.
- Produces: a valid plugin directory at `plugins/_template/` that Task 3 adds content files into. Not referenced by `marketplace.json` (per Global Constraints).

- [ ] **Step 1: Confirm no manifest exists yet**

Run: `claude plugin validate "C:\Users\Jonathan\Documents\GitHub\claude\plugins\_template"`
Expected output includes:
```
✘ Found 1 error:

  ❯ directory: No manifest found in directory. Expected .claude-plugin/marketplace.json or .claude-plugin/plugin.json
```
Expected exit code: `1`

- [ ] **Step 2: Create the template plugin manifest**

Create `plugins/_template/.claude-plugin/plugin.json`:

```json
{
  "name": "template-plugin",
  "description": "Starter scaffold for creating new plugins in this marketplace. Not a real plugin: copy this directory, rename it, and fill in the pieces you need.",
  "version": "0.1.0",
  "author": {
    "name": "Jonathan Mabrito",
    "email": "mabritoj@gmail.com"
  }
}
```

- [ ] **Step 3: Create the template README**

Create `plugins/_template/README.md`:

```markdown
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
```

- [ ] **Step 4: Validate it passes**

Run: `claude plugin validate "C:\Users\Jonathan\Documents\GitHub\claude\plugins\_template" --strict`
Expected output includes:
```
Validating plugin manifest: ...plugins\_template\.claude-plugin\plugin.json
```
and ends with a pass message with zero warnings (since `version` and `author` are both present). Expected exit code: `0`

- [ ] **Step 5: Commit**

```bash
git add plugins/_template/.claude-plugin/plugin.json plugins/_template/README.md
git commit -m "Add template plugin manifest and docs"
```

---

### Task 3: Template plugin content examples

**Files:**
- Create: `plugins/_template/skills/example-skill/SKILL.md`
- Create: `plugins/_template/agents/example-agent.md`
- Create: `plugins/_template/commands/example-command.md`
- Create: `plugins/_template/hooks/hooks.json`
- Create: `plugins/_template/hooks/example_hook.py`
- Create: `plugins/_template/.mcp.json`

**Interfaces:**
- Consumes: `plugins/_template/.claude-plugin/plugin.json` from Task 2 (must already exist for `claude plugin validate` to treat this as a plugin directory).
- Produces: one reference example per content type, for future plugins to copy from. None of these are registered anywhere else — this task only adds files.

- [ ] **Step 1: Create the example skill**

Create `plugins/_template/skills/example-skill/SKILL.md`:

```markdown
---
name: example-skill
description: Template skill showing required SKILL.md frontmatter (name, description) and structure. Copy this directory and rewrite the frontmatter/content for a real skill — this one should never trigger on its own.
version: 0.1.0
---

# Example Skill

Replace this body with real guidance. `name` and `description` in the
frontmatter are required; `description` is what tells Claude when to
invoke the skill, so write concrete trigger phrases and keywords.
```

- [ ] **Step 2: Create the example agent**

Create `plugins/_template/agents/example-agent.md`:

```markdown
---
name: example-agent
description: Template agent definition. Copy this file, rename it, and replace this description with real trigger conditions before use — describe when this agent should be spawned and for what kind of task.
model: inherit
tools: ["Read", "Grep"]
---

You are a template agent. Replace this body with real instructions
before use: what the agent should do, how it should report back, and
any constraints on its behavior.
```

- [ ] **Step 3: Create the example command**

Create `plugins/_template/commands/example-command.md`:

```markdown
---
description: Template slash command. Copy this file, rename it, and replace this description before use.
argument-hint: [optional-arg]
allowed-tools: [Read, Grep]
---

# Example Command

Replace this with real instructions for what the command should do.

The user invoked this command with: $ARGUMENTS
```

- [ ] **Step 4: Create the example hooks config and its script**

Create `plugins/_template/hooks/hooks.json`:

```json
{
  "description": "Template hooks configuration - replace with real hooks, or delete this whole hooks/ directory if the plugin doesn't need any",
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"${CLAUDE_PLUGIN_ROOT}/hooks/example_hook.py\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Create `plugins/_template/hooks/example_hook.py`:

```python
#!/usr/bin/env python3
"""Template hook — replace with real logic or delete this file."""

print("template-plugin: example hook fired", flush=True)
```

- [ ] **Step 5: Create the example MCP config**

Create `plugins/_template/.mcp.json`:

```json
{
  "example-server": {
    "type": "http",
    "url": "https://mcp.example.com/api"
  }
}
```

- [ ] **Step 6: Confirm the manifest still validates cleanly**

Run: `claude plugin validate "C:\Users\Jonathan\Documents\GitHub\claude\plugins\_template" --strict`
Expected: same pass output as Task 2 Step 4 (adding content files must not introduce validation errors). Expected exit code: `0`

- [ ] **Step 7: Confirm the JSON files are syntactically valid**

Run:
```bash
python -m json.tool plugins/_template/hooks/hooks.json > /dev/null && echo HOOKS_OK
python -m json.tool "plugins/_template/.mcp.json" > /dev/null && echo MCP_OK
```
Expected output:
```
HOOKS_OK
MCP_OK
```

- [ ] **Step 8: Commit**

```bash
git add plugins/_template/skills plugins/_template/agents plugins/_template/commands plugins/_template/hooks plugins/_template/.mcp.json
git commit -m "Add template plugin content examples"
```

---

### Task 4: Root documentation and gitignore

**Files:**
- Create: `README.md`
- Create: `.gitignore`

**Interfaces:**
- Consumes: the marketplace name `jonathan-plugins` from Task 1, and the "adding a new plugin" workflow from Task 2's template README (root README summarizes the same steps for someone landing on the repo).
- Produces: nothing consumed by later tasks — this is documentation only.

- [ ] **Step 1: Create the root README**

Create `README.md`:

```markdown
# jonathan-plugins

Personal Claude Code plugin marketplace: skills, agents, slash
commands, hooks, and MCP server configs, each packaged as its own
installable plugin.

## Install

Add this repo as a marketplace, then install whichever plugins you want:

```bash
claude plugin marketplace add /path/to/this/repo
claude plugin install <plugin-name>@jonathan-plugins
```

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
4. Validate: `claude plugin validate plugins/<new-plugin-name> --strict`
5. Commit.
```

- [ ] **Step 2: Create the gitignore**

Create `.gitignore`:

```
.DS_Store
Thumbs.db
*.local.md
*.local.json
```

- [ ] **Step 3: Commit**

```bash
git add README.md .gitignore
git commit -m "Add root README and gitignore"
```

---

### Task 5: End-to-end marketplace validation

**Files:**
- None created or modified — this task only runs commands against the state built by Tasks 1-4.

**Interfaces:**
- Consumes: `.claude-plugin/marketplace.json` (Task 1) and `plugins/_template` (Tasks 2-3).
- Produces: confirmation that Claude Code itself (not just schema validation) accepts this repo as a marketplace.

- [ ] **Step 1: Full strict validation sweep**

Run:
```bash
claude plugin validate "C:\Users\Jonathan\Documents\GitHub\claude" --strict
claude plugin validate "C:\Users\Jonathan\Documents\GitHub\claude\plugins\_template" --strict
```
Expected: both pass with exit code `0` and no `✘` in the output.

- [ ] **Step 2: Register the repo as a live marketplace**

Run: `claude plugin marketplace add "C:\Users\Jonathan\Documents\GitHub\claude"`
Expected: a success message confirming the `jonathan-plugins` marketplace was added. Expected exit code: `0`

- [ ] **Step 3: Confirm it's listed**

Run: `claude plugin marketplace list`
Expected output includes an entry for `jonathan-plugins`.

- [ ] **Step 4: Report to user**

No file changes. Tell the user the marketplace is live and registered
locally, that `plugins/_template` is the copy source for new plugins,
and that migrating their existing skills/plugins in is the next
(separate) piece of work — one at a time, once each is identified, per
the spec's "Out of scope" section.

---

## Post-plan follow-up (not part of this plan)

Migrating Jonathan's existing skills/plugins from other machines/drafts
into `plugins/<name>/` directories, one at a time. Each migration is
small enough to be its own quick task once the source content is
identified — no need for a separate spec/plan cycle unless a
particular migration turns out to be non-trivial.
