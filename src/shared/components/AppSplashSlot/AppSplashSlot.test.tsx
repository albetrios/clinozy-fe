import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { dismissAppSplash, markAppContentSettled } from '@/lib/app-splash.ts';
import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { type MeContext, meContextQueryKey } from '@/shared/tenancy/me-context.ts';

import { SPLASH_TEST_IDS } from './app-splash.constants.ts';
import { AppSplashSlot } from './AppSplashSlot.tsx';

/** 09:00 in Asia/Kolkata on Saturday 3 October 2026 — the clinic's clock. */
const APP_MORNING = new Date('2026-10-03T03:30:00Z');

function meContext(firstName: string | null, email = 'riya@cresence.test'): MeContext {
  return {
    user: {
      id: 'user-1',
      email,
      isEmailVerified: true,
      isMfaEnabled: false,
      firstName,
      lastName: 'Shah',
      jobTitle: null,
      avatarUrl: null,
      status: 'ACTIVE',
      onboardingCompleted: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    activeOrganization: null,
    myPermissions: [],
    globalRole: null,
  } as unknown as MeContext;
}

function mountSplash() {
  const splash = document.createElement('div');
  splash.id = 'app-splash';
  const slot = document.createElement('div');
  slot.className = 'app-splash-slot';
  splash.append(slot);
  document.body.prepend(splash);
  return slot;
}

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

function renderSlot(
  props: { offlineAtMount?: boolean; greets?: boolean },
  session: MeContext | null = meContext('Riya'),
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (session) queryClient.setQueryData(meContextQueryKey, session);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AppSplashSlot
        offlineAtMount={props.offlineAtMount ?? false}
        greets={props.greets ?? true}
      />
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe('AppSplashSlot', () => {
  let slot: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers({ now: APP_MORNING });
    setOnline(true);
    slot = mountSplash();
  });

  afterEach(() => {
    document.getElementById('app-splash')?.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('first load of the org layout, online', () => {
    it('greets the user by first name inside the splash', () => {
      renderSlot({});
      const block = within(slot);
      expect(block.getByTestId(SPLASH_TEST_IDS.greeting)).toHaveTextContent(
        'Good morning, Riya',
      );
    });

    it('steps the ticker through the clinic’s weekday to "All set"', () => {
      renderSlot({});
      const progress = within(slot).getByTestId(SPLASH_TEST_IDS.progress);
      expect(progress).toHaveTextContent('Opening Saturday’s schedule');
      expect(progress).toHaveTextContent('Syncing patients and leads');
      expect(progress).toHaveTextContent('All set');
    });

    it('draws the bar and its track as pills, both hidden from assistive technology', () => {
      renderSlot({});
      const track = slot.querySelector('.app-splash-track');
      expect(track).toHaveAttribute('data-slot', 'pill');
      expect(track).toHaveAttribute('aria-hidden', 'true');
      expect(track?.querySelector('.app-splash-bar')).toHaveAttribute(
        'data-slot',
        'pill',
      );
      expect(slot.querySelector('.app-splash-ticker')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });

    it('colours the ticker dots grey on the way and green on "All set"', () => {
      renderSlot({});
      const dots = slot.querySelectorAll('.app-splash-step-dot');
      expect([...dots].map((dot) => dot.classList.contains('bg-success'))).toEqual([
        false,
        false,
        true,
      ]);
    });

    it.each([
      ['2026-10-03T03:30:00Z', 'Good morning, Riya'], // 09:00 IST
      ['2026-10-03T06:30:00Z', 'Good afternoon, Riya'], // 12:00 IST
      ['2026-10-03T11:29:00Z', 'Good afternoon, Riya'], // 16:59 IST
      ['2026-10-03T11:30:00Z', 'Good evening, Riya'], // 17:00 IST
      ['2026-10-03T16:00:00Z', 'Good evening, Riya'], // 21:30 IST — no clamp (D15)
    ])('at %s greets on the clinic-local clock: %s', (now, greeting) => {
      vi.setSystemTime(new Date(now));
      renderSlot({});
      expect(within(slot).getByTestId(SPLASH_TEST_IDS.greeting)).toHaveTextContent(
        greeting,
      );
    });

    it('keeps "Dr." — it is part of the first name', () => {
      renderSlot({}, meContext('Dr. Reenal'));
      expect(within(slot).getByTestId(SPLASH_TEST_IDS.greeting)).toHaveTextContent(
        'Good morning, Dr. Reenal',
      );
    });

    it('falls back to the email name when the profile has no first name', () => {
      renderSlot({}, meContext(null, 'kavya.m@cresence.test'));
      expect(within(slot).getByTestId(SPLASH_TEST_IDS.greeting)).toHaveTextContent(
        'Good morning, kavya.m',
      );
    });

    it('waits for the session, then plays the block the moment it lands', () => {
      const { queryClient } = renderSlot({}, null);
      expect(slot).toBeEmptyDOMElement();

      act(() => {
        vi.advanceTimersByTime(2600);
      });
      act(() => {
        queryClient.setQueryData(meContextQueryKey, meContext('Riya'));
        vi.advanceTimersByTime(1); // React Query notifies observers on a 0ms timer
      });
      // Past the 1,900ms beat: rise at once rather than wait for a beat gone by.
      expect(within(slot).getByTestId(SPLASH_TEST_IDS.block)).toHaveStyle({
        '--app-splash-block-delay': '0ms',
      });
    });

    it('holds the splash until the session lands and the block is on it', () => {
      const { queryClient } = renderSlot({}, null);
      dismissAppSplash();
      markAppContentSettled();
      act(() => {
        vi.advanceTimersByTime(3000); // well past the wordmark
      });
      expect(document.getElementById('app-splash')).not.toHaveClass('app-splash-exiting');

      act(() => {
        queryClient.setQueryData(meContextQueryKey, meContext('Riya'));
        vi.advanceTimersByTime(1);
      });
      expect(within(slot).getByTestId(SPLASH_TEST_IDS.greeting)).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(32);
      });
      expect(document.getElementById('app-splash')).toHaveClass('app-splash-exiting');
    });

    it('lets go when the boot leaves the org layout', () => {
      const view = renderSlot({}, null);
      dismissAppSplash();
      markAppContentSettled();
      // A guest sent to sign in: the shell stops greeting and unmounts the slot.
      view.unmount();
      act(() => {
        vi.advanceTimersByTime(2100);
      });
      expect(document.getElementById('app-splash')).toHaveClass('app-splash-exiting');
    });

    it('starts its animations at the instant its delay was measured', () => {
      // The browser would start them a frame — or a slow render — later, and the
      // block would rise that much off the beat.
      const animations = [
        { startTime: null },
        { startTime: null },
      ] as unknown as Animation[];
      const getAnimations = vi.fn(() => animations);
      Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
        configurable: true,
        value: getAnimations,
      });
      try {
        vi.advanceTimersByTime(700);
        renderSlot({});
        expect(animations.map((animation) => animation.startTime)).toEqual([700, 700]);
        expect(getAnimations).toHaveBeenCalledWith({ subtree: true });
      } finally {
        Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations');
      }
    });

    it('rises on the 1,900ms beat of the splash’s own clock', () => {
      vi.advanceTimersByTime(800);
      renderSlot({});
      expect(within(slot).getByTestId(SPLASH_TEST_IDS.block)).toHaveStyle({
        '--app-splash-block-delay': '1100ms',
      });
    });

    it('has no accessibility violations', async () => {
      vi.useRealTimers();
      renderSlot({});
      expect(await axe(document.getElementById('app-splash')!)).toHaveNoViolations();
    });
  });

  it('says nothing on a boot outside the org layout (frames 1–4 only)', () => {
    renderSlot({ greets: false });
    expect(slot).toBeEmptyDOMElement();
  });

  it('renders nothing once the splash is gone', () => {
    document.getElementById('app-splash')?.remove();
    const { container } = renderSlot({});
    expect(container).toBeEmptyDOMElement();
  });

  describe('offline at mount', () => {
    const realLocation = window.location;
    let reload: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      setOnline(false);
      reload = vi.fn();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...realLocation, reload },
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: realLocation,
      });
    });

    it('shows the notice and Retry instead of the progress block', () => {
      renderSlot({ offlineAtMount: true }, null);
      const notice = within(slot).getByRole('alert');
      expect(notice).toHaveTextContent(
        `Can’t reach ${PRODUCT_NAME} · check the internet connection`,
      );
      expect(within(notice).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      expect(
        within(slot).queryByTestId(SPLASH_TEST_IDS.progress),
      ).not.toBeInTheDocument();
    });

    it('Retry reloads the page — the only way out', () => {
      renderSlot({ offlineAtMount: true }, null);
      fireEvent.click(within(slot).getByTestId(SPLASH_TEST_IDS.retry));
      expect(reload).toHaveBeenCalledOnce();
    });

    it('holds the splash: no exit, not even past the 8s hand-off', () => {
      renderSlot({ offlineAtMount: true }, null);
      dismissAppSplash();
      markAppContentSettled();
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(document.getElementById('app-splash')).not.toBeNull();
      expect(document.getElementById('app-splash')).not.toHaveClass('app-splash-exiting');
    });

    it('greets above the notice when the session is somehow known', () => {
      renderSlot({ offlineAtMount: true });
      expect(within(slot).getByTestId(SPLASH_TEST_IDS.greeting)).toHaveTextContent(
        'Good morning, Riya',
      );
      expect(within(slot).getByRole('alert')).toBeInTheDocument();
    });

    it('keeps the notice when the connection returns — only Retry lifts the hold', () => {
      renderSlot({ offlineAtMount: true }, null);
      setOnline(true);
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(within(slot).getByRole('alert')).toBeInTheDocument();
    });

    it('has no accessibility violations', async () => {
      vi.useRealTimers();
      renderSlot({ offlineAtMount: true }, null);
      expect(await axe(document.getElementById('app-splash')!)).toHaveNoViolations();
    });
  });

  describe('online at mount, offline later', () => {
    it('shows the notice when the connection drops, without holding the exit', () => {
      renderSlot({});
      setOnline(false);
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      expect(within(slot).getByRole('alert')).toBeInTheDocument();

      dismissAppSplash();
      markAppContentSettled();
      act(() => {
        vi.advanceTimersByTime(2100);
      });
      expect(document.getElementById('app-splash')).toHaveClass('app-splash-exiting');
    });
  });
});
