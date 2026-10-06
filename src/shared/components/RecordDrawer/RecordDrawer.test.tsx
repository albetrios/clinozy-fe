import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { useStackedDrawer } from '@/shared/hooks/useStackedDrawer/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

import { useDrawerItemsField } from './record-drawer-items.ts';
import { RecordDrawer, type RecordDrawerProps } from './RecordDrawer.tsx';

type HarnessProps = Partial<RecordDrawerProps> & { startOpen?: boolean };

/** Stands in for an `ItemsField`: reports an item-rows table to the drawer. */
function ItemsTableStub({ wide }: { wide: boolean }) {
  useDrawerItemsField(wide);
  return <p>item rows</p>;
}

/** A page with the button that opens the drawer, as a list's "New" would. */
function Harness({ startOpen = false, onClose, ...props }: HarnessProps) {
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        New patient
      </button>
      <RecordDrawer
        title="New patient"
        sub="Add the details, then Create patient"
        testId="pt"
        onSave={vi.fn()}
        {...props}
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      />
    </>
  );
}

const user = () => userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

async function openDrawer(props: HarnessProps = {}) {
  const u = user();
  renderWithProviders(<Harness {...props} />);
  await u.click(await screen.findByRole('button', { name: 'New patient' }));
  const drawer = await screen.findByTestId('pt');
  return { u, drawer };
}

const STEPS: DrawerStep[] = [
  { id: 'contact', title: 'Contact & personal', content: <p>contact body</p> },
  {
    id: 'clinic',
    title: 'Clinic, referral & follow-up',
    missing: ['Status'],
    content: <p>clinic body</p>,
  },
];

beforeEach(() => {
  viewport.tier = 'desktop';
});

describe('RecordDrawer — shell', () => {
  it('is a modal dialog named by its title, with tag, sub line, badges and body', async () => {
    renderWithProviders(
      <Harness
        startOpen
        tag="#273"
        badges={[
          { id: 'type', label: 'Aesthetic', tone: 'lav' },
          { id: 'age', label: '28 yrs' },
        ]}
      >
        <p>fields</p>
      </Harness>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'New patient' });
    expect(dialog).toHaveAccessibleDescription('Add the details, then Create patient');
    expect(screen.getByTestId('pt-tag')).toHaveTextContent('#273');
    const badges = screen.getByTestId('pt-badges');
    expect(within(badges).getByText('Aesthetic')).toHaveClass(
      'bg-tone-lav',
      'text-tone-lav-foreground',
    );
    expect(within(badges).getByText('28 yrs')).toHaveClass('bg-muted');
    expect(within(screen.getByTestId('pt-body')).getByText('fields')).toBeInTheDocument();
  });

  it('reads a record’s name, tag and badges in their own direction; the sub keeps the page’s', async () => {
    // "Riya S." or "INV-787" in a right-to-left header reorders unless isolated.
    document.documentElement.dir = 'rtl';
    try {
      renderWithProviders(
        <Harness
          startOpen
          title="Riya S."
          tag="INV-787"
          sub="Patient file"
          badges={[{ id: 'bill', label: 'Bill ₹324' }]}
        />,
      );
      const title = await screen.findByTestId('pt-title');
      expect(title).toHaveAttribute('dir', 'auto');
      expect(title).toHaveClass('[text-align:match-parent]');
      expect(screen.getByTestId('pt-tag')).toHaveAttribute('dir', 'auto');
      expect(screen.getByText('Bill ₹324')).toHaveAttribute('dir', 'auto');
      // A sub line often leads with a name: its tokens are isolated, not the line.
      expect(screen.getByText('Patient file')).not.toHaveAttribute('dir');
      expect(title.parentElement).toHaveTextContent('Riya S.INV-787');
    } finally {
      document.documentElement.dir = '';
    }
  });

  it('sets a 20px title over a 12.5px sub line for a screen-sized header', async () => {
    renderWithProviders(<Harness startOpen largeTitle />);
    expect(await screen.findByTestId('pt-title')).toHaveClass('text-xl');
    expect(screen.getByText('Add the details, then Create patient')).toHaveClass(
      'text-detail',
    );
  });

  it('carries a counter at the header’s end, and lays edge-to-edge rows in a flush body', async () => {
    renderWithProviders(
      <Harness startOpen headerEnd={<span>2 of 10 counted</span>} flushBody>
        <p>count rows</p>
      </Harness>,
    );
    expect(await screen.findByTestId('pt-header-end')).toHaveTextContent(
      '2 of 10 counted',
    );
    const body = screen.getByTestId('pt-body');
    expect(body).not.toHaveClass('p-(--drawer-body-pad)');
    expect(body).not.toHaveClass('gap-3');
  });

  it('keeps the sub line as the description while a phone hides it', async () => {
    renderWithProviders(<Harness startOpen hideSubOnPhone />);
    const dialog = await screen.findByRole('dialog', { name: 'New patient' });
    expect(dialog).toHaveAccessibleDescription('Add the details, then Create patient');
    expect(screen.getByText('Add the details, then Create patient')).toHaveClass(
      'max-md:sr-only',
    );
  });

  it('slides in from the inline end over a 45% backdrop', async () => {
    renderWithProviders(<Harness startOpen />);

    const drawer = await screen.findByTestId('pt');
    expect(drawer).toHaveClass('data-[state=open]:animate-drawer-in', 'end-0');
    const overlay = document.querySelector('[data-slot="sheet-overlay"]');
    expect(overlay).toHaveClass('bg-overlay/45', 'data-[state=open]:animate-backdrop-in');
    // The sheet's stock slide and fade are replaced, not left to race them.
    for (const node of [drawer, overlay]) {
      expect(node).not.toHaveClass('data-[state=open]:animate-in');
      expect(node).not.toHaveClass('data-[state=closed]:animate-out');
    }
  });

  it('sizes itself by the width rule', async () => {
    const { unmount } = renderWithProviders(
      <Harness startOpen content={{ fieldCount: 6 }} />,
    );
    expect(await screen.findByTestId('pt')).toHaveClass(
      'w-full',
      'md:w-[min(560px,calc(100vw-56px))]',
    );
    unmount();

    renderWithProviders(
      <Harness startOpen content={{ fieldCount: 3, hasItems: true }} />,
    );
    expect(await screen.findByTestId('pt')).toHaveClass(
      'md:w-[min(840px,calc(100vw-56px))]',
    );
  });

  it('takes 840px from an items table that reports itself, not from a compact one', async () => {
    const { unmount } = renderWithProviders(
      <Harness startOpen content={{ fieldCount: 3 }}>
        <ItemsTableStub wide />
      </Harness>,
    );
    expect(await screen.findByTestId('pt')).toHaveClass(
      'md:w-[min(840px,calc(100vw-56px))]',
    );
    unmount();

    renderWithProviders(
      <Harness startOpen content={{ fieldCount: 3 }}>
        <ItemsTableStub wide={false} />
      </Harness>,
    );
    expect(await screen.findByTestId('pt')).toHaveClass(
      'md:w-[min(560px,calc(100vw-56px))]',
    );
  });

  it('floats the × outside the inline-start edge from md up, popping in late', async () => {
    renderWithProviders(<Harness startOpen />);

    const close = await screen.findByTestId('pt-close');
    expect(close).toHaveAccessibleName('Close');
    expect(close).toHaveAttribute('data-slot', 'floating-edge');
    expect(close).toHaveClass(
      '-start-[3.125rem]',
      'size-9',
      'rounded-xl',
      'animate-pop-in',
    );
  });

  it('takes a width the screen measures, with a column at the inline end (the form’s chat)', async () => {
    renderWithProviders(
      <Harness
        startOpen
        panelWidth={1180}
        aside={{ width: 420, content: <p>the chat</p> }}
        closeStyle="form"
      />,
    );
    const drawer = await screen.findByTestId('pt');
    expect(drawer).toHaveClass('md:w-(--drawer-panel-width)');
    expect(drawer.style.getPropertyValue('--drawer-panel-width')).toBe('1180px');
    expect(drawer.style.getPropertyValue('--drawer-aside-width')).toBe('420px');
    expect(within(screen.getByTestId('pt-aside')).getByText('the chat')).toBeVisible();
    expect(within(screen.getByTestId('pt-main')).getByTestId('pt-body')).toBeVisible();
    expect(screen.getByTestId('pt-close')).toHaveClass(
      '-start-[2.875rem]',
      'rounded-lg',
      'border',
    );
  });

  it('leaves the column out on a phone', async () => {
    viewport.tier = 'phone';
    renderWithProviders(
      <Harness startOpen panelWidth={375} aside={{ width: 420, content: <p>chat</p> }} />,
    );
    await screen.findByTestId('pt');
    expect(screen.queryByTestId('pt-aside')).not.toBeInTheDocument();
    expect(screen.queryByText('chat')).not.toBeInTheDocument();
  });

  it('holds the primary until the first change, and dims it while incomplete', async () => {
    const { unmount } = renderWithProviders(<Harness startOpen saveDisabled />);
    expect(await screen.findByTestId('pt-save')).toBeDisabled();
    unmount();
    const onSave = vi.fn();
    const u = user();
    renderWithProviders(
      <Harness startOpen saveIncomplete compactFooter onSave={onSave} />,
    );
    const save = await screen.findByTestId('pt-save');
    expect(save).toHaveAttribute('data-incomplete', 'true');
    expect(save).toHaveClass('opacity-50', 'md:h-8');
    await u.click(save);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('shows Quick fill presets, which run without saving', async () => {
    const onSelect = vi.fn();
    const onSave = vi.fn();
    const { u } = await openDrawer({
      onSave,
      quickFill: [{ id: 'single', label: 'Single session', tone: 'sage', onSelect }],
    });

    await u.click(screen.getByTestId('pt-quick-fill-single'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps a strip under Quick fill and one above the footer out of the scrolling body', async () => {
    const { drawer } = await openDrawer({
      headerStrip: <p>type switch</p>,
      footerStrip: <p>totals</p>,
      children: <p>fields</p>,
    });
    const body = within(drawer).getByTestId('pt-body');
    const header = within(drawer).getByTestId('pt-header-strip');
    const footer = within(drawer).getByTestId('pt-footer-strip');
    expect(header).toHaveTextContent('type switch');
    expect(footer).toHaveTextContent('totals');
    expect(body).not.toContainElement(header);
    expect(body).not.toContainElement(footer);
    // Header strip, body, footer strip, footer — in that order.
    expect(header.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(body.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});

describe('RecordDrawer — focus', () => {
  it('focuses the title on open and returns focus to the trigger on close', async () => {
    const { u } = await openDrawer();

    await waitFor(() => expect(screen.getByTestId('pt-title')).toHaveFocus());

    await u.click(screen.getByTestId('pt-dismiss'));

    await waitFor(() => expect(screen.queryByTestId('pt')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'New patient' })).toHaveFocus();
  });

  it('focuses what the screen names instead of the title, while it is there', async () => {
    function SearchFirst({ withSearch }: { withSearch: boolean }) {
      const searchRef = useRef<HTMLInputElement>(null);
      return (
        <Harness startOpen initialFocusRef={searchRef}>
          {withSearch ? <input ref={searchRef} aria-label="Search" /> : null}
        </Harness>
      );
    }
    const { unmount } = renderWithProviders(<SearchFirst withSearch />);
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus(),
    );
    unmount();

    renderWithProviders(<SearchFirst withSearch={false} />);
    await waitFor(() => expect(screen.getByTestId('pt-title')).toHaveFocus());
  });

  it('keeps Tab inside the drawer', async () => {
    const { u, drawer } = await openDrawer();

    for (let press = 0; press < 6; press += 1) {
      await u.tab();
      expect(drawer.contains(document.activeElement)).toBe(true);
    }
  });
});

describe('RecordDrawer — closing', () => {
  it('closes at once from Esc when nothing is dirty', async () => {
    const onClose = vi.fn();
    const { u } = await openDrawer({ onClose });

    await u.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('asks before discarding on Esc while dirty; "Keep editing" keeps the drawer', async () => {
    const onClose = vi.fn();
    const { u } = await openDrawer({ onClose, dirty: true });

    await u.keyboard('{Escape}');

    const prompt = await screen.findByTestId('confirm-dialog');
    expect(within(prompt).getByText('Discard changes?')).toBeInTheDocument();
    await u.click(screen.getByTestId('confirm-cancel'));

    await waitFor(() =>
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('pt')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    ['the ×', 'pt-close'],
    ['Cancel', 'pt-dismiss'],
  ])(
    'asks before discarding from %s while dirty; "Discard" closes',
    async (_, testId) => {
      const onClose = vi.fn();
      const { u } = await openDrawer({ onClose, dirty: true });

      await u.click(screen.getByTestId(testId));
      await screen.findByTestId('confirm-dialog');
      expect(onClose).not.toHaveBeenCalled();

      await u.click(screen.getByTestId('confirm-accept'));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByTestId('pt')).not.toBeInTheDocument());
    },
  );

  it('"Keep editing" puts focus back where it was, inside the drawer', async () => {
    const { u } = await openDrawer({ dirty: true });

    await u.click(screen.getByTestId('pt-close'));
    await u.click(await screen.findByTestId('confirm-cancel'));

    await waitFor(() => expect(screen.getByTestId('pt-close')).toHaveFocus());
  });

  it('asks before discarding from the backdrop while dirty', async () => {
    const onClose = vi.fn();
    const { u } = await openDrawer({ onClose, dirty: true });

    const overlay = document.querySelector('[data-slot="sheet-overlay"]');
    if (!(overlay instanceof HTMLElement)) throw new Error('no sheet overlay');
    await u.click(overlay);

    expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('holds every exit while a save is in flight', async () => {
    const onClose = vi.fn();
    const { u } = await openDrawer({ onClose, dirty: true, saveState: 'saving' });

    await u.keyboard('{Escape}');
    await u.click(screen.getByTestId('pt-close'));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('pt-dismiss')).toBeDisabled();
    expect(screen.getByTestId('pt-save')).toHaveTextContent('Saving…');
  });

  it('asks before the browser Back leaves a dirty drawer', async () => {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const listRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <p data-testid="list-page">patients</p>,
    });
    function DrawerRoute() {
      const navigate = useNavigate();
      return (
        <RecordDrawer
          open
          dirty
          title="New patient"
          testId="pt"
          onClose={() => void navigate({ to: '/' })}
        />
      );
    }
    const drawerRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/new',
      component: DrawerRoute,
    });
    // The browser history, not the memory one: a Back is a `popstate`, which is
    // where TanStack runs the blockers (memory history blocks PUSH / REPLACE only).
    window.history.replaceState(null, '', '/');
    const history = createBrowserHistory();
    const router = createRouter({
      routeTree: rootRoute.addChildren([listRoute, drawerRoute]),
      history,
    });
    const u = user();
    render(<RouterProvider router={router} />);
    await screen.findByTestId('list-page');
    await act(() => router.navigate({ to: '/new' }));
    await screen.findByTestId('pt');

    act(() => window.history.back());

    expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('pt')).toBeInTheDocument();

    await u.click(screen.getByTestId('confirm-accept'));

    expect(await screen.findByTestId('list-page')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('pt')).not.toBeInTheDocument());
    history.destroy();
  });
});

describe('RecordDrawer — saving', () => {
  it('opens the first step with a required field still empty instead of saving', async () => {
    const onSave = vi.fn();
    const onMissing = vi.fn();
    const { u } = await openDrawer({ steps: STEPS, onSave, onMissing });

    expect(screen.getByTestId('pt-step-contact')).toHaveAttribute('data-status', 'open');
    await u.click(screen.getByTestId('pt-save'));

    expect(onSave).not.toHaveBeenCalled();
    expect(onMissing).toHaveBeenCalledWith('clinic', ['Status']);
    expect(screen.getByTestId('pt-step-clinic')).toHaveAttribute('data-status', 'open');
    expect(screen.getByText('clinic body')).toBeInTheDocument();
    // Save stays enabled: pressing it is how the missing step is found.
    expect(screen.getByTestId('pt-save')).toBeEnabled();
  });

  it('saves once nothing required is missing', async () => {
    const onSave = vi.fn();
    const steps = STEPS.map((step) => ({ ...step, missing: [] }));
    const { u } = await openDrawer({ steps, onSave, saveLabel: 'Create patient' });

    await u.click(screen.getByRole('button', { name: 'Create patient' }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('keeps the drawer and the draft after a failed save: "Retry save" and the note', async () => {
    renderWithProviders(<Harness startOpen saveState="failed" />);

    expect(await screen.findByTestId('pt-save')).toHaveTextContent('Retry save');
    expect(screen.getByTestId('pt-not-saved')).toHaveTextContent(
      'Not saved · your changes are kept',
    );
  });

  it('names what a failed save kept in the screen’s own words', async () => {
    renderWithProviders(
      <Harness
        startOpen
        saveState="failed"
        notSavedLabel="Not saved · your counts are kept"
      />,
    );
    expect(await screen.findByTestId('pt-not-saved')).toHaveTextContent(
      'Not saved · your counts are kept',
    );
  });

  it('is view only for a role that cannot edit', async () => {
    renderWithProviders(
      <Harness
        startOpen
        readOnly
        onDelete={vi.fn()}
        quickFill={[{ id: 'x', label: 'Preset', onSelect: vi.fn() }]}
      />,
    );

    expect(await screen.findByTestId('pt-dismiss')).toHaveTextContent('Close');
    expect(screen.getByTestId('pt-summary')).toHaveTextContent(
      'View only · your role can’t change this',
    );
    expect(screen.queryByTestId('pt-save')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pt-delete')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pt-quick-fill')).not.toBeInTheDocument();
  });

  it('keeps, view only, a Quick fill chip that opens another record — and only that one', async () => {
    const u = user();
    const onCheckIn = vi.fn();
    renderWithProviders(
      <Harness
        startOpen
        readOnly
        quickFill={[
          {
            id: 'check-in',
            label: 'Log check-in',
            keepWhenReadOnly: true,
            onSelect: onCheckIn,
          },
          { id: 'preset', label: 'Preset', onSelect: vi.fn() },
        ]}
      />,
    );
    await u.click(await screen.findByTestId('pt-quick-fill-check-in'));
    expect(onCheckIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('pt-quick-fill-preset')).not.toBeInTheDocument();
  });
});

describe('RecordDrawer — phone (below md)', () => {
  beforeEach(() => {
    viewport.tier = 'phone';
  });

  it('fills the screen with no shadow or start border', async () => {
    renderWithProviders(<Harness startOpen />);

    expect(await screen.findByTestId('pt')).toHaveClass(
      'w-full',
      'max-md:shadow-none',
      'border-s-0',
    );
  });

  it('puts the × inside the header at 44×44, and nothing outside', async () => {
    renderWithProviders(<Harness startOpen />);

    const close = await screen.findByTestId('pt-close');
    expect(close).toHaveAccessibleName('Close');
    expect(close).toHaveClass('end-2', 'top-2', 'size-11');
    expect(close).not.toHaveAttribute('data-slot', 'floating-edge');
    // The header clears it (56px at the inline end) and is 60px tall by its token —
    // at least: a long sub wraps to a second line and the header grows with it.
    expect(close.parentElement).toHaveClass(
      'max-md:pe-14',
      'h-(--drawer-header-height)',
      'max-md:h-auto',
      'max-md:min-h-(--drawer-header-height)',
    );
    expect(document.querySelector('[data-slot="floating-edge"]')).toBeNull();
  });

  it('does not offer "Save & add another"', async () => {
    renderWithProviders(<Harness startOpen onSaveAndAdd={vi.fn()} />);

    await screen.findByTestId('pt-save');
    expect(screen.queryByTestId('pt-save-and-add')).not.toBeInTheDocument();
  });

  it('closes from the inside × like any other exit', async () => {
    const onClose = vi.fn();
    const { u } = await openDrawer({ onClose });

    await u.click(screen.getByTestId('pt-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('RecordDrawer — a stacked child', () => {
  /** A purchase drawer whose supplier picker opens a full "New supplier" on top. */
  function Stack({ onParentClose = vi.fn() }: { onParentClose?: () => void }) {
    const [supplier, setSupplier] = useState('none');
    const child = useStackedDrawer<{ name: string }>((record) =>
      setSupplier(record.name),
    );
    return (
      <>
        <RecordDrawer open title="New purchase" testId="po" onClose={onParentClose}>
          <p data-testid="po-supplier">{supplier}</p>
          <button type="button" onClick={() => child.open('Medline')}>
            New supplier
          </button>
        </RecordDrawer>
        <RecordDrawer
          open={child.isOpen}
          stacked
          title="New supplier"
          testId="sup"
          onClose={child.close}
          onSave={() => child.complete({ name: child.query })}
        />
      </>
    );
  }

  it('opens on top of the parent and reads "Back"', async () => {
    const u = user();
    renderWithProviders(<Stack />);

    await u.click(await screen.findByRole('button', { name: 'New supplier' }));

    expect(
      await screen.findByRole('dialog', { name: 'New supplier' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('sup-dismiss')).toHaveTextContent('Back');
    expect(screen.getByTestId('po')).toBeInTheDocument();
  });

  it('Back and Esc close only the child', async () => {
    const onParentClose = vi.fn();
    const u = user();
    renderWithProviders(<Stack onParentClose={onParentClose} />);

    await u.click(await screen.findByRole('button', { name: 'New supplier' }));
    await screen.findByTestId('sup');
    await u.click(screen.getByTestId('sup-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('sup')).not.toBeInTheDocument());

    await u.click(screen.getByRole('button', { name: 'New supplier' }));
    await screen.findByTestId('sup');
    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('sup')).not.toBeInTheDocument());

    expect(screen.getByTestId('po')).toBeInTheDocument();
    expect(onParentClose).not.toHaveBeenCalled();
  });

  it('saving the child closes only the child and hands the record to the parent field', async () => {
    const onParentClose = vi.fn();
    const u = user();
    renderWithProviders(<Stack onParentClose={onParentClose} />);

    await u.click(await screen.findByRole('button', { name: 'New supplier' }));
    await u.click(await screen.findByTestId('sup-save'));

    await waitFor(() => expect(screen.queryByTestId('sup')).not.toBeInTheDocument());
    expect(screen.getByTestId('po')).toBeInTheDocument();
    expect(screen.getByTestId('po-supplier')).toHaveTextContent('Medline');
    expect(onParentClose).not.toHaveBeenCalled();
    // Focus goes back into the parent, to the control that opened the child.
    expect(screen.getByRole('button', { name: 'New supplier' })).toHaveFocus();
  });
});

describe('RecordDrawer — the other drawers’ slots (task, Day close, contact editor, lead)', () => {
  it('draws a leading tile, chips after the title, a band and controls at the footer’s start', async () => {
    renderWithProviders(
      <Harness
        startOpen
        headerStart={<span data-testid="tile">T</span>}
        titleEnd={<button type="button">#2363</button>}
        band={<div data-testid="band">Rhea Shah</div>}
        footerStart={<button type="button">Snooze</button>}
        onSave={undefined}
        dismissLabel="Close"
      />,
    );
    const drawer = await screen.findByTestId('pt');
    expect(within(drawer).getByTestId('tile')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: '#2363' })).toBeInTheDocument();
    expect(within(drawer).getByTestId('band')).toHaveTextContent('Rhea Shah');
    const start = screen.getByTestId('pt-start');
    expect(within(start).getByRole('button', { name: 'Snooze' })).toBeInTheDocument();
    expect(screen.getByTestId('pt-dismiss')).toHaveTextContent('Close');
    expect(screen.queryByTestId('pt-save')).toBeNull();
  });

  it('can have no footer, a body surface of its own and footer test ids the specs name', async () => {
    const plain = renderWithProviders(
      <Harness startOpen hideFooter bodyClassName="bg-canvas" />,
    );
    await screen.findByTestId('pt');
    expect(screen.queryByTestId('pt-footer')).toBeNull();
    expect(screen.getByTestId('pt-body')).toHaveClass('bg-canvas');
    plain.unmount();
    renderWithProviders(
      <Harness
        startOpen
        saveTestId="pt-done"
        onDelete={vi.fn()}
        deleteTestId="pt-remove"
      />,
    );
    expect(await screen.findByTestId('pt-done')).toBeInTheDocument();
    expect(screen.getByTestId('pt-remove')).toBeInTheDocument();
  });

  it('lets the dismiss button do its own thing (the lead’s Discard) instead of closing', async () => {
    const onDismiss = vi.fn();
    const onClose = vi.fn();
    const { u } = await openDrawer({ onDismiss, onClose, dismissLabel: 'Discard' });
    await u.click(screen.getByTestId('pt-dismiss'));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('pt')).toBeInTheDocument();
  });

  it('hands Esc to the screen first — an inline edit may keep the drawer open', async () => {
    const onClose = vi.fn();
    const { u } = await openDrawer({
      onClose,
      onEscapeKeyDown: (event) => event.preventDefault(),
    });
    await u.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('pt')).toBeInTheDocument();
  });

  it('shows the column beside the form from md, and on a phone behind a pane switch', async () => {
    const panes = {
      label: 'Lead panels',
      form: { id: 'details', label: 'Details' },
      aside: { id: 'chat', label: 'Chat' },
      testIdPrefix: 'pt-panes',
    };
    function Panes() {
      const [pane, setPane] = useState<'form' | 'aside'>('form');
      return (
        <Harness
          startOpen
          panelWidth={980}
          aside={{
            width: 420,
            content: <p>the chat</p>,
            panes: { ...panes, value: pane, onValueChange: setPane },
          }}
        >
          <p>the details</p>
        </Harness>
      );
    }
    const desktop = renderWithProviders(<Panes />);
    await screen.findByTestId('pt');
    expect(screen.getByTestId('pt-aside')).toHaveTextContent('the chat');
    expect(screen.queryByTestId('pt-panes-tabs')).toBeNull();
    desktop.unmount();

    viewport.tier = 'phone';
    const u = user();
    renderWithProviders(<Panes />);
    await screen.findByTestId('pt');
    expect(screen.getByText('the details')).toBeInTheDocument();
    expect(screen.queryByText('the chat')).toBeNull();
    await u.click(screen.getByTestId('pt-panes-tab-chat'));
    expect(screen.getByTestId('pt-aside')).toHaveTextContent('the chat');
    expect(screen.queryByText('the details')).toBeNull();
    // The form's footer belongs to the form pane.
    expect(screen.queryByTestId('pt-footer')).toBeNull();
  });
});

describe('RecordDrawer — accessibility', () => {
  it('has no accessibility violations (desktop, with steps)', async () => {
    const { baseElement } = renderWithProviders(
      <Harness
        startOpen
        steps={STEPS}
        tag="#2363"
        badges={[{ id: 'a', label: 'New' }]}
      />,
    );
    await screen.findByTestId('pt');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('has no accessibility violations (phone, read-only)', async () => {
    viewport.tier = 'phone';
    const { baseElement } = renderWithProviders(<Harness startOpen readOnly />);
    await screen.findByTestId('pt');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
