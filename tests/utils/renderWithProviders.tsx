import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';

/**
 * Create a fresh QueryClient for each test to prevent shared state.
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial route entries for TanStack Router (memory history) */
  initialEntries?: string[];
  /** Custom QueryClient (defaults to a fresh test client) */
  queryClient?: QueryClient;
}

/**
 * Build a minimal route tree that renders the given UI at the index route.
 * Allows testing components that use useNavigate, Link, etc. with TanStack Router.
 */
function createTestRouteTree(ui: ReactElement) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => ui,
  });
  return rootRoute.addChildren([indexRoute]);
}

/**
 * Renders a component wrapped with all necessary providers for testing.
 *
 * Includes:
 * - TanStack Query (fresh client per test, no retries)
 * - TanStack Router (memory history; UI is rendered as the index route)
 *
 * Usage:
 *   const { getByText } = renderWithProviders(<MyComponent />);
 *   expect(getByText('Hello')).toBeInTheDocument();
 *
 * Stub dependencies with vi.mock() / vi.fn() at the top of your test file.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    initialEntries = ['/'],
    queryClient,
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) {
  const testQueryClient = queryClient ?? createTestQueryClient();
  const history = createMemoryHistory({ initialEntries });
  const routeTree = createTestRouteTree(ui);
  const testRouter = createRouter({ routeTree, history });

  return {
    ...render(
      <QueryClientProvider client={testQueryClient}>
        <RouterProvider router={testRouter} />
      </QueryClientProvider>,
      renderOptions,
    ),
    queryClient: testQueryClient,
    router: testRouter,
  };
}
