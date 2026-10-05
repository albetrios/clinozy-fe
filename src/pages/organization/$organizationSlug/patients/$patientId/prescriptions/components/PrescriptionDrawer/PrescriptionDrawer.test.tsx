import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as PrescriptionsApi from '@/shared/api/clinic/prescriptions-api.ts';
import { fetchVisit } from '@/shared/api/clinic/visits-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock, printMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  printMock: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/components/PrintTemplate/print-document.ts', () => ({
  printDocument: printMock,
  PRINTING_ATTRIBUTE: 'data-printing',
}));

/** Holds the print sheet's read while a test sets it, to print before it lands. */
const sheetGate = vi.hoisted(() => ({ hold: null as Promise<void> | null }));
vi.mock('@/shared/api/clinic/prescriptions-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof PrescriptionsApi>();
  return {
    ...actual,
    fetchRxSheetContext: async (
      ...args: Parameters<typeof actual.fetchRxSheetContext>
    ) => {
      await sheetGate.hold;
      return actual.fetchRxSheetContext(...args);
    },
  };
});

const DHARTI = patientRef('Dharti Galani');
const RX_497 = ref.prescription(497);
const url = (rest: string) => patientFileUrl(DHARTI, `/prescriptions${rest}`);

/** Dharti's prescriptions, newest first. */
const dhartiRx = () =>
  clinicFixtures.prescriptions
    .snapshot((rx) => rx.patientId === DHARTI)
    .sort((a, b) => b.seq - a.seq);

async function openNew(role: 'doctor' | 'owner' = 'doctor') {
  const user = userEvent.setup();
  const view = renderPatientFile(url('/create'), { role });
  const drawer = await screen.findByTestId('rx-drawer');
  return { ...view, user, drawer };
}

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockClear();
  sheetGate.hold = null;
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('Prescription drawer (KICKOFF §6.6; S:35, 37)', () => {
  it('heads a new prescription with the patient, the count and the kits', async () => {
    const { drawer, baseElement } = await openNew();
    expect(within(drawer).getByTestId('rx-drawer-title')).toHaveTextContent(
      'New prescription',
    );
    expect(drawer).toHaveTextContent('Dharti Galani · #3508');
    expect(within(drawer).getByTestId('rx-drawer-badges')).toHaveTextContent(
      '0 medicines',
    );
    const fill = within(drawer).getByTestId('rx-drawer-quick-fill');
    expect(
      within(fill)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual([
      'Repeat last Rx #497',
      'Hair fall kit',
      'Post-peel kit',
      'Pigmentation kit',
    ]);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('asks for a medicine before it saves', async () => {
    const { user, drawer } = await openNew();
    await user.click(within(drawer).getByTestId('rx-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a medicine');
    expect(within(drawer).getByTestId('rx-drawer-step-medicines')).toHaveAttribute(
      'data-status',
      'open',
    );
    expect(dhartiRx()).toHaveLength(1);
  });

  it('in the visit flow: approves, prints, sends to the pharmacy and goes back to the flow (L-64)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
    resetClinicFixtures();
    try {
      // Sana Kapoor is with the doctor (visit 2866), opened from Today's card.
      const SANA = patientRef('Sana Kapoor');
      const user = userEvent.setup();
      const { router } = renderPatientFile(
        patientFileUrl(SANA, '/prescriptions/create?visit=open&from=today'),
        { role: 'doctor' },
      );
      const drawer = await screen.findByTestId('rx-drawer');
      const save = within(drawer).getByTestId('rx-drawer-save');
      expect(save).toHaveTextContent('Approve · print · send to pharmacy');
      await user.click(within(drawer).getByTestId('rx-drawer-quick-fill-hairFall'));
      await user.click(save);
      await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(router.state.location.pathname).toBe(patientFileUrl(SANA, '/timeline')),
      );
      expect(router.state.location.search).toEqual({ visit: 'open', from: 'today' });
      const [written] = clinicFixtures.prescriptions
        .snapshot((rx) => rx.patientId === SANA)
        .sort((a, b) => b.seq - a.seq);
      // Tied to the visit's booking: Today's pharmacy lane and Medical's to fill.
      expect(written?.appointmentId).toBe(ref.appointment(2866));
      const visit = await fetchVisit(ref.visit(2866));
      expect(visit.visit.stage).toBe('checkout');
      expect(visit.rxToFill).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('in the visit flow, Save & sell prints once the sheet is read and keeps the flow behind the sale (L-64)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
    resetClinicFixtures();
    try {
      const SANA = patientRef('Sana Kapoor');
      let release: () => void = () => undefined;
      sheetGate.hold = new Promise((resolve) => {
        release = resolve;
      });
      const user = userEvent.setup();
      const { router } = renderPatientFile(
        patientFileUrl(SANA, '/prescriptions/create?visit=open&from=today'),
        { role: 'doctor' },
      );
      const drawer = await screen.findByTestId('rx-drawer');
      await user.click(within(drawer).getByTestId('rx-drawer-quick-fill-hairFall'));
      await user.click(within(drawer).getByTestId('rx-drawer-save-and-add'));
      await waitFor(() =>
        expect(shownLocation(router).pathname).toBe(
          '/organization/acme/medical/sales/create',
        ),
      );
      // The flow itself stands behind the sale (A-P1).
      expect(router.state.location.pathname).toBe(patientFileUrl(SANA, '/timeline'));
      expect(router.state.location.search).toMatchObject({
        visit: 'open',
        from: 'today',
      });
      const [written] = clinicFixtures.prescriptions
        .snapshot((rx) => rx.patientId === SANA)
        .sort((a, b) => b.seq - a.seq);
      // The sale closes back into the flow, Today still its way back.
      expect(shownLocation(router).search).toEqual({
        prescription: written?.id,
        from: `patients/${SANA}/timeline?visit=open&from=today`,
      });
      // The sheet is still being read: the print waits for it rather than skipping.
      expect(printMock).not.toHaveBeenCalled();
      release();
      await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
    } finally {
      vi.useRealTimers();
    }
  });

  it('fills the hair fall kit and saves it — “Prescription saved”', async () => {
    const { user, drawer, router } = await openNew();
    await user.click(within(drawer).getByTestId('rx-drawer-quick-fill-hairFall'));
    expect(within(drawer).getByTestId('rx-drawer-badges')).toHaveTextContent(
      '3 medicines',
    );
    await user.click(within(drawer).getByTestId('rx-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Prescription saved'),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    const [saved] = dhartiRx();
    expect(saved?.items.map((item) => item.medicineName)).toEqual([
      'Flubolt 400',
      'Clonix-B Lotion',
      'Densyl-AD Shampoo',
    ]);
    expect(saved?.items[1]).toMatchObject({ timing: 'morning_night', bodyPart: 'scalp' });
  });

  it('repeats the last prescription', async () => {
    const { user, drawer } = await openNew();
    await user.click(within(drawer).getByTestId('rx-drawer-quick-fill-repeat'));
    expect(within(drawer).getByTestId('rx-drawer-badges')).toHaveTextContent(
      '1 medicine',
    );
  });

  it('adds a medicine from the quick line with its shorthand', async () => {
    const { user, drawer } = await openNew();
    await user.click(within(drawer).getByTestId('rx-drawer-step-medicines-trigger'));
    const line = await within(drawer).findByRole('combobox', { name: 'Quick add' });
    await user.type(line, 'glyco 1-0-1 af 10d');
    expect(drawer).toHaveTextContent('1-0-1');
    await user.keyboard('{Enter}');
    expect(notifyMock.success).toHaveBeenCalledWith('Glycolac Cream added');
    const row = within(drawer).getAllByTestId('rx-items-row')[0] as HTMLElement;
    expect(within(row).getByTestId('rx-items-qty')).toHaveValue('20');
    expect(within(row).getByTestId('rx-items-dose-night')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('saves and hands the prescription to a new medical sale (Save & sell)', async () => {
    const { user, drawer, router } = await openNew();
    await user.click(within(drawer).getByTestId('rx-drawer-quick-fill-pigmentation'));
    await user.click(within(drawer).getByTestId('rx-drawer-save-and-add'));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/medical/sales/create',
      ),
    );
    const [saved] = dhartiRx();
    expect(shownLocation(router).search).toEqual({
      prescription: saved?.id,
      from: `patients/${DHARTI}/prescriptions`,
    });
    // The Rx drawer closes; Prescriptions stays behind the sale (A-P1).
    expect(router.state.location.pathname).toBe(url(''));
  });

  it('edits a prescription, prints it, and saves “Prescription #497 saved”', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(url(`/${RX_497}/edit`), { role: 'doctor' });
    const drawer = await screen.findByTestId('rx-drawer');
    expect(within(drawer).getByTestId('rx-drawer-title')).toHaveTextContent(
      'Edit prescription',
    );
    expect(within(drawer).getByTestId('rx-drawer-tag')).toHaveTextContent('#497');
    await user.click(within(drawer).getByTestId('rx-drawer-quick-fill-print'));
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
    await user.click(within(drawer).getByTestId('rx-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Prescription #497 saved'),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
  });

  it('reads only for a member without the Rx gate (S:37)', async () => {
    renderPatientFile(url(`/${RX_497}/edit`), { role: 'front_desk' });
    const drawer = await screen.findByTestId('rx-drawer');
    expect(within(drawer).queryByTestId('rx-drawer-save')).not.toBeInTheDocument();
    expect(within(drawer).queryByTestId('rx-drawer-quick-fill')).not.toBeInTheDocument();
    expect(within(drawer).getByTestId('rx-drawer-summary')).toHaveTextContent(
      'View only · your role can’t change this',
    );
  });

  it('deletes a prescription with a reason, offering Undo', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(url(`/${RX_497}/edit`), { role: 'owner' });
    const drawer = await screen.findByTestId('rx-drawer');
    await user.click(within(drawer).getByTestId('rx-drawer-delete'));
    const confirm = await screen.findByTestId('confirm-dialog');
    expect(confirm).toHaveTextContent('Delete this prescription?');
    expect(within(confirm).getByTestId('confirm-record')).toHaveTextContent(
      'Prescription #497',
    );
    await user.click(within(confirm).getByTestId('confirm-reason-mistake'));
    await user.click(within(confirm).getByTestId('confirm-accept'));
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    expect(dhartiRx()).toHaveLength(0);
    expect(notifyMock.undo).toHaveBeenCalledWith('Prescription deleted', {
      onUndo: expect.any(Function),
    });
  });
});
