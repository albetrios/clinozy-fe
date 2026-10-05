import { useSearch } from '@tanstack/react-router';

import { RolesAccess } from '../shared/components/RolesAccess/index.ts';
import { validateRolesSearch } from '../users.search.ts';

/**
 * Users › Roles & access (KICKOFF §6.12; `users.md:42–77`): the room toolbar
 * with "New role" over the role list and the selected role's page — the
 * URL's `role`, Front desk by default (H:5179). Every box and switch writes at
 * once; the family-shared `RolesAccess` holds it all, because the Team page
 * also keeps it behind a member drawer opened from here.
 */
export function RolesPage() {
  const { role } = validateRolesSearch(useSearch({ strict: false }));
  return (
    <section
      data-testid="users-roles-page"
      className="bg-canvas flex min-h-0 flex-1 flex-col"
    >
      <RolesAccess selected={role} />
    </section>
  );
}
