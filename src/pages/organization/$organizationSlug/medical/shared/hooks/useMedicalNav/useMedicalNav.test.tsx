import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { useMedicalNav } from './useMedicalNav.ts';

const ROOM = '/organization/acme/medical';
const ID = '0b9c7a3e-2f6d-4f8a-9c1e-5d4b3a2f1e0d';

/** Buttons that run the hook's navigations. */
function Probe() {
  const nav = useMedicalNav();
  return (
    <>
      <button type="button" onClick={() => nav.purchaseOrderReceive(ID)}>
        receive
      </button>
      <button type="button" onClick={() => nav.close('purchases')}>
        close
      </button>
      <button type="button" onClick={() => nav.create('purchases', { supplier: ID })}>
        new order
      </button>
    </>
  );
}

afterEach(() => resetMedicalRoutes());

describe('useMedicalNav', () => {
  it('opens each dialog route over its tab, keeping the list’s params', async () => {
    const user = userEvent.setup();
    const { router } = renderMedicalRoutes(`${ROOM}/purchases?stage=ordered`, {
      purchases: Probe,
    });
    await user.click(await screen.findByRole('button', { name: 'receive' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/purchases/${ID}/receive`),
    );
    expect(router.state.location.search).toMatchObject({ stage: 'ordered' });
    await user.click(screen.getByRole('button', { name: 'close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/purchases`));
    expect(router.state.location.search).toMatchObject({ stage: 'ordered' });
  });

  it('opens a create over its own tab with its prefill', async () => {
    const user = userEvent.setup();
    const { router } = renderMedicalRoutes(`${ROOM}/purchases`, { purchases: Probe });
    await user.click(await screen.findByRole('button', { name: 'new order' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/purchases/create`),
    );
    expect(router.state.location.search).toMatchObject({ supplier: ID });
  });
});
