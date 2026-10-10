import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import {
  addCivilDays,
  clinicInstant,
  clinicToday,
} from '@/shared/api/clinic/clinic-time.ts';
import type {
  ContactActivityEntry,
  ContactActivityFilter,
} from '@/shared/api/clinic/contact-activities-api.ts';
import { PATIENT_FILE_SECTIONS } from '@/shared/clinic/patient-file-sections.ts';
import { DOCTOR_NISHA } from '@/tests/utils/appointment-doubles.ts';
import {
  patientFile,
  TEST_CONTACT_ID,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';

import {
  patientFileUrl,
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { ActivityTimeline } from './ActivityTimeline.tsx';

/** The person's stream as the server holds it, newest first — each read filters it. */
const server = vi.hoisted(() => ({
  entries: [] as ContactActivityEntry[],
  fail: false,
  pageSize: 20,
}));
vi.mock('@/shared/api/clinic/contact-activities-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listContactActivities: vi.fn(
    async ({
      filter,
      after,
    }: {
      contactId: string;
      filter: ContactActivityFilter;
      limit: number;
      after?: string;
    }) => {
      if (server.fail) throw new Error('offline');
      const rows = server.entries.filter(
        (entry) =>
          (!filter.type || filter.type.includes(entry.type)) &&
          (!filter.group || filter.group.includes(entry.group)),
      );
      const start = Number(after ?? 0);
      const end = start + server.pageSize;
      return {
        rows: rows.slice(start, end),
        next: end < rows.length ? String(end) : null,
        hasMore: end < rows.length,
        total: start === 0 ? rows.length : null,
      };
    },
  ),
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(async () => [DOCTOR_NISHA]),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(async () => DOCTOR_NISHA.id),
}));

import { listContactActivities } from '@/shared/api/clinic/contact-activities-api.ts';

const today = clinicToday();

/** An entry `days` from today at `time`. */
function entry(
  id: string,
  days: number,
  time: string,
  more: Partial<ContactActivityEntry> = {},
): ContactActivityEntry {
  return {
    id,
    type: 'system',
    group: 'clinical',
    body: id,
    occurredAt: clinicInstant(addCivilDays(today, days), time),
    authorId: null,
    link: null,
    ...more,
  };
}

const TREATMENT = entry('Treatment recorded: Back Peeling', 0, '11:05', {
  link: { kind: 'treatment', id: 'trt_peel' },
});
const NOTE = entry('Call before the next session', 0, '09:30', {
  type: 'note',
  group: 'messages',
  authorId: DOCTOR_NISHA.id,
});
const INVOICE = entry('Invoice 2026-27/0002 billed: ₹9,794.00', -1, '17:00', {
  group: 'money',
  link: { kind: 'invoice', id: 'invc_two' },
});
const TASK = entry('Task closed · Call done', -9, '10:00', {
  group: 'tasks',
  link: { kind: 'task', id: 'task_call' },
});

const rows = () => screen.getAllByTestId('overview-activity-row');
const texts = () => rows().map((row) => row.textContent);

function renderTimeline(options: Parameters<typeof renderInPatientFile>[1] = {}) {
  const user = userEvent.setup();
  const view = renderInPatientFile(<ActivityTimeline />, {
    file: patientFile(),
    section: 'timeline',
    ...options,
  });
  return { user, ...view };
}

beforeEach(() => {
  vi.resetAllMocks();
  server.entries = [TREATMENT, NOTE, INVOICE, TASK];
  server.fail = false;
  server.pageSize = 20;
});
afterEach(() => resetPatientFile());

describe('ActivityTimeline (KICKOFF §6.6, H:4840–4864; §6 #2)', () => {
  it('lists the person’s record events and notes, newest first under their days', async () => {
    const { container } = renderTimeline();
    await screen.findAllByTestId('overview-activity-row');
    expect(listContactActivities).toHaveBeenCalledWith({
      contactId: TEST_CONTACT_ID,
      filter: { type: ['system', 'note'] },
      limit: 20,
      after: undefined,
    });
    expect(texts()).toEqual([
      expect.stringContaining('Treatment recorded: Back Peeling'),
      expect.stringContaining('Call before the next session'),
      expect.stringContaining('Invoice 2026-27/0002 billed:'),
      expect.stringContaining('Task closed · Call done'),
    ]);
    const card = screen.getByTestId('overview-activity');
    expect(within(card).getByText('Today')).toBeInTheDocument();
    expect(within(card).getByText('Yesterday')).toBeInTheDocument();
    // A note shows who wrote it.
    expect(rows()[1]).toHaveTextContent('NS');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('masks the amounts in the server’s lines while the file is masked (Q-F4)', async () => {
    const { unmount } = renderTimeline();
    await screen.findAllByTestId('overview-activity-row');
    expect(screen.queryByText(/₹9,794\.00/)).not.toBeInTheDocument();
    unmount();

    renderTimeline({ masked: false });
    expect(await screen.findByText(/₹9,794\.00/)).toBeInTheDocument();
  });

  it('opens each row’s record — a task’s event opens nothing', async () => {
    const { user, router } = renderTimeline();
    await screen.findAllByTestId('overview-activity-row');
    const [treatment, note, invoice, task] = rows();
    expect(task?.tagName).toBe('DIV');

    await user.click(treatment!);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(TEST_PATIENT_ID, '/treatments/trt_peel/edit'),
      ),
    );
    await user.click(note!);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(TEST_PATIENT_ID, '/notes'),
      ),
    );
    await user.click(invoice!);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(TEST_PATIENT_ID, '/invoices'),
      ),
    );
  });

  it('filters by the stream’s own groups and notes — no tab carries a count', async () => {
    const { user } = renderTimeline();
    await screen.findAllByTestId('overview-activity-row');
    const tabs = screen.getByRole('tablist', { name: 'Activity filters' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.getAttribute('data-testid')),
    ).toEqual([
      'overview-activity-filter-all',
      'overview-activity-filter-clinical',
      'overview-activity-filter-money',
      'overview-activity-filter-notes',
    ]);

    await user.click(screen.getByTestId('overview-activity-filter-money'));
    await waitFor(() =>
      expect(texts()).toEqual([expect.stringContaining('Invoice 2026-27/0002')]),
    );
    expect(listContactActivities).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: { group: ['money'] } }),
    );

    await user.click(screen.getByTestId('overview-activity-filter-notes'));
    await waitFor(() =>
      expect(texts()).toEqual([expect.stringContaining('Call before the next session')]),
    );
    expect(listContactActivities).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: { type: ['note'] } }),
    );
  });

  it('leaves money out without billing view — its tab and its events', async () => {
    renderTimeline({
      viewable: PATIENT_FILE_SECTIONS.filter(
        (section) => section !== 'invoices' && section !== 'payments',
      ),
    });
    await screen.findAllByTestId('overview-activity-row');
    expect(
      screen.queryByTestId('overview-activity-filter-money'),
    ).not.toBeInTheDocument();
    expect(listContactActivities).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { type: ['system', 'note'], group: ['clinical', 'messages', 'tasks'] },
      }),
    );
    expect(texts()).toHaveLength(3);
  });

  it('reads a page at a time — "Load more" reads the next', async () => {
    server.pageSize = 2;
    const { user } = renderTimeline();
    await screen.findAllByTestId('overview-activity-row');
    expect(rows()).toHaveLength(2);
    await user.click(screen.getByTestId('overview-activity-more'));
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(screen.queryByTestId('overview-activity-more')).not.toBeInTheDocument();
  });

  it('says when there is nothing yet, and when the read failed, with Retry', async () => {
    server.entries = [];
    const { unmount } = renderTimeline();
    expect(await screen.findByText('No activity yet')).toBeInTheDocument();
    unmount();

    server.fail = true;
    const { user } = renderTimeline();
    const retry = await screen.findByTestId('retry-button');
    server.fail = false;
    server.entries = [NOTE];
    await user.click(retry);
    expect(await screen.findByText('Call before the next session')).toBeInTheDocument();
  });

  it('shows nothing to a member who may not read the stream, and asks nothing', async () => {
    renderTimeline({ role: 'accountant' });
    await waitFor(() => expect(screen.queryByTestId('overview-activity')).toBeNull());
    expect(listContactActivities).not.toHaveBeenCalled();
  });
});
