import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { TeamCard, TeamCardContent, type TeamCardData } from './TeamCard.tsx';

/** Riya Shah as `US_SEED` and `PEOPLE` seed her (H:3374, H:3593). */
const RIYA: TeamCardData = {
  name: 'Riya Shah',
  initials: 'RS',
  tone: 'blush',
  role: 'Front desk · Admin',
  online: true,
  phone: '+919825044120',
  email: 'riya@cresence.skin',
  branches: ['Adajan', 'Vesu'],
  hours: { from: '10:00', to: '19:00' },
  updatedAt: '2026-10-03T05:35:00.000Z',
};

function renderContent(
  data: TeamCardData,
  extra: Partial<Parameters<typeof TeamCardContent>[0]> = {},
) {
  const close = vi.fn();
  render(
    <TooltipProvider>
      <div role="dialog" aria-label={data.name}>
        <TeamCardContent data={data} close={close} {...extra} />
      </div>
    </TooltipProvider>,
  );
  return { close };
}

beforeEach(() => {
  useLocaleStore.setState({ formatLocale: 'en-IN', hourCycle: 'h23', timeZone: 'UTC' });
});

afterEach(() => {
  useLocaleStore.setState({ formatLocale: 'en-US', hourCycle: 'auto', timeZone: 'auto' });
});

describe('TeamCardContent', () => {
  it('shows the member in their tone, online, with the presence dot', () => {
    const { container } = render(
      <TooltipProvider>
        <TeamCardContent data={RIYA} close={() => {}} />
      </TooltipProvider>,
    );
    expect(screen.getByText('RS')).toHaveClass('bg-tone-blush');
    expect(container.querySelector('[data-presence="online"]')).toHaveClass(
      'bg-presence-online',
    );
    expect(screen.getByText('Riya Shah')).toHaveClass('text-title', 'font-semibold');
    expect(screen.getByText('Front desk · Admin')).toBeInTheDocument();
    expect(screen.getByText('Online now')).toBeInTheDocument();
  });

  it('says Offline with the border-strong dot', () => {
    const { container } = render(
      <TooltipProvider>
        <TeamCardContent data={{ ...RIYA, online: false }} close={() => {}} />
      </TooltipProvider>,
    );
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(container.querySelector('[data-presence="offline"]')).toHaveClass(
      'bg-border-strong',
    );
  });

  it.each([
    ['assigned', 'Assigned', 'bg-primary'],
    ['sentThis', 'Sent this', 'bg-tone-sage'],
    ['treating', 'Treating', 'bg-muted'],
    ['involved', 'Involved', 'bg-muted'],
  ] as const)('draws the %s pill', (kind, label, paint) => {
    renderContent(RIYA, { kind });
    expect(screen.getByText(label).closest('[data-slot="pill"]')).toHaveClass(
      paint,
      'h-5.5',
    );
  });

  it('lists how to reach them', () => {
    renderContent(RIYA);
    const reach = screen.getByRole('group', { name: 'Reach' });
    for (const row of [
      '+91 98250 44120',
      'riya@cresence.skin',
      'Adajan · Vesu',
      'Works 10:00 – 19:00',
    ]) {
      expect(within(reach).getByText(row)).toBeInTheDocument();
    }
  });

  it('assigns with the default label, or the caller’s, and closes', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();
    const { close } = renderContent(RIYA, { assign: { onAssign } });
    await user.click(screen.getByRole('button', { name: 'Assign to yourself' }));
    expect(close).toHaveBeenCalledOnce();
    expect(onAssign).toHaveBeenCalledOnce();
  });

  it('takes a claim label instead', () => {
    renderContent(RIYA, { assign: { label: 'Claim Rhea', onAssign: () => {} } });
    expect(screen.getByTestId('team-card-assign')).toHaveTextContent('Claim Rhea');
  });

  it('stamps when the copy was fetched, or says it is still fetching', () => {
    const { rerender } = render(
      <TooltipProvider>
        <TeamCardContent data={RIYA} close={() => {}} />
      </TooltipProvider>,
    );
    expect(screen.getByText('Updated 05:35')).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <TeamCardContent data={{ ...RIYA, updatedAt: null }} close={() => {}} />
      </TooltipProvider>,
    );
    expect(screen.getByText('Fetching latest…')).toBeInTheDocument();
  });

  it('drops the body when there is nothing to reach or assign', () => {
    renderContent({ name: 'Nidhi', tone: 'lav', role: 'Counsellor', online: false });
    expect(screen.queryByRole('group', { name: 'Reach' })).toBeNull();
  });
});

describe('TeamCard', () => {
  it('opens on hover, named by the member', async () => {
    const user = userEvent.setup();
    render(
      <TeamCard data={RIYA} kind="assigned">
        <span>RS</span>
      </TeamCard>,
    );
    await user.hover(screen.getByRole('button', { name: 'RS' }));
    const card = await screen.findByRole('dialog', { name: 'Riya Shah' });
    expect(card).toHaveAttribute('data-testid', 'team-card');
    expect(within(card).getByText('Assigned')).toBeInTheDocument();
  });

  it('a failed load never opens it', async () => {
    const user = userEvent.setup();
    const load = vi.fn(() => Promise.reject(new Error('offline')));
    render(
      <TeamCard load={load}>
        <span>RS</span>
      </TeamCard>,
    );
    await user.hover(screen.getByRole('button', { name: 'RS' }));
    await waitFor(() => expect(load).toHaveBeenCalledOnce());
    await new Promise((done) => setTimeout(done, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no accessibility violations when open', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <TeamCard data={RIYA} kind="sentThis" assign={{ onAssign: () => {} }}>
        <span>RS</span>
      </TeamCard>,
    );
    await user.hover(screen.getByRole('button', { name: 'RS' }));
    await screen.findByRole('dialog', { name: 'Riya Shah' });
    expect(
      await axe(baseElement, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
