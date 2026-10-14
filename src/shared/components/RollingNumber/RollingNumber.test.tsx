import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RollingNumber } from './RollingNumber.tsx';

function number(container: HTMLElement): HTMLElement {
  const found = container.querySelector<HTMLElement>('[data-slot="rolling-number"]');
  if (!found) throw new Error('no rolling number');
  return found;
}

function layer(container: HTMLElement, kind: 'in' | 'out'): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-roll-layer="${kind}"]`);
}

describe('RollingNumber', () => {
  it('shows the value on the first paint without rolling', () => {
    const { container } = render(<RollingNumber value={4} />);
    expect(number(container)).toHaveTextContent('4');
    expect(number(container)).not.toHaveAttribute('data-roll');
    expect(layer(container, 'in')).toBeNull();
    expect(layer(container, 'out')).toBeNull();
  });

  it('rolls up when the value grows: the new value arrives, the old one leaves drawn', () => {
    const { container, rerender } = render(<RollingNumber value={2} />);
    rerender(<RollingNumber value={3} />);
    expect(number(container)).toHaveAttribute('data-roll', 'up');
    expect(layer(container, 'in')).toHaveTextContent('3');
    expect(layer(container, 'out')).toHaveAttribute('data-value', '2');
    expect(layer(container, 'out')).toHaveAttribute('aria-hidden', 'true');
    // The leaving value is CSS, never text: the number reads as its value.
    expect(number(container)).toHaveTextContent(/^3$/);
  });

  it('rolls down when the value shrinks', () => {
    const { container, rerender } = render(<RollingNumber value={4} />);
    rerender(<RollingNumber value={3} />);
    expect(number(container)).toHaveAttribute('data-roll', 'down');
  });

  it('drops the old value once it has left', () => {
    const { container, rerender } = render(<RollingNumber value={2} />);
    rerender(<RollingNumber value={3} />);
    const leaving = layer(container, 'out');
    if (!leaving) throw new Error('no leaving value');
    fireEvent.animationEnd(leaving);
    expect(layer(container, 'out')).toBeNull();
    expect(number(container)).toHaveTextContent(/^3$/);
  });

  it('keeps only the latest change when the value moves again mid-roll', () => {
    const { container, rerender } = render(<RollingNumber value={1} />);
    rerender(<RollingNumber value={2} />);
    rerender(<RollingNumber value={3} />);
    expect(container.querySelectorAll('[data-roll-layer="out"]')).toHaveLength(1);
    expect(layer(container, 'out')).toHaveAttribute('data-value', '2');
    expect(layer(container, 'in')).toHaveTextContent('3');
  });

  it('lands a change at once while still — and on the first render after it', () => {
    const { container, rerender } = render(<RollingNumber value={0} still />);
    rerender(<RollingNumber value={0} still />);
    rerender(<RollingNumber value={4} />);
    expect(number(container)).toHaveTextContent(/^4$/);
    expect(number(container)).not.toHaveAttribute('data-roll');
    expect(layer(container, 'out')).toBeNull();
    // Settled: the next change is a change, and rolls.
    rerender(<RollingNumber value={3} />);
    expect(number(container)).toHaveAttribute('data-roll', 'down');
  });

  it("writes the leaving value with the caller's format too", () => {
    const { container, rerender } = render(
      <RollingNumber value={9} format={(value) => `${value}!`} />,
    );
    rerender(<RollingNumber value={10} format={(value) => `${value}!`} />);
    expect(layer(container, 'out')).toHaveAttribute('data-value', '9!');
  });

  it("writes the value with the caller's format", () => {
    const { container } = render(
      <RollingNumber
        value={7}
        format={(value) => `#${value}`}
        className="font-heading"
      />,
    );
    expect(number(container)).toHaveTextContent('#7');
    expect(number(container)).toHaveClass('tabular-nums', 'font-heading');
  });

  it('re-renders with the same value without rolling', () => {
    const { container, rerender } = render(<RollingNumber value={5} />);
    rerender(<RollingNumber value={5} />);
    expect(number(container)).not.toHaveAttribute('data-roll');
  });
});
