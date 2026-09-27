import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { Gate } from './Gate.tsx';

const USER = { id: 'usr_1', email: 'u@e.com', role: 'user' } as AuthUser;

function setTeamOrg(isTeam: boolean) {
  useOrganizationStore.setState({ organizationType: isTeam ? 'TEAM' : 'PERSONAL' });
}

beforeEach(() => {
  useAuthStore.setState({ user: USER });
  useOrganizationStore.getState().clearOrganization();
});

describe('Gate', () => {
  it('renders children when the check passes', () => {
    setTeamOrg(true);
    render(
      <Gate teamOrganizationOnly>
        <span>allowed</span>
      </Gate>,
    );
    expect(screen.getByText('allowed')).toBeInTheDocument();
  });

  it('renders the fallback when the check fails', () => {
    setTeamOrg(false);
    render(
      <Gate teamOrganizationOnly fallback={<span>denied</span>}>
        <span>allowed</span>
      </Gate>,
    );
    expect(screen.queryByText('allowed')).not.toBeInTheDocument();
    expect(screen.getByText('denied')).toBeInTheDocument();
  });
});
