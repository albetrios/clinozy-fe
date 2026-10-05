import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';

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

const DHARTI = patientRef('Dharti Galani');
const url = () => patientFileUrl(DHARTI, '/notes');
const notes = () => screen.findAllByTestId(/^patient-note-(?!delete)/);
const liveNotes = () =>
  clinicFixtures.patientNotes.snapshot((note) => note.patientId === DHARTI);

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('PatientNotesPage', () => {
  it('renders the Team notes section in the patient file', async () => {
    renderPatientFile(url());
    expect(await screen.findByTestId('patient-section-notes')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Team notes' }),
    ).toBeInTheDocument();
  });

  it('lists the notes newest first with who wrote them and when (H:834)', async () => {
    renderPatientFile(url());
    const [newest, oldest] = await notes();
    if (!(newest && oldest)) throw new Error('no notes');
    expect(newest).toHaveTextContent(
      'Patient suggested the peel package, will decide after first session',
    );
    // The author and the time are isolated: "Riya S." keeps its full stop at its end.
    expect(
      within(newest).getByText(new RegExp(`^${fsi('Riya S\\.')} · `)),
    ).toBeInTheDocument();
    expect(oldest).toHaveTextContent('Clinic visited');
  });

  it('adds a note on top and clears the composer; an empty one does nothing', async () => {
    const user = userEvent.setup();
    renderPatientFile(url());
    await notes();
    const input = screen.getByRole('textbox', { name: 'New note' });
    await user.click(screen.getByTestId('patient-notes-add'));
    expect(liveNotes()).toHaveLength(2);
    await user.type(input, 'call before the next session');
    await user.click(screen.getByTestId('patient-notes-add'));
    expect(input).toHaveValue('');
    await waitFor(() => expect(liveNotes()).toHaveLength(3));
    const [newest] = await notes();
    expect(newest).toHaveTextContent('Call before the next session');
  });

  it('deletes a note at once and offers Undo', async () => {
    const user = userEvent.setup();
    renderPatientFile(url(), { role: 'owner' });
    await notes();
    await user.click(screen.getByTestId(`patient-note-delete-${ref.patientNote(1)}`));
    await waitFor(() => expect(liveNotes()).toHaveLength(1));
    expect(notifyMock.undo).toHaveBeenCalledWith('Note deleted', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(liveNotes()).toHaveLength(2));
  });

  it('gives a member who only reads the file the notes alone', async () => {
    renderPatientFile(url(), { role: 'therapist' });
    expect(await notes()).toHaveLength(2);
    expect(screen.queryByRole('textbox', { name: 'New note' })).not.toBeInTheDocument();
    expect(screen.queryByTestId(/^patient-note-delete-/)).not.toBeInTheDocument();
  });

  it('says so when the patient has no notes', async () => {
    renderPatientFile(patientFileUrl(patientRef('Kavya Joshi'), '/notes'));
    expect(await screen.findByText('No notes yet')).toBeInTheDocument();
  });
});
