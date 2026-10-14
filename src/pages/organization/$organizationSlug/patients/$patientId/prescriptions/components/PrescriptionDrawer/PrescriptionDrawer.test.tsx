import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { DOCTOR_NISHA } from '@/tests/utils/appointment-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import {
  patientFile,
  patientRecord,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  prescriptionLine,
  prescriptionRecord,
  resetRxWorld,
  rxServerApi,
  rxWorld,
  TEST_PRESCRIPTION_ID,
} from '../../__tests__/integration/prescription-doubles.ts';
import {
  type PrescriptionsMember,
  prescriptionsUrl,
  renderPrescriptions,
  resetPrescriptionsMember,
} from '../../__tests__/integration/prescriptions-test-router.tsx';
import { PrescriptionDrawer } from './PrescriptionDrawer.tsx';

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

vi.mock('@/shared/api/app/prescriptions-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../__tests__/integration/prescription-doubles.ts')).rxServerApi,
}));
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => {
  const { DOCTOR_ARJUN, DOCTOR_NISHA: NISHA } =
    await import('@/tests/utils/appointment-doubles.ts');
  return {
    ...(await importOriginal<object>()),
    fetchTeamDirectory: vi.fn(async () => [NISHA, DOCTOR_ARJUN]),
  };
});
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(async () => 'mem_nisha0000000000000000'),
}));

const url = prescriptionsUrl;
/** A member who writes drafts and approves none. */
const DRAFTER: PrescriptionsMember = {
  codes: ['patient_prescription:read', 'patient_prescription:create'],
};
const HAIR_FALL = {
  id: 'rxk_hairfall00000000000000',
  name: 'Hair fall kit',
  items: [
    prescriptionLine(),
    prescriptionLine({
      medicineName: 'Clonix-B Lotion',
      doseNight: 0,
      meal: null,
      timing: 'morning_night',
      bodyPart: 'scalp',
      qty: 1,
    }),
  ],
};

async function openNew(member: PrescriptionsMember = { role: 'admin' }) {
  const user = userEvent.setup();
  const view = renderPrescriptions(url('/create'), { member });
  const drawer = await screen.findByTestId('rx-drawer');
  return { ...view, user, drawer };
}

async function openEdit(member: PrescriptionsMember = { role: 'admin' }) {
  const user = userEvent.setup();
  const view = renderPrescriptions(url(`/${TEST_PRESCRIPTION_ID}/edit`), { member });
  const drawer = await screen.findByTestId('rx-drawer');
  return { ...view, user, drawer };
}

/** The newest prescription the stand-in server holds. */
const written = () => rxWorld.prescriptions.at(-1);

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockClear();
  for (const fn of Object.values(rxServerApi)) fn.mockClear();
  resetRxWorld({ prescriptions: [prescriptionRecord()], kits: [HAIR_FALL] });
});
afterEach(() => resetPrescriptionsMember());

describe('Prescription drawer (KICKOFF §6.6; S:35, 37; Q19)', () => {
  it('heads a new prescription with the patient, the count, Draft and the member’s kits', async () => {
    const { drawer, baseElement } = await openNew();
    expect(within(drawer).getByTestId('rx-drawer-title')).toHaveTextContent(
      'New prescription',
    );
    expect(drawer).toHaveTextContent(`${fsi('Priya Shah')} · ${fsi('#3508')}`);
    const badges = within(drawer).getByTestId('rx-drawer-badges');
    expect(badges).toHaveTextContent('0 medicines');
    expect(
      within(within(drawer).getByTestId('rx-drawer-quick-fill'))
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual(['Repeat last Rx #500', 'Hair fall kit']);
    expect(rxServerApi.listPrescriptionKits).toHaveBeenCalled();
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
    expect(rxServerApi.createPrescription).not.toHaveBeenCalled();
  });

  it('writes and approves for an approver — the kit’s lines, “Prescription #501 approved”', async () => {
    const { user, drawer, router } = await openNew();
    await user.click(
      within(drawer).getByTestId(`rx-drawer-quick-fill-kit-${HAIR_FALL.id}`),
    );
    expect(within(drawer).getByTestId('rx-drawer-badges')).toHaveTextContent(
      '2 medicines',
    );
    const save = within(drawer).getByTestId('rx-drawer-save');
    expect(save).toHaveTextContent('Save & approve');
    await user.click(save);
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Prescription #501 approved'),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    const create = rxServerApi.createPrescription.mock.lastCall?.[0];
    expect(create).toMatchObject({
      patientId: TEST_PATIENT_ID,
      appointmentId: null,
      fields: { doctorId: DOCTOR_NISHA.id, advice: null },
    });
    expect(create?.fields.items.map((item) => item.medicineName)).toEqual([
      'Flubolt 400',
      'Clonix-B Lotion',
    ]);
    expect(create?.fields.items[1]).toMatchObject({
      timing: 'morning_night',
      bodyPart: 'scalp',
    });
    expect(rxServerApi.approvePrescription).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      prescriptionId: written()?.id,
      idempotencyKey: `${create?.idempotencyKey}:approve`,
    });
    expect(written()?.status).toBe('approved');
  });

  it('saves a draft for a member who does not approve — no “Save & sell”', async () => {
    const { user, drawer } = await openNew(DRAFTER);
    await user.click(
      within(drawer).getByTestId(`rx-drawer-quick-fill-kit-${HAIR_FALL.id}`),
    );
    const save = within(drawer).getByTestId('rx-drawer-save');
    expect(save).toHaveTextContent('Save prescription');
    expect(
      within(drawer).queryByTestId('rx-drawer-save-and-add'),
    ).not.toBeInTheDocument();
    await user.click(save);
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Prescription saved'),
    );
    expect(rxServerApi.approvePrescription).not.toHaveBeenCalled();
    expect(written()?.status).toBe('draft');
  });

  it('approves and hands the prescription to a new medical sale (Save & sell)', async () => {
    const { user, drawer, router } = await openNew();
    await user.click(within(drawer).getByTestId('rx-drawer-quick-fill-repeat'));
    await user.click(within(drawer).getByTestId('rx-drawer-save-and-add'));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/medical/sales/create',
      ),
    );
    expect(written()?.status).toBe('approved');
    expect(shownLocation(router).search).toEqual({
      prescription: written()?.id,
      customer: TEST_PATIENT_ID,
      from: `patients/${TEST_PATIENT_ID}/prescriptions`,
    });
  });

  it('adds a medicine of the store from the quick line with its shorthand and stock', async () => {
    rxWorld.medicines = [
      {
        id: 'med_glycolac000000000000',
        name: 'Glycolac Cream',
        composition: null,
        stock: 4,
      },
    ];
    const { user, drawer } = await openNew();
    // A new prescription opens on Medicines (feat-prescription-composer D9).
    const line = await within(drawer).findByRole('combobox', { name: 'Quick add' });
    await user.type(line, 'glyco 1-0-1 af 10d');
    expect(await screen.findByText(/4 in stock/)).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(notifyMock.success).toHaveBeenCalledWith('Glycolac Cream added');
    const row = within(drawer).getAllByTestId('rx-items-row')[0] as HTMLElement;
    expect(within(row).getByTestId('rx-items-qty')).toHaveValue('20');
    expect(within(row).getByTestId('rx-items-dose-night')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows the server’s field errors on the line it names and opens Medicines', async () => {
    rxServerApi.createPrescription.mockRejectedValueOnce(
      new HttpError('Invalid', 400, '/app/patients/…/prescriptions', 'POST', {
        error: {
          type: 'validation_error',
          errors: [
            { field: 'body.items/1/quantity', message: 'Too small: expected >=1' },
          ],
        },
      }),
    );
    const { user, drawer } = await openNew(DRAFTER);
    await user.click(
      within(drawer).getByTestId(`rx-drawer-quick-fill-kit-${HAIR_FALL.id}`),
    );
    await user.click(within(drawer).getByTestId('rx-drawer-step-notes-trigger'));
    await user.click(within(drawer).getByTestId('rx-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Too small: expected >=1'),
    );
    expect(within(drawer).getByTestId('rx-drawer-step-medicines')).toHaveAttribute(
      'data-status',
      'open',
    );
  });

  it('edits a draft, prints it and saves it with its updated_at, approving it', async () => {
    const { user, drawer, router } = await openEdit();
    expect(within(drawer).getByTestId('rx-drawer-title')).toHaveTextContent(
      'Edit prescription',
    );
    expect(within(drawer).getByTestId('rx-drawer-tag')).toHaveTextContent('#500');
    expect(within(drawer).getByTestId('rx-drawer-badges')).toHaveTextContent('Draft');
    await user.click(within(drawer).getByTestId('rx-drawer-quick-fill-print'));
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
    await user.click(within(drawer).getByTestId('rx-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Prescription #500 approved'),
    );
    expect(rxServerApi.updatePrescription).toHaveBeenCalledWith(
      expect.objectContaining({
        prescriptionId: TEST_PRESCRIPTION_ID,
        expectedUpdatedAt: '2026-10-01T05:00:00.000Z',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
  });

  it('offers Reload when someone saved the draft meanwhile, and reads it again', async () => {
    const { user, drawer } = await openEdit();
    // Saved elsewhere since the drawer read it.
    rxWorld.prescriptions = [
      prescriptionRecord({ updatedAt: '2026-10-02T09:00:00.000Z' }),
    ];
    await user.click(within(drawer).getByTestId('rx-drawer-save'));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    const options = notifyMock.error.mock.lastCall?.[1] as {
      action?: { label: string; onClick: () => void };
    };
    expect(options.action?.label).toBe('Reload');
    rxServerApi.fetchPrescription.mockClear();
    options.action?.onClick();
    await waitFor(() => expect(rxServerApi.fetchPrescription).toHaveBeenCalled());
    await user.click(within(drawer).getByTestId('rx-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Prescription #500 approved'),
    );
  });

  it('reads an approved prescription only — it can print, not change or go', async () => {
    rxWorld.prescriptions = [prescriptionRecord({ status: 'approved' })];
    const { drawer } = await openEdit();
    expect(within(drawer).getByTestId('rx-drawer-approved')).toHaveTextContent(
      'an approved prescription can’t be changed',
    );
    expect(within(drawer).getByTestId('rx-drawer-badges')).toHaveTextContent('Approved');
    expect(within(drawer).queryByTestId('rx-drawer-save')).not.toBeInTheDocument();
    expect(within(drawer).queryByTestId('rx-drawer-delete')).not.toBeInTheDocument();
    expect(within(drawer).getByTestId('rx-drawer-quick-fill-print')).toBeInTheDocument();
  });

  it('reads only for a member without the Rx gate (S:37)', async () => {
    const { drawer } = await openEdit({ role: 'front_desk' });
    expect(within(drawer).queryByTestId('rx-drawer-save')).not.toBeInTheDocument();
    expect(within(drawer).getByTestId('rx-drawer-summary')).toHaveTextContent(
      'View only · your role can’t change this',
    );
  });

  it('deletes a draft with a reason, offering Undo that restores it', async () => {
    const { user, drawer, router } = await openEdit();
    await user.click(within(drawer).getByTestId('rx-drawer-delete'));
    const confirm = await screen.findByTestId('confirm-dialog');
    expect(within(confirm).getByTestId('confirm-record')).toHaveTextContent(
      'Prescription #500',
    );
    await user.click(within(confirm).getByTestId('confirm-reason-mistake'));
    await user.click(within(confirm).getByTestId('confirm-accept'));
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    expect(rxServerApi.deletePrescription).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      prescriptionId: TEST_PRESCRIPTION_ID,
      reason: 'mistake',
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith('Prescription deleted', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.lastCall as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(rxServerApi.restorePrescription).toHaveBeenCalled());
    expect(rxWorld.prescriptions.map((prescription) => prescription.id)).toEqual([
      TEST_PRESCRIPTION_ID,
    ]);
  });

  it('in the visit flow: writes at the visit’s booking, approves and prints (L-64)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPrescriptions(url(''), {
      ui: (
        <PrescriptionDrawer
          prescription={null}
          patient={{ id: TEST_PATIENT_ID, name: 'Priya Shah', seq: 3508 }}
          history={[]}
          catalog={undefined}
          kits={[HAIR_FALL]}
          defaultDoctorId={DOCTOR_NISHA.id}
          access={{ writes: true, approves: true, deletes: false, sells: false }}
          today="2026-10-03"
          visit={{ appointmentId: 'appt_sana0000000000000000', fromToday: true }}
          onClose={onClose}
        />
      ),
    });
    const drawer = await screen.findByTestId('rx-drawer');
    const save = within(drawer).getByTestId('rx-drawer-save');
    expect(save).toHaveTextContent('Approve · print · send to pharmacy');
    await user.click(
      within(drawer).getByTestId(`rx-drawer-quick-fill-kit-${HAIR_FALL.id}`),
    );
    await user.click(save);
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
    expect(rxServerApi.createPrescription.mock.lastCall?.[0]).toMatchObject({
      appointmentId: 'appt_sana0000000000000000',
    });
    expect(written()?.status).toBe('approved');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('the prescription composer (feat-prescription-composer)', () => {
  const SEPTRAN = {
    id: 'med_septran0000000000000000',
    name: 'Septran DS',
    composition: 'Sulfamethoxazole 800 mg + Trimethoprim 160 mg',
    stock: 6,
  };
  const GLYCOLAC = {
    id: 'med_glycolac000000000000',
    name: 'Glycolac Cream',
    composition: null,
    stock: 4,
  };
  /** Priya, allergic to sulfa drugs. */
  const allergicFile = () =>
    patientFile({ patient: patientRecord({ allergies: ['Sulfa drugs'] }) });

  async function openNewFor(file = patientFile()) {
    const user = userEvent.setup();
    const view = renderPrescriptions(url('/create'), { member: { role: 'admin' }, file });
    const drawer = await screen.findByTestId('rx-drawer');
    return { ...view, user, drawer };
  }

  it('opens a new prescription on Medicines, the quick line focused and its list closed', async () => {
    const { drawer } = await openNew();
    expect(within(drawer).getByTestId('rx-drawer-step-medicines')).toHaveAttribute(
      'data-status',
      'open',
    );
    const line = within(drawer).getByRole('combobox', { name: 'Quick add' });
    await waitFor(() => expect(line).toHaveFocus());
    expect(screen.queryByTestId('rx-quick-line-matches')).toBeNull();
  });

  it('opens an edit on Medicines, its title keeping the focus', async () => {
    const { drawer } = await openEdit();
    expect(within(drawer).getByTestId('rx-drawer-step-medicines')).toHaveAttribute(
      'data-status',
      'open',
    );
    await waitFor(() =>
      expect(within(drawer).getByTestId('rx-drawer-title')).toHaveFocus(),
    );
  });

  it('reads a pasted prescription in the Pad and adds every readable line', async () => {
    rxWorld.medicines = [GLYCOLAC];
    const { user, drawer } = await openNew();
    const toggle = within(drawer).getByTestId('rx-pad-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const pad = within(drawer).getByTestId('rx-pad');
    const input = within(pad).getByRole('textbox', { name: 'Rx Pad' });
    await waitFor(() => expect(input).toHaveFocus());

    await user.paste('1. Tab. glyco 1-0-1 af 10d\n- kojic gel face\n0-0-1');

    expect(
      within(pad)
        .getAllByTestId('rx-pad-line')
        .map((line) => line.dataset.kind),
    ).toEqual(['found', 'typed', 'unreadable']);
    expect(within(pad).getByTestId('rx-pad-summary')).toHaveTextContent(
      '3 lines · 1 found · 1 new · 1 skipped',
    );
    expect(within(pad).getAllByTestId('rx-pad-line')[0]).toHaveTextContent('4 in stock');
    expect(within(pad).getByTestId('rx-pad-add')).toHaveTextContent('Add 2 medicines');

    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(notifyMock.success).toHaveBeenCalledWith('2 medicines added');
    expect(input).toHaveValue('');
    const rows = within(drawer).getAllByTestId('rx-items-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByTestId('rx-items-qty')).toHaveValue('20');
    expect(within(drawer).getByTestId('rx-drawer-badges')).toHaveTextContent(
      '2 medicines',
    );
  });

  it('closes the Pad with Esc and keeps the drawer, the focus back on its toggle', async () => {
    const { user, drawer } = await openNew();
    await user.click(within(drawer).getByTestId('rx-pad-toggle'));
    await waitFor(() =>
      expect(within(drawer).getByRole('textbox', { name: 'Rx Pad' })).toHaveFocus(),
    );
    await user.keyboard('{Escape}');
    expect(within(drawer).queryByTestId('rx-pad')).toBeNull();
    expect(screen.getByTestId('rx-drawer')).toBeVisible();
    expect(within(drawer).getByTestId('rx-pad-toggle')).toHaveFocus();
  });

  it('names a line that matches an allergy, and asks before it saves', async () => {
    rxWorld.medicines = [SEPTRAN];
    const { user, drawer } = await openNewFor(allergicFile());
    const band = within(drawer).getByTestId('rx-drawer-allergy-band');
    expect(band).toHaveTextContent('Allergies: Sulfa drugs');

    await user.type(
      within(drawer).getByRole('combobox', { name: 'Quick add' }),
      'septran bd',
    );
    await user.keyboard('{Enter}');
    expect(within(band).getByTestId('rx-drawer-allergy-band-match')).toHaveTextContent(
      `${fsi('Septran DS')} matches ${fsi('Sulfa drugs')}`,
    );

    await user.click(within(drawer).getByTestId('rx-drawer-save'));
    const confirm = await screen.findByTestId('rx-allergy-confirm');
    expect(confirm).toHaveTextContent('Prescribe despite the allergy?');
    expect(confirm).toHaveTextContent('This medicine matches the patient’s allergies:');
    await user.click(screen.getByTestId('rx-allergy-confirm-cancel'));
    expect(rxServerApi.createPrescription).not.toHaveBeenCalled();

    await user.click(within(drawer).getByTestId('rx-drawer-save'));
    await user.click(await screen.findByTestId('rx-allergy-confirm-accept'));
    await waitFor(() => expect(rxServerApi.createPrescription).toHaveBeenCalled());
    expect(
      rxServerApi.createPrescription.mock.lastCall?.[0].fields.items[0]?.medicineName,
    ).toBe('Septran DS');
  });

  it('keeps the guard quiet for a patient without allergies, or whose allergies it may not see', async () => {
    const { drawer } = await openNewFor(
      patientFile({ patient: patientRecord({ allergies: null }) }),
    );
    expect(within(drawer).queryByTestId('rx-drawer-allergy-band')).toBeNull();
    expect(within(drawer).queryByTestId('rx-sidekick-allergies')).toBeNull();
  });

  it('shows what changed since the last prescription and continues a stopped medicine', async () => {
    const { user, drawer } = await openNew();
    const sidekick = within(drawer).getByTestId('rx-sidekick');
    expect(sidekick).toHaveAttribute('data-layout', 'column');
    expect(within(sidekick).getByTestId('rx-sidekick-allergies')).toHaveTextContent(
      'No allergies recorded',
    );
    const since = within(sidekick).getByTestId('rx-sidekick-since');
    expect(since).toHaveTextContent(`Since Rx ${fsi('#500')} · ${fsi('Oct 1')}`);
    const changes = () =>
      within(since)
        .queryAllByTestId('rx-sidekick-change')
        .map((change) => change.dataset.kind);
    expect(changes()).toEqual(['stopped']);

    await user.click(within(since).getByTestId('rx-sidekick-continue'));

    expect(notifyMock.success).toHaveBeenCalledWith(`${fsi('Flubolt 400')} continued`);
    expect(changes()).toEqual([]);
    expect(within(since).getByTestId('rx-sidekick-unchanged')).toHaveTextContent(
      '1 unchanged · Flubolt 400',
    );
    expect(within(sidekick).getByTestId('rx-sidekick-reads-line')).toHaveTextContent(
      'Flubolt 4001 at night · After meal · 8 in all',
    );
  });

  it('folds the sidekick into a card below xl, its summary first', async () => {
    viewport.tier = 'tablet';
    const { user, drawer } = await openNewFor(allergicFile());
    const sidekick = within(drawer).getByTestId('rx-sidekick');
    expect(sidekick).toHaveAttribute('data-layout', 'card');
    const toggle = within(sidekick).getByTestId('rx-sidekick-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(sidekick).getByTestId('rx-sidekick-summary')).toHaveTextContent(
      '1 change since Rx #500',
    );
    expect(within(sidekick).queryByTestId('rx-sidekick-since')).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(sidekick).getByTestId('rx-sidekick-since')).toBeVisible();
  });

  it('has no axe violations with the Pad, the band and the sidekick open', async () => {
    rxWorld.medicines = [SEPTRAN];
    const { user, drawer, baseElement } = await openNewFor(allergicFile());
    await user.click(within(drawer).getByTestId('rx-pad-toggle'));
    await user.paste('septran bd 5d');
    await within(drawer).findByTestId('rx-pad-line-allergy');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
