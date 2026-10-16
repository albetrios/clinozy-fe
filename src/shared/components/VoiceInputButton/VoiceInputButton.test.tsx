import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { VoiceInputButton } from './VoiceInputButton.tsx';

const TEST_ID = 'voice';

describe('VoiceInputButton', () => {
  it('is a quiet, labelled toggle at rest, with no meter', async () => {
    const onToggle = vi.fn();
    const { container } = render(
      <VoiceInputButton
        listening={false}
        hearing={false}
        label="Dictate with your voice"
        onToggle={onToggle}
        testId={TEST_ID}
      />,
    );

    const button = screen.getByRole('button', { name: 'Dictate with your voice' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toHaveAttribute('data-listening');
    expect(container.querySelector('.voice-bars')).toBeNull();
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
        testId={TEST_ID}
      />,
    );

    expect(screen.getByTestId(TEST_ID)).toHaveAttribute('data-listening', 'true');
    expect(screen.getByTestId(TEST_ID)).toHaveAttribute('aria-pressed', 'true');
    const bars = container.querySelector('.voice-bars');
    expect(bars?.children).toHaveLength(5);
    expect(bars).not.toHaveAttribute('data-hearing');

    rerender(
      <VoiceInputButton
        listening
        hearing
        label="Stop dictating"
        onToggle={vi.fn()}
        testId={TEST_ID}
      />,
    );
    expect(container.querySelector('.voice-bars')).toHaveAttribute(
      'data-hearing',
      'true',
    );
  });

  it('draws the small corner mic with no meter for a note field', () => {
    const { container } = render(
      <VoiceInputButton
        listening
        hearing
        size="sm"
        meter={false}
        label="Stop dictating"
        onToggle={vi.fn()}
        testId={TEST_ID}
      />,
    );
    const button = screen.getByTestId(TEST_ID);
    expect(button).toHaveClass('size-6', '[&_svg]:size-3');
    expect(button).toHaveAttribute('data-size', 'sm');
    expect(container.querySelector('.voice-bars')).toBeNull();
  });
});
