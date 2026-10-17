import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// The agent permission rules: named scripts and the chain's git commands run without a prompt,
// a new dependency or a downloaded tool asks, GitHub stays read-only without one, and the
// destructive commands are denied outright. clinozy-be pins its own in
// src/tests/unit/tooling/agent-permissions.policy.unit.test.ts.

const permissions = (
  JSON.parse(readFileSync('agent-os/platforms/claude/settings.json', 'utf8')) as {
    permissions: Record<'allow' | 'ask' | 'deny', string[]>;
  }
).permissions;

describe('Claude Code permission rules', () => {
  it('names the pnpm scripts instead of allowing every pnpm command', () => {
    expect(permissions.allow).not.toContain('Bash(pnpm *)');
    for (const rule of permissions.allow.filter((entry) =>
      entry.startsWith('Bash(pnpm '),
    )) {
      // `pnpm <script>…` or the exact no-argument install, never a bare wildcard.
      expect(rule).toMatch(/^Bash\(pnpm (?:[a-z][a-z:-]*\*|install(?: --[a-z-]+)?)\)$/);
    }
    for (const rule of [
      'Bash(pnpm test*)',
      'Bash(pnpm health*)',
      'Bash(pnpm iteration*)',
    ]) {
      expect(permissions.allow).toContain(rule);
    }
  });

  it('no allowed pnpm rule also covers dlx, add, exec or an install with a package', () => {
    const covered = (command: string) =>
      permissions.allow.some((rule) => {
        const body = rule.slice('Bash('.length, -1);
        return body.endsWith('*')
          ? command.startsWith(body.slice(0, -1))
          : command === body;
      });
    for (const command of [
      'pnpm dlx shadcn@latest add button',
      'pnpm add left-pad',
      'pnpm exec tsx x.ts',
      'pnpm install left-pad',
      'pnpm deploy',
      'pnpm rebrand Acme',
    ]) {
      expect(covered(command), command).toBe(false);
    }
    for (const rule of ['Bash(pnpm dlx *)', 'Bash(pnpm add *)', 'Bash(pnpm exec *)']) {
      expect(permissions.ask).toContain(rule);
    }
  });

  it('git writes and gh run run without a prompt', () => {
    for (const rule of [
      'Bash(git add *)',
      'Bash(git commit *)',
      'Bash(git push *)',
      'Bash(git switch *)',
      'Bash(gh run *)',
      'mcp__headroom__*',
    ]) {
      expect(permissions.allow).toContain(rule);
    }
  });

  it('GitHub MCP tools are allowed for reading only', () => {
    const github = permissions.allow.filter((rule) => rule.startsWith('mcp__github__'));
    expect(github.length).toBeGreaterThan(0);
    for (const rule of github) {
      expect(rule).toMatch(
        /^mcp__github__(get_\*|list_\*|search_\*|pull_request_read|issue_read|actions_get|actions_list)$/,
      );
    }
  });

  it('opening a PR asks, and destructive commands are denied', () => {
    expect(permissions.ask).toContain('Bash(gh pr create *)');
    for (const rule of [
      'Bash(git push --force *)',
      'Bash(git push -f *)',
      'Bash(rm -rf *)',
      'mcp__github__delete_file',
    ]) {
      expect(permissions.deny).toContain(rule);
    }
  });

  it('no rule sits in two lists', () => {
    const all = [...permissions.allow, ...permissions.ask, ...permissions.deny];
    expect(new Set(all).size).toBe(all.length);
  });
});
