# Route island template

Copy for **`pages/<page-name>/`** or any nested **`pages/.../<child-segment>/`**. Rules: [route-island-structure.md](../reference/route-island-structure.md).

## Tree

The tree — every mandatory and optional file and folder of an island — is in one place: **[route-island-structure.md](../reference/route-island-structure.md)**. The templates below fill its files.

## `<page>.manifest.ts`

```ts
import type { PageManifest } from '@/lib/routes/page-manifest.ts';

export const manifest = {
  segment: '<page-name>',
  path: '/<path>',
  title: '<Page title>', // document title: "<Page title> · Clinozy"
  testId: '<page-name>-page',
  permission: 'resource:read', // or null
  kind: 'leaf', // or 'layout' + children: ['<sub-a>']
  children: [],
} as const satisfies PageManifest;
```

## `route.tsx`

```tsx
import { ExamplePage } from './ExamplePage.tsx';

/** Lazy boundary — access control is registered in routeTree `beforeLoad`. */
export function Component() {
  return <ExamplePage />;
}
```

Register `gatewayFromManifest(manifest)` (and org guards when applicable) on the
route in `src/app/routes/routeTree.tsx` — see `agent-os/skills/fe-routing-tenancy/SKILL.md`.

## `components/ExamplePage.tsx`

```tsx
import { manifest } from '../page.ts';

export function ExamplePage() {
  return (
    <div className="space-y-6" data-testid={page.testId}>
      <h1 className="text-2xl font-bold tracking-tight">Title</h1>
    </div>
  );
}
```

## `__tests__/unit/page.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { ExamplePage } from '../../components/ExamplePage.tsx';

describe('ExamplePage', () => {
  it('renders', () => {
    render(<ExamplePage />);
    expect(screen.getByTestId('example-page')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<ExamplePage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

## `routeTree.tsx`

```ts
lazy: () => import('@/pages/<page-name>/route.tsx'),
// child: lazy: () => import('@/pages/<page-name>/<child>/<child>.route.tsx'),
```
