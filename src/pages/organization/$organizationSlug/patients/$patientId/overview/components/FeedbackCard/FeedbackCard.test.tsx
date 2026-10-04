import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { createCheckIn } from '@/shared/api/clinic/feedback-api.ts';
import type { CheckInInput } from '@/shared/api/clinic/feedback-contracts.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import {
  CONFIRM_TEST_IDS,
  confirmReasonTestId,
} from '@/shared/components/ConfirmDialog/confirm-dialog.constants.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { FeedbackCard, type FeedbackCardProps } from './FeedbackCard.tsx';

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
const ID = 'feedback-card';

const visitCheckIn = (fields: Partial<CheckInInput> = {}): CheckInInput => ({
  patientId: DHARTI,
  appointmentId: null,
  treatmentId: null,
  context: 'Visit check-in',
  feel: 'same',
  score: 6,
  followed: null,
  followedNote: null,
  now: null,
  nextPlan: null,
  nextOfferingIds: [],
  date: clinicToday(),
  ...fields,
});

async function renderCard(
  props: Partial<FeedbackCardProps> = {},
  counts = '2 check-ins · 1 review',
) {
  const onLog = vi.fn();
  const onEdit = vi.fn();
  const view = renderWithProviders(
    <TooltipProvider>
      <FeedbackCard patientId={DHARTI} canEdit onLog={onLog} onEdit={onEdit} {...props} />
    </TooltipProvider>,
  );
  await view.router.load();
  const user = userEvent.setup();
  const card = await screen.findByTestId(ID);
  await waitFor(() => expect(card).toHaveTextContent(counts));
  return { ...view, user, card, onLog, onEdit };
}

const items = () => screen.queryAllByTestId(`${ID}-item`);

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => resetClinicFixtures());

describe('FeedbackCard (KICKOFF §6.6 Feedback; S:1636)', () => {
  it('starts collapsed with the counts, then opens on the type chips and the cards', async () => {
    const { user, card, container } = await renderCard();
    expect(within(card).getByTestId(`${ID}-toggle`)).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(items()).toHaveLength(0);
    await user.click(within(card).getByTestId(`${ID}-toggle`));
    await waitFor(() => expect(items()).toHaveLength(3));
    expect(
      ['all', 'visit', 'treatment', 'google'].map(
        (type) => within(card).getByTestId(`${ID}-type-${type}`).textContent,
      ),
    ).toEqual(['All', 'Consultation', 'Treatment feedback', 'Google']);
    expect(within(card).getByTestId(`${ID}-type-all`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(card).toHaveTextContent('Followed mostly');
    expect(card).toHaveTextContent('★★★★★');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows one type at a time', async () => {
    const { user, card } = await renderCard();
    await user.click(within(card).getByTestId(`${ID}-toggle`));
    await user.click(await within(card).findByTestId(`${ID}-type-google`));
    await waitFor(() => expect(items()).toHaveLength(1));
    expect(items()[0]).toHaveTextContent('Google');
  });

  it('hands a card to its Edit, and logs feedback from the header', async () => {
    const { user, card, onEdit, onLog } = await renderCard();
    await user.click(within(card).getByTestId(`${ID}-log`));
    expect(onLog).toHaveBeenCalledOnce();
    await user.click(within(card).getByTestId(`${ID}-toggle`));
    await waitFor(() => expect(items()).toHaveLength(3));
    const [first] = items();
    if (!first) throw new Error('no card');
    await user.click(within(first).getByTestId(`${ID}-item-edit`));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'review' }));
  });

  it('removes a check-in for a reason, with Undo', async () => {
    const { user, card } = await renderCard();
    await user.click(within(card).getByTestId(`${ID}-toggle`));
    await user.click(await within(card).findByTestId(`${ID}-type-visit`));
    await waitFor(() => expect(items()).toHaveLength(1));
    const [visit] = items();
    if (!visit) throw new Error('no card');
    await user.click(within(visit).getByTestId(`${ID}-item-remove`));
    const confirm = await screen.findByTestId(CONFIRM_TEST_IDS.dialog);
    expect(confirm).toHaveTextContent('Remove this check-in?');
    await user.click(screen.getByTestId(confirmReasonTestId('mistake')));
    await user.click(screen.getByTestId(CONFIRM_TEST_IDS.accept));
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        'Check-in removed',
        expect.any(Object),
      ),
    );
    await waitFor(() => expect(card).toHaveTextContent('1 check-in · 1 review'));
  });

  it('logs the follow-up on a card that needs action — “✓ Doctor called · logged”', async () => {
    await createCheckIn(visitCheckIn({ feel: 'worse', score: 3, now: 'Itching' }));
    const { user, card } = await renderCard({}, '3 check-ins · 1 review');
    await user.click(within(card).getByTestId(`${ID}-toggle`));
    await waitFor(() => expect(items()).toHaveLength(4));
    const bad = items().find((item) => item.textContent?.includes('Itching'));
    if (!bad) throw new Error('no card');
    expect(bad).toHaveTextContent('Action needed');
    await user.click(within(bad).getByTestId(`${ID}-item-log-action`));
    await user.click(await screen.findByTestId(`${ID}-item-action-doctor_called`));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('✓ Doctor called · logged'),
    );
    await waitFor(() =>
      expect(
        within(card)
          .getAllByTestId(`${ID}-item-action`)
          .some((pill) => pill.textContent?.startsWith('✓ Doctor called')),
      ).toBe(true),
    );
  });

  it('pages six at a time — “Load more”', async () => {
    for (let index = 0; index < 6; index += 1) {
      await createCheckIn(visitCheckIn({ now: `Visit ${index}` }));
    }
    const { user, card } = await renderCard({}, '8 check-ins · 1 review');
    await user.click(within(card).getByTestId(`${ID}-toggle`));
    await waitFor(() => expect(items()).toHaveLength(6));
    const more = within(card).getByTestId(`${ID}-load-more`);
    expect(more).toHaveTextContent('3 more');
    await user.click(more);
    await waitFor(() => expect(items()).toHaveLength(9));
    expect(within(card).queryByTestId(`${ID}-load-more`)).not.toBeInTheDocument();
  });

  it('offers the picker when there is no feedback yet', async () => {
    await Promise.all([
      ...clinicFixtures.checkIns
        .snapshot((row) => row.patientId === DHARTI)
        .map((row) => clinicFixtures.checkIns.remove(row.id, 'mistake', null)),
      ...clinicFixtures.reviews
        .snapshot((row) => row.patientId === DHARTI)
        .map((row) => clinicFixtures.reviews.remove(row.id, 'mistake', null)),
    ]);
    const { user, card, onLog } = await renderCard({}, 'No feedback yet');
    await user.click(within(card).getByTestId(`${ID}-toggle`));
    const empty = await within(card).findByTestId(`${ID}-empty`);
    expect(empty).toHaveTextContent(
      'Log a check-in or a review after the next visit · Log feedback',
    );
    await user.click(empty);
    expect(onLog).toHaveBeenCalledOnce();
  });

  it('only reads without Patients edit', async () => {
    const { user, card } = await renderCard({ canEdit: false });
    expect(within(card).queryByTestId(`${ID}-log`)).not.toBeInTheDocument();
    await user.click(within(card).getByTestId(`${ID}-toggle`));
    await waitFor(() => expect(items()).toHaveLength(3));
    expect(within(card).queryByTestId(`${ID}-item-edit`)).not.toBeInTheDocument();
  });
});
