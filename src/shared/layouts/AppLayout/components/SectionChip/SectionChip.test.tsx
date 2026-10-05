import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { House } from '@/shared/icons/index.ts';
import type { SectionBarEntry } from '@/shared/layouts/AppLayout/section-bar-nav.ts';

import { SectionChip } from './SectionChip.tsx';

const today: SectionBarEntry = {
  id: 'today',
  to: '/organization/$organizationSlug/today',
  section: 'today',
  icon: House,
  labelNs: 'clinic',
  labelKey: 'sections.today.label',
  tone: 'butter',
  descriptionKey: 'sections.today.description',
};

describe('SectionChip', () => {
  it('names the current room in its tone, phone only', async () => {
    const { container } = render(<SectionChip entry={today} />);
    const chip = screen.getByTestId('section-chip');
    expect(chip).toHaveTextContent('Today');
    expect(chip.className).toContain('bg-tone-butter');
    expect(chip.className).toContain('md:hidden');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is the header item that gives way on a narrow phone: it shrinks and ellipsizes (L-64)', () => {
    render(<SectionChip entry={today} />);
    const chip = screen.getByTestId('section-chip');
    expect(chip).toHaveClass('min-w-0', 'flex-[0_1_auto]');
    expect(chip).not.toHaveClass('flex-none');
    expect(chip).toHaveAttribute('title', 'Today');
    expect(chip.firstElementChild).toHaveClass('truncate');
  });

  it('draws nothing outside a room', () => {
    const { container } = render(<SectionChip entry={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
