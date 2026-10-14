import { describe, expect, it } from 'vitest';

import { rxComposerColumns } from './rx-composer-columns.ts';

describe('rxComposerColumns — the drawer and its sidekick from xl', () => {
  it.each([
    [1920, { panel: 1360, aside: 320 }],
    [1440, { panel: 1360, aside: 320 }],
    [1416, { panel: 1360, aside: 320 }],
    [1366, { panel: 1310, aside: 272 }],
    [1280, { panel: 1224, aside: 272 }],
  ])('%ipx → %o', (viewport, columns) => {
    expect(rxComposerColumns(viewport)).toEqual(columns);
  });
});
