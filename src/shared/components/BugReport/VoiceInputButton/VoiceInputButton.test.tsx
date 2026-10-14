import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { BUG_REPORT_TEST_IDS } from '../bug-report.constants.ts';
import { VoiceInputButton } from './VoiceInputButton.tsx';

describe('VoiceInputButton', () => {
  it('is a quiet, labelled toggle at rest, with no meter', async () => {
    const onToggle = vi.fn();
    const { container } = render(
      <VoiceInputButton
        listening={false}
        hearing={false}
        label="Dictate with your voice"
        onToggle={onToggle}
      />,
    );

    const button = screen.getByRole('button', { name: 'Dictate with your voice' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toHaveAttribute('data-listening');
    expect(container.querySelector('.bug-report-bars')).toBeNull();
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('glows and shows the meter while listening; the meter jumps while hearing', () => {
    const { container, rerender } = render(
      <VoiceInputButton
        listening
        hearing={false}
        label="Stop dictating"
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByTestId(BUG_REPORT_TEST_IDS.voice)).toHaveAttribute(
      'data-listening',
      'true',
    );
    expect(screen.getByTestId(BUG_REPORT_TEST_IDS.voice)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const bars = container.querySelector('.bug-report-bars');
    expect(bars?.children).toHaveLength(5);
    expect(bars).not.toHaveAttribute('data-hearing');

    rerender(
      <VoiceInputButton listening hearing label="Stop dictating" onToggle={vi.fn()} />,
    );
    expect(container.querySelector('.bug-report-bars')).toHaveAttribute(
      'data-hearing',
      'true',
    );
  });
});
