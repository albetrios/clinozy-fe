import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import { LEAD_HOLD_DAYS, leadHold } from '@/shared/api/clinic/leads-hold.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import {
  ASHA,
  daysAgo,
  leadRecord,
  NIDHI,
  NOW,
  RIYA,
} from '../../__tests__/integration/leads-test-data.ts';
import { useLeadsTable } from './leads-table-columns.tsx';
import type { LeadsTableContextValue } from './leads-table-context.ts';
import { LeadsTable } from './LeadsTable.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

const staffById = new Map([RIYA, NIDHI, ASHA].map((profile) => [profile.id, profile]));

function context(
  overrides: Partial<LeadsTableContextValue> = {},
): LeadsTableContextValue {
  return {
    staffById,
    staffUpdatedAt: NOW.toISOString(),
    viewerId: RIYA.id,
    holdOf: (lead) =>
      leadHold(
        { ...lead, ownerGone: !(staffById.get(lead.ownerId ?? '')?.active ?? false) },
        LEAD_HOLD_DAYS,
        NOW,
      ),
    canClaim: true,
    onClaim: vi.fn(),
    contactActions: () => ({}),
    ...overrides,
  };
}

function Harness({
  rows,
  value,
  onOpen = () => undefined,
  openLeadId = null,
}: {
  rows: LeadRecord[];
  value: LeadsTableContextValue;
  onOpen?: (lead: LeadRecord) => void;
  openLeadId?: string | null;
}) {
  const table = useLeadsTable({
    rows,
    sorting: [],
    onSortingChange: () => undefined,
    now: NOW,
  });
  return (
    <LeadsTable
      table={table}
      context={value}
      list={{
        isRefreshing: false,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: () => undefined,
      }}
      openLeadId={openLeadId}
      onOpen={onOpen}
      empty={<p>No leads match</p>}
    />
  );
}

const rowOf = (name: string) =>
  screen.getAllByTestId('leads-table-row').find((row) => row.textContent?.includes(name));

beforeEach(() => {
  viewport.tier = 'desktop';
  useDevicePrefsStore.setState({ hiddenColumns: {} });
});
afterEach(() => vi.restoreAllMocks());

describe('LeadsTable — the grid (leads.md:32–35)', () => {
  it('shows the six columns, each lead as a row with its pills', () => {
    render(
      <Harness
        rows={[
          leadRecord({
            interests: ['clinical', 'peel'],
            customInterests: ['Acne scars'],
          }),
        ]}
        value={context()}
      />,
    );
    const header = screen.getByTestId('leads-table-header');
    expect(
      within(header)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Lead', 'Status', 'Source', 'Interested in', 'Team', 'Updated']);
    const row = rowOf('Anaya Desai');
    expect(row).toBeDefined();
    const cells = within(row as HTMLElement);
    expect(cells.getByText('+91 98795 21034')).toBeInTheDocument();
    expect(cells.getByText('New')).toBeInTheDocument();
    expect(cells.getByText('WhatsApp')).toBeInTheDocument();
    expect(cells.getByText('Clinical')).toBeInTheDocument();
    // The "+N" pill names every interest.
    expect(cells.getByText('2 more: Clinical, Peel, Acne scars')).toHaveClass('sr-only');
    expect(cells.getByText('Nidhi K.')).toBeInTheDocument();
    expect(cells.getByText('Yesterday')).toBeInTheDocument();
  });

  it('edges each row in its status colour and keeps the open lead on muted', () => {
    const contacted = leadRecord({
      id: '00000000-0000-4000-8000-000000002364',
      seq: 2364,
      name: 'Kabir Mehta',
      status: 'contacted',
    });
    render(
      <Harness
        rows={[leadRecord(), contacted]}
        value={context()}
        openLeadId={contacted.id}
      />,
    );
    expect(rowOf('Anaya Desai')?.className).toContain('border-s-tone-sky-dot');
    expect(rowOf('Kabir Mehta')?.className).toContain('border-s-tone-lav-dot');
    expect(rowOf('Kabir Mehta')).toHaveAttribute('data-active', 'true');
    expect(rowOf('Anaya Desai')).not.toHaveAttribute('data-active');
  });

  it('sets an unread lead’s name at 600', () => {
    render(<Harness rows={[leadRecord({ unreadCount: 2 })]} value={context()} />);
    expect(screen.getByText('Anaya Desai')).toHaveClass('font-semibold');
  });

  it('opens a lead on a click, and j / k + Enter open the focused row (Leads only)', () => {
    const onOpen = vi.fn();
    const second = leadRecord({
      id: '00000000-0000-4000-8000-000000002364',
      seq: 2364,
      name: 'Kabir Mehta',
    });
    render(<Harness rows={[leadRecord(), second]} value={context()} onOpen={onOpen} />);
    fireEvent.click(rowOf('Anaya Desai') as HTMLElement);
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ seq: 2363 }));

    fireEvent.keyDown(document, { key: 'j' });
    fireEvent.keyDown(document, { key: 'j' });
    expect(rowOf('Kabir Mehta')).toHaveAttribute('data-kfocus', 'true');
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ seq: 2364 }));
  });

  it('is 830px wide with every column, and narrower as columns hide', () => {
    const { rerender } = render(<Harness rows={[leadRecord()]} value={context()} />);
    const table = screen.getByRole('table');
    expect(table.getAttribute('style')).toContain('--dt-min-w: 830px');
    useDevicePrefsStore.setState({ hiddenColumns: { leads: ['interests', 'source'] } });
    rerender(<Harness rows={[leadRecord()]} value={context()} />);
    expect(screen.getByRole('table').getAttribute('style')).toContain(
      `--dt-min-w: ${160 + 104 + 150 + 84 + 36 + 60}px`,
    );
  });

  it('wraps each row on a phone — no header, every cell in order', () => {
    viewport.tier = 'phone';
    render(<Harness rows={[leadRecord()]} value={context()} />);
    expect(screen.queryByTestId('leads-table-header')).toBeNull();
    expect(rowOf('Anaya Desai')?.className).toContain('flex-wrap');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Harness rows={[leadRecord({ unreadCount: 1 })]} value={context()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LeadsTable — the hold buckets in the Team column (H:6153)', () => {
  it('offers "Open · Claim" on someone else’s idle lead, claiming in place', async () => {
    const onClaim = vi.fn();
    const onOpen = vi.fn();
    const idle = leadRecord({ touchedAt: daysAgo(5) });
    render(<Harness rows={[idle]} value={context({ onClaim })} onOpen={onOpen} />);
    const claim = screen.getByRole('button', { name: 'Open · Claim' });
    await userEvent.setup().click(claim);
    expect(onClaim).toHaveBeenCalledWith(idle);
    // Claiming never also opens the row.
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('reads "Open to team" on my own open lead — nothing to claim', () => {
    render(
      <Harness
        rows={[leadRecord({ ownerId: RIYA.id, touchedAt: daysAgo(5) })]}
        value={context()}
      />,
    );
    expect(screen.getByText('Open to team')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open · Claim' })).toBeNull();
  });

  it('never shrinks the owner’s chip: a narrow Team column runs on, as at 820', () => {
    const { container } = render(
      <Harness
        rows={[leadRecord({ ownerId: RIYA.id, touchedAt: daysAgo(5) })]}
        value={context()}
      />,
    );
    const owner = container.querySelector('[data-slot="avatar-stack"]');
    expect(owner).toHaveClass('flex-none');
    expect(owner?.parentElement).not.toHaveClass('max-w-full');
  });

  it('reads "Open to team · Join" when the owner has left the clinic', () => {
    render(<Harness rows={[leadRecord({ ownerId: ASHA.id })]} value={context()} />);
    expect(
      screen.getByRole('button', { name: 'Open to team · Join' }),
    ).toBeInTheDocument();
  });

  it('dots a lead that releases within a day, worded today or tomorrow', () => {
    const hoursAgo = (hours: number) =>
      new Date(NOW.getTime() - hours * 3_600_000).toISOString();
    // Touched 60 hours ago: the 3-day hold runs out at 22:00 today.
    const { unmount } = render(
      <Harness rows={[leadRecord({ touchedAt: hoursAgo(60) })]} value={context()} />,
    );
    expect(screen.getByTestId('leads-hold-dot')).toHaveAccessibleName(
      'Released to the team today if nobody follows up',
    );
    unmount();
    // Touched 50 hours ago: it runs out at 08:00 tomorrow — still within a day.
    render(
      <Harness rows={[leadRecord({ touchedAt: hoursAgo(50) })]} value={context()} />,
    );
    expect(screen.getByTestId('leads-hold-dot')).toHaveAccessibleName(
      'Released to the team tomorrow if nobody follows up',
    );
  });

  it('shows no hold pill on a held lead, and no claim without Edit', () => {
    const { rerender } = render(<Harness rows={[leadRecord()]} value={context()} />);
    expect(screen.queryByTestId('leads-claim')).toBeNull();
    expect(screen.queryByTestId('leads-hold-dot')).toBeNull();
    rerender(
      <Harness
        rows={[leadRecord({ touchedAt: daysAgo(5) })]}
        value={context({ canClaim: false })}
      />,
    );
    expect(screen.queryByTestId('leads-claim')).toBeNull();
  });

  it('lists up to three involved people, then "+N"', () => {
    const extra = [1, 2, 3].map((index) => staffProfile(index));
    const many = new Map(staffById);
    for (const profile of extra) many.set(profile.id, profile);
    render(
      <Harness
        rows={[
          leadRecord({ involvedIds: [RIYA.id, ...extra.map((profile) => profile.id)] }),
        ]}
        value={context({ staffById: many })}
      />,
    );
    expect(screen.getByTestId('avatar-stack-more')).toHaveTextContent('+1');
  });
});

/** A spare team member for the involved stack. */
function staffProfile(index: number) {
  return {
    ...NIDHI,
    id: `00000000-0000-4000-8000-00000000009${index}`,
    seq: 90 + index,
    firstName: `Staff${String.fromCharCode(64 + index)}`,
    initials: `S${String.fromCharCode(64 + index)}`,
  };
}
