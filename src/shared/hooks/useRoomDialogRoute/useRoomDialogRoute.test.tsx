import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicHttpError } from '@/shared/api/clinic/clinic-fixture-store.ts';
import {
  type CrossRoomDialog,
  CrossRoomDialogContext,
} from '@/shared/hooks/useCrossRoomDialog/index.ts';

import {
  useRoomDialogRoute,
  type UseRoomDialogRouteOptions,
} from './useRoomDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** The member's access: resolved or not, and the actions granted in every section. */
const access = vi.hoisted(() => ({
  isResolved: true,
  granted: new Set<string>(['view', 'create', 'edit']),
}));
vi.mock('@/shared/hooks/useClinicAccess/index.ts', () => ({
  useClinicAccess: () => ({
    isResolved: access.isResolved,
    can: (_section: string, action: string) => access.granted.has(action),
  }),
}));

const RECORDS: Record<string, { name: string }> = { r1: { name: 'Alpha' } };

async function fetchRecord(id: string) {
  const record = RECORDS[id];
  if (!record) throw clinicHttpError(404, 'not_found', 'Record not found');
  return record;
}

type ProbeOptions = Partial<
  Pick<
    UseRoomDialogRouteOptions<{ name: string }, unknown>,
    'createActions' | 'tabActions'
  >
>;

/** The options the next render's room passes on top of the defaults. */
let roomOptions: ProbeOptions = {};

/** Every dialog the Probe rendered, in order. */
const seen: string[] = [];

/** The dialog the URL names, written out. */
function Probe() {
  const navigate = useNavigate();
  const { dialog } = useRoomDialogRoute<{ name: string }, { name?: string }>({
    section: 'stock',
    ...roomOptions,
    close: () => void navigate({ to: '/room', replace: true }),
    param: 'recordId',
    queryKey: (id) => ['record', id],
    fetchRecord,
    recordLabel: 'Record',
    readPrefill: (search) => ({
      name: typeof search.name === 'string' ? search.name : undefined,
    }),
  });
  let text: string = dialog.kind;
  if (dialog.kind === 'create') text += ` ${dialog.prefill.name ?? ''}`;
  if (dialog.kind === 'action') text += ` ${dialog.action}`;
  if (dialog.kind === 'record') {
    text += ` ${dialog.action || 'view'} ${dialog.record?.name ?? '…'}`;
  }
  seen.push(text);
  return (
    <>
      <p data-testid="dialog">{text}</p>
      <Outlet />
    </>
  );
}

/** The drawer route the cross-room host provides over the page, when a test sets one. */
let crossRoom: CrossRoomDialog | null = null;

/** The room's page: the Probe — over the page under a cross-room drawer when one is set. */
function RoomPage() {
  return crossRoom ? (
    <CrossRoomDialogContext.Provider value={crossRoom}>
      <Probe />
    </CrossRoomDialogContext.Provider>
  ) : (
    <Probe />
  );
}

/** A room tab at `/room` with its dialog routes, opened at `url`. */
function renderRoom(url: string, options: ProbeOptions = {}) {
  roomOptions = options;
  const root = createRootRoute({ component: () => <Outlet /> });
  const room = createRoute({
    getParentRoute: () => root,
    path: '/room',
    component: RoomPage,
  });
  const dialogs = [
    'create',
    'check',
    '$recordId',
    '$recordId/edit',
    '$recordId/receive',
  ].map((path) =>
    createRoute({
      getParentRoute: () => room,
      path,
      validateSearch: (search: Record<string, unknown>) => search,
      component: () => null,
    }),
  );
  const router = createRouter({
    routeTree: root.addChildren([room.addChildren(dialogs)]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router };
}

beforeEach(() => {
  notifyMock.info.mockReset();
  access.isResolved = true;
  access.granted = new Set(['view', 'create', 'edit']);
});
afterEach(() => {
  roomOptions = {};
  crossRoom = null;
  seen.length = 0;
});

describe('useRoomDialogRoute (KICKOFF §4, D24, S:115)', () => {
  it('reads nothing on the list, a create with its prefill, a tab action and each record route', async () => {
    const cases: [url: string, text: string][] = [
      ['/room', 'none'],
      ['/room/create?name=Al', 'create Al'],
      ['/room/check', 'action check'],
      ['/room/r1', 'record view Alpha'],
      ['/room/r1/edit', 'record edit Alpha'],
      ['/room/r1/receive', 'record receive Alpha'],
    ];
    for (const [url, text] of cases) {
      const view = renderRoom(url, { tabActions: ['check'] });
      await waitFor(() => expect(screen.getByTestId('dialog')).toHaveTextContent(text));
      view.unmount();
    }
  });

  it('a create opened from the list has its prefill from its first render', async () => {
    const { router } = renderRoom('/room');
    await waitFor(() => expect(screen.getByTestId('dialog')).toHaveTextContent('none'));
    await router.navigate({ to: '/room/create', search: { name: 'Al' } });
    await waitFor(() =>
      expect(screen.getByTestId('dialog')).toHaveTextContent('create Al'),
    );
    // A drawer keys its form on the opening render: it must never see an empty prefill.
    expect(seen.filter((text) => text.startsWith('create'))).toEqual(
      expect.arrayContaining(['create Al']),
    );
    expect(seen).not.toContain('create ');
  });

  it('a path that is not one of the tab’s actions opens nothing', async () => {
    renderRoom('/room/check');
    await waitFor(() => expect(screen.getByTestId('dialog')).toHaveTextContent('none'));
  });

  it('an unknown id goes back to the list with "Record not found"', async () => {
    const { router } = renderRoom('/room/zz/edit');
    await waitFor(() => expect(router.state.location.pathname).toBe('/room'));
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('dialog')).toHaveTextContent('none');
  });

  it('refuses a create, or a tab action, without every create action — once', async () => {
    access.granted = new Set(['view', 'create']);
    const create = renderRoom('/room/create', { createActions: ['create', 'edit'] });
    await waitFor(() => expect(create.router.state.location.pathname).toBe('/room'));
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    create.unmount();

    const check = renderRoom('/room/check', {
      createActions: ['create', 'edit'],
      tabActions: ['check'],
    });
    await waitFor(() => expect(check.router.state.location.pathname).toBe('/room'));
    expect(notifyMock.info).toHaveBeenCalledTimes(2);
  });

  it('waits for the access before it refuses anything', async () => {
    access.isResolved = false;
    access.granted = new Set();
    const { router } = renderRoom('/room/create');
    await waitFor(() => expect(screen.getByTestId('dialog')).toHaveTextContent('create'));
    expect(router.state.location.pathname).toBe('/room/create');
    expect(notifyMock.info).not.toHaveBeenCalled();
  });
});

describe('useRoomDialogRoute over another room (A-P1)', () => {
  const over = (pathname: string, close: () => void, params = {}): CrossRoomDialog => ({
    pathname,
    search: { name: 'Al' },
    params,
    close,
  });

  it('reads the drawer from its own route, not the page behind', async () => {
    crossRoom = over('/room/create', vi.fn());
    const { router } = renderRoom('/room');
    await waitFor(() =>
      expect(screen.getByTestId('dialog')).toHaveTextContent('create Al'),
    );
    expect(router.state.location.pathname).toBe('/room');

    crossRoom = over('/room/r1/edit', vi.fn(), { recordId: 'r1' });
    renderRoom('/room');
    await waitFor(() =>
      expect(screen.getAllByTestId('dialog').at(-1)).toHaveTextContent(
        'record edit Alpha',
      ),
    );
  });

  it('sends a refused create and a dead record back to the page behind', async () => {
    const close = vi.fn();
    access.granted = new Set(['view']);
    crossRoom = over('/room/create', close);
    const refused = renderRoom('/room');
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'You do not have permission to perform this action.',
    );
    refused.unmount();

    close.mockReset();
    notifyMock.info.mockReset();
    access.granted = new Set(['view', 'create', 'edit']);
    crossRoom = over('/room/gone', close, { recordId: 'gone' });
    renderRoom('/room');
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Record not found · it may have been deleted',
    );
  });
});
