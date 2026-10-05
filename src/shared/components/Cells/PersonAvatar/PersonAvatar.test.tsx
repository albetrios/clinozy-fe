import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { personInitials, shortPersonName } from './person-name.ts';
import { PersonAvatar } from './PersonAvatar.tsx';

describe('personInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(personInitials('Rhea Shah')).toBe('RS');
    expect(personInitials('  dharti   galani  ')).toBe('DG');
    expect(personInitials('Anaya Mehta Desai')).toBe('AM');
    expect(personInitials('Madonna')).toBe('M');
    expect(personInitials('')).toBe('');
  });
});

describe('shortPersonName', () => {
  it('keeps the first name and the last initial', () => {
    expect(shortPersonName('Riya Shah')).toBe('Riya S.');
    expect(shortPersonName('  Nidhi   Kapoor Mehta ')).toBe('Nidhi K.');
  });

  it('keeps a doctor’s name after the title', () => {
    expect(shortPersonName('Dr. Drashti Desai')).toBe('Dr. Drashti');
    expect(shortPersonName('Dr.Reenal Patel')).toBe('Dr. Reenal');
  });

  it('leaves a single name alone', () => {
    expect(shortPersonName('Madonna')).toBe('Madonna');
    expect(shortPersonName('')).toBe('');
  });
});

describe('PersonAvatar', () => {
  it('draws the initials in the tone, hidden from assistive technology', () => {
    const { container } = render(<PersonAvatar initials="RS" tone="sage" />);
    const root = container.querySelector('[data-slot="person-avatar"]');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('RS')).toHaveClass(
      'bg-tone-sage',
      'text-tone-sage-foreground',
      'text-micro',
      'font-semibold',
    );
    expect(container.querySelector('[data-slot="avatar"]')).toHaveClass('size-8');
  });

  it('adds the "P" badge for a patient', () => {
    render(<PersonAvatar initials="RS" tone="sage" patient />);
    const badge = screen.getByTestId('patient-badge');
    expect(badge).toHaveTextContent('P');
    expect(badge).toHaveClass('bg-success', 'size-3.5');
  });

  it('adds the violet "L" badge for a lead — the patient’s "P" wins', () => {
    const { rerender } = render(
      <PersonAvatar initials="AP" tone="lav" size="line" lead />,
    );
    const badge = screen.getByTestId('lead-badge');
    expect(badge).toHaveTextContent('L');
    expect(badge).toHaveClass('bg-assist', 'size-2.5');
    rerender(<PersonAvatar initials="AP" tone="lav" size="line" lead patient />);
    expect(screen.queryByTestId('lead-badge')).toBeNull();
    expect(screen.getByTestId('patient-badge')).toHaveTextContent('P');
  });

  it('sizes the card avatar with the 16px badge and a presence dot', () => {
    const { container } = render(
      <PersonAvatar initials="DR" tone="sky" size="card" patient presence="online" />,
    );
    expect(container.querySelector('[data-slot="avatar"]')).toHaveClass('size-12');
    expect(screen.getByTestId('patient-badge')).toHaveClass('size-4');
    expect(container.querySelector('[data-presence="online"]')).toHaveClass(
      'bg-presence-online',
      'size-3',
    );
  });

  it('sizes the chat header avatar at 34px with the 14px badge (H:1830)', () => {
    const { container } = render(
      <PersonAvatar initials="DG" tone="sage" size="header" patient />,
    );
    expect(container.querySelector('[data-slot="avatar"]')).toHaveClass('size-8.5');
    expect(screen.getByTestId('patient-badge')).toHaveClass('size-3.5');
  });

  it('draws the team chip with the 7px presence dot (H:1741)', () => {
    const { container } = render(
      <PersonAvatar initials="RS" tone="blush" size="chip" presence="online" />,
    );
    expect(container.querySelector('[data-slot="avatar"]')).toHaveClass('size-5.5');
    const dot = container.querySelector('[data-presence="online"]');
    expect(dot).toHaveClass('size-1.75', 'border-[1.5px]');
    expect(dot).not.toHaveClass('border-2');
  });

  it('sizes the Leads filter and people-popover avatars at 18, 28 and 30px', () => {
    const sizes = [
      ['line', 'size-4.5'],
      ['list', 'size-7'],
      ['roster', 'size-7.5'],
    ] as const;
    for (const [size, root] of sizes) {
      const { container, unmount } = render(
        <PersonAvatar initials="NK" tone="sage" size={size} />,
      );
      expect(container.querySelector('[data-slot="avatar"]')).toHaveClass(root);
      unmount();
    }
  });

  it('rings a picked person in the tone ink, 2px off the disc', () => {
    const { container } = render(
      <PersonAvatar initials="NK" tone="sage" size="list" selected />,
    );
    const disc = container.querySelector('[data-slot="avatar"]');
    expect(disc).toHaveClass(
      'ring-[1.5px]',
      'ring-offset-2',
      'ring-tone-sage-foreground',
    );
    expect(disc).not.toHaveClass('ring-1');
  });

  it('paints an offline dot in border-strong', () => {
    const { container } = render(
      <PersonAvatar initials="NK" tone="lav" presence="offline" />,
    );
    expect(container.querySelector('[data-presence="offline"]')).toHaveClass(
      'bg-border-strong',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<PersonAvatar initials="RS" tone="sage" patient />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('PersonAvatar — photo, identity / profile sizes, the user’s Status', () => {
  it('draws the photo over the initials, and falls back to them if it fails', async () => {
    const { container } = render(
      <PersonAvatar
        initials="AL"
        tone="stone"
        size="profile"
        src="https://signed.test/a.png"
      />,
    );
    const photo = screen.getByTestId('person-avatar-photo');
    expect(photo).toHaveAttribute('src', 'https://signed.test/a.png');
    // Decorative like the disc: the caller names the picture beside it.
    expect(photo).toHaveAttribute('alt', '');
    expect(container.querySelector('[data-slot="avatar"]')).toHaveClass('size-16');
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.error(photo);
    expect(screen.queryByTestId('person-avatar-photo')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('AL');
  });

  it.each([
    ['online', 'bg-presence-online'],
    ['away', 'bg-tone-butter-dot'],
    ['busy', 'bg-now-indicator'],
    ['offline', 'bg-border-strong'],
  ] as const)('paints the %s dot', (presence, fill) => {
    const { container } = render(
      <PersonAvatar initials="RV" tone="sky" size="identity" presence={presence} />,
    );
    expect(container.querySelector(`[data-presence="${presence}"]`)).toHaveClass(fill);
    expect(container.querySelector('[data-slot="avatar"]')).toHaveClass('size-10');
  });
});
