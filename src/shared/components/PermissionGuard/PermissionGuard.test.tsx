import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { PermissionGuard } from './PermissionGuard.tsx';

const USER = { id: 'usr_1', email: 'u@e.com', role: 'user' } as AuthUser;

describe('PermissionGuard', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
    useOrganizationStore.getState().clearOrganization();
  });

  it('renders children when the permission is held', () => {
    useAuthStore.setState({ user: USER });
    useOrganizationStore.getState().setPermissions(['organization:read']);
    render(<PermissionGuard permission="organization:read">allowed</PermissionGuard>);
    expect(screen.getByText('allowed')).toBeInTheDocument();
  });

  it('renders the fallback when the permission is missing', () => {
    useAuthStore.setState({ user: USER });
    render(
      <PermissionGuard permission="organization:read" fallback="denied">
        allowed
      </PermissionGuard>,
    );
    expect(screen.queryByText('allowed')).not.toBeInTheDocument();
    expect(screen.getByText('denied')).toBeInTheDocument();
  });

  it('hides children for signed-out users', () => {
    render(<PermissionGuard permission="organization:read">allowed</PermissionGuard>);
    expect(screen.queryByText('allowed')).not.toBeInTheDocument();
  });
});
