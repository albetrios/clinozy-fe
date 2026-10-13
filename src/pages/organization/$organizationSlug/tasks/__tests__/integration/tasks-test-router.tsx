import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useLocation,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { type ReactNode, useCallback } from 'react';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { organizationTasks } from '@/lib/routes/tasks-builders.ts';
import type { Role } from '@/shared/api/app/app-schema.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { PRESET_CODES } from '@/tests/utils/app-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import { validateTaskCreateSearch } from '../../tasks.dialog-search.ts';
import { validateTasksSearch } from '../../tasks.search.ts';

/**
 * Every code an Owner or Admin holds in the room (research-tasks §7) — the
 * harness's member unless a test names others: read, create, work and delete
 * tasks, switch the rules, and open a lead or a booking from a contact card.
 */
const TASKS_ADMIN_CODES: readonly OrganizationPermission[] = [
  'organization:read',
  'organization:update',
  'task:read',
  'task:create',
  'task:update',
  'task:delete',
  'lead:create',
  'appointment:create',
];

/** A Front desk member's codes in the room: no delete, no rule switches. */
export const TASKS_FRONT_DESK_CODES: readonly OrganizationPermission[] = [
  'organization:read',
  'task:read',
  'task:create',
  'task:update',
  'lead:create',
  'appointment:create',
];

/** Who the harness signs in: their clinozy-be codes, or a preset's. */
export interface TasksTestMember {
  /** The member's codes (the room answers from them); the Admin's by default. */
  permissions?: readonly OrganizationPermission[];
  /** A member holding this preset's codes instead. */
  role?: Role;
}

/**
 * The Tasks family as `routeTree.tsx` registers it — the list with its search
 * schema and its two dialog routes, New task and the task drawer, which render
 * nothing — with `Page` as the list's component, opened at `url`, for the test
 * member (`signInTestMember`: organization `org_test`, slug `acme` — every
 * tasks read and key carries the organization) holding `member.permissions`,
 * or holding the preset `member.role`'s codes. Every other path lands on a
 * catch-all, so a test can read where a link went.
 */
export function renderTasksRoutes(
  url: string,
  Page: () => ReactNode,
  { permissions = TASKS_ADMIN_CODES, role }: TasksTestMember = {},
) {
  signInTestMember();
  useOrganizationStore
    .getState()
    .setPermissions([...(role ? PRESET_CODES[role] : permissions)]);

  const root = createRootRoute({ component: () => <Outlet /> });
  const tasks = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/tasks',
    validateSearch: validateTasksSearch,
    component: Page,
  });
  const create = createRoute({
    getParentRoute: () => tasks,
    path: 'create',
    validateSearch: validateTaskCreateSearch,
    component: () => null,
  });
  const task = createRoute({
    getParentRoute: () => tasks,
    path: '$taskId',
    component: () => null,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([tasks.addChildren([create, task]), elsewhere]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

/** Put the stores the harness touched back as they were. */
export function resetTasksRoutes() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
}

/**
 * A stand-in for `useTasksDialogRoute` (the drawers' package): the dialog the
 * URL opens as the real one reads it — New task on `/create`, a task on
 * `/$taskId` — and a close back to the list with its params.
 */
export function useTasksDialogRouteStub() {
  const { organizationSlug = '', taskId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const close = useCallback(() => {
    void navigate({
      ...organizationTasks(organizationSlug),
      search: (current: Record<string, unknown>) => validateTasksSearch(current),
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug]);
  if (taskId) {
    return {
      dialog: { kind: 'task', taskId, detail: undefined, isPending: true },
      close,
    };
  }
  if (pathname.endsWith('/create')) {
    return { dialog: { kind: 'create', prefill: {} }, close };
  }
  return { dialog: { kind: 'none' }, close };
}
