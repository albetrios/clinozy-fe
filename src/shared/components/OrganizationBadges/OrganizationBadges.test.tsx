/* eslint-disable jsx-a11y/aria-role -- `role` here is a domain prop on RoleBadge, not the HTML/ARIA role attribute */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import {
  InvitationStatusBadge,
  MemberStatusBadge,
  RoleBadge,
} from './OrganizationBadges.tsx';

describe('OrganizationBadges', () => {
  it('renders the role label', () => {
    render(<RoleBadge role="admin" />);
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('renders member and invitation status labels', () => {
    render(
      <>
        <MemberStatusBadge status="active" />
        <InvitationStatusBadge status="pending" />
      </>,
    );
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<RoleBadge role="owner" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
