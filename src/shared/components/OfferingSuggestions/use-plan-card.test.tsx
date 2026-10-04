import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { findPersonThread } from '@/shared/api/clinic/fixtures/contact-threads.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { PlanIdeaReason } from '@/shared/api/clinic/plan-contracts.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

import { ideaReasonText, type PlanCardHost, usePlanCard } from './use-plan-card.ts';

/** A `t` that shows the key and its values. */
const t = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}${JSON.stringify(values)}` : key;

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const dharti = () =>
  clinicFixtures.patients.snapshot((row) => row.firstName === 'Dharti')[0]?.id ?? '';

/** A patient whose thread has messages — the card's contact activity. */
function patientWithActivity() {
  const leads = clinicFixtures.leads.snapshot();
  const spoken = new Set(
    clinicFixtures.leadMessages
      .snapshot((message) => !message.isSystem)
      .map((message) => message.leadId),
  );
  const patient = clinicFixtures.patients.snapshot((row) => {
    const thread = findPersonThread(leads, {
      leadId: row.leadId,
      patientId: row.id,
      phone: row.phone,
    });
    return thread !== null && spoken.has(thread.id);
  })[0];
  if (!patient) throw new Error('no patient with a thread');
  return patient;
}

function renderCard(host: Partial<PlanCardHost> = {}) {
  const onOpenChat = vi.fn();
  const view = renderHook(
    () =>
      usePlanCard({
        patientId: dharti(),
        firstName: 'Dharti',
        sourceLabel: 'Appt #2859 · Peel',
        appointmentId: null,
        canEdit: true,
        onOpenChat,
        ...host,
      }),
    { wrapper },
  );
  return { ...view, onOpenChat };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('ideaReasonText (H:4357–4366)', () => {
  it('words every reason an idea is offered for', () => {
    const reasons: PlanIdeaReason[] = [
      { kind: 'note', text: 'LHR next' },
      { kind: 'complaint', text: 'hair fall' },
      { kind: 'visits', count: 3 },
      { kind: 'renew' },
      { kind: 'first' },
    ];
    expect(reasons.map((reason) => ideaReasonText(t, reason))).toEqual([
      'offeringSuggestions.ideaReasons.note{"text":"LHR next"}',
      'offeringSuggestions.ideaReasons.complaint{"text":"hair fall"}',
      'offeringSuggestions.ideaReasons.visits{"count":3}',
      'offeringSuggestions.ideaReasons.renew',
      'offeringSuggestions.ideaReasons.first',
    ]);
  });
});

describe('usePlanCard — the plan bound to the card', () => {
  it('reads nothing without a patient', () => {
    const { result } = renderCard({ patientId: '' });
    expect(result.current.props).toBeNull();
    expect(result.current.plan).toBeUndefined();
    const reads = client.getQueryCache().findAll({ queryKey: ['clinic', 'plan'] });
    expect(reads.every((query) => query.state.fetchStatus === 'idle')).toBe(true);
    expect(reads.every((query) => query.state.dataUpdatedAt === 0)).toBe(true);
  });

  it('words the lines, the ideas and the purchases', async () => {
    const { result } = renderCard();
    expect(result.current.status).toBe('pending');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const props = result.current.props;
    if (!props) throw new Error('no card');
    expect(props.lines).toHaveLength(result.current.plan?.suggestions.length ?? 0);
    for (const line of props.lines) expect(line.info).not.toBe('');
    for (const idea of props.ideas) expect(idea.info).toMatch(/^Idea from history · /);
    expect(props.purchases?.lines.length).toBeGreaterThan(0);
  });

  it('words the contact activity of the patient’s thread, and opens its chat', async () => {
    const patient = patientWithActivity();
    const { result, onOpenChat } = renderCard({
      patientId: patient.id,
      firstName: patient.firstName,
    });
    await waitFor(() => expect(result.current.props?.activity).toBeDefined());
    const activity = result.current.props!.activity!;
    expect(activity.lines.length).toBeGreaterThan(0);
    for (const line of activity.lines) {
      expect(line.status).toMatch(
        /^(Received|Read|Not delivered|Queued|Delivered|Sent)$/,
      );
    }
    expect(activity.summary).toMatch(/^Lead #\d+/);
    activity.onOpenChat?.();
    expect(onOpenChat).toHaveBeenCalledWith(result.current.plan?.lead?.id);
  });

  it('says the plan could not be read, and Retry reads it again', async () => {
    const { result } = renderCard({ patientId: '00000000-0000-4000-8000-000000000000' });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.props).toBeNull();
    const read = () =>
      client.getQueryCache().findAll({ queryKey: ['clinic', 'plan'] })[0];
    expect(read()?.state.errorUpdateCount).toBe(1);
    act(() => result.current.retry());
    await waitFor(() => expect(read()?.state.errorUpdateCount).toBe(2));
  });

  it('greys the offerings already suggested', async () => {
    const { result } = renderCard();
    await waitFor(() => expect(result.current.props).not.toBeNull());
    const props = result.current.props!;
    const taken = new Set(
      result.current.plan?.suggestions
        .filter((row) => row.status !== 'declined')
        .map((row) => row.offeringId),
    );
    for (const option of props.addOffering?.options ?? []) {
      expect(option.disabled).toBe(taken.has(option.key));
    }
  });

  it('adds from an idea and from "Add offering", toasting the patient’s name', async () => {
    const { result } = renderCard();
    await waitFor(() => expect(result.current.props).not.toBeNull());
    const props = result.current.props!;
    const idea = props.ideas[0];
    if (idea) {
      act(() => props.onAddIdea?.(idea));
      await waitFor(() =>
        expect(notifyMock.success).toHaveBeenCalledWith(
          `${idea.name} added to Dharti’s suggestions`,
        ),
      );
    }
    await waitFor(() => expect(result.current.props).not.toBeNull());
    const free = result.current.props?.addOffering?.options.find(
      (option) => !option.disabled,
    );
    if (!free) throw new Error('no free offering');
    act(() => result.current.props?.addOffering?.onPick(free.key));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenLastCalledWith(
        `${free.label} added to Dharti’s suggestions`,
      ),
    );
  });

  it('edits a line, and removes one with a 10s Undo that brings it back', async () => {
    const { result } = renderCard();
    await waitFor(() => expect(result.current.props?.lines.length).toBeGreaterThan(0));
    const line = result.current.props!.lines[0]!;
    act(() => result.current.props?.onChange?.(line, { qty: 2 }));
    await waitFor(() =>
      expect(result.current.props?.lines.find((row) => row.id === line.id)?.qty).toBe(2),
    );
    await act(async () => {
      await result.current.props?.onRemove?.(line, {
        reason: 'other',
        note: 'Plan changed',
        picked: { value: 'plan_changed', label: 'Plan changed' },
        comment: '',
      });
    });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      `${line.name} removed from suggestions`,
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    await waitFor(() =>
      expect(result.current.props?.lines.some((row) => row.id === line.id)).toBe(false),
    );
    const [, options] = notifyMock.undo.mock.lastCall ?? [];
    act(() => options.onUndo());
    await waitFor(() =>
      expect(result.current.props?.lines.some((row) => row.id === line.id)).toBe(true),
    );
  });
});
