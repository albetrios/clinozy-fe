import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { LocalizedCalendar, type LocalizedCalendarProps } from './LocalizedCalendar.tsx';

/** 1 October 2026 is a Thursday; "today" is 3 October. */
const OCTOBER = new Date(2026, 9, 1);
const TODAY = new Date(2026, 9, 3);

function Grid({
  initial,
  onPick = () => {},
  ...props
}: Partial<LocalizedCalendarProps> & {
  initial?: Date;
  onPick?: (date: Date | undefined) => void;
}) {
  const [selected, setSelected] = useState<Date | undefined>(initial);
  return (
    <LocalizedCalendar
      mode="single"
      selected={selected}
      onSelect={(date: Date | undefined) => {
        setSelected(date);
        onPick(date);
      }}
      defaultMonth={OCTOBER}
      today={TODAY}
      weekStartsOn={0}
      showOutsideDays={false}
      testIds={{ day: 'grid-day', previous: 'grid-previous', next: 'grid-next' }}
      {...(props as object)}
    />
  );
}

/** The day button of a day of October 2026. */
function october(day: number): HTMLElement {
  const iso = `2026-10-${String(day).padStart(2, '0')}`;
  const button = screen
    .getAllByTestId('grid-day')
    .find((candidate) => candidate.dataset.day === iso);
  if (!button) throw new Error(`no ${iso}`);
  return button;
}

describe('LocalizedCalendar — the month grid', () => {
  it('gives every day its YYYY-MM-DD and the caller’s test id, the arrows theirs', () => {
    render(<Grid look="regular" />);
    expect(screen.getAllByTestId('grid-day')).toHaveLength(31);
    expect(october(9)).toHaveTextContent(/^9$/);
    expect(screen.getByTestId('grid-previous')).toHaveAttribute('data-slot', 'button');
    expect(screen.getByTestId('grid-next')).toBeInTheDocument();
  });

  it('heads the columns Sunday first in two letters, the caption between the arrows', () => {
    const { container } = render(<Grid look="regular" />);
    // react-day-picker hides the header row from assistive tech: each day names itself.
    const headers = [...container.querySelectorAll('th')].map((cell) => cell.textContent);
    expect(headers).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
    expect(screen.getByRole('status')).toHaveTextContent('Oct 2026');
  });

  it('keeps its day buttons mounted when the parent re-renders on a pick', async () => {
    const user = userEvent.setup();
    render(<Grid look="regular" />);
    const ninth = october(9);
    await user.click(ninth);
    expect(ninth).toBeInTheDocument();
    expect(ninth).toHaveFocus();
  });

  it('spells the month in full in the compact look', () => {
    render(<Grid look="compact" />);
    expect(screen.getByRole('status')).toHaveTextContent('October 2026');
  });

  it('marks today and the pick — one state per day — in the primary tone by default', async () => {
    const user = userEvent.setup();
    render(<Grid look="regular" />);
    expect(october(3)).toHaveAttribute('data-day-state', 'today');
    await user.click(october(9));
    expect(october(9)).toHaveAttribute('data-day-state', 'selected');
    expect(october(9).closest('[role="gridcell"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(october(9).className).toContain('data-[day-state=selected]:bg-primary');
  });

  it('wears sky for today and the pick in the sky tone', () => {
    render(<Grid look="compact" tone="sky" />);
    expect(october(3).className).toContain('data-[day-state=today]:bg-tone-sky');
  });

  it('clears an optional pick on a second press', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<Grid look="regular" onPick={onPick} />);
    await user.click(october(9));
    await user.click(october(9));
    expect(onPick).toHaveBeenLastCalledWith(undefined);
  });

  it('turns days it cannot pick off, keeping a disabled pick picked', () => {
    render(
      <Grid look="compact" initial={new Date(2026, 9, 1)} disabled={{ before: TODAY }} />,
    );
    expect(october(2)).toBeDisabled();
    expect(october(2)).toHaveAttribute('data-day-state', 'off');
    expect(october(1)).toHaveAttribute('data-day-state', 'selected');
    expect(october(4)).toBeEnabled();
  });

  it('draws one to three dots under the days its dots modifier answers for', () => {
    render(
      <Grid
        look="regular"
        initial={new Date(2026, 9, 12)}
        dots={(date) => {
          if (date === '2026-10-09') return { count: 2, className: 'bg-tone-butter-dot' };
          if (date === '2026-10-12') return { count: 1, className: 'bg-tone-sage-dot' };
          return undefined;
        }}
      />,
    );
    const dots = (day: number) =>
      october(day).querySelectorAll('[aria-hidden="true"] > span');
    expect(dots(9)).toHaveLength(2);
    expect(dots(9)[0]).toHaveClass('bg-tone-butter-dot');
    expect(dots(10)).toHaveLength(0);
    // The pick turns its dots to the canvas colour.
    expect(dots(12)[0]).toHaveClass('bg-canvas');
    expect(october(9)).toHaveTextContent(/^9$/);
  });

  it('is one tab stop: arrows move the focus between days, Enter picks', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<Grid look="regular" initial={new Date(2026, 9, 9)} onPick={onPick} />);
    const tabbable = screen
      .getAllByTestId('grid-day')
      .filter((day) => day.getAttribute('tabindex') === '0');
    expect(tabbable).toEqual([october(9)]);
    october(9).focus();
    await user.keyboard('{ArrowRight}');
    expect(october(10)).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(october(17)).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onPick).toHaveBeenLastCalledWith(new Date(2026, 9, 17));
  });

  it('names each day for a screen reader and, in a room look, as its tooltip', () => {
    render(
      <Grid
        look="regular"
        labels={{ labelDayButton: (date) => `day ${date.getDate()}` }}
      />,
    );
    expect(october(9)).toHaveAccessibleName('day 9');
    expect(october(9)).toHaveAttribute('title', 'day 9');
  });

  it('keeps the picker look’s days without a tooltip', () => {
    render(<Grid />);
    expect(october(9)).not.toHaveAttribute('title');
    expect(october(9)).toHaveAccessibleName(/October 9, 2026|9 October 2026/);
  });

  it('has no accessibility violations in each look', async () => {
    for (const look of ['picker', 'compact', 'regular'] as const) {
      const { container, unmount } = render(<Grid look={look} />);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });
});
