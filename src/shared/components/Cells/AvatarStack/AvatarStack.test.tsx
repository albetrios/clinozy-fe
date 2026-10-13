import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { AvatarStack, type AvatarStackPerson } from './AvatarStack.tsx';

const TEAM: readonly AvatarStackPerson[] = [
  { id: 'rs', name: 'Riya Shah', tone: 'blush' },
  { id: 'dr', name: 'Dr. Rakesh Patel', initials: 'DR', tone: 'sky' },
  { id: 'nk', name: 'Nidhi Kapoor', tone: 'lav' },
  { id: 'ks', name: 'Kunal Shah', tone: 'mint' },
  { id: 'kp', name: 'Krupa Patel', tone: 'butter' },
];

describe('AvatarStack', () => {
  it('shows three avatars and a "+N" pill for the rest', () => {
    render(<AvatarStack people={TEAM} />);
    expect(screen.getByText('RS')).toBeInTheDocument();
    expect(screen.getByText('DR')).toBeInTheDocument();
    expect(screen.getByText('NK')).toBeInTheDocument();
    expect(screen.queryByText('KS')).toBeNull();

    const more = screen.getByTestId('avatar-stack-more');
    expect(more).toHaveTextContent('+2');
    expect(screen.getByText('2 more')).toHaveClass('sr-only');
  });

  it('draws no "+N" pill when everyone fits', () => {
    render(<AvatarStack people={TEAM.slice(0, 3)} />);
    expect(screen.queryByTestId('avatar-stack-more')).toBeNull();
  });

  it('takes its own limit', () => {
    render(<AvatarStack people={TEAM} max={1} />);
    expect(screen.getByTestId('avatar-stack-more')).toHaveTextContent('+4');
  });

  it('speaks and titles every name it shows', () => {
    render(<AvatarStack people={TEAM.slice(0, 2)} />);
    expect(screen.getByText('Riya Shah')).toHaveClass('sr-only');
    expect(screen.getByTitle('Dr. Rakesh Patel')).toHaveAttribute('data-slot', 'pill');
  });

  it('names the first person in their pill for a people cell', () => {
    render(<AvatarStack people={TEAM.slice(1, 3)} nameFirst />);
    const first = screen.getByTitle('Dr. Rakesh Patel');
    expect(first).toHaveTextContent('Dr. Rakesh');
    expect(first).toHaveClass('ps-0.75', 'pe-2.5');
    // Only the first pill carries a name.
    expect(screen.getByTitle('Nidhi Kapoor')).not.toHaveTextContent('Nidhi K.');
    // Isolated in its own direction: its full stop stays at its end right-to-left.
    expect(screen.getByText('Dr. Rakesh')).toHaveAttribute('dir', 'auto');
  });

  it('wraps each pill for its card and puts the presence dot on the avatar', () => {
    const { container } = render(
      <AvatarStack
        people={[{ ...TEAM[0]!, presence: 'online' }]}
        nameFirst
        wrapPerson={(person, pill) => (
          <button type="button" aria-label={`Card of ${person.name}`}>
            {pill}
          </button>
        )}
      />,
    );
    expect(screen.getByRole('button', { name: 'Card of Riya Shah' })).toBeInTheDocument();
    expect(container.querySelector('[data-presence="online"]')).toBeInTheDocument();
    // The card names the person; the pill drops its own title.
    expect(screen.queryByTitle('Riya Shah')).toBeNull();
  });

  it('draws the 22px avatar in a 28px bordered pill', () => {
    const { container } = render(<AvatarStack people={TEAM.slice(0, 1)} />);
    const pill = container.querySelector('[title="Riya Shah"]');
    expect(pill).toHaveClass('h-7', 'min-w-7', 'rounded-full', 'border');
    expect(pill?.querySelector('[data-slot="avatar"]')).toHaveClass('size-5.5');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<AvatarStack people={TEAM} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
