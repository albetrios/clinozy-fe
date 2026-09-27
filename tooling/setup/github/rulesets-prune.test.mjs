import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findStaleBranchRulesets } from './sync-rulesets.mjs';

test('findStaleBranchRulesets flags branch rulesets not in the committed config', () => {
  const remote = [
    { id: 1, name: 'Protect main', target: 'branch' },
    { id: 2, name: 'Protect dev', target: 'branch' },
  ];
  const localNames = new Set(['Protect main']);
  const stale = findStaleBranchRulesets(remote, localNames);
  assert.deepEqual(
    stale.map((entry) => entry.name),
    ['Protect dev'],
  );
});

test('findStaleBranchRulesets never touches tag or push rulesets', () => {
  const remote = [
    { id: 3, name: 'Tag guard', target: 'tag' },
    { id: 4, name: 'Push guard', target: 'push' },
  ];
  const stale = findStaleBranchRulesets(remote, new Set());
  assert.equal(stale.length, 0);
});

test('findStaleBranchRulesets is empty when every remote branch ruleset is in config', () => {
  const remote = [{ id: 1, name: 'Protect main', target: 'branch' }];
  const stale = findStaleBranchRulesets(remote, new Set(['Protect main']));
  assert.equal(stale.length, 0);
});
