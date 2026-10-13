import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ConsentCategoryRow } from './ConsentCategoryRow.tsx';

describe('ConsentCategoryRow', () => {
  it('names its switch by the category and describes it by what it enables', () => {
    render(
      <ConsentCategoryRow
        testId="row"
        title="Analytics"
        description="Shows how features are used."
        status="Off"
        checked={false}
      />,
    );
    const toggle = screen.getByRole('switch', { name: 'Analytics' });
    expect(toggle).toHaveAccessibleDescription('Shows how features are used.');
    expect(toggle).toHaveAttribute('data-testid', 'row-switch');
    expect(screen.getByTestId('row')).toHaveTextContent('Off');
  });

  it('toggles from a tap on its name, and from the switch itself — once each', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <ConsentCategoryRow
        testId="row"
        title="Analytics"
        description="Shows how features are used."
        status="Off"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );
    await user.click(screen.getByText('Analytics'));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole('switch', { name: 'Analytics' }));
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it('a locked row cannot be changed', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <ConsentCategoryRow
        testId="row"
        title="Necessary"
        description="Enables security and basic functionality."
        status="Required"
        checked
        disabled
        onCheckedChange={onCheckedChange}
      />,
    );
    const toggle = screen.getByRole('switch', { name: 'Necessary' });
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
    await user.click(screen.getByText('Necessary'));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('shows an extra line when given one', () => {
    render(
      <ConsentCategoryRow
        testId="row"
        title="Analytics"
        description="Shows how features are used."
        status="On"
        checked
        footer={<span>Saved on 13 Oct 2026</span>}
      />,
    );
    expect(screen.getByTestId('row')).toHaveTextContent('Saved on 13 Oct 2026');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <ConsentCategoryRow
        testId="row"
        title="Analytics"
        description="Shows how features are used."
        status="Off"
        checked={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
