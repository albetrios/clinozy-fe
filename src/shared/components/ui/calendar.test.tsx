import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Calendar } from './calendar.tsx';

const january = new Date(2026, 0, 1);

describe('Calendar — its custom parts', () => {
  it('keeps the same root element across a re-render (the parts are module-level components)', () => {
    const { container, rerender } = render(<Calendar defaultMonth={january} />);
    const root = container.querySelector('[data-slot="calendar"]');
    expect(root).not.toBeNull();

    rerender(<Calendar defaultMonth={january} className="p-4" />);

    // A part declared inside Calendar's render would be a new component type on every render,
    // and DayPicker would unmount and remount the whole calendar under it.
    expect(container.querySelector('[data-slot="calendar"]')).toBe(root);
  });

  it('draws the previous and next month chevrons', () => {
    const { container } = render(<Calendar defaultMonth={january} />);
    expect(container.querySelector('svg.lucide-chevron-left')).not.toBeNull();
    expect(container.querySelector('svg.lucide-chevron-right')).not.toBeNull();
  });

  it('draws the down chevron on the month and year dropdowns', () => {
    const { container } = render(
      <Calendar
        defaultMonth={january}
        captionLayout="dropdown"
        startMonth={new Date(2025, 0, 1)}
        endMonth={new Date(2027, 11, 1)}
      />,
    );
    expect(container.querySelector('svg.lucide-chevron-down')).not.toBeNull();
  });

  it('puts each week number in a centred cell', () => {
    const { container } = render(<Calendar defaultMonth={january} showWeekNumber />);
    // Day cells hold a button; a week-number cell holds a div with the number.
    const weekNumbers = [...container.querySelectorAll('td > div')].filter((cell) =>
      /^\d+$/.test(cell.textContent ?? ''),
    );
    expect(weekNumbers.length).toBeGreaterThan(0);
    expect(weekNumbers[0]).toHaveClass('flex', 'items-center', 'justify-center');
  });
});
