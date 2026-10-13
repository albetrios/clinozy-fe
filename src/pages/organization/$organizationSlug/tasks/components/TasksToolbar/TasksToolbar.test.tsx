import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { TasksToolbar, type TasksToolbarProps } from './TasksToolbar.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

function renderToolbar(props: Partial<TasksToolbarProps> = {}) {
  const handlers = {
    onViewChange: vi.fn(),
    onTypesChange: vi.fn(),
    onScopeChange: vi.fn(),
    onNewTask: vi.fn(),
  };
  const view = renderWithProviders(
    <TasksToolbar
      view="open"
      types={[]}
      scope="mine"
      rules={{
        settings: undefined,
        failed: false,
        onRetry: vi.fn(),
        canEdit: true,
        onChange: vi.fn(),
      }}
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers };
}

beforeEach(() => {
  viewport.tier = 'desktop';
});

describe('TasksToolbar (tasks.md:17, H:2129–2139)', () => {
  it('is h1 · views · search · type · Mine · Everyone · Rules · New task', async () => {
    renderToolbar();
    const toolbar = await screen.findByTestId('tasks-toolbar');
    expect(within(toolbar).getByRole('heading', { level: 1 })).toHaveTextContent('Tasks');
    const views = within(toolbar).getByRole('tablist', { name: 'Task view' });
    expect(
      within(views)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['To do', 'Snoozed', 'Done']);
    expect(
      within(toolbar).getByRole('searchbox', { name: 'Search tasks' }),
    ).toHaveAttribute('placeholder', 'Search tasks or people');
    expect(screen.getByTestId('tasks-type-trigger')).toHaveTextContent('All types');
    const scope = within(toolbar).getByRole('tablist', { name: 'Scope' });
    expect(
      within(scope)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Mine', 'Everyone']);
    expect(screen.getByTestId('tasks-rules-trigger')).toHaveTextContent('Rules');
    expect(screen.getByTestId('tasks-new')).toHaveTextContent('New task');
  });

  it('switches views and scope on Enter, as the room tabs do', async () => {
    const user = userEvent.setup();
    const { onViewChange, onScopeChange } = renderToolbar();
    await user.click(await screen.findByTestId('tasks-tab-snoozed'));
    await user.keyboard('{Enter}');
    expect(onViewChange).toHaveBeenCalledWith('snoozed');
    await user.click(screen.getByTestId('tasks-scope-tab-everyone'));
    await user.keyboard('{Enter}');
    expect(onScopeChange).toHaveBeenCalledWith('everyone');
  });

  it('opens New task, and hides it without `task:create`', async () => {
    const user = userEvent.setup();
    const { onNewTask, unmount } = renderToolbar();
    await user.click(await screen.findByTestId('tasks-new'));
    expect(onNewTask).toHaveBeenCalledOnce();
    unmount();
    renderToolbar({ onNewTask: undefined });
    await screen.findByTestId('tasks-toolbar');
    expect(screen.queryByTestId('tasks-new')).toBeNull();
  });

  it('floats New task on a phone, the actions on their own row', async () => {
    viewport.tier = 'phone';
    renderToolbar();
    const toolbar = await screen.findByTestId('tasks-toolbar');
    expect(toolbar).toHaveAttribute('data-layout', 'tasks');
    expect(within(toolbar).queryByTestId('tasks-new')).toBeNull();
    expect(within(screen.getByTestId('tasks-fab')).getByText('New task')).toBeVisible();
    const actions = screen
      .getByTestId('tasks-rules-trigger')
      .closest('[data-slot="room-toolbar-actions"]');
    expect(actions?.className).toContain('max-md:basis-full');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderToolbar({ types: ['confirm'] });
    await screen.findByTestId('tasks-toolbar');
    expect(await axe(container)).toHaveNoViolations();
  });
});
