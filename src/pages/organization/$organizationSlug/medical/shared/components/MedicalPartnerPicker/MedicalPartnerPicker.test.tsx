import { screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import {
  appFixtures,
  resetAppFixtures,
} from '@/shared/api/app/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { useMedicalPickers } from '../../hooks/useMedicalPickers/index.ts';
import type { OpenMedicalChild } from '../../hooks/useMedicalStack/index.ts';
import {
  type MedicalPartnerKind,
  MedicalPartnerPicker,
} from './MedicalPartnerPicker.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** A one-pick field over `kind`, its pick shown beside it. */
function Single({
  kind,
  openChild,
  makerId,
}: {
  kind: MedicalPartnerKind;
  openChild?: OpenMedicalChild;
  makerId?: string;
}) {
  const pickers = useMedicalPickers();
  const [value, setValue] = useState<string | null>(null);
  return (
    <>
      <MedicalPartnerPicker
        kind={kind}
        label="Partner"
        value={value}
        onChange={setValue}
        pickers={pickers}
        openChild={openChild}
        makerId={makerId}
        testId="partner"
      />
      <output data-testid="picked">{value ?? ''}</output>
    </>
  );
}

/** A pick-any field over `kind`. */
function Multiple({ kind }: { kind: MedicalPartnerKind }) {
  const pickers = useMedicalPickers();
  const [value, setValue] = useState<string[]>([]);
  return (
    <>
      <MedicalPartnerPicker
        kind={kind}
        multiple
        label="Partners"
        value={value}
        onChange={setValue}
        pickers={pickers}
        testId="partners"
      />
      <output data-testid="picked">{value.join(',')}</output>
    </>
  );
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetAppFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetAppFixtures();
});

describe('MedicalPartnerPicker (medical.md:311–325)', () => {
  it('lists the makers with their counts and picks one', async () => {
    const user = setup();
    const { container } = renderMedicalDrawer(<Single kind="manufacturer" />);
    await user.click(await screen.findByTestId('partner'));
    expect(await screen.findByRole('option', { name: /ALVI/ })).toHaveTextContent(
      ' medicine',
    );
    await user.click(screen.getByRole('option', { name: /AVRI/ }));
    expect(screen.getByTestId('picked')).toHaveTextContent(ref.manufacturer(3));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('quick-adds a maker from the create row: "ACME" in the next colour, toasted and picked', async () => {
    const user = setup();
    renderMedicalDrawer(<Single kind="manufacturer" />);
    await user.click(await screen.findByTestId('partner'));
    await user.type(await screen.findByRole('combobox'), 'acme');
    await user.click(
      await screen.findByRole('option', { name: /Add manufacturer “acme”/ }),
    );
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Manufacturer ACME added'),
    );
    const [acme] = appFixtures.manufacturers.snapshot((row) => row.name === 'ACME');
    expect(acme?.isQuick).toBe(true);
    await waitFor(() =>
      expect(screen.getByTestId('picked')).toHaveTextContent(acme?.id ?? '—'),
    );
  });

  it('groups suppliers by the maker they distribute and quick-adds one linked to it', async () => {
    const user = setup();
    renderMedicalDrawer(<Single kind="supplier" makerId={ref.manufacturer(6)} />);
    await user.click(await screen.findByTestId('partner'));
    expect(await screen.findByText('Distributes BLA')).toBeInTheDocument();
    expect(screen.getByText('Other suppliers')).toBeInTheDocument();
    await user.type(screen.getByRole('combobox'), 'Om Pharma');
    await user.click(
      await screen.findByRole('option', { name: /Add supplier “Om Pharma”/ }),
    );
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Supplier Om Pharma added · add phone and GST later',
      ),
    );
    const [om] = appFixtures.suppliers.snapshot((row) => row.name === 'Om Pharma');
    expect(om?.manufacturerIds).toEqual([ref.manufacturer(6)]);
  });

  it('opens the record in full on top, and picks what it saves', async () => {
    const user = setup();
    const openChild = vi.fn<OpenMedicalChild>();
    renderMedicalDrawer(<Single kind="mr" openChild={openChild} />);
    await user.click(await screen.findByTestId('partner'));
    await user.type(await screen.findByRole('combobox'), 'Ravi');
    await user.click(await screen.findByTestId('partner-create-full'));
    expect(openChild).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'mr', query: 'Ravi' }),
    );
    const [request] = openChild.mock.calls[0] ?? [];
    if (request?.kind !== 'mr') throw new Error('expected an MR request');
    const rep = await appFixtures.medicalReps.create({
      name: 'Ravi',
      phone: null,
      nextVisitOn: null,
      manufacturerIds: [],
    });
    request.onCreated(rep);
    await waitFor(() => expect(screen.getByTestId('picked')).toHaveTextContent(rep.id));
  });

  it('adds picks to a pick-any field, a quick MR among them', async () => {
    const user = setup();
    renderMedicalDrawer(<Multiple kind="mr" />);
    await user.click(await screen.findByTestId('partners'));
    await user.click(
      await screen.findByRole('option', { name: /Alvio Pharma · Rakesh/ }),
    );
    await user.type(screen.getByRole('combobox'), 'Ravi');
    await user.click(await screen.findByRole('option', { name: /Add MR “Ravi”/ }));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalledWith('MR Ravi added'));
    const [ravi] = appFixtures.medicalReps.snapshot((rep) => rep.name === 'Ravi');
    await waitFor(() =>
      expect(screen.getByTestId('picked')).toHaveTextContent(
        `${ref.medicalRep(1)},${ravi?.id ?? '—'}`,
      ),
    );
  });
});
