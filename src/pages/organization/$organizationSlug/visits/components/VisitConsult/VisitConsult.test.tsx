import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrescriptionItem } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { startVisit } from '@/shared/api/clinic/visits-api.ts';
import type * as PrintModule from '@/shared/components/PrintTemplate/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderVisitRoute,
  resetVisitRoute,
  visitPath,
} from '../../__tests__/integration/visit-test-router.tsx';
import {
  useVisitDraftStore,
  type VisitDraftLine,
} from '../../store/useVisitDraftStore/index.ts';
import { VisitPage } from '../../VisitPage.tsx';
import { RxLines } from './rx-lines.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

const printed = vi.hoisted(() => ({ sheets: 0 }));
vi.mock('@/shared/components/PrintTemplate/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PrintModule>()),
  printDocument: async () => {
    printed.sheets += 1;
  },
}));

const approve = () => screen.getByTestId('visit-approve');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  resetClinicFixtures();
  useVisitDraftStore.setState({ drafts: {} });
  printed.sheets = 0;
  vi.mocked(notify.success).mockClear();
});
afterEach(() => {
  resetVisitRoute();
  resetClinicFixtures();
  vi.useRealTimers();
});

describe('VisitConsult (KICKOFF §6.13 Consult & Rx)', () => {
  it('approves once every line is reviewed: the Rx, the print, the toast and back to Today', async () => {
    const user = userEvent.setup();
    renderVisitRoute(visitPath(2866, 'consult'), VisitPage, { role: 'doctor' });
    expect(await screen.findByText(/^No medicines yet\./)).toBeInTheDocument();
    expect(approve()).toHaveAttribute('aria-disabled', 'true');
    expect(approve()).toHaveTextContent('Review the lines first');

    await user.type(screen.getByLabelText('Complaint'), 'Dark patches');
    await user.click(screen.getByRole('button', { name: 'Melasma' }));
    expect(screen.getByRole('button', { name: 'Melasma' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const [chip] = await screen.findAllByTestId('visit-rx-add');
    await user.click(chip as HTMLElement);
    expect(screen.getAllByTestId('visit-rx-line')).toHaveLength(1);
    expect(approve()).toHaveTextContent('Review 1 line first');
    await user.click(approve());
    expect(notify.success).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('visit-rx-review'));
    expect(screen.getByTestId('visit-rx-line')).toHaveAttribute('data-reviewed', 'true');
    expect(approve()).toHaveTextContent('Approve · print · send to pharmacy');
    expect(approve()).toHaveAttribute('aria-disabled', 'false');
    await user.click(approve());

    expect(await screen.findByTestId('elsewhere')).toHaveTextContent(
      '/organization/acme/today',
    );
    expect(notify.success).toHaveBeenCalledWith(
      'Prescription approved for Sana Kapoor · printed in English · sent to pharmacy · moved to checkout',
    );
    await waitFor(() => expect(printed.sheets).toBe(1));
    const rx = clinicFixtures.prescriptions.snapshot((row) => row.date === '2026-10-03');
    expect(rx.some((row) => row.items.length === 1)).toBe(true);
  });

  it('removes a line', async () => {
    const user = userEvent.setup();
    renderVisitRoute(visitPath(2866, 'consult'), VisitPage, { role: 'doctor' });
    const [chip] = await screen.findAllByTestId('visit-rx-add');
    await user.click(chip as HTMLElement);
    await user.click(screen.getByTestId('visit-rx-remove'));
    expect(screen.queryByTestId('visit-rx-line')).not.toBeInTheDocument();
  });

  it('copies the last prescription, every line unreviewed', async () => {
    const user = userEvent.setup();
    const dharti = clinicFixtures.patients.snapshot(
      (row) => row.firstName === 'Dharti',
    )[0];
    const visit = await startVisit({ patientId: dharti?.id ?? '' });
    renderVisitRoute(`/organization/acme/visits/${visit.id}?tab=consult`, VisitPage, {
      role: 'doctor',
    });
    await user.click(await screen.findByTestId('visit-copy-rx'));
    const lines = screen.getAllByTestId('visit-rx-line');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((line) => line.dataset.reviewed === 'false')).toBe(true);
  });

  it('keeps the draft when the sheet closes and opens again', async () => {
    const user = userEvent.setup();
    const first = renderVisitRoute(visitPath(2866, 'consult'), VisitPage, {
      role: 'doctor',
    });
    await user.type(await screen.findByLabelText('Plan'), 'Review in 8 weeks');
    first.unmount();
    renderVisitRoute(visitPath(2866, 'consult'), VisitPage, { role: 'doctor' });
    expect(await screen.findByLabelText('Plan')).toHaveValue('Review in 8 weeks');
  });

  it('shows an approved Rx as it was approved, without its actions', async () => {
    renderVisitRoute(visitPath(2863, 'consult'), VisitPage, { role: 'doctor' });
    expect(await screen.findByTestId('visit-rx-approved')).toHaveTextContent(
      '✓ Prescription #501 approved · 3 medicines',
    );
    expect(screen.getAllByTestId('visit-rx-line')).toHaveLength(3);
    expect(screen.queryByTestId('visit-approve')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Complaint')).toBeDisabled();
  });

  it('has no axe violations', async () => {
    const { baseElement } = renderVisitRoute(visitPath(2866, 'consult'), VisitPage, {
      role: 'doctor',
    });
    await screen.findAllByTestId('visit-rx-add');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});

describe('RxLines › a line with no dose', () => {
  const unset: PrescriptionItem = {
    medicineId: null,
    medicineName: 'Ceramide moisturiser',
    doseMorning: 0,
    doseAfternoon: 0,
    doseNight: 0,
    sos: false,
    meal: null,
    timing: null,
    timingText: null,
    bodyPart: null,
    bodyPartText: null,
    qty: 1,
    remarks: null,
  };

  function Harness() {
    const [lines, setLines] = useState<VisitDraftLine[]>([
      { key: 'a', item: unset, reviewed: false },
    ]);
    return <RxLines lines={lines} onChange={setLines} readOnly={false} />;
  }

  it('reads "Doctor to set" and opens its dose editor before it can be reviewed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const line = screen.getByTestId('visit-rx-line');
    expect(line).toHaveTextContent('Doctor to set · qty 1');
    await user.click(within(line).getByRole('button', { name: 'Set dose' }));
    const editor = screen.getByTestId('visit-rx-dose');
    expect(within(editor).getByRole('button', { name: 'Done' })).toBeDisabled();
    await user.click(within(editor).getByRole('button', { name: 'Morning 0' }));
    await user.click(within(editor).getByRole('button', { name: 'Night 0' }));
    expect(line).toHaveTextContent('1-0-1 · qty 1');
    await user.click(within(editor).getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('visit-rx-dose')).not.toBeInTheDocument();
    await user.click(within(line).getByRole('button', { name: 'Review' }));
    expect(line).toHaveAttribute('data-reviewed', 'true');
  });
});
