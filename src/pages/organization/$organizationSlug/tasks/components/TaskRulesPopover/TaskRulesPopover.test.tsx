import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import {
  TASK_RULE_KEY_VALUES,
  type TaskRuleKey,
  type TaskRuleSettings,
} from '@/shared/api/clinic/tasks-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { TaskRulesPopover, type TaskRulesPopoverProps } from './TaskRulesPopover.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

/** The rules the server can do (`can_be_automatic`, `GET /app/task-rule-settings` live). */
const AUTOMATIC: readonly TaskRuleKey[] = [
  'confirm',
  'feedback',
  'payment_due',
  'gone_quiet',
];

/** Every rule's setting as the server answers a fresh organization — on, by hand. */
const settings = (patch: TaskRuleSettings = {}): TaskRuleSettings => ({
  ...Object.fromEntries(
    TASK_RULE_KEY_VALUES.map((ruleKey) => [
      ruleKey,
      {
        isOn: true,
        isAutomatic: false,
        canBeAutomatic: AUTOMATIC.includes(ruleKey),
        updatedAt: null,
      },
    ]),
  ),
  ...patch,
});

function renderRules(props: Partial<TaskRulesPopoverProps> = {}) {
  const onChange = vi.fn();
  const onRetry = vi.fn();
  render(
    <TaskRulesPopover
      settings={settings()}
      failed={false}
      onRetry={onRetry}
      canEdit
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, onRetry };
}

const openRules = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByTestId('tasks-rules-trigger'));
  return { user, panel: await screen.findByTestId('tasks-rules') };
};

beforeEach(() => {
  viewport.tier = 'desktop';
});

describe('TaskRulesPopover (tasks.md:148–162)', () => {
  it('lists the API’s rules under "What creates tasks", each with its line and switch', async () => {
    renderRules();
    const { panel } = await openRules();
    expect(screen.getByRole('dialog', { name: 'Task rules' })).toBe(panel);
    expect(panel).toHaveTextContent('What creates tasks');
    expect(panel).toHaveTextContent(
      `${PRODUCT_NAME} watches leads, appointments and feedback and creates a task when someone needs to act. A task closes itself when the record changes.`,
    );
    // Fifteen rules switch; "Follow-ups you set" has no rule behind it.
    const switches = within(panel).getAllByRole('switch');
    expect(switches).toHaveLength(15);
    expect(
      switches.every((control) => control.getAttribute('aria-checked') === 'true'),
    ).toBe(true);
    expect(screen.getByTestId('tasks-rule-reply')).toHaveTextContent(
      'Leads · A lead wrote and nobody has replied',
    );
    const byHand = screen.getByTestId('tasks-rule-by_hand');
    expect(byHand).toHaveTextContent('Follow-ups you set');
    expect(within(byHand).queryByRole('switch')).toBeNull();
    expect(screen.getByTestId('tasks-rule-medical_rep_visit')).toBeInTheDocument();
    // The design's recall has no rule on the API (route map §4 #22).
    expect(screen.queryByTestId('tasks-rule-recall')).toBeNull();
  });

  it('saves a switch as one change to the rule (`PUT /app/task-rule-settings`)', async () => {
    const { onChange } = renderRules();
    const { user } = await openRules();
    await user.click(screen.getByRole('switch', { name: 'Confirm visits' }));
    expect(onChange).toHaveBeenCalledWith({ ruleKey: 'confirm', isOn: false });
  });

  it(`offers "Let ${PRODUCT_NAME} handle" only on a rule the server can do`, async () => {
    const { onChange } = renderRules();
    const { user } = await openRules();
    for (const ruleKey of AUTOMATIC) {
      expect(screen.getByTestId(`tasks-rule-${ruleKey}-handle`)).toBeInTheDocument();
    }
    for (const ruleKey of ['reply', 'follow_up', 'claim', 'rebook', 'aftercare']) {
      expect(screen.queryByTestId(`tasks-rule-${ruleKey}-handle`)).toBeNull();
    }
    const handle = screen.getByTestId('tasks-rule-confirm-handle');
    expect(handle).toHaveTextContent(`Let ${PRODUCT_NAME} handle`);
    expect(handle).toHaveAttribute('aria-pressed', 'false');
    await user.click(handle);
    expect(onChange).toHaveBeenCalledWith({ ruleKey: 'confirm', isAutomatic: true });
  });

  it(`shows a handed-over rule as "${PRODUCT_NAME} handles it", a switched-off one off`, async () => {
    const { onChange } = renderRules({
      settings: settings({
        feedback: {
          isOn: true,
          isAutomatic: true,
          canBeAutomatic: true,
          updatedAt: '2026-10-10T05:00:00.000Z',
        },
        claim: {
          isOn: false,
          isAutomatic: false,
          canBeAutomatic: false,
          updatedAt: null,
        },
      }),
    });
    const { user } = await openRules();
    const handle = screen.getByTestId('tasks-rule-feedback-handle');
    expect(handle).toHaveTextContent(`${PRODUCT_NAME} handles it`);
    expect(handle).toHaveAttribute('aria-pressed', 'true');
    await user.click(handle);
    expect(onChange).toHaveBeenCalledWith({ ruleKey: 'feedback', isAutomatic: false });
    expect(screen.getByTestId('tasks-rule-claim')).toHaveAttribute('data-on', 'false');
    expect(screen.getByRole('switch', { name: 'Leads open to claim' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('is read-only, and says so, without `organization:update`', async () => {
    const { onChange } = renderRules({ canEdit: false });
    const { panel, user } = await openRules();
    expect(panel).toHaveTextContent('Only an owner or admin can change these rules');
    expect(screen.getByRole('switch', { name: 'Unreplied messages' })).toBeDisabled();
    const handle = screen.getByTestId('tasks-rule-confirm-handle');
    expect(handle).toBeDisabled();
    await user.click(handle);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows bars while the settings load, and the error with Retry when they fail', async () => {
    const { unmount } = render(
      <TaskRulesPopover
        settings={undefined}
        failed={false}
        onRetry={vi.fn()}
        canEdit
        onChange={vi.fn()}
      />,
    );
    let { panel } = await openRules();
    expect(within(panel).getByTestId('skeleton-rows')).toBeInTheDocument();
    expect(within(panel).queryByRole('switch')).toBeNull();
    unmount();
    const { onRetry } = renderRules({ settings: undefined, failed: true });
    const opened = await openRules();
    panel = opened.panel;
    expect(within(panel).getByTestId('retry-error')).toBeInTheDocument();
    await opened.user.click(within(panel).getByTestId('retry-button'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('closes on Esc (§7.3)', async () => {
    renderRules();
    const { user } = await openRules();
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('tasks-rules')).toBeNull();
  });

  it('rises as the bottom sheet on a phone', async () => {
    viewport.tier = 'phone';
    renderRules();
    const { panel } = await openRules();
    expect(panel).toHaveAttribute('data-picker-surface', 'sheet');
  });

  it('has no accessibility violations', async () => {
    renderRules();
    await openRules();
    expect(await axeForDialog(document.body)).toHaveNoViolations();
  });
});
