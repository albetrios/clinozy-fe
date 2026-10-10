import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { TaskType } from '@/shared/api/clinic/tasks-contracts.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { TaskTypePicker } from './TaskTypePicker.tsx';

vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
}));

function Harness({
  initial = [],
  onChange = vi.fn(),
}: {
  initial?: TaskType[];
  onChange?: (types: TaskType[]) => void;
}) {
  const [value, setValue] = useState<TaskType[]>(initial);
  return (
    <TaskTypePicker
      value={value}
      onChange={(types) => {
        setValue(types);
        onChange(types);
      }}
    />
  );
}

const trigger = () => screen.getByTestId('tasks-type-trigger');

describe('TaskTypePicker (tasks.md:164–178)', () => {
  it('reads "All types", the one rule’s name, or "<n> types"', async () => {
    const { unmount } = renderWithProviders(<Harness />);
    expect(await screen.findByTestId('tasks-type-trigger')).toHaveTextContent(
      'All types',
    );
    expect(trigger()).toHaveClass('border-border');
    unmount();
    const one = renderWithProviders(<Harness initial={['confirm']} />);
    expect(await screen.findByTestId('tasks-type-trigger')).toHaveTextContent(
      'Confirm visits',
    );
    expect(trigger()).toHaveClass('border-disabled');
    one.unmount();
    renderWithProviders(<Harness initial={['confirm', 'call_back']} />);
    expect(await screen.findByTestId('tasks-type-trigger')).toHaveTextContent('2 types');
  });

  it('lists the API’s rules and "Follow-ups you set" by source and picks several', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Harness onChange={onChange} />);
    await user.click(await screen.findByTestId('tasks-type-trigger'));
    const panel = await screen.findByTestId('tasks-type-panel');
    // Fifteen rules and the tasks made by hand (`kind` follow_up · manual).
    expect(within(panel).getAllByRole('option')).toHaveLength(16);
    for (const group of [
      'Leads',
      'Appointments',
      'Feedback',
      'Treatments',
      'Patients',
      'Team',
      'Payments',
    ]) {
      expect(within(panel).getAllByText(group).length).toBeGreaterThan(0);
    }
    await user.click(within(panel).getByRole('option', { name: /Confirm visits/ }));
    await user.click(within(panel).getByRole('option', { name: /Follow-ups you set/ }));
    expect(onChange).toHaveBeenLastCalledWith(['confirm', 'by_hand']);
    // Multi-select stays open.
    expect(screen.getByTestId('tasks-type-panel')).toBeInTheDocument();
  });

  it('says nothing matches a search, and how to fix it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(await screen.findByTestId('tasks-type-trigger'));
    await user.keyboard('zzz');
    const panel = await screen.findByTestId('tasks-type-panel');
    expect(panel).toHaveTextContent('No results for “zzz”');
    expect(panel).toHaveTextContent('Check the spelling or try fewer letters');
  });

  it('clears the pick with its ×', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={['by_hand']} onChange={onChange} />);
    await user.click(await screen.findByTestId('tasks-type-clear'));
    expect(onChange).toHaveBeenCalledWith([]);
    expect(trigger()).toHaveTextContent('All types');
  });

  it('has no accessibility violations, open', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={['reply']} />);
    await user.click(await screen.findByTestId('tasks-type-trigger'));
    await screen.findByTestId('tasks-type-panel');
    expect(await axeForDialog(document.body)).toHaveNoViolations();
  });
});
