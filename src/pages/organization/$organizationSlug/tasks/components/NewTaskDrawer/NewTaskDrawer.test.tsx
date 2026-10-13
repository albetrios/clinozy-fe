import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { appInstant } from '@/shared/api/app/app-time.ts';
import * as ContactsApiModule from '@/shared/api/app/contacts-api.ts';
import type { Contact, ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import * as LeadsApiModule from '@/shared/api/app/leads-api.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import * as TasksApiModule from '@/shared/api/app/tasks-api.ts';
import type { TaskFields } from '@/shared/api/app/tasks-contracts.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import type * as MyMembershipModule from '@/shared/tenancy/my-membership.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';
import { taskRecord } from '@/tests/utils/task-doubles.ts';

import type { TaskCreateSearch } from '../../tasks.dialog-search.ts';
import { NewTaskDrawer } from './NewTaskDrawer.tsx';

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
vi.mock('@/shared/api/app/contacts-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof ContactsApiModule>()),
  searchContacts: vi.fn(),
  fetchContact: vi.fn(),
}));
vi.mock('@/shared/api/app/leads-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof LeadsApiModule>()),
  fetchLead: vi.fn(),
}));
vi.mock('@/shared/api/app/tasks-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof TasksApiModule>()),
  addTask: vi.fn(),
  fetchTaskWorkerIds: vi.fn(),
}));

const team = vi.hoisted(() => ({ members: [] as DirectoryMember[] }));
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof DirectoryApiModule>()),
  fetchTeamDirectory: async () => structuredClone(team.members),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof MyMembershipModule>()),
  findMyMembershipId: async () => 'mem_yls33gz5jj66ful8q4ads',
}));

const { searchContacts, fetchContact } = ContactsApiModule;
const { fetchLead } = LeadsApiModule;
const { addTask, fetchTaskWorkerIds } = TasksApiModule;

/** 10:30 in the clinic, Sat 10 Oct 2026. */
const NOW = new Date('2026-10-10T05:00:00.000Z');

const member = (id: string, name: string, initials: string): DirectoryMember => ({
  id,
  userId: `usr_${id}`,
  name,
  initials,
  tone: 'sky',
  roleIds: [],
  branchIds: [],
});
/** The member signed in — on the front desk. */
const RIYA = member('mem_yls33gz5jj66ful8q4ads', 'Riya Shah', 'RS');
/** A counsellor — Anaya's lead is hers. */
const ASHA = member('mem_asha0000000000000000', 'Asha Mehta', 'AM');
/** Marketing — can't work tasks (no `task:read`), so never offered. */
const MAYA = member('mem_maya0000000000000000', 'Maya Iyer', 'MI');

/** Every code an Owner or Admin holds here. */
const ADMIN_CODES: OrganizationPermission[] = [
  'organization:read',
  'task:read',
  'task:create',
  'task:update',
  'task:delete',
  'lead:read',
];

const ANAYA_LEAD = 'lead_hplz5ew0h3tw99ntqf39w';

/** A person as the search answers. */
function hit(patch: Partial<ContactSummary>): ContactSummary {
  return {
    id: 'con_8hb15isod6txlpljrn1f7',
    contactNumber: 9,
    firstName: 'Anaya',
    lastName: 'Desai',
    name: 'Anaya Desai',
    primaryPhone: '+919826005869',
    email: null,
    instagramHandles: [],
    defaultChannel: 'whatsapp',
    preferenceTags: [],
    patientId: null,
    openLeadId: ANAYA_LEAD,
    lastActivityAt: null,
    lastReceivedAt: null,
    isAwaitingReply: false,
    updatedAt: '2026-10-09T20:01:53.622Z',
    ...patch,
  };
}

/** Anaya — a lead, Asha's. */
const ANAYA = hit({});
/** Kavya — a patient (C-4). */
const KAVYA = hit({
  id: 'con_ebj92x3oamfu4qjwim3wq',
  contactNumber: 4,
  firstName: 'Kavya',
  lastName: 'Mehta',
  name: 'Kavya Mehta',
  primaryPhone: '+919825005865',
  patientId: 'pat_9e6j52vjb8uhvz44ebe94',
  openLeadId: null,
});

/** Anaya's lead as `GET /app/leads/:id` answers. */
function anayaLead(patch: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: ANAYA_LEAD,
    leadNumber: 1,
    contactId: ANAYA.id,
    person: null,
    name: 'Anaya Desai',
    phone: ANAYA.primaryPhone,
    patientId: null,
    status: 'new',
    source: null,
    interests: [],
    kind: 'new',
    retargetReason: null,
    ownerId: ASHA.id,
    involvedIds: [],
    heldUntil: null,
    followUpAt: null,
    branchId: null,
    notes: null,
    lastActivityAt: null,
    isAwaitingReply: false,
    createdAt: '2026-10-09T20:01:53.622Z',
    updatedAt: '2026-10-09T20:01:53.622Z',
    ...patch,
  } as LeadRecord;
}

const callbacks = { onClose: vi.fn(), onCreated: vi.fn() };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  signInTestMember();
  useOrganizationStore.getState().setPermissions(ADMIN_CODES);
  for (const fn of Object.values(notify)) vi.mocked(fn).mockReset();
  for (const fn of Object.values(callbacks)) fn.mockReset();
  team.members = [RIYA, ASHA, MAYA];
  vi.mocked(fetchTaskWorkerIds).mockReset();
  vi.mocked(fetchTaskWorkerIds).mockResolvedValue([RIYA.id, ASHA.id]);
  vi.mocked(searchContacts).mockReset();
  // As the API: 3+ letters, else nothing asked.
  vi.mocked(searchContacts).mockImplementation(async (typed) =>
    typed.trim().length < 3
      ? []
      : [ANAYA, KAVYA].filter((person) =>
          person.name.toLowerCase().includes(typed.trim().toLowerCase()),
        ),
  );
  vi.mocked(fetchContact).mockReset();
  vi.mocked(fetchContact).mockResolvedValue({
    ...KAVYA,
    gender: null,
    dateOfBirth: null,
    address: null,
    referralSource: null,
    referredByContactId: null,
    referredByName: null,
    hasMarketingConsent: false,
    patientNumber: 2,
    phones: [],
  } as Contact);
  vi.mocked(fetchLead).mockReset();
  vi.mocked(fetchLead).mockResolvedValue(anayaLead());
  vi.mocked(addTask).mockReset();
  vi.mocked(addTask).mockImplementation(async ({ fields }) =>
    taskRecord({
      id: 'task_created000000000000',
      kind: 'manual',
      ruleKey: null,
      type: 'by_hand',
      title: fields.title,
    }),
  );
});
afterEach(() => {
  useOrganizationStore.getState().clearOrganization();
  vi.useRealTimers();
});

async function openNewTask(prefill: TaskCreateSearch = {}) {
  const view = renderWithProviders(
    <TooltipProvider>
      <NewTaskDrawer prefill={prefill} {...callbacks} />
    </TooltipProvider>,
  );
  const drawer = await screen.findByTestId('new-task-drawer');
  return { ...view, drawer, user: userEvent.setup() };
}

const step = (id: string) => screen.getByTestId(`new-task-drawer-step-${id}`);
const openStep = async (user: ReturnType<typeof userEvent.setup>, id: string) =>
  user.click(screen.getByTestId(`new-task-drawer-step-${id}-trigger`));
const save = () => screen.getByTestId('new-task-drawer-save');

/** What the create sent. */
const sentFields = (): TaskFields => {
  const call = vi.mocked(addTask).mock.lastCall?.[0];
  if (!call) throw new Error('nothing was created');
  return call.fields;
};

/** Search the "For" picker and take the hit named `name`. */
async function pickPerson(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByTestId('new-task-for'));
  await user.type(await screen.findByTestId('new-task-for-search'), name);
  const panel = await screen.findByTestId('new-task-for-panel');
  await user.click(await within(panel).findByRole('option', { name: new RegExp(name) }));
}

/** Open "Assign to" and pick the option named `name`. */
async function pickOwner(user: ReturnType<typeof userEvent.setup>, name: string) {
  await openStep(user, 'when');
  await user.click(screen.getByTestId('new-task-owner'));
  const panel = await screen.findByTestId('new-task-owner-panel');
  await user.click(within(panel).getByRole('option', { name: new RegExp(name) }));
}

describe('NewTaskDrawer on clinozy-be (KICKOFF §6.10 New task, Q-T4)', () => {
  it('opens over the list: 720px, three steps, no Type or Remind, the defaults summed up', async () => {
    const { drawer } = await openNewTask();
    expect(within(drawer).getByRole('heading', { name: 'New task' })).toBeInTheDocument();
    expect(drawer).toHaveClass('md:w-[min(720px,calc(100vw-56px))]');
    expect(step('what')).toHaveAttribute('data-state', 'open');
    expect(screen.queryByTestId('new-task-type-call_back')).toBeNull();
    expect(screen.queryByTestId('new-task-remind')).toBeNull();
    await waitFor(() =>
      expect(step('when')).toHaveTextContent('Tomorrow 11 am · Riya S.'),
    );
    expect(step('how')).toHaveTextContent('Normal');
    expect(step('how')).not.toHaveTextContent('Remind');
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('asks for a title or a person before it saves', async () => {
    const { user } = await openNewTask();
    await openStep(user, 'how');
    await user.click(save());
    expect(notify.warning).toHaveBeenCalledOnce();
    expect(step('what')).toHaveAttribute('data-state', 'open');
    expect(addTask).not.toHaveBeenCalled();
  });

  it('adds a patient’s task from the search — on her contact, to the member, the due as picked', async () => {
    const { user, drawer } = await openNewTask();
    await pickPerson(user, 'Kavya');
    expect(searchContacts).toHaveBeenCalledWith('Kavya');
    expect(drawer).toHaveAccessibleDescription(
      `For ${fsi('Kavya Mehta')} · shows in Tasks and on this person’s timeline`,
    );
    await user.type(screen.getByTestId('new-task-title'), 'Share the laser price');
    await openStep(user, 'when');
    await user.click(screen.getByTestId('new-task-due-inThreeDays'));
    await openStep(user, 'how');
    await user.click(screen.getByTestId('new-task-priority-high'));
    await user.type(screen.getByTestId('new-task-notes'), 'Asked twice');
    await user.click(save());

    await waitFor(() => expect(callbacks.onCreated).toHaveBeenCalledOnce());
    expect(sentFields()).toEqual({
      title: 'Share the laser price',
      why: 'Asked twice',
      dueAt: appInstant('2026-10-13', '11:00'),
      assignee: { membershipId: RIYA.id },
      priority: 'high',
      contactId: KAVYA.id,
      link: null,
    });
    expect(callbacks.onCreated).toHaveBeenCalledWith({
      task: expect.objectContaining({ id: 'task_created000000000000' }),
      owner: 'Riya S.',
      due: 'In 3 days',
    });
  });

  it('points a lead’s task at her lead and gives it to the lead’s owner (H:6056)', async () => {
    const { user } = await openNewTask();
    await pickPerson(user, 'Anaya');
    await waitFor(() => expect(fetchLead).toHaveBeenCalledWith(ANAYA_LEAD));
    await waitFor(() => expect(step('when')).toHaveTextContent('Asha M.'));
    await user.click(save());

    await waitFor(() => expect(addTask).toHaveBeenCalledOnce());
    expect(sentFields()).toMatchObject({
      contactId: ANAYA.id,
      link: { kind: 'lead', id: ANAYA_LEAD },
      assignee: { membershipId: ASHA.id },
    });
    // An empty title saves as "Follow up · <first name>".
    expect(sentFields().title).toMatch(/Anaya$/);
  });

  it('is for the lead ?lead= names — the task points at it', async () => {
    const { drawer, user } = await openNewTask({ lead: ANAYA_LEAD });
    await waitFor(() =>
      expect(drawer).toHaveAccessibleDescription(
        `For ${fsi('Anaya Desai')} · shows in Tasks and on this person’s timeline`,
      ),
    );
    expect(screen.getByTestId('new-task-drawer-summary')).toHaveTextContent(
      `↔ ${fsi('Anaya Desai')} · `,
    );
    await user.type(screen.getByTestId('new-task-title'), 'Send the price list');
    await user.click(save());
    await waitFor(() => expect(addTask).toHaveBeenCalledOnce());
    expect(fetchLead).toHaveBeenCalledOnce();
    expect(sentFields()).toMatchObject({
      contactId: ANAYA.id,
      link: { kind: 'lead', id: ANAYA_LEAD },
      assignee: { membershipId: ASHA.id },
    });
  });

  it('is for the person ?contact= names', async () => {
    const { drawer, user } = await openNewTask({ contact: KAVYA.id });
    await waitFor(() =>
      expect(drawer).toHaveAccessibleDescription(
        `For ${fsi('Kavya Mehta')} · shows in Tasks and on this person’s timeline`,
      ),
    );
    expect(fetchContact).toHaveBeenCalledWith(KAVYA.id);
    await user.click(save());
    await waitFor(() => expect(addTask).toHaveBeenCalledOnce());
    expect(sentFields()).toMatchObject({ contactId: KAVYA.id, link: null });
  });

  it('clears the URL’s person with × — the task is then about no one', async () => {
    const { drawer, user } = await openNewTask({ contact: KAVYA.id });
    await waitFor(() =>
      expect(drawer).toHaveAccessibleDescription(
        `For ${fsi('Kavya Mehta')} · shows in Tasks and on this person’s timeline`,
      ),
    );
    await user.click(screen.getByTestId('new-task-for-clear'));
    expect(drawer).not.toHaveAccessibleDescription(/Kavya/);
    expect(screen.queryByTestId('new-task-drawer-summary')?.textContent ?? '').toBe('');
    await user.type(screen.getByTestId('new-task-title'), 'Order more gloves');
    await user.click(save());
    await waitFor(() => expect(addTask).toHaveBeenCalledOnce());
    expect(sentFields()).toMatchObject({ contactId: null, link: null });
  });

  it('assigns to a role queue, and the toast names the queue', async () => {
    const { user } = await openNewTask({ contact: KAVYA.id });
    await waitFor(() => expect(fetchContact).toHaveBeenCalled());
    await pickOwner(user, 'Front desk');
    await user.click(save());
    await waitFor(() => expect(callbacks.onCreated).toHaveBeenCalledOnce());
    expect(sentFields().assignee).toEqual({ role: 'front_desk' });
    expect(callbacks.onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'Front desk' }),
    );
  });

  it('offers only the team who can work tasks, then the queues the clinic’s roles work', async () => {
    const { user } = await openNewTask();
    await openStep(user, 'when');
    await user.click(screen.getByTestId('new-task-owner'));
    const panel = await screen.findByTestId('new-task-owner-panel');
    const names = within(panel)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(names[0]).toContain('Riya Shah (you)');
    expect(names.join('|')).toContain('Asha Mehta');
    expect(names.join('|')).not.toContain('Maya Iyer');
    // Pharmacist and Marketing work tasks since D81 (5); no Accountant holds a task code.
    for (const queue of [
      'Front desk',
      'Counsellor',
      'Doctor',
      'Therapist',
      'Pharmacist',
      'Marketing',
    ]) {
      expect(names.join('|')).toContain(queue);
    }
    expect(names.join('|')).not.toContain('Accountant');
  });

  it('adds a task about no one from its title alone', async () => {
    const { user } = await openNewTask();
    await user.type(screen.getByTestId('new-task-title'), 'Order more gloves');
    await user.click(save());
    await waitFor(() => expect(addTask).toHaveBeenCalledOnce());
    expect(sentFields()).toMatchObject({
      title: 'Order more gloves',
      contactId: null,
      link: null,
    });
  });

  it('outlines the field the server refused and opens its step', async () => {
    vi.mocked(addTask).mockRejectedValue(
      new HttpError('Bad Request', 400, '/app/tasks', 'POST', {
        error: {
          type: 'validation_error',
          errors: [
            {
              field: 'body.owner_membership_id',
              message: 'Asha Mehta cannot work tasks',
            },
          ],
        },
      }),
    );
    const { user } = await openNewTask();
    await user.type(screen.getByTestId('new-task-title'), 'Order more gloves');
    await user.click(save());
    await waitFor(() => expect(step('when')).toHaveAttribute('data-state', 'open'));
    expect(screen.getByText('Asha Mehta cannot work tasks')).toBeInTheDocument();
    expect(notify.error).toHaveBeenCalledWith('Asha Mehta cannot work tasks');
    expect(callbacks.onCreated).not.toHaveBeenCalled();
  });

  it('keeps the drawer when the connection drops, and the retry sends the same write', async () => {
    vi.mocked(addTask).mockRejectedValueOnce(new Error('connection dropped'));
    const { user } = await openNewTask({ contact: KAVYA.id });
    await waitFor(() => expect(fetchContact).toHaveBeenCalled());
    await user.type(screen.getByTestId('new-task-title'), 'Call about the package');
    await user.click(save());
    await waitFor(() => expect(save()).toHaveTextContent('Retry save'));
    expect(screen.getByTestId('new-task-title')).toHaveValue('Call about the package');

    await user.click(save());
    await waitFor(() => expect(callbacks.onCreated).toHaveBeenCalledOnce());
    const [first, second] = vi.mocked(addTask).mock.calls.map(([call]) => call);
    expect(second?.fields).toEqual(first?.fields);
    expect(second?.idempotencyKey).toBe(first?.idempotencyKey);
  });

  it('writes nothing for a member without `task:create`', async () => {
    useOrganizationStore
      .getState()
      .setPermissions(['organization:read', 'task:read', 'task:update']);
    const { user } = await openNewTask();
    await user.type(screen.getByTestId('new-task-title'), 'Order more gloves');
    await user.click(save());
    await waitFor(() => expect(notify.info).toHaveBeenCalledOnce());
    expect(addTask).not.toHaveBeenCalled();
  });

  it('closes at once when nothing was entered, and asks first after', async () => {
    const { user } = await openNewTask();
    await user.click(screen.getByTestId('new-task-drawer-dismiss'));
    expect(callbacks.onClose).toHaveBeenCalledOnce();
    callbacks.onClose.mockReset();

    await user.type(screen.getByTestId('new-task-title'), 'Half a thought');
    await user.click(screen.getByTestId('new-task-drawer-dismiss'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(callbacks.onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(callbacks.onClose).toHaveBeenCalledOnce();
  });
});
