import { expect, it } from 'vitest';

import { findStaleBranchRulesets } from './sync-rulesets.mjs';

it('findStaleBranchRulesets flags branch rulesets not in the committed config', () => {
  const remote = [
    { id: 1, name: 'Protect main', target: 'branch' },
    { id: 2, name: 'Protect dev', target: 'branch' },
  ];
  const localNames = new Set(['Protect main']);
  const stale = findStaleBranchRulesets(remote, localNames);
  expect(stale.map((entry) => entry.name)).toStrictEqual(['Protect dev']);
});

it('findStaleBranchRulesets never touches tag or push rulesets', () => {
  const remote = [
    { id: 3, name: 'Tag guard', target: 'tag' },
    { id: 4, name: 'Push guard', target: 'push' },
  ];
  const stale = findStaleBranchRulesets(remote, new Set());
  expect(stale.length).toBe(0);
});

it('findStaleBranchRulesets is empty when every remote branch ruleset is in config', () => {
  const remote = [{ id: 1, name: 'Protect main', target: 'branch' }];
  const stale = findStaleBranchRulesets(remote, new Set(['Protect main']));
  expect(stale.length).toBe(0);
});
