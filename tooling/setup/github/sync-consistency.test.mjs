import { expect, it } from 'vitest';

import { checkSyncConsistency, collectConsistencyIssues } from './sync-consistency.mjs';

const CONSISTENT = {
  configuredEnvironments: ['development', 'production'],
  environmentJsonNames: ['development', 'production'],
  deployWorkflowEnvironments: ['production', 'development'],
  defaultBranch: 'main',
  protectedBranches: ['main'],
  rulesetBranches: ['main'],
};

it('collectConsistencyIssues: none when everything agrees (order-insensitive)', () => {
  expect(collectConsistencyIssues(CONSISTENT)).toStrictEqual([]);
});

it('collectConsistencyIssues: flags an env in config with no environment JSON file', () => {
  const issues = collectConsistencyIssues({
    ...CONSISTENT,
    environmentJsonNames: ['development'],
  });
  expect(issues.length).toBe(1);
  expect(issues[0].dimension).toBe('environments');
});

it('collectConsistencyIssues: flags an env the deploy workflow does not accept', () => {
  const issues = collectConsistencyIssues({
    ...CONSISTENT,
    deployWorkflowEnvironments: ['production'],
  });
  expect(issues.length).toBe(1);
  expect(issues[0].dimension).toBe('environments');
});

it('collectConsistencyIssues: flags a protectedBranch with no committed ruleset (stale dev)', () => {
  const issues = collectConsistencyIssues({
    ...CONSISTENT,
    protectedBranches: ['dev', 'main'],
  });
  expect(issues.length).toBe(1);
  expect(issues[0].dimension).toBe('branches');
});

it('collectConsistencyIssues: flags a defaultBranch protected by no ruleset', () => {
  const issues = collectConsistencyIssues({
    ...CONSISTENT,
    defaultBranch: 'dev',
    protectedBranches: ['dev'],
    rulesetBranches: ['main'],
  });
  expect(issues.some((issue) => issue.detail.includes('defaultBranch'))).toBeTruthy();
});

it('checkSyncConsistency: the committed tree is self-consistent (single trunk)', () => {
  expect(checkSyncConsistency()).toStrictEqual([]);
});
