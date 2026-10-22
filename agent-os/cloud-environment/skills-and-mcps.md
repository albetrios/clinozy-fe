# Cloud sessions — skills, MCPs, and subagents (clinozy-fe)

What a remote/cloud session uses. Local human setup stays in
[docs/getting-started/setup.md](../../docs/getting-started/setup.md); on-demand
stack notes are in [`agents-cloud.md`](agents-cloud.md).

## MCP servers

`install.sh` installs the **default pair** and scaffolds
[`.mcp.json`](../../.mcp.json) via `pnpm mcp:setup:default`:

| Server         | Command                                          | Notes                                                    |
| -------------- | ------------------------------------------------ | -------------------------------------------------------- |
| `fe-codegraph` | `pnpm exec codegraph serve --mcp`                | Code intelligence (devDependency)                        |
| `fe-headroom`  | `uvx --from headroom-ai[mcp] headroom mcp serve` | Context compression (`install-headroom.sh` pre-warms it) |

A session that holds both repos runs from their parent (`/home/user`), where neither
`.mcp.json` is read, so its servers are user-level (`~/.claude.json`): `pnpm agent-os:session-hooks`
registers each repo's codegraph there, pointed at it with `--path` (`fe-codegraph` runs the repo's
`node_modules/.bin/codegraph`), and one user-level `headroom` serves both: `install-headroom.sh`
registers it. Claude Code connects MCP servers when it starts, so a change loads at the next
start. Each server gets 3 minutes to start: `agent-os/platforms/claude/settings.json` sets
`env.MCP_TIMEOUT` to `180000`, carried to the parent by `pnpm agent-os:session-hooks`. The
default is 30 s, and on a freshly booted container codegraph and headroom started about 55 s
after launch; the first reply still waits at most 5 s for MCP servers.

On-demand servers (`chrome-devtools`, `fe-context7`, `clinozy-be-api`, `fe-semgrep`,
`shadcn`, `fe-sonarqube`, `tailwindcss`): `pnpm mcp:setup <name>`. `chrome-devtools`
reuses the Playwright Chromium (install once with
`pnpm exec playwright install --with-deps chromium`; the launcher
`tooling/dev/chrome-devtools-mcp.mjs` runs it headless and errors with that hint
if the browser is missing). Full template:
[`.mcp.example.json`](../../.mcp.example.json), mirrored at
[`agent-os/mcp/mcp.example.json`](../mcp/mcp.example.json) (drift-tested by
`tests/ci/mcp-config.policy.test.ts`).

## Skills

The full project skill catalog (41 skills, grouped in
[`agent-os/skills/groups.json`](../skills/groups.json)) starts at the
[skill registry](../skills/fe-skill-registry/SKILL.md). Chains that sequence them
live in [`agent-os/skills/chains.json`](../skills/chains.json). Routing by file
pattern: [`agent-os/docs/skill-triggers.md`](../docs/skill-triggers.md).

## Subagents

Read-only reviewer agents (Cursor + Claude, via the `.cursor/agents/` and
`.claude/agents/` symlinks) are catalogued in
[`agent-os/docs/agents-catalog.md`](../docs/agents-catalog.md); review pipelines
(`fe-pre-merge-review`, `fe-prod-readiness`) are declared in
[`agent-os/agents/pipelines.json`](../agents/pipelines.json). All are read-only —
they investigate and report; the parent applies fixes.
