import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import type { TaskRuleSettings } from '@/shared/api/clinic/tasks-contracts.ts';
import { TASK_RULE_IDS } from '@/shared/api/clinic/tasks-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { TaskRulesPopover, type TaskRulesPopoverProps } from './TaskRulesPopover.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const settings = (patch: Partial<TaskRuleSettings> = {}): TaskRuleSettings =>
  ({
    ...Object.fromEntries(
      TASK_RULE_IDS.map((rule) => [rule, { on: true, handled: false }]),
    ),
    ...patch,
  }) as TaskRuleSettings;

function renderRules(props: Partial<TaskRulesPopoverProps> = {}) {
  const onChange = vi.fn();
  render(
    <TaskRulesPopover settings={settings()} canEdit onChange={onChange} {...props} />,
  );
  return { onChange };
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
  it('lists the thirteen rules under "What creates tasks", each with its line and switch', async () => {
    renderRules();
    const { panel } = await openRules();
    expect(screen.getByRole('dialog', { name: 'Task rules' })).toBe(panel);
    expect(panel).toHaveTextContent('What creates tasks');
    expect(panel).toHaveTextContent(
      `${PRODUCT_NAME} watches leads, appointments and feedback and creates a task when someone needs to act. A task closes itself when the record changes.`,
    );
    const switches = within(panel).getAllByRole('switch');
    expect(switches).toHaveLength(13);
    expect(
      switches.every((control) => control.getAttribute('aria-checked') === 'true'),
    ).toBe(true);
    expect(screen.getByTestId('tasks-rule-reply')).toHaveTextContent(
      'Leads · A lead wrote and nobody has replied',
    );
    // Today's two kinds stay out of the popover (D42).
    expect(screen.queryByTestId('tasks-rule-payment')).toBeNull();
    expect(screen.queryByTestId('tasks-rule-recall')).toBeNull();
  });

  it('switches a rule off, and hands a rule with an automation to the product', async () => {
    const { onChange } = renderRules();
    const { user } = await openRules();
    await user.click(screen.getByRole('switch', { name: 'Confirm visits' }));
    expect(onChange).toHaveBeenCalledWith('confirm', { on: false });
    const handle = screen.getByTestId('tasks-rule-confirm-handle');
    expect(handle).toHaveTextContent(`Let ${PRODUCT_NAME} handle`);
    expect(handle).toHaveAttribute('aria-pressed', 'false');
    await user.click(handle);
    expect(onChange).toHaveBeenCalledWith('confirm', { handled: true });
    // A rule the product can't do has no hand-over.
    expect(screen.queryByTestId('tasks-rule-claim-handle')).toBeNull();
  });

  it(`shows a handed-over rule as "${PRODUCT_NAME} handles it"`, async () => {
    renderRules({ settings: settings({ reply: { on: true, handled: true } }) });
    await openRules();
    const handle = screen.getByTestId('tasks-rule-reply-handle');
    expect(handle).toHaveTextContent(`${PRODUCT_NAME} handles it`);
    expect(handle).toHaveAttribute('aria-pressed', 'true');
  });

  it('is read-only, and says so, for anyone but an Owner or Admin', async () => {
    renderRules({ canEdit: false });
    const { panel } = await openRules();
    expect(panel).toHaveTextContent('Only an owner or admin can change these rules');
    expect(screen.getByRole('switch', { name: 'Unreplied messages' })).toBeDisabled();
    expect(screen.getByTestId('tasks-rule-reply-handle')).toBeDisabled();
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
