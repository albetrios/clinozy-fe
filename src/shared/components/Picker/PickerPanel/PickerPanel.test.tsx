import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { pickerTestIds } from '@/shared/components/Picker/picker.constants.ts';
import type { PickerOption } from '@/shared/components/Picker/picker.types.ts';
import { buildPickerRows } from '@/shared/components/Picker/picker-rows.ts';
import { Tag, Wallet } from '@/shared/icons/index.ts';

import { PickerPanel, type PickerPanelProps } from './PickerPanel.tsx';

const OPTIONS: PickerOption[] = [
  {
    key: 'p1',
    label: 'Riya Sharma',
    sub: 'PT-1042',
    leading: { kind: 'avatar', initials: 'RS', patient: true },
    group: 'Patients',
  },
  { key: 'd1', label: 'Dr. Mavani', meta: '4 today', group: 'Team', tone: 'sage' },
];

function panel(overrides: Partial<PickerPanelProps<unknown>> = {}) {
  const rows = buildPickerRows({
    options: OPTIONS,
    query: overrides.query ?? '',
    recentKeys: [],
    recentEnabled: false,
    limit: 30,
    labels: { recent: 'Recent', all: 'All' },
  });
  const props: PickerPanelProps<unknown> = {
    label: 'Who',
    testIds: pickerTestIds('who'),
    mode: 'single',
    picked: new Set(['d1']),
    sections: rows.sections,
    searchable: true,
    query: '',
    onQueryChange: vi.fn(),
    searchPlaceholder: 'Search who',
    searching: false,
    skeleton: false,
    loadingMore: false,
    onPick: vi.fn(),
    onKeyDown: vi.fn(),
    onScroll: vi.fn(),
    ...overrides,
  };
  return render(<PickerPanel {...props} />);
}

describe('PickerPanel', () => {
  it('draws the search row with its esc hint and a spinner while searching', () => {
    const { rerender } = panel();
    const search = screen.getByTestId('who-search');
    expect(search).toHaveAttribute('placeholder', 'Search who');
    expect(screen.getByText('esc')).toHaveAttribute('data-slot', 'kbd');
    expect(document.querySelector('.animate-spinner')).toBeNull();
    rerender(
      <PickerPanel
        label="Who"
        testIds={pickerTestIds('who')}
        mode="single"
        picked={new Set()}
        sections={[]}
        searchable
        query="r"
        onQueryChange={vi.fn()}
        searchPlaceholder="Search who"
        searching
        skeleton
        loadingMore={false}
        onPick={vi.fn()}
        onKeyDown={vi.fn()}
        onScroll={vi.fn()}
      />,
    );
    expect(document.querySelector('.animate-spinner')).not.toBeNull();
    const loading = screen.getByTestId('who-loading');
    expect(loading).toHaveAttribute('role', 'status');
    expect(loading).toHaveTextContent('Loading');
  });

  it('groups rows under tone-squared headers and marks the pick', () => {
    panel();
    const list = screen.getByRole('listbox', { name: 'Who' });
    expect(within(list).getByRole('group', { name: 'Patients' })).toBeInTheDocument();
    const doctor = screen.getByTestId('who-option-d1');
    expect(doctor).toHaveAttribute('aria-checked', 'true');
    expect(doctor).toHaveTextContent('4 today');
    expect(doctor.querySelector('.font-semibold')).toHaveTextContent('Dr. Mavani');
    const patient = screen.getByTestId('who-option-p1');
    expect(patient).toHaveAttribute('aria-checked', 'false');
    // The avatar is decorative; the badge's meaning is read out as text.
    expect(within(patient).getByText('Patient')).toHaveClass('sr-only');
    expect(within(patient).getByText('P')).toBeInTheDocument();
  });

  it('isolates the label, the sub and the meta in their own direction, in order', () => {
    // "PT-1042" or a phone in a right-to-left row reorders unless isolated.
    panel();
    const patient = screen.getByTestId('who-option-p1');
    expect(within(patient).getByText('Riya Sharma')).toHaveAttribute('dir', 'auto');
    const sub = within(patient).getByText('PT-1042');
    expect(sub).toHaveAttribute('dir', 'auto');
    expect(sub).toHaveClass('[text-align:match-parent]');
    expect(
      within(screen.getByTestId('who-option-d1')).getByText('4 today'),
    ).toHaveAttribute('dir', 'auto');
    expect(patient).toHaveTextContent('Riya SharmaPatientPT-1042');
  });

  it('leads rows with a tone tile, a pill or nothing as asked', () => {
    const rows = buildPickerRows({
      options: [
        {
          key: 'pay',
          label: 'Payments',
          leading: { kind: 'icon', icon: Wallet },
          tone: 'peach',
        },
        {
          key: 'ig',
          label: 'Instagram',
          leading: { kind: 'pill', icon: Tag },
          tone: 'blush',
        },
        { key: 'none', label: 'Plain', leading: { kind: 'none' } },
      ],
      query: '',
      recentKeys: [],
      recentEnabled: false,
      limit: 30,
      labels: { recent: 'Recent', all: 'All' },
    });
    panel({ sections: rows.sections, picked: new Set() });
    const tile = screen.getByTestId('who-option-pay').querySelector('.size-6');
    expect(tile).toHaveClass('bg-tone-peach', 'text-tone-peach-foreground');
    const pill = within(screen.getByTestId('who-option-ig')).getByText('Instagram');
    expect(pill.closest('[data-slot="pill"]')).toHaveClass('bg-tone-blush');
    expect(
      screen.getByTestId('who-option-none').querySelector('[class*="-dot"]'),
    ).toBeNull();
  });

  it('draws checkboxes for a multi-select and no mark for a menu', () => {
    const { unmount } = panel({ mode: 'multiple' });
    expect(
      screen.getByTestId('who-option-d1').querySelector('.size-4\\.5'),
    ).not.toBeNull();
    unmount();
    panel({ mode: 'menu' });
    expect(screen.getByTestId('who-option-d1')).not.toHaveAttribute('aria-checked');
  });

  it('shows the empty state, the dashed create row and the full-details footer', async () => {
    const create = vi.fn();
    const createFull = vi.fn();
    const user = userEvent.setup();
    panel({
      sections: [],
      empty: {
        title: 'No results for “Med”',
        hint: 'Check the spelling or try fewer letters',
      },
      create: { label: 'Add supplier “Med”', onSelect: create },
      createFull: { label: 'New supplier · “Med”', onSelect: createFull },
    });
    expect(screen.getByTestId('who-empty')).toHaveTextContent('No results for “Med”');
    await user.click(screen.getByTestId('who-create'));
    expect(create).toHaveBeenCalled();
    const footer = screen.getByTestId('who-create-full');
    expect(footer).toHaveTextContent('New supplier · “Med”full details');
    await user.click(footer);
    expect(createFull).toHaveBeenCalled();
  });

  it('shows two "Loading more" rows while the next page loads', () => {
    panel({ loadingMore: true });
    expect(screen.getByRole('status', { name: 'Loading more' })).toBeInTheDocument();
  });

  it('reports picks and keys to the picker', async () => {
    const onPick = vi.fn();
    const onKeyDown = vi.fn();
    const user = userEvent.setup();
    panel({ onPick, onKeyDown });
    await user.click(screen.getByTestId('who-option-p1'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ value: 'all:p1' }));
    screen.getByTestId('who-search').focus();
    await user.keyboard('{PageDown}');
    expect(onKeyDown).toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = panel({
      create: { label: 'Create “x”', onSelect: vi.fn() },
      createFull: { label: 'New thing', onSelect: vi.fn() },
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
