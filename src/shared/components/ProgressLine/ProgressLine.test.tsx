import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { ProgressLine } from './ProgressLine.tsx';

describe('ProgressLine', () => {
  it('is a named, indeterminate progress element over a sweeping bar', () => {
    render(<ProgressLine label="Searching…" testId="line" />);
    const progress = screen.getByRole('progressbar', { name: 'Searching…' });
    expect(progress.tagName).toBe('PROGRESS');
    // No value: indeterminate.
    expect(progress).not.toHaveAttribute('value');
    const line = screen.getByTestId('line');
    expect(line).toHaveClass('h-0.5', 'overflow-hidden', 'pointer-events-none');
    const bar = line.querySelector('[aria-hidden="true"]');
    expect(bar).toHaveClass(
      'bg-primary',
      'animate-[route-progress_1.1s_ease-in-out_infinite]',
    );
  });

  it('takes its place from the host', () => {
    render(
      <ProgressLine
        label="Loading"
        testId="line"
        className="absolute inset-x-0 bottom-0"
      />,
    );
    expect(screen.getByTestId('line')).toHaveClass('absolute', 'inset-x-0', 'bottom-0');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<ProgressLine label="Loading page" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
