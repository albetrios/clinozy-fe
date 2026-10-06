import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { useOnboardingStore } from '@/shared/store/useOnboardingStore/index.ts';

import { InviteStep } from './InviteStep.tsx';

function addEmail(value: string) {
  fireEvent.change(screen.getByTestId('onboarding-invite-email'), {
    target: { value },
  });
  fireEvent.click(screen.getByTestId('onboarding-invite-add'));
}

describe('InviteStep', () => {
  beforeEach(() => {
    useOnboardingStore.setState((s) => ({ data: { ...s.data, invites: [] } }));
  });

  it('adds a valid email (normalized to lowercase) and clears the field', () => {
    render(<InviteStep />);

    addEmail('  Teammate@Example.COM ');

    expect(useOnboardingStore.getState().data.invites).toEqual(['teammate@example.com']);
    expect(screen.getByTestId('onboarding-invite-list')).toHaveTextContent(
      'teammate@example.com',
    );
    expect(screen.getByTestId('onboarding-invite-email')).toHaveValue('');
  });

  it('Enter in the field adds the email without submitting a form', () => {
    render(<InviteStep />);
    const input = screen.getByTestId('onboarding-invite-email');

    fireEvent.change(input, { target: { value: 'kb@example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useOnboardingStore.getState().data.invites).toEqual(['kb@example.com']);
  });

  it('rejects an invalid email with an alert and marks the field invalid', () => {
    render(<InviteStep />);

    addEmail('not-an-email');

    expect(screen.getByTestId('onboarding-invite-error')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-invite-email')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(useOnboardingStore.getState().data.invites).toEqual([]);
  });

  it('rejects a duplicate of an already-added email', () => {
    render(<InviteStep />);

    addEmail('dup@example.com');
    addEmail('DUP@example.com');

    expect(useOnboardingStore.getState().data.invites).toEqual(['dup@example.com']);
    expect(screen.getByTestId('onboarding-invite-error')).toBeInTheDocument();
  });

  it('typing again clears the error', () => {
    render(<InviteStep />);

    addEmail('bad');
    expect(screen.getByTestId('onboarding-invite-error')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('onboarding-invite-email'), {
      target: { value: 'good@example.com' },
    });
    expect(screen.queryByTestId('onboarding-invite-error')).not.toBeInTheDocument();
  });

  it('the remove control drops exactly that invite', () => {
    useOnboardingStore.setState((s) => ({
      data: { ...s.data, invites: ['a@example.com', 'b@example.com'] },
    }));
    render(<InviteStep />);

    const removeButtons = screen.getAllByRole('button', { name: /remove|a@|b@/i });
    // First list row's remove control targets a@example.com.
    fireEvent.click(removeButtons[0]!);

    expect(useOnboardingStore.getState().data.invites).toEqual(['b@example.com']);
  });

  it("lists each invitee as a person row in the design's item frame", () => {
    useOnboardingStore.setState((s) => ({
      data: { ...s.data, invites: ['dr.nisha@clinic.test'] },
    }));
    const { container } = render(<InviteStep />);

    const list = screen.getByTestId('onboarding-invite-list');
    expect(list).toHaveClass('rounded-xl', 'border', 'divide-y');
    // The 26px avatar with the address's initials, then the address itself.
    const avatar = container.querySelector('[data-slot="person-avatar"]');
    expect(avatar).toHaveTextContent('DN');
    const address = screen.getByText('dr.nisha@clinic.test');
    expect(address).toHaveAttribute('dir', 'ltr');
    expect(address).toHaveClass('truncate');
    // The remove "×" warns in the danger soft on hover.
    expect(screen.getByRole('button', { name: /dr\.nisha@clinic\.test/ })).toHaveClass(
      'hover:bg-destructive-tint',
      'hover:text-destructive',
    );
  });

  it('has no accessibility violations with invites listed', async () => {
    useOnboardingStore.setState((s) => ({
      data: { ...s.data, invites: ['a@example.com'] },
    }));
    const { container } = render(<InviteStep />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
