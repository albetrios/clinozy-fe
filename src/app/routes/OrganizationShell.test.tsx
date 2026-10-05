import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Component as OrganizationShell } from './OrganizationShell.tsx';

vi.mock('@/pages/organization/$organizationSlug/organization-slug.route.tsx', () => ({
  Component: () => <main data-testid="organization-layout">rooms</main>,
}));
vi.mock('./CrossRoomDialogs.tsx', () => ({
  CrossRoomDialogs: () => <aside data-testid="cross-room-dialogs" />,
}));

describe('OrganizationShell (A-P1)', () => {
  it('mounts the org shell’s layout and, beside it, the host of drawers other rooms open', () => {
    render(<OrganizationShell />);
    expect(screen.getByTestId('organization-layout')).toBeInTheDocument();
    expect(screen.getByTestId('cross-room-dialogs')).toBeInTheDocument();
  });
});
