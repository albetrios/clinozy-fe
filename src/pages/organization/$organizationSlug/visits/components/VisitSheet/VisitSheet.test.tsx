import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchVisit } from '@/shared/api/clinic/visits-api.ts';
import type { VisitDetail } from '@/shared/api/clinic/visits-contracts.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderVisitRoute,
  resetVisitRoute,
  visitPath,
} from '../../__tests__/integration/visit-test-router.tsx';
import { VisitSheet, type VisitSheetProps } from './VisitSheet.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

/** The sheet on its own, with the props a test gives it. */
function renderSheet(props: Partial<VisitSheetProps> & { detail: VisitDetail | null }) {
  const handlers = {
    onRetry: vi.fn(),
    onTab: vi.fn(),
    onClose: vi.fn(),
    onProfile: vi.fn(),
  };
  const view = renderVisitRoute(visitPath(2865), () => (
    <VisitSheet
      failed={false}
      tab="timeline"
      tabs={['timeline', 'consult', 'treatment', 'checkout']}
      {...handlers}
      {...props}
    />
  ));
  return { ...view, ...handlers };
}

const chipText = (chip: string) =>
  screen.getAllByTestId('visit-chip').find((element) => element.dataset.chip === chip)
    ?.textContent;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  resetClinicFixtures();
});
afterEach(() => {
  resetVisitRoute();
  resetClinicFixtures();
  vi.useRealTimers();
});

describe('VisitSheet', () => {
  it('shows bars while the visit loads, under a title that says so', async () => {
    renderSheet({ detail: null });
    expect(
      await screen.findByRole('dialog', { name: 'Loading the visit…' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-rows')).toHaveTextContent('Loading the visit…');
  });

  it('offers Retry when the read failed', async () => {
    const user = userEvent.setup();
    const { onRetry } = renderSheet({ detail: null, failed: true });
    await user.click(await screen.findByTestId('retry-button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('heads the band with the name, the meta line, the kind and the chips', async () => {
    const detail = await fetchVisit(ref.visit(2865));
    renderSheet({ detail });
    expect(await screen.findByTestId('visit-name')).toHaveTextContent('Dhruv Patel');
    // Dhruv's record has no gender or birth date: the code and the masked number alone.
    expect(screen.getByTestId('visit-meta')).toHaveTextContent(
      'PT-0377 · +91 99251 ··· 17',
    );
    expect(screen.getByText('Registered patient')).toBeInTheDocument();
    expect(chipText('pack')).toBe('LHR Half Leg · 10 sessions · 7 of 10 left');
    expect(chipText('consent')).toMatch(
      /^Consent: data [✓✗] · photos [✓✗] · marketing [✓✗]$/,
    );
    expect(chipText('stage')).toMatch(/^Visit: Treatment · since 10:25/);
    expect(screen.getByTestId('visit-saved')).toHaveTextContent(
      /^All changes saved 10:25/,
    );
  });

  it('shows what is due, and no Full profile or patient pill for a lead’s visit', async () => {
    const checkout = await fetchVisit(ref.visit(2864));
    const first = renderSheet({ detail: checkout });
    await screen.findByTestId('visit-name');
    expect(chipText('due')).toBe('Due ₹3,717');
    first.unmount();
    resetVisitRoute();

    const lead = await clinicFixtures.visits.create({
      appointmentId: null,
      patientId: null,
      leadId: ref.lead(2385),
      stage: 'with_doctor',
      stageAt: new Date().toISOString(),
      checks: { consent: false, photos: false, allergies: false },
      note: null,
      prescriptionId: null,
      treatmentId: null,
      invoiceId: null,
      sharedAt: null,
    });
    const detail = await fetchVisit(lead.id);
    renderSheet({ detail, onProfile: undefined, tab: 'consult' });
    await screen.findByTestId('visit-needs-patient');
    expect(screen.getByText('Lead')).toBeInTheDocument();
    expect(screen.queryByTestId('visit-full-profile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('visit-meta')).not.toBeInTheDocument();
  });

  it('closes from the strip and "Close · Esc", and opens the file from "Full profile"', async () => {
    const user = userEvent.setup();
    const detail = await fetchVisit(ref.visit(2865));
    const { onClose, onProfile, onTab } = renderSheet({ detail });
    await user.click(await screen.findByRole('button', { name: 'Close visit' }));
    await user.click(screen.getByTestId('visit-close'));
    await user.click(screen.getByTestId('visit-full-profile'));
    await user.click(screen.getByRole('tab', { name: 'Checkout' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onProfile).toHaveBeenCalledTimes(1);
    expect(onTab).toHaveBeenCalledWith('checkout');
  });

  it('has no axe violations', async () => {
    const detail = await fetchVisit(ref.visit(2865));
    const { baseElement } = renderSheet({ detail });
    await screen.findByTestId('visit-name');
    await waitFor(() =>
      expect(screen.getAllByTestId('visit-history-row').length).toBeGreaterThan(0),
    );
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('fades the tab strip where more tabs wait, and keeps the save label out of it', async () => {
    // A phone's 339px strip under four long labels: 420px of tabs.
    const strip = (element: Element) => element.getAttribute('role') === 'tablist';
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (
      this: Element,
    ) {
      return strip(this) ? 420 : 0;
    });
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (
      this: Element,
    ) {
      return strip(this) ? 339 : 0;
    });
    const scrolled = vi.spyOn(Element.prototype, 'scrollLeft', 'get').mockReturnValue(0);
    vi.spyOn(Element.prototype, 'scrollLeft', 'set').mockImplementation(() => {});
    try {
      const detail = await fetchVisit(ref.visit(2865));
      renderSheet({ detail });
      await screen.findByTestId('visit-name');
      const tablist = screen.getByRole('tablist');
      const hint = (edge: string) =>
        tablist.parentElement?.querySelector(`[data-edge="${edge}"]`) ?? null;
      expect(hint('end')).not.toBeNull();
      expect(hint('start')).toBeNull();
      expect(tablist.parentElement).not.toContainElement(
        screen.getByTestId('visit-saved'),
      );

      scrolled.mockReturnValue(81);
      fireEvent.scroll(tablist);
      expect(hint('start')).not.toBeNull();
      expect(hint('end')).toBeNull();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
