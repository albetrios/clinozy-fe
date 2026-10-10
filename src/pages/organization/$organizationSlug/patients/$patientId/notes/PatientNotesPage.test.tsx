import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import type { ContactActivityEntry } from '@/shared/api/clinic/contact-activities-api.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { DOCTOR_ARJUN, DOCTOR_NISHA } from '@/tests/utils/appointment-doubles.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { patientFile, TEST_CONTACT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';
import { PatientNotesPage } from './PatientNotesPage.tsx';

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
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** The person's notes as clinozy-be holds them, newest first — a page of `pageSize`. */
const server = vi.hoisted(() => ({
  notes: [] as ContactActivityEntry[],
  pageSize: 25,
  failRead: false,
  refuseNext: false,
}));
vi.mock('@/shared/api/clinic/contact-activities-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listContactActivities: vi.fn(async ({ after }: { after?: string }) => {
    if (server.failRead) throw new Error('offline');
    const start = Number(after ?? 0);
    const end = start + server.pageSize;
    return {
      rows: structuredClone(server.notes.slice(start, end)),
      next: end < server.notes.length ? String(end) : null,
      hasMore: end < server.notes.length,
      total: start === 0 ? server.notes.length : null,
    };
  }),
  sendContactActivity: vi.fn(async ({ body }: { body: string }) => {
    if (server.refuseNext) {
      server.refuseNext = false;
      throw new Error('refused');
    }
    server.notes.unshift(
      note('msg_new', body, DOCTOR_NISHA.id, '2026-10-03T06:00:00.000Z'),
    );
    return { id: 'msg_new' };
  }),
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(async () => [DOCTOR_NISHA, DOCTOR_ARJUN]),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(async () => DOCTOR_NISHA.id),
}));

import {
  listContactActivities,
  sendContactActivity,
} from '@/shared/api/clinic/contact-activities-api.ts';

/** A team note of Priya's person. */
function note(
  id: string,
  body: string,
  authorId: string,
  occurredAt: string,
): ContactActivityEntry {
  return { id, type: 'note', group: 'messages', body, occurredAt, authorId, link: null };
}

const NEWEST = note(
  'msg_peel',
  'Patient suggested the peel package, will decide after first session',
  DOCTOR_ARJUN.id,
  '2026-10-02T10:09:00.000Z',
);
const OLDEST = note(
  'msg_visit',
  'Clinic visited',
  DOCTOR_NISHA.id,
  '2026-09-24T05:00:00.000Z',
);

/** Says when the member's access is known — before then every gate reads "not allowed". */
function AccessProbe() {
  const access = useClinicAccess();
  return access.isResolved ? <span data-testid="access-resolved" /> : null;
}

/** A member who reads the whole file and writes nothing in it — no preset is that narrow. */
const READS_ONLY: OrganizationPermission[] = [
  'organization:read',
  'patient:read',
  'patient:clinical_record:read',
  'contact_activity:read',
  'appointment:read',
];

async function openNotes(
  role: Role = 'admin',
  codes?: readonly OrganizationPermission[],
) {
  const user = userEvent.setup();
  const view = renderInPatientFile(
    <>
      <PatientNotesPage />
      <AccessProbe />
    </>,
    { file: patientFile(), section: 'notes', role, codes },
  );
  await screen.findByTestId('access-resolved');
  return { user, ...view };
}
const cards = () => screen.findAllByTestId(/^patient-note-msg_/);

beforeEach(() => {
  vi.resetAllMocks();
  server.notes = [NEWEST, OLDEST];
  server.pageSize = 25;
  server.failRead = false;
  server.refuseNext = false;
});
afterEach(() => resetPatientFile());

describe('PatientNotesPage (§6 #3)', () => {
  it('lists the person’s notes newest first, with who wrote them and when (H:834)', async () => {
    const { container } = await openNotes();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Team notes' }),
    ).toBeInTheDocument();
    const [newest, oldest] = await cards();
    if (!(newest && oldest)) throw new Error('no notes');
    expect(newest).toHaveTextContent(
      'Patient suggested the peel package, will decide after first session',
    );
    // The author and the time are isolated: "Arjun R." keeps its full stop at its end.
    expect(
      within(newest).getByText(new RegExp(`^${fsi('Arjun R\\.')} · `)),
    ).toBeInTheDocument();
    expect(oldest).toHaveTextContent('Clinic visited');
    expect(listContactActivities).toHaveBeenCalledWith({
      contactId: TEST_CONTACT_ID,
      filter: { type: ['note'] },
      limit: 25,
      after: undefined,
    });
    // No delete and no Undo: the API has no way back for a note (G4).
    expect(screen.queryByRole('button', { name: 'Delete note' })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('adds a note on top at once and clears the composer; an empty one does nothing', async () => {
    const { user } = await openNotes();
    await cards();
    const input = screen.getByRole('textbox', { name: 'New note' });
    await user.click(screen.getByTestId('patient-notes-add'));
    expect(sendContactActivity).not.toHaveBeenCalled();

    await user.type(input, '  call before the next session ');
    await user.click(screen.getByTestId('patient-notes-add'));
    expect(input).toHaveValue('');
    // The note tops the list before the answer lands, its author the signed-in member.
    const [newest] = await cards();
    expect(newest).toHaveTextContent('call before the next session');
    expect(newest).toHaveTextContent('Nisha S.');
    expect(sendContactActivity).toHaveBeenCalledWith({
      contactId: TEST_CONTACT_ID,
      channel: 'note',
      body: 'call before the next session',
      idempotencyKey: expect.any(String),
    });
    await waitFor(async () => expect(await cards()).toHaveLength(3));
  });

  it('puts a refused note back into the box — its error toasts', async () => {
    server.refuseNext = true;
    const { user } = await openNotes();
    await cards();
    const input = screen.getByRole('textbox', { name: 'New note' });
    await user.type(input, 'Allergic to lidocaine');
    await user.click(screen.getByTestId('patient-notes-add'));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    expect(input).toHaveValue('Allergic to lidocaine');
    expect(await cards()).toHaveLength(2);
  });

  it('reads a page at a time — "Load more" reads the next', async () => {
    server.pageSize = 1;
    const { user } = await openNotes();
    expect(await cards()).toHaveLength(1);
    await user.click(screen.getByTestId('patient-notes-more'));
    await waitFor(async () => expect(await cards()).toHaveLength(2));
    expect(screen.queryByTestId('patient-notes-more')).not.toBeInTheDocument();
  });

  it('gives a member who only reads the file the notes alone', async () => {
    await openNotes('admin', READS_ONLY);
    expect(await cards()).toHaveLength(2);
    expect(screen.queryByRole('textbox', { name: 'New note' })).not.toBeInTheDocument();
  });

  it('asks nothing for a member who may not read the stream', async () => {
    await openNotes('accountant');
    expect(screen.queryByRole('textbox', { name: 'New note' })).not.toBeInTheDocument();
    expect(listContactActivities).not.toHaveBeenCalled();
  });

  it('says so when the person has no notes, and when the read failed, with Retry', async () => {
    server.notes = [];
    const { unmount } = await openNotes();
    expect(await screen.findByText('No notes yet')).toBeInTheDocument();
    unmount();

    server.failRead = true;
    const { user } = await openNotes();
    const retry = await screen.findByTestId('retry-button');
    server.failRead = false;
    server.notes = [OLDEST];
    await user.click(retry);
    expect(await screen.findByText('Clinic visited')).toBeInTheDocument();
  });
});
