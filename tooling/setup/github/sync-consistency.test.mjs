import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkSyncConsistency, collectConsistencyIssues } from './sync-consistency.mjs';

const CONSISTENT = {
  configuredEnvironments: ['development', 'production'],
  environmentJsonNames: ['development', 'production'],
  deployWorkflowEnvironments: ['production', 'development'],
  defaultBranch: 'main',
  protectedBranches: ['main'],
  rulesetBranches: ['main'],
};

test('collectConsistencyIssues: none when everything agrees (order-insensitive)', () => {
  assert.deepEqual(collectConsistencyIssues(CONSISTENT), []);
});

test('collectConsistencyIssues: flags an env in config with no environment JSON file', () => {
  const issues = collectConsistencyIssues({
    ...CONSISTENT,
    environmentJsonNames: ['development'],
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].dimension, 'environments');
});

test('collectConsistencyIssues: flags an env the deploy workflow does not accept', () => {
  const issues = collectConsistencyIssues({
    ...CONSISTENT,
    deployWorkflowEnvironments: ['production'],
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].dimension, 'environments');
});

test('collectConsistencyIssues: flags a protectedBranch with no committed ruleset (stale dev)', () => {
  const issues = collectConsistencyIssues({
    ...CONSISTENT,
    protectedBranches: ['dev', 'main'],
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].dimension, 'branches');
});

test('collectConsistencyIssues: flags a defaultBranch protected by no ruleset', () => {
  const issues = collectConsistencyIssues({
    ...CONSISTENT,
    defaultBranch: 'dev',
    protectedBranches: ['dev'],
    rulesetBranches: ['main'],
  });
  assert.ok(issues.some((issue) => issue.detail.includes('defaultBranch')));
});

test('checkSyncConsistency: the committed tree is self-consistent (single trunk)', () => {
  assert.deepEqual(checkSyncConsistency(), []);
});
