# Cursor agent environments (multi-repo)

When you work on **Clinozy** together with **clinozy-be** (or other repos), configure Cursor so agents can see every repository and optional MCP servers in one place.

## Multi-root workspace (VS Code / Cursor)

1. **File → Add Folder to Workspace…** and add `clinozy-fe` and `clinozy-be` (or clone paths on your machine).
2. **File → Save Workspace As…** — save a `*.code-workspace` file (optional; you can keep an untitled multi-root window).
3. Open the workspace file in Cursor when starting work on full-stack features.

Agents and chat can reference files across roots when both folders are in the workspace.

## Cursor Cloud / remote agents

Cursor’s **agent environments** (see the [Cursor changelog](https://cursor.com/changelog) for the current product name and capabilities) may support:

- Multiple repositories in one environment definition
- Dockerfile-based images with build secrets and caching

Use the official docs for **environment configuration as code** when wiring CI-style agent sandboxes; this repo does not ship a Dockerfile for Cursor agents by default.

## MCP with backend

For API discovery from the frontend repo alone, use [cursor-backend-mcp.md](./cursor-backend-mcp.md) and [cursor-mcp-setup.md](./cursor-mcp-setup.md). Multi-root is complementary: you can point MCP at a local backend **or** open `clinozy-be` in the same workspace for direct file reads.

## Parallel work

For large changes (new routes + tests + docs), use Cursor’s **parallel agents** or **`/multitask`** where available so independent tasks (e.g. lint vs E2E smoke) do not block each other.
