import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { UseSignInClinicResult } from '@/shared/hooks/useSignInClinic/index.ts';
import type { MyOrganizationSummary } from '@/shared/tenancy/my-organization-summaries.ts';

import { SignInClinicCard } from './SignInClinicCard.tsx';

function clinic(id: string, name: string, slug: string): MyOrganizationSummary {
  return {
    id,
    name,
    slug,
    type: 'TEAM',
    status: 'ACTIVE',
    logoUrl: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    isActive: false,
  };
}

const hook = vi.hoisted(() => ({
  value: undefined as unknown as UseSignInClinicResult,
  choose: vi.fn(),
}));
vi.mock('@/shared/hooks/useSignInClinic/index.ts', () => ({
  useSignInClinic: () => hook.value,
}));

const CLINICS = [
  clinic('org_ojas', 'Ojas Dermatology & Aesthetics', 'ojas-dermatology-aesthetics'),
  clinic('org_demo', 'Demo Organization', 'demo-org'),
];

function withHook(overrides: Partial<UseSignInClinicResult>) {
  hook.value = {
    clinics: CLINICS,
    pinnedId: null,
    canChoose: true,
    choose: hook.choose,
    ...overrides,
  };
}

describe('SignInClinicCard — the clinic that opens at sign-in', () => {
  beforeEach(() => {
    hook.choose.mockReset();
    withHook({});
  });

  it('offers the clinic used last and each clinic, with automatic chosen by default', () => {
    render(<SignInClinicCard />);

    expect(
      screen.getByRole('radiogroup', { name: 'Clinic at sign-in' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /The clinic I used last/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Ojas Dermatology/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Demo Organization/ })).not.toBeChecked();
  });

  it('shows the pinned clinic as chosen', () => {
    withHook({ pinnedId: 'org_demo' });
    render(<SignInClinicCard />);

    expect(screen.getByTestId('sign-in-clinic-option-demo-org')).toHaveAttribute(
      'data-state',
      'checked',
    );
    expect(
      screen.getByRole('radio', { name: /The clinic I used last/ }),
    ).not.toBeChecked();
  });

  it('pins a clinic, and goes back to automatic, on select', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SignInClinicCard />);

    await user.click(
      screen.getByTestId('sign-in-clinic-option-ojas-dermatology-aesthetics'),
    );
    expect(hook.choose).toHaveBeenLastCalledWith('org_ojas');

    withHook({ pinnedId: 'org_ojas' });
    rerender(<SignInClinicCard />);
    await user.click(screen.getByTestId('sign-in-clinic-option-automatic'));
    expect(hook.choose).toHaveBeenLastCalledWith(null);
  });

  it('renders nothing when there is nothing to choose', () => {
    withHook({ canChoose: false, clinics: CLINICS.slice(0, 1) });
    const { container } = render(<SignInClinicCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<SignInClinicCard />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
