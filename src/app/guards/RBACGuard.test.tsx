import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';

import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { RBACGuard } from './RBACGuard.tsx';

type Permission = Parameters<typeof RBACGuard>[0]['permission'];

function buildTestRouter(permission: Permission) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const unauthorizedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/unauthorized',
    component: () => <div data-testid="unauthorized-page">Unauthorized</div>,
  });
  const guardedLayoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/guarded',
    component: () => <RBACGuard permission={permission} />,
  });
  const guardedIndexRoute = createRoute({
    getParentRoute: () => guardedLayoutRoute,
    path: '/',
    component: () => <div data-testid="guarded-page">Guarded Content</div>,
  });
  const tree = rootRoute.addChildren([
    unauthorizedRoute,
    guardedLayoutRoute.addChildren([guardedIndexRoute]),
  ]);
  const history = createMemoryHistory({ initialEntries: ['/guarded'] });
  return createRouter({ routeTree: tree, history });
}

function TestApp({ permission }: { permission: Permission }) {
  const router = buildTestRouter(permission);
  return <RouterProvider router={router} />;
}

describe('RBACGuard', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    useOrganizationStore.setState({
      organizationId: null,
      organizationSlug: null,
      permissions: [],
    });
  });

  it('redirects to /unauthorized when no user', async () => {
    render(<TestApp permission={'organization:read' as Permission} />);
    expect(await screen.findByTestId('unauthorized-page')).toBeInTheDocument();
  });

  it('renders content when user has permission', async () => {
    useAuthStore.setState({
      user: { id: '1', email: 'u@test.com', role: 'user' },
      isAuthenticated: true,
      isLoading: false,
    });
    useOrganizationStore.setState({ permissions: ['organization:read'] });

    render(<TestApp permission={'organization:read' as Permission} />);
    expect(await screen.findByTestId('guarded-page')).toBeInTheDocument();
  });

  it('redirects when user lacks permission', async () => {
    useAuthStore.setState({
      user: { id: '2', email: 'u2@test.com', role: 'user' },
      isAuthenticated: true,
      isLoading: false,
    });
    useOrganizationStore.setState({ permissions: ['organization:read'] });

    render(<TestApp permission={'membership:manage' as Permission} />);
    expect(await screen.findByTestId('unauthorized-page')).toBeInTheDocument();
  });

  it('renders nothing while loading', () => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });

    render(<TestApp permission={'organization:read' as Permission} />);
    // RBACGuard returns null while loading — guarded content should not be visible yet
    expect(screen.queryByTestId('guarded-page')).not.toBeInTheDocument();
  });
});
