import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type {
  ClinicalNote,
  ClinicalNoteKind,
} from '@/shared/api/app/clinical-notes-contracts.ts';
import type { FeedbackItem } from '@/shared/api/app/feedback-contracts.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';
import type { FeedbackCardProps } from './components/FeedbackCard/index.ts';
import type { LogFeedbackPickerProps } from './components/LogFeedbackPicker/index.ts';
import { PatientOverviewPage } from './PatientOverviewPage.tsx';

/** The patient's notes as the server holds them — the API module's double reads and writes it. */
const server = vi.hoisted(() => ({
  notes: [] as ClinicalNote[],
  deleted: [] as ClinicalNote[],
  next: 0,
}));

vi.mock('@/shared/api/app/clinical-notes-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listClinicalNotes: vi.fn(async () => structuredClone(server.notes)),
  createClinicalNote: vi.fn(
    async ({ kind, text }: { kind: ClinicalNoteKind; text: string }) => {
      server.next += 1;
      const created = note(`pcn_new${server.next}`, kind, text);
      server.notes.push(created);
      return created;
    },
  ),
  deleteClinicalNote: vi.fn(async ({ noteId }: { noteId: string }) => {
    server.deleted.push(...server.notes.filter((row) => row.id === noteId));
    server.notes = server.notes.filter((row) => row.id !== noteId);
  }),
  restoreClinicalNote: vi.fn(async ({ noteId }: { noteId: string }) => {
    const back = server.deleted.find((row) => row.id === noteId);
    if (!back) throw new Error('record_not_deleted');
    server.notes.unshift(back);
    return back;
  }),
}));
// The plan card and Feedback are their own suites' (Offering suggestions, FeedbackCard,
// LogFeedbackPicker): here they are stand-ins that show what the section hands them.
vi.mock('@/shared/components/OfferingSuggestions/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  usePlanCard: vi.fn(() => ({ props: {} })),
  OfferingSuggestions: () => <div data-testid="offering-suggestions" />,
}));
vi.mock('./components/FeedbackCard/index.ts', () => ({
  FeedbackCard: ({ access, onLog, onEdit }: FeedbackCardProps) => (
    <div
      data-testid="feedback-card"
      data-can-edit={access.checkIns}
      data-can-log-review={access.logReview}
    >
      <button type="button" onClick={onLog}>
        Log feedback
      </button>
      <button
        type="button"
        onClick={() => onEdit({ kind: 'checkIn', id: 'pci_visit' } as FeedbackItem)}
      >
        Edit check-in
      </button>
    </div>
  ),
}));
vi.mock('./components/LogFeedbackPicker/index.ts', () => ({
  LogFeedbackPicker: ({ patientName, from, onClose }: LogFeedbackPickerProps) => (
    <div data-testid="log-feedback-picker">
      {patientName} · {from}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
import {
  createClinicalNote,
  deleteClinicalNote,
  listClinicalNotes,
} from '@/shared/api/app/clinical-notes-api.ts';
import { usePlanCard } from '@/shared/components/OfferingSuggestions/index.ts';
import { notify } from '@/shared/notify/index.ts';

/** A note of Priya's. */
function note(id: string, kind: ClinicalNoteKind, text: string): ClinicalNote {
  return {
    id,
    patientId: TEST_PATIENT_ID,
    kind,
    text,
    appointmentId: null,
    diagnosisId: null,
    addedAt: '2026-10-01T05:00:00.000Z',
  };
}

/** Says when the member's access is known — before then every gate reads "not allowed". */
function AccessProbe() {
  const access = useAppAccess();
  return access.isResolved ? <span data-testid="access-resolved" /> : null;
}

const CARDS = [
  'clinical-card-complaints',
  'clinical-card-diagnosis',
  'clinical-card-treatment-suggestions',
  'clinical-card-future-suggestions',
];

/** A member who reads the whole file and writes nothing in it — no preset is that narrow. */
const READS_ONLY: OrganizationPermission[] = [
  'organization:read',
  'patient:read',
  'patient:clinical_record:read',
  'contact_activity:read',
  'appointment:read',
];

async function openNotes(codes?: readonly OrganizationPermission[]) {
  const user = userEvent.setup();
  const view = renderInPatientFile(
    <>
      <PatientOverviewPage />
      <AccessProbe />
    </>,
    { file: patientFile(), section: 'overview', codes },
  );
  await screen.findAllByTestId('clinical-card-complaints-chip');
  await screen.findByTestId('access-resolved');
  return { ...view, user };
}

beforeEach(() => {
  vi.resetAllMocks();
  server.notes = [
    note('pcn_tanning', 'complaint', 'Tanning on face'),
    note('pcn_uneven', 'complaint', 'Uneven skin tone'),
    note('pcn_pih', 'diagnosis', 'Post-inflammatory hyperpigmentation'),
    note('pcn_safety', 'safety_check', 'No isotretinoin this month'),
  ];
  server.deleted = [];
  server.next = 0;
});
afterEach(() => resetPatientFile());

describe('PatientOverviewPage — Clinical notes (KICKOFF §6.6; H:780–826)', () => {
  it('lays the four chip cards out by its own width, over the plan and Feedback', async () => {
    const { container } = await openNotes();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Clinical notes' }),
    ).toBeInTheDocument();
    for (const id of CARDS) {
      expect(screen.getByTestId(id)).toHaveClass(
        'col-span-12',
        '@min-[620px]:col-span-6',
        '@min-[980px]:col-span-3',
      );
    }
    expect(screen.getByTestId(CARDS[0] ?? '').parentElement).toHaveClass(
      '@container',
      'grid-cols-12',
    );
    expect(screen.getByTestId('clinical-card-diagnosis')).toHaveTextContent(
      'Post-inflammatory hyperpigmentation',
    );
    // A safety check has no card in the design.
    expect(screen.queryByText('No isotretinoin this month')).not.toBeInTheDocument();
    expect(listClinicalNotes).toHaveBeenCalledWith(TEST_PATIENT_ID);
    expect(screen.getByTestId('offering-suggestions')).toBeInTheDocument();
    expect(usePlanCard).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: TEST_PATIENT_ID,
        firstName: 'Priya',
        canEdit: true,
      }),
    );
    expect(screen.getByTestId('feedback-card')).toHaveAttribute('data-can-edit', 'true');
    expect(screen.getByTestId('feedback-card')).toHaveAttribute(
      'data-can-log-review',
      'true',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('adds a complaint as one clinical note — ringed as new', async () => {
    const { user } = await openNotes();
    const card = screen.getByTestId('clinical-card-complaints');
    await user.type(
      within(card).getByRole('textbox', { name: 'Add Complaints' }),
      'Dry patches{Enter}',
    );
    expect(within(card).getByTestId('clinical-card-complaints-new')).toHaveTextContent(
      '1 new',
    );
    await waitFor(() =>
      expect(createClinicalNote).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: TEST_PATIENT_ID,
          kind: 'complaint',
          text: 'Dry patches',
        }),
      ),
    );
    await waitFor(() =>
      expect(
        within(card)
          .getAllByTestId('clinical-card-complaints-chip')
          .map((chip) => chip.textContent),
      ).toEqual(['Tanning on face×', 'Uneven skin tone×', 'Dry patches×']),
    );
    expect(within(card).getByTestId('clinical-card-complaints-new')).toHaveTextContent(
      '1 new',
    );
  });

  it('removes a chip as not needed, with Undo that restores it (Q24)', async () => {
    const { user } = await openNotes();
    const card = screen.getByTestId('clinical-card-complaints');
    await user.click(
      within(card).getByRole('button', { name: 'Remove Tanning on face' }),
    );
    expect(within(card).queryByText('Tanning on face')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(deleteClinicalNote).toHaveBeenCalledWith({
        patientId: TEST_PATIENT_ID,
        noteId: 'pcn_tanning',
        reason: 'not_needed',
      }),
    );
    await waitFor(() => expect(notify.undo).toHaveBeenCalledTimes(1));
    const [message, options] = vi.mocked(notify.undo).mock.calls[0] ?? [];
    // `clinical.removed` — the English bundle once the locale file lands.
    expect(message).toMatch(/clinical\.removed|Tanning on face removed/);
    options?.onUndo();
    expect(await within(card).findByText('Tanning on face')).toBeInTheDocument();
  });

  it('says when the notes cannot be read, and Retry reads them again', async () => {
    vi.mocked(listClinicalNotes).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderInPatientFile(<PatientOverviewPage />, {
      file: patientFile(),
      section: 'overview',
    });
    expect(await screen.findByTestId('retry-error')).toHaveTextContent(
      'Could not load data.',
    );
    expect(screen.queryByTestId('clinical-card-complaints')).not.toBeInTheDocument();
    expect(screen.getByTestId('feedback-card')).toBeInTheDocument();
    await user.click(screen.getByTestId('retry-button'));
    expect(await screen.findAllByTestId('clinical-card-complaints-chip')).toHaveLength(2);
  });

  it('opens the Log feedback picker, and a card’s Edit over this section', async () => {
    const { user, router } = await openNotes();
    await user.click(screen.getByRole('button', { name: 'Log feedback' }));
    expect(screen.getByTestId('log-feedback-picker')).toHaveTextContent(
      'Priya Shah · overview',
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('log-feedback-picker')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit check-in' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${TEST_PATIENT_ID}/check-ins/pci_visit/edit`,
      ),
    );
    expect(router.state.location.search).toEqual({ from: 'overview' });
  });

  it('only reads without Patients edit', async () => {
    await openNotes(READS_ONLY);
    const card = screen.getByTestId('clinical-card-complaints');
    expect(within(card).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('feedback-card')).toHaveAttribute('data-can-edit', 'false');
  });
});
