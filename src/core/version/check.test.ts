import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VERSION_CHECK_RELOADED_FOR_KEY } from './version-check.constants.ts';

describe('startVersionCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('returns undefined when version checking is disabled (VITE_VERSION_CHECK=false)', async () => {
    vi.stubEnv('VITE_VERSION_CHECK', 'false');
    vi.stubEnv('VITE_APP_BUILD_ID', 'abc123');
    const { startVersionCheck } = await import('./check.ts');
    expect(startVersionCheck()).toBeUndefined();
  });

  it('returns undefined when no build ID is set', async () => {
    vi.stubEnv('VITE_VERSION_CHECK', 'true');
    vi.stubEnv('VITE_APP_BUILD_ID', '');
    const { startVersionCheck } = await import('./check.ts');
    expect(startVersionCheck()).toBeUndefined();
  });

  it('returns a cleanup function when properly configured', async () => {
    vi.stubEnv('VITE_VERSION_CHECK', 'true');
    vi.stubEnv('VITE_APP_BUILD_ID', 'abc123');

    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ buildId: 'abc123', builtAt: '2025-01-01' }), {
        status: 200,
      }),
    );

    const { startVersionCheck } = await import('./check.ts');
    const cleanup = startVersionCheck();
    expect(typeof cleanup).toBe('function');

    cleanup?.();
  });

  describe('idle-gated reload', () => {
    const realLocation = window.location;
    let reload: ReturnType<typeof vi.fn>;

    function setVisibility(state: 'visible' | 'hidden') {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
      });
    }

    beforeEach(() => {
      sessionStorage.clear();
      reload = vi.fn();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...realLocation, reload },
      });
      setVisibility('visible');
      vi.stubEnv('VITE_VERSION_CHECK', 'true');
      vi.stubEnv('VITE_APP_BUILD_ID', 'build-OLD');
    });

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: realLocation,
      });
      setVisibility('visible');
      sessionStorage.clear();
    });

    function mockVersionResponse(buildId: string) {
      vi.mocked(globalThis.fetch).mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ buildId, builtAt: '2026-01-01' }), {
            status: 200,
          }),
        ),
      );
    }

    it('reloads ONCE once the user is idle and marks the buildId', async () => {
      mockVersionResponse('build-NEW');
      const { startVersionCheck } = await import('./check.ts');
      const cleanup = startVersionCheck();

      await vi.advanceTimersByTimeAsync(2_000); // initial check → reload pending
      expect(reload).not.toHaveBeenCalled(); // still "active" — deferred

      await vi.advanceTimersByTimeAsync(60_000); // cross the idle threshold

      expect(reload).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem(VERSION_CHECK_RELOADED_FOR_KEY)).toBe('build-NEW');
      cleanup?.();
    });

    it('calls onUpdateAvailable once per new buildId with reloadNow', async () => {
      mockVersionResponse('build-NEW');
      const onUpdateAvailable = vi.fn();
      const { startVersionCheck } = await import('./check.ts');
      const cleanup = startVersionCheck({ onUpdateAvailable });

      await vi.advanceTimersByTimeAsync(2_000);

      expect(onUpdateAvailable).toHaveBeenCalledOnce();
      const ctx = onUpdateAvailable.mock.calls[0]?.[0] as {
        buildId: string;
        reloadNow: () => void;
      };
      expect(ctx.buildId).toBe('build-NEW');
      ctx.reloadNow();
      expect(reload).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(onUpdateAvailable).toHaveBeenCalledOnce(); // not duplicated on poll
      cleanup?.();
    });

    it('reloads immediately while the boot splash is still up', async () => {
      // A returning user on a cached shell: the app has painted nothing yet, so
      // the idle policy has no in-flight work to protect and waiting out
      // IDLE_AFTER_MS just leaves them staring at the splash (QA-V3-7).
      const splash = document.createElement('div');
      splash.id = 'app-splash';
      document.body.appendChild(splash);
      mockVersionResponse('build-NEW');
      const { startVersionCheck } = await import('./check.ts');
      const cleanup = startVersionCheck();

      await vi.advanceTimersByTimeAsync(2_000); // initial check → applied at once

      expect(reload).toHaveBeenCalledTimes(1);
      splash.remove();
      cleanup?.();
    });

    it('reloads immediately when the tab is hidden (invisible reload)', async () => {
      mockVersionResponse('build-NEW');
      const { startVersionCheck } = await import('./check.ts');
      const cleanup = startVersionCheck();

      await vi.advanceTimersByTimeAsync(2_000); // detect → pending (visible + active)
      expect(reload).not.toHaveBeenCalled();

      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);

      expect(reload).toHaveBeenCalledTimes(1); // applied at once, no idle wait
      cleanup?.();
    });

    it('defers while a field is focused, then reloads once it is idle', async () => {
      mockVersionResponse('build-NEW');
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const { startVersionCheck } = await import('./check.ts');
      const cleanup = startVersionCheck();

      await vi.advanceTimersByTimeAsync(2_000); // detect
      await vi.advanceTimersByTimeAsync(60_000); // idle elapsed, but field is focused
      expect(reload).not.toHaveBeenCalled();

      input.blur(); // user leaves the field
      await vi.advanceTimersByTimeAsync(10_000); // next safety re-check

      expect(reload).toHaveBeenCalledTimes(1);
      input.remove();
      cleanup?.();
    });

    it('does NOT reload again while stuck on the same advertised buildId', async () => {
      sessionStorage.setItem(VERSION_CHECK_RELOADED_FOR_KEY, 'build-NEW');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockVersionResponse('build-NEW');
      const { startVersionCheck } = await import('./check.ts');
      const cleanup = startVersionCheck();

      await vi.advanceTimersByTimeAsync(2_000); // initial check
      await vi.advanceTimersByTimeAsync(60_000); // first poll

      expect(reload).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
      cleanup?.();
      warn.mockRestore();
    });

    it('reloads again when an even NEWER buildId ships', async () => {
      sessionStorage.setItem(VERSION_CHECK_RELOADED_FOR_KEY, 'build-NEW');
      mockVersionResponse('build-NEWER');
      const { startVersionCheck } = await import('./check.ts');
      const cleanup = startVersionCheck();

      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(60_000); // idle → apply the deferred reload

      expect(reload).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem(VERSION_CHECK_RELOADED_FOR_KEY)).toBe('build-NEWER');
      cleanup?.();
    });
    it('does not re-notify while snoozed', async () => {
      mockVersionResponse('build-NEW');
      const onUpdateAvailable = vi.fn();
      const { startVersionCheck } = await import('./check.ts');
      const { snoozeVersionUpdate } = await import('./version-update-snooze.ts');
      const cleanup = startVersionCheck({ onUpdateAvailable });

      await vi.advanceTimersByTimeAsync(2_000);
      expect(onUpdateAvailable).toHaveBeenCalledOnce();
      snoozeVersionUpdate('build-NEW');

      await vi.advanceTimersByTimeAsync(60_000);
      expect(onUpdateAvailable).toHaveBeenCalledOnce();
      cleanup?.();
    });

    // A critical update: version.json names a `minimumVersion` this bundle's
    // release is below. It counts down instead of waiting for a safe moment.
    describe('critical update', () => {
      const realOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
      let field: HTMLInputElement | null = null;

      beforeEach(() => {
        vi.stubEnv('VITE_APP_VERSION', '1.12.0');
      });

      afterEach(() => {
        field?.remove();
        field = null;
        delete (navigator as { onLine?: boolean }).onLine;
        if (realOnLine) Object.defineProperty(Navigator.prototype, 'onLine', realOnLine);
        vi.unstubAllEnvs();
      });

      function mockCriticalResponse(fields: Record<string, unknown> = {}) {
        vi.mocked(globalThis.fetch).mockImplementation(() =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                buildId: 'build-NEW',
                builtAt: '2026-01-01',
                version: '1.12.1',
                minimumVersion: '1.12.1',
                ...fields,
              }),
              { status: 200 },
            ),
          ),
        );
      }

      /** The user is typing — the ordinary path would never reload over this. */
      function focusField() {
        field = document.createElement('input');
        document.body.appendChild(field);
        field.focus();
      }

      function setOnline(online: boolean) {
        Object.defineProperty(navigator, 'onLine', {
          configurable: true,
          get: () => online,
        });
      }

      it('counts down instead of offering the toast, then reloads at the deadline over a focused field', async () => {
        mockCriticalResponse();
        focusField();
        const onUpdateAvailable = vi.fn();
        const onCriticalUpdate = vi.fn();
        const { startVersionCheck } = await import('./check.ts');
        const cleanup = startVersionCheck({ onUpdateAvailable, onCriticalUpdate });

        await vi.advanceTimersByTimeAsync(2_000); // detect
        expect(onUpdateAvailable).not.toHaveBeenCalled();
        expect(onCriticalUpdate).toHaveBeenCalledOnce();
        const ctx = onCriticalUpdate.mock.calls[0]?.[0] as {
          buildId: string;
          reloadAt: number;
        };
        expect(ctx.buildId).toBe('build-NEW');
        expect(ctx.reloadAt).toBe(Date.now() + 60_000);

        await vi.advanceTimersByTimeAsync(59_999);
        expect(reload).not.toHaveBeenCalled(); // the grace period is honoured

        await vi.advanceTimersByTimeAsync(1);
        expect(reload).toHaveBeenCalledTimes(1); // …and then it is not negotiable
        expect(sessionStorage.getItem(VERSION_CHECK_RELOADED_FOR_KEY)).toBe('build-NEW');
        cleanup?.();
      });

      it('reloads at once from "Update now"', async () => {
        mockCriticalResponse();
        const onCriticalUpdate = vi.fn();
        const { startVersionCheck } = await import('./check.ts');
        const cleanup = startVersionCheck({ onCriticalUpdate });

        await vi.advanceTimersByTimeAsync(2_000);
        const ctx = onCriticalUpdate.mock.calls[0]?.[0] as
          { reloadNow: () => void } | undefined;
        ctx?.reloadNow();

        expect(reload).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(reload).toHaveBeenCalledTimes(1); // the deadline was cancelled with it
        cleanup?.();
      });

      it('is never snoozed', async () => {
        mockCriticalResponse();
        const { snoozeVersionUpdate } = await import('./version-update-snooze.ts');
        snoozeVersionUpdate('build-NEW');
        const onCriticalUpdate = vi.fn();
        const { startVersionCheck } = await import('./check.ts');
        const cleanup = startVersionCheck({ onCriticalUpdate });

        await vi.advanceTimersByTimeAsync(2_000);

        expect(onCriticalUpdate).toHaveBeenCalledOnce();
        cleanup?.();
      });

      it('reloads at once while the boot splash is up — no notice, nothing to lose', async () => {
        const splash = document.createElement('div');
        splash.id = 'app-splash';
        document.body.appendChild(splash);
        mockCriticalResponse();
        const onCriticalUpdate = vi.fn();
        const { startVersionCheck } = await import('./check.ts');
        const cleanup = startVersionCheck({ onCriticalUpdate });

        await vi.advanceTimersByTimeAsync(2_000);

        expect(reload).toHaveBeenCalledTimes(1);
        expect(onCriticalUpdate).not.toHaveBeenCalled();
        splash.remove();
        cleanup?.();
      });

      it('reloads at once in a hidden tab', async () => {
        setVisibility('hidden');
        mockCriticalResponse();
        const onCriticalUpdate = vi.fn();
        const { startVersionCheck } = await import('./check.ts');
        const cleanup = startVersionCheck({ onCriticalUpdate });

        await vi.advanceTimersByTimeAsync(2_000);

        expect(reload).toHaveBeenCalledTimes(1);
        expect(onCriticalUpdate).not.toHaveBeenCalled();
        cleanup?.();
      });

      // Hiding the tab is a safe moment, as on the ordinary path — which also
      // means a focused field still holds it: only the deadline overrides that.
      it('reloads early when the tab is hidden during the countdown', async () => {
        mockCriticalResponse();
        const { startVersionCheck } = await import('./check.ts');
        const cleanup = startVersionCheck({ onCriticalUpdate: vi.fn() });

        await vi.advanceTimersByTimeAsync(2_000);
        setVisibility('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(0);

        expect(reload).toHaveBeenCalledTimes(1);
        cleanup?.();
      });

      it('waits for the network when the deadline passes offline', async () => {
        mockCriticalResponse();
        focusField();
        const { startVersionCheck } = await import('./check.ts');
        const cleanup = startVersionCheck({ onCriticalUpdate: vi.fn() });

        await vi.advanceTimersByTimeAsync(2_000);
        setOnline(false);
        await vi.advanceTimersByTimeAsync(60_000); // deadline passes offline
        expect(reload).not.toHaveBeenCalled(); // an offline reload re-serves the old shell

        setOnline(true);
        window.dispatchEvent(new Event('online'));
        expect(reload).toHaveBeenCalledTimes(1);
        cleanup?.();
      });

      it('keeps its deadline: a later check never restarts or extends it', async () => {
        mockCriticalResponse();
        focusField();
        const onCriticalUpdate = vi.fn();
        const { startVersionCheck } = await import('./check.ts');
        const cleanup = startVersionCheck({ onCriticalUpdate });

        await vi.advanceTimersByTimeAsync(2_000);
        await vi.advanceTimersByTimeAsync(30_000);
        document.dispatchEvent(new Event('visibilitychange')); // returning to the tab re-checks
        await vi.advanceTimersByTimeAsync(0);
        expect(onCriticalUpdate).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(30_000); // the ORIGINAL deadline
        expect(reload).toHaveBeenCalledTimes(1);
        cleanup?.();
      });

      it('does not loop: a tab already reloaded for the build stands down', async () => {
        sessionStorage.setItem(VERSION_CHECK_RELOADED_FOR_KEY, 'build-NEW');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockCriticalResponse();
        const onCriticalUpdate = vi.fn();
        const { startVersionCheck } = await import('./check.ts');
        const cleanup = startVersionCheck({ onCriticalUpdate });

        await vi.advanceTimersByTimeAsync(2_000);
        await vi.advanceTimersByTimeAsync(60_000);

        expect(onCriticalUpdate).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
        cleanup?.();
        warn.mockRestore();
      });

      it('stops the countdown on cleanup', async () => {
        mockCriticalResponse();
        focusField();
        const { startVersionCheck } = await import('./check.ts');
        const cleanup = startVersionCheck({ onCriticalUpdate: vi.fn() });

        await vi.advanceTimersByTimeAsync(2_000);
        cleanup?.();
        await vi.advanceTimersByTimeAsync(60_000);

        expect(reload).not.toHaveBeenCalled();
      });

      // Anything the tab cannot be sure of is NOT critical: the ordinary path
      // (toast + safe-moment reload) still applies, and a guess never forces a reload.
      it.each([
        ['this bundle carries no version (a local build)', { ownVersion: '' }],
        ['version.json names no floor', { fields: { minimumVersion: undefined } }],
        ['this tab already meets the floor', { ownVersion: '1.12.1' }],
        ['this tab is newer than the floor', { ownVersion: '1.13.0' }],
        [
          'the advertised build is itself below its floor',
          { fields: { version: '1.12.0', minimumVersion: '1.12.1' } },
        ],
        ['the floor is malformed', { fields: { minimumVersion: 1121 } }],
        ['the floor is not a release version', { fields: { minimumVersion: 'v1.12.1' } }],
      ])(
        'takes the ordinary path when %s',
        async (
          _case,
          { ownVersion, fields }: { ownVersion?: string; fields?: object },
        ) => {
          if (ownVersion !== undefined) vi.stubEnv('VITE_APP_VERSION', ownVersion);
          mockCriticalResponse(fields as Record<string, unknown>);
          const onUpdateAvailable = vi.fn();
          const onCriticalUpdate = vi.fn();
          const { startVersionCheck } = await import('./check.ts');
          const cleanup = startVersionCheck({ onUpdateAvailable, onCriticalUpdate });

          await vi.advanceTimersByTimeAsync(2_000);

          expect(onCriticalUpdate).not.toHaveBeenCalled();
          expect(onUpdateAvailable).toHaveBeenCalledOnce();
          cleanup?.();
        },
      );
    });

    describe('service-worker handoff', () => {
      type MockWaitingWorker = { postMessage: ReturnType<typeof vi.fn> };

      /** Stateful `installing` worker whose statechange events actually fire. */
      function createInstallingWorker(initialState = 'installing') {
        const stateListeners: Array<() => void> = [];
        const worker = {
          state: initialState,
          postMessage: vi.fn(),
          addEventListener: vi.fn((_type: string, cb: () => void) => {
            stateListeners.push(cb);
          }),
          removeEventListener: vi.fn(),
          setState(next: string) {
            worker.state = next;
            for (const cb of [...stateListeners]) cb();
          },
        };
        return worker;
      }

      function installMockServiceWorker(options: {
        waiting?: MockWaitingWorker | null;
        installing?: ReturnType<typeof createInstallingWorker> | null;
        /** getRegistration behavior: resolves it, resolves undefined, or rejects. */
        lookup?: 'ok' | 'none' | 'reject';
      }) {
        const listeners = new Map<string, Array<() => void>>();
        const registration = {
          waiting: options.waiting ?? null,
          installing: options.installing ?? null,
          update: vi.fn(() => Promise.resolve()),
        };
        const lookup = options.lookup ?? 'ok';
        const container = {
          getRegistration: vi.fn(() => {
            if (lookup === 'reject') return Promise.reject(new Error('sw down'));
            return Promise.resolve(lookup === 'none' ? undefined : registration);
          }),
          addEventListener: vi.fn((type: string, cb: () => void) => {
            const arr = listeners.get(type) ?? [];
            arr.push(cb);
            listeners.set(type, arr);
          }),
          removeEventListener: vi.fn(),
          dispatchControllerChange() {
            for (const cb of listeners.get('controllerchange') ?? []) cb();
          },
        };
        Object.defineProperty(navigator, 'serviceWorker', {
          configurable: true,
          value: container,
        });
        return { container, registration };
      }

      afterEach(() => {
        Reflect.deleteProperty(navigator, 'serviceWorker');
      });

      /** Detect at 2s, then force the immediate (hidden-tab) reload path. */
      async function detectAndTriggerReload() {
        const { startVersionCheck } = await import('./check.ts');
        const cleanup = startVersionCheck();
        await vi.advanceTimersByTimeAsync(2_000); // detect → pending
        setVisibility('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(0); // flush the async handoff chain
        return cleanup;
      }

      it('messages SKIP_WAITING to the waiting worker and reloads on controllerchange', async () => {
        const waiting = { postMessage: vi.fn() };
        const { container, registration } = installMockServiceWorker({ waiting });
        mockVersionResponse('build-NEW');

        const cleanup = await detectAndTriggerReload();

        expect(registration.update).toHaveBeenCalled(); // pre-warm at detection
        expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
        expect(reload).not.toHaveBeenCalled(); // waits for the new worker to take control

        container.dispatchControllerChange();
        expect(reload).toHaveBeenCalledTimes(1);

        // A duplicate controllerchange must not double-reload (finish() guard).
        container.dispatchControllerChange();
        expect(reload).toHaveBeenCalledTimes(1);
        cleanup?.();
      });

      it('falls back to a plain reload when no newer worker exists', async () => {
        installMockServiceWorker({ waiting: null });
        mockVersionResponse('build-NEW');

        const cleanup = await detectAndTriggerReload();

        expect(reload).toHaveBeenCalledTimes(1);
        cleanup?.();
      });

      it('reloads anyway after the deadline if the worker never reaches waiting', async () => {
        const installing = createInstallingWorker();
        installMockServiceWorker({ waiting: null, installing });
        mockVersionResponse('build-NEW');

        const cleanup = await detectAndTriggerReload();
        expect(reload).not.toHaveBeenCalled(); // still waiting on the install

        await vi.advanceTimersByTimeAsync(10_000); // SW_ACTIVATE_DEADLINE_MS
        expect(reload).toHaveBeenCalledTimes(1);
        cleanup?.();
      });

      it('follows an in-flight install to installed and completes the handoff', async () => {
        const installing = createInstallingWorker();
        const { container } = installMockServiceWorker({ installing });
        mockVersionResponse('build-NEW');

        const cleanup = await detectAndTriggerReload();
        expect(installing.postMessage).not.toHaveBeenCalled(); // still installing

        installing.setState('installed');
        await vi.advanceTimersByTimeAsync(0);

        expect(installing.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
        expect(reload).not.toHaveBeenCalled();

        container.dispatchControllerChange();
        expect(reload).toHaveBeenCalledTimes(1);
        cleanup?.();
      });

      it('falls back to a plain reload when the install goes redundant', async () => {
        const installing = createInstallingWorker();
        installMockServiceWorker({ installing });
        mockVersionResponse('build-NEW');

        const cleanup = await detectAndTriggerReload();
        expect(reload).not.toHaveBeenCalled();

        installing.setState('redundant');
        await vi.advanceTimersByTimeAsync(0);

        expect(reload).toHaveBeenCalledTimes(1);
        cleanup?.();
      });

      it('falls back to a plain reload when no registration exists', async () => {
        installMockServiceWorker({ lookup: 'none' });
        mockVersionResponse('build-NEW');

        const cleanup = await detectAndTriggerReload();

        expect(reload).toHaveBeenCalledTimes(1);
        cleanup?.();
      });

      it('falls back to a plain reload when the registration lookup throws', async () => {
        installMockServiceWorker({ lookup: 'reject' });
        mockVersionResponse('build-NEW');

        const cleanup = await detectAndTriggerReload();

        expect(reload).toHaveBeenCalledTimes(1);
        cleanup?.();
      });
    });
  });
});
