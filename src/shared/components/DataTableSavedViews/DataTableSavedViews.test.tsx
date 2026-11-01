import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { savedViewsKey } from '@/shared/hooks/useSavedViews/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import {
  LEAD_CHAT_WIDTH,
  useDevicePrefsStore,
} from '@/shared/store/useDevicePrefsStore/index.ts';

import { DataTableSavedViews } from './DataTableSavedViews.tsx';

const notify = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock('@/shared/notify/index.ts', () => ({ notify }));

const VIP = { id: 'v1', name: 'VIP', filters: { status: ['vip'] } };
const DUES = {
  id: 'v2',
  name: 'With dues + New',
  filters: { due: ['yes'], status: ['new'] },
};

/** The signed-in person's views of the patients table. */
const PATIENTS_VIEWS = savedViewsKey('usr_ada', 'patients');

beforeEach(() => {
  notify.success.mockReset();
  useAuthStore
    .getState()
    .setUser({ id: 'usr_ada', email: 'ada@clinic.test', role: 'user' });
  useDevicePrefsStore.setState({
    hiddenColumns: {},
    savedViews: { [PATIENTS_VIEWS]: [VIP, DUES] },
    photoSize: 'medium',
    leadChatWidth: LEAD_CHAT_WIDTH.initial,
  });
});

describe('DataTableSavedViews', () => {
  it('renders nothing until a view is saved', () => {
    const { container } = render(
      <DataTableSavedViews tableId="payments" onApply={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('applies a view from its chip', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<DataTableSavedViews tableId="patients" onApply={onApply} />);
    expect(screen.getByRole('group', { name: 'Saved views' })).toBeInTheDocument();

    const chip = screen.getByRole('button', { name: 'VIP' });
    expect(chip).toHaveAttribute('title', 'Apply view');
    await user.click(chip);
    expect(onApply).toHaveBeenCalledWith(VIP);
  });

  it('presses the view whose filters are applied now', () => {
    render(
      <DataTableSavedViews
        tableId="patients"
        activeFilters={{ status: ['new'], due: ['yes'] }}
        onApply={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'With dues + New' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'VIP' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('removes a view from this device and says so', async () => {
    const user = userEvent.setup();
    render(<DataTableSavedViews tableId="patients" onApply={vi.fn()} />);
    const [remove] = screen.getAllByRole('button', { name: 'Remove view' });
    await user.click(remove as HTMLElement);

    expect(useDevicePrefsStore.getState().savedViews[PATIENTS_VIEWS]).toEqual([DUES]);
    expect(notify.success).toHaveBeenCalledWith('View removed');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <DataTableSavedViews tableId="patients" onApply={vi.fn()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
