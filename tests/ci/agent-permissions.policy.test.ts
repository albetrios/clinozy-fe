import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The agent permission rules: named scripts, `pnpm exec` (a binary already installed) and the
// chain's git commands run without a prompt, GitHub stays read-only without one, the destructive
// commands are denied outright, and nothing asks — neither an `ask` rule nor a hook — so every
// other call is the permission mode's to decide. clinozy-be pins its own in
// src/tests/unit/tooling/agent-permissions.policy.unit.test.ts.

const permissions = (
  JSON.parse(readFileSync('agent-os/platforms/claude/settings.json', 'utf8')) as {
    permissions: Partial<Record<'ask', string[]>> & Record<'allow' | 'deny', string[]>;
  }
).permissions;

describe('Claude Code permission rules', () => {
  it('names the pnpm scripts instead of allowing every pnpm command', () => {
    expect(permissions.allow).not.toContain('Bash(pnpm *)');
    for (const rule of permissions.allow.filter((entry) =>
      entry.startsWith('Bash(pnpm '),
    )) {
      // `pnpm <script>…`, `pnpm exec *` or the exact no-argument install, never a bare wildcard.
      expect(rule).toMatch(
        /^Bash\(pnpm (?:[a-z][a-z:-]*\*|exec \*|install(?: --[a-z-]+)?)\)$/,
      );
    }
    for (const rule of [
      'Bash(pnpm test*)',
      'Bash(pnpm health*)',
      'Bash(pnpm iteration*)',
    ]) {
      expect(permissions.allow).toContain(rule);
    }
  });

  it('no allowed pnpm rule also covers dlx, add or an install with a package', () => {
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
      'pnpm install left-pad',
      'pnpm deploy',
      'pnpm rebrand Acme',
    ]) {
      expect(covered(command), command).toBe(false);
    }
    expect(covered('pnpm exec tsx x.ts')).toBe(true);
  });

  it('declares no ask rule, the same as clinozy-be', () => {
    // One policy for both repositories: a session that holds both merges their rules, and an ask
    // outranks every allow.
    expect(permissions.ask ?? []).toEqual([]);
  });

  it('no hook script asks the user (permissionDecision "ask")', () => {
    const hooksDirectory = join('agent-os', 'hooks');
    for (const file of readdirSync(hooksDirectory).filter((name) =>
      name.endsWith('.mjs'),
    )) {
      const source = readFileSync(join(hooksDirectory, file), 'utf8');
      expect(source, file).not.toMatch(/decision:\s*["']ask["']|decide\(\s*["']ask["']/);
    }
  });

  it('git writes and gh run run without a prompt', () => {
    for (const rule of [
      'Bash(git add *)',
      'Bash(git commit *)',
      'Bash(git push *)',
      'Bash(git switch *)',
      'Bash(gh run *)',
      // The project's own server (`.mcp.json`) and the user-level one (install-headroom.sh).
      'mcp__fe-headroom__*',
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

  it('destructive commands are denied', () => {
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
    const all = [...permissions.allow, ...(permissions.ask ?? []), ...permissions.deny];
    expect(new Set(all).size).toBe(all.length);
  });
});
