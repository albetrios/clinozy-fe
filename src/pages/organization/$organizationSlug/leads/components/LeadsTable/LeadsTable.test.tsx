import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import { leadHold } from '@/shared/api/app/leads-hold.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import {
  daysAgo,
  daysAhead,
  leadRecord,
  NOW,
  RIYA,
  TEAM,
  TEAM_BY_ID,
  teamMember,
} from '../../__tests__/integration/leads-test-data.ts';
import { useLeadsTable } from './leads-table-columns.tsx';
import type { LeadsTableContextValue } from './leads-table-context.ts';
import { LeadsTable } from './LeadsTable.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

/** An instant `hours` after {@link NOW}. */
const hoursAhead = (hours: number) =>
  new Date(NOW.getTime() + hours * 3_600_000).toISOString();

/** Kabir Mehta — a second lead, contacted. */
const KABIR = leadRecord({
  id: 'lead_kabir0000000000000000',
  leadNumber: 2364,
  contactId: 'con_kabir0000000000000000',
  name: 'Kabir Mehta',
  phone: '+919825044120',
  status: 'contacted',
});

function context(
  overrides: Partial<LeadsTableContextValue> = {},
): LeadsTableContextValue {
  return {
    team: TEAM_BY_ID,
    teamUpdatedAt: NOW.toISOString(),
    viewerId: RIYA.id,
    holdOf: (lead) => leadHold(lead, NOW),
    canClaim: true,
    onClaim: vi.fn(),
    onTakeOver: vi.fn(),
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

const rowOf = (name: string) => {
  const row = screen
    .getAllByTestId('leads-table-row')
    .find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

/** The row's cells, in column order. */
const cellsOf = (name: string) => within(rowOf(name)).getAllByRole('cell');

const initialHourCycle = useLocaleStore.getState().hourCycle;
beforeEach(() => {
  viewport.tier = 'desktop';
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  useLocaleStore.setState({ hourCycle: 'h12' });
});
afterEach(() => {
  useLocaleStore.setState({ hourCycle: initialHourCycle });
  vi.restoreAllMocks();
});

describe('LeadsTable — the grid (leads.md:32–35)', () => {
  it('shows the six columns, each lead as a row with its pills', () => {
    render(
      <Harness
        rows={[leadRecord({ interests: ['clinical', 'peel', 'others'] })]}
        value={context()}
      />,
    );
    const header = screen.getByTestId('leads-table-header');
    expect(
      within(header)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Lead', 'Status', 'Source', 'Interested in', 'Team', 'Updated']);
    const cells = within(rowOf('Anaya Desai'));
    expect(cells.getByText('+91 98795 21034')).toBeInTheDocument();
    expect(cells.getByText('New')).toBeInTheDocument();
    expect(cells.getByText('WhatsApp')).toBeInTheDocument();
    expect(cells.getByText('Clinical')).toBeInTheDocument();
    // The "+N" pill names every interest — "Others" stands for the typed ones.
    expect(cells.getByText('2 more: Clinical, Peel, Others')).toHaveClass('sr-only');
    expect(cells.getByText('Nidhi K.')).toBeInTheDocument();
    expect(cells.getByText('Yesterday')).toBeInTheDocument();
  });

  it('sets the name at 600 while the person waits for a reply, else 500', () => {
    render(
      <Harness rows={[leadRecord({ isAwaitingReply: true }), KABIR]} value={context()} />,
    );
    expect(screen.getByText('Anaya Desai')).toHaveClass('font-semibold');
    expect(screen.getByText('Kabir Mehta')).toHaveClass('font-medium');
  });

  it('badges a lead whose person is a patient', () => {
    render(
      <Harness
        rows={[leadRecord({ patientId: 'pat_anaya0000000000000000' }), KABIR]}
        value={context()}
      />,
    );
    expect(within(rowOf('Anaya Desai')).getByText(', Patient')).toHaveClass('sr-only');
    expect(within(rowOf('Kabir Mehta')).queryByText(', Patient')).toBeNull();
  });

  it('dates Updated by the person’s last activity, and shows nothing without one', () => {
    render(
      <Harness
        rows={[
          leadRecord({ lastActivityAt: daysAgo(4), updatedAt: daysAgo(0) }),
          { ...KABIR, lastActivityAt: null },
        ]}
        value={context()}
      />,
    );
    // Four days before Sat 3 Oct: its weekday, never the record's own update.
    expect(cellsOf('Anaya Desai').at(-1)).toHaveTextContent(/^Tue$/);
    expect(cellsOf('Kabir Mehta').at(-1)).toHaveTextContent(/^$/);
  });

  it('edges each row in its status colour and keeps the open lead on muted', () => {
    render(
      <Harness rows={[leadRecord(), KABIR]} value={context()} openLeadId={KABIR.id} />,
    );
    expect(rowOf('Anaya Desai').className).toContain('border-s-tone-sky-dot');
    expect(rowOf('Kabir Mehta').className).toContain('border-s-tone-lav-dot');
    expect(rowOf('Kabir Mehta')).toHaveAttribute('data-active', 'true');
    expect(rowOf('Anaya Desai')).not.toHaveAttribute('data-active');
  });

  it('opens a lead on a click, and j / k + Enter open the focused row', () => {
    const onOpen = vi.fn();
    render(<Harness rows={[leadRecord(), KABIR]} value={context()} onOpen={onOpen} />);
    fireEvent.click(rowOf('Anaya Desai'));
    expect(onOpen).toHaveBeenLastCalledWith(
      expect.objectContaining({ leadNumber: 2363 }),
    );

    fireEvent.keyDown(document, { key: 'j' });
    fireEvent.keyDown(document, { key: 'j' });
    expect(rowOf('Kabir Mehta')).toHaveAttribute('data-kfocus', 'true');
    fireEvent.keyDown(document, { key: 'k' });
    expect(rowOf('Anaya Desai')).toHaveAttribute('data-kfocus', 'true');
    fireEvent.keyDown(document, { key: 'j' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onOpen).toHaveBeenLastCalledWith(
      expect.objectContaining({ leadNumber: 2364 }),
    );
  });

  it('is 830px wide with every column, and narrower as columns hide', () => {
    const { rerender } = render(<Harness rows={[leadRecord()]} value={context()} />);
    expect(screen.getByRole('table').getAttribute('style')).toContain(
      '--dt-min-w: 830px',
    );
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
    expect(rowOf('Anaya Desai').className).toContain('flex-wrap');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Harness
        rows={[
          leadRecord({ isAwaitingReply: true, heldUntil: hoursAhead(6) }),
          { ...KABIR, ownerId: RIYA.id, heldUntil: daysAgo(1) },
        ]}
        value={context()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LeadsTable — the Team column and the hold (H:1739–1741, H:6153)', () => {
  it('shows the owner’s chip, and a dash for a lead nobody owns', () => {
    render(
      <Harness rows={[leadRecord(), { ...KABIR, ownerId: null }]} value={context()} />,
    );
    expect(within(rowOf('Anaya Desai')).getByText('Nidhi K.')).toBeInTheDocument();
    expect(within(rowOf('Kabir Mehta')).getByText('—')).toBeInTheDocument();
  });

  it('offers "Open · Claim" once the hold has passed, claiming in place', async () => {
    const onClaim = vi.fn();
    const onOpen = vi.fn();
    const open = leadRecord({ heldUntil: daysAgo(1) });
    render(<Harness rows={[open]} value={context({ onClaim })} onOpen={onOpen} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open · Claim' }));
    expect(onClaim).toHaveBeenCalledWith(open);
    // Claiming never also opens the row.
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('treats a lead with no hold at all as open to claim', () => {
    render(<Harness rows={[leadRecord({ heldUntil: null })]} value={context()} />);
    expect(screen.getByRole('button', { name: 'Open · Claim' })).toBeInTheDocument();
  });

  it('reads "Open to team" on the viewer’s own expired hold — nothing to claim', () => {
    render(
      <Harness
        rows={[leadRecord({ ownerId: RIYA.id, heldUntil: daysAgo(1) })]}
        value={context()}
      />,
    );
    expect(screen.getByText('Open to team')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open · Claim' })).toBeNull();
  });

  it('shows no hold pill on a held or closed lead, and no claim without Edit', () => {
    const { rerender } = render(
      <Harness
        rows={[leadRecord(), { ...KABIR, status: 'lost', heldUntil: daysAgo(1) }]}
        value={context()}
      />,
    );
    expect(screen.queryByTestId('leads-claim')).toBeNull();
    expect(screen.queryByText('Open to team')).toBeNull();
    rerender(
      <Harness
        rows={[leadRecord({ heldUntil: daysAgo(1) })]}
        value={context({ canClaim: false })}
      />,
    );
    expect(screen.queryByTestId('leads-claim')).toBeNull();
  });

  it('dots a hold that ends within a day, worded today or tomorrow', () => {
    // Six hours on from 10:00: 4 pm today.
    const { unmount } = render(
      <Harness rows={[leadRecord({ heldUntil: hoursAhead(6) })]} value={context()} />,
    );
    expect(screen.getByTestId('leads-hold-dot')).toHaveAccessibleName(
      /^Back to the team today at \W?4:00\sPM\W?$/i,
    );
    unmount();
    // Twenty hours on: 6 am tomorrow — still within a day.
    const tomorrow = render(
      <Harness rows={[leadRecord({ heldUntil: hoursAhead(20) })]} value={context()} />,
    );
    expect(screen.getByTestId('leads-hold-dot')).toHaveAccessibleName(
      /^Back to the team tomorrow at \W?6:00\sAM\W?$/i,
    );
    tomorrow.unmount();
    // Two days on: no dot.
    render(
      <Harness rows={[leadRecord({ heldUntil: daysAhead(2) })]} value={context()} />,
    );
    expect(screen.queryByTestId('leads-hold-dot')).toBeNull();
  });

  it('offers "Take over from <owner>" on the owner’s card while the hold runs', async () => {
    const onTakeOver = vi.fn();
    const held = leadRecord();
    render(<Harness rows={[held]} value={context({ onTakeOver })} />);
    const user = userEvent.setup();
    await user.hover(within(rowOf('Anaya Desai')).getByText('Nidhi K.'));
    const take = await screen.findByTestId('team-card-assign');
    expect(take).toHaveTextContent('Take over from Nidhi');
    await user.click(take);
    expect(onTakeOver).toHaveBeenCalledWith(held);
  });

  it('offers "Claim <first>" on the owner’s card once the hold has passed', async () => {
    const onClaim = vi.fn();
    const open = leadRecord({ heldUntil: daysAgo(1) });
    render(<Harness rows={[open]} value={context({ onClaim })} />);
    const user = userEvent.setup();
    await user.hover(within(rowOf('Anaya Desai')).getByText('Nidhi K.'));
    const claim = await screen.findByTestId('team-card-assign');
    expect(claim).toHaveTextContent('Claim Anaya');
    await user.click(claim);
    expect(onClaim).toHaveBeenCalledWith(open);
  });

  it('never shrinks the owner’s chip: a narrow Team column runs on, as at 820', () => {
    const { container } = render(<Harness rows={[leadRecord()]} value={context()} />);
    const owner = container.querySelector('[data-slot="avatar-stack"]');
    expect(owner).toHaveClass('flex-none');
    expect(owner?.parentElement).not.toHaveClass('max-w-full');
  });

  it('lists up to three involved people, then "+N"', () => {
    const extra: DirectoryMember[] = [
      { id: 'mem_asha0000000000000000', name: 'Asha Mehta', initials: 'AM' },
      { id: 'mem_dev00000000000000000', name: 'Dev Patel', initials: 'DP' },
      { id: 'mem_isha0000000000000000', name: 'Isha Rao', initials: 'IR' },
    ].map((overrides) => teamMember(overrides));
    render(
      <Harness
        rows={[
          leadRecord({ involvedIds: [RIYA.id, ...extra.map((member) => member.id)] }),
        ]}
        value={context({
          team: new Map([...TEAM, ...extra].map((member) => [member.id, member])),
        })}
      />,
    );
    expect(screen.getByTestId('avatar-stack-more')).toHaveTextContent('+1');
  });

  it('leaves out an involved person who is no longer on the team', () => {
    render(
      <Harness
        rows={[leadRecord({ involvedIds: [RIYA.id, 'mem_gone0000000000000000'] })]}
        value={context()}
      />,
    );
    const stacks = rowOf('Anaya Desai').querySelectorAll('[data-slot="avatar-stack"]');
    // The owner's stack, then the involved one — Riya alone.
    expect(stacks).toHaveLength(2);
    expect(stacks[1]).toHaveTextContent(/^RS/);
    expect(screen.queryByTestId('avatar-stack-more')).toBeNull();
  });
});
