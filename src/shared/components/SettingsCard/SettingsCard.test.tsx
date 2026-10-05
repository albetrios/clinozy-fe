import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { SettingsCard, SettingsList, SettingsListRow } from './SettingsCard.tsx';

describe('SettingsCard', () => {
  it('heads the block with its title, description and action, and is named by the title', () => {
    render(
      <SettingsCard
        title="Two-factor authentication"
        description="Require an authenticator code at sign-in."
        action={<button type="button">Set up</button>}
        data-testid="card"
      >
        <p>Body</p>
      </SettingsCard>,
    );
    const card = screen.getByRole('region', { name: 'Two-factor authentication' });
    expect(card).toBe(screen.getByTestId('card'));
    expect(
      within(card).getByRole('heading', { level: 3, name: 'Two-factor authentication' }),
    ).toHaveClass('text-field', 'font-semibold');
    expect(
      within(card).getByText('Require an authenticator code at sign-in.'),
    ).toHaveClass('text-muted-foreground', 'text-xs');
    expect(within(card).getByRole('button', { name: 'Set up' })).toBeInTheDocument();
    expect(within(card).getByText('Body')).toBeInTheDocument();
  });

  it('is the card slot, padded like a drawer step card, so the theme axes reach it', () => {
    render(<SettingsCard data-testid="card">Body</SettingsCard>);
    const card = screen.getByTestId('card');
    expect(card).toHaveAttribute('data-slot', 'card');
    expect(card).toHaveClass('rounded-xl', 'border', 'p-(--step-pad)');
    // No head without a title or an action.
    expect(card.querySelector('h3')).toBeNull();
  });

  it('draws the destructive edge and title in its danger variant', () => {
    render(
      <SettingsCard title="Danger zone" variant="danger" data-testid="card">
        Body
      </SettingsCard>,
    );
    expect(screen.getByTestId('card')).toHaveClass('border-destructive-border');
    expect(screen.getByRole('heading', { name: 'Danger zone' })).toHaveClass(
      'text-destructive',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <SettingsCard title="Avatar" description="Shown next to your name.">
        <button type="button">Upload photo</button>
      </SettingsCard>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('SettingsList', () => {
  it('frames table-like rows in the card slot', () => {
    render(
      <SettingsList data-testid="list" frameClassName="opacity-60" aria-busy>
        <SettingsListRow>First</SettingsListRow>
        <SettingsListRow>Second</SettingsListRow>
      </SettingsList>,
    );
    const list = screen.getByTestId('list');
    expect(list.tagName).toBe('UL');
    expect(list).toHaveAttribute('aria-busy', 'true');
    expect(list.parentElement).toHaveAttribute('data-slot', 'card');
    expect(list.parentElement).toHaveClass('rounded-xl', 'overflow-hidden', 'opacity-60');
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveClass('border-b-muted', 'hover:bg-canvas', 'py-2.5');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <SettingsList>
        <SettingsListRow>Mac · Chrome</SettingsListRow>
      </SettingsList>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
