import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
}));

import { resetPreferencesFixture } from '@/shared/api/clinic/preferences-api.ts';
import {
  CONFIRM_TEST_IDS,
  confirmReasonTestId,
} from '@/shared/components/ConfirmDialog/index.ts';

import { OFFERING_SUGGESTIONS_TEST_IDS as IDS } from './offering-suggestions.constants.ts';
import type {
  SuggestionActivityLine,
  SuggestionIdea,
  SuggestionLine,
  SuggestionPurchase,
} from './offering-suggestions.types.ts';
import {
  OfferingSuggestions,
  type OfferingSuggestionsProps,
} from './OfferingSuggestions.tsx';

const by = {
  initials: 'RM',
  tone: 'sky',
  label: 'Dr. Reenal · 24 Sep · Patient file',
} as const;

/** Dharti's plan: a discounted package (accepted), a list-priced pair (half invoiced), a declined peel. */
const LINES: SuggestionLine[] = [
  {
    id: 'lhr',
    name: 'LHR Full Face · B4G7',
    tone: 'blush',
    info: 'Package · 7 sessions · List ₹4,800',
    qty: 1,
    price: 420_000,
    listPrice: 480_000,
    floorPrice: 400_000,
    status: 'accepted',
    invoicedQty: 0,
    invoicedAmount: 0,
    by,
  },
  {
    id: 'hydra',
    name: 'Hydrafacial',
    tone: 'sky',
    info: 'Facial · 2 visits · List ₹7,000',
    qty: 2,
    price: null,
    listPrice: 350_000,
    floorPrice: 300_000,
    status: 'planned',
    invoicedQty: 1,
    invoicedAmount: 350_000,
    by,
  },
  {
    id: 'peel',
    name: 'Chemical peel',
    tone: 'peach',
    info: 'Peel · 1 session · List ₹2,500',
    qty: 1,
    price: null,
    listPrice: 250_000,
    floorPrice: null,
    status: 'declined',
    invoicedQty: 0,
    invoicedAmount: 0,
    by,
  },
];

const IDEAS: SuggestionIdea[] = [
  {
    id: 'prp',
    name: 'PRP Hair',
    tone: 'lav',
    info: 'Idea from history · Complaint · hair fall',
    listPrice: 600_000,
  },
];

const PURCHASES: SuggestionPurchase[] = [
  {
    id: 'p1',
    date: '24 Sep',
    category: { label: 'Package', tone: 'blush' },
    name: 'LHR Full Face · B4G7',
    qty: 1,
    paid: 420_000,
    sessions: { used: 3, total: 6 },
    invoice: { label: '#1042', status: 'Paid', tone: 'sage' },
  },
  {
    id: 'p2',
    date: '02 Sep',
    category: { label: 'Facial', tone: 'sky' },
    name: 'Hydrafacial',
    qty: 1,
    paid: 210_000,
    sessions: null,
    invoice: { label: '#998', status: 'Due', tone: 'butter' },
  },
];

const ACTIVITY: SuggestionActivityLine[] = [
  {
    id: 'm1',
    at: '24 Sep, 4:10 PM',
    channel: { label: 'WhatsApp', tone: 'sage' },
    direction: 'sent',
    text: 'Your package is ready',
    status: 'Not delivered',
    statusTone: 'danger',
  },
  {
    id: 'm2',
    at: '24 Sep, 4:22 PM',
    channel: { label: 'WhatsApp', tone: 'sage' },
    direction: 'got',
    text: 'Thanks, see you Friday',
    status: 'Received',
  },
];

type Props = Partial<OfferingSuggestionsProps>;

/** The card with its own price eye, as a host keeps it. */
function Card({ pricesShown: initialShown = true, ...props }: Props) {
  const [pricesShown, setPricesShown] = useState(initialShown);
  return (
    <OfferingSuggestions
      firstName="Dharti"
      lines={LINES}
      variant="form"
      canEdit
      canDiscount
      {...props}
      pricesShown={pricesShown}
      onPricesShownChange={(shown) => {
        setPricesShown(shown);
        props.onPricesShownChange?.(shown);
      }}
    />
  );
}

function renderCard(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  return {
    user,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

const card = () => screen.getByTestId(IDS.card);
const toggle = () => screen.getByTestId(IDS.toggle);
const rows = () => screen.queryAllByTestId(IDS.row);
const row = (name: string) => {
  const found = rows().find((element) => within(element).queryByText(name));
  if (!found) throw new Error(`no row for ${name}`);
  return found;
};

beforeEach(() => {
  resetPreferencesFixture();
});

describe('OfferingSuggestions — header (H:2802–2804, H:4376)', () => {
  it('starts collapsed in the patient file: planned · accepted · ideas, and no rows', async () => {
    const { user } = renderCard(<Card variant="file" ideas={IDEAS} />);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveTextContent('2 planned · 1 accepted · 1 idea');
    expect(rows()).toHaveLength(0);
    expect(screen.queryByTestId(IDS.prices)).not.toBeInTheDocument();

    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(rows()).toHaveLength(3);
  });

  it('opens in the form: suggested · accepted · past purchases', () => {
    renderCard(
      <Card purchases={{ lines: PURCHASES, paidSoFar: 630_000 }} ideas={IDEAS} />,
    );
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(toggle()).toHaveTextContent(
      'Offering suggestions2 suggested · 1 accepted · 2 past purchases',
    );
  });

  it('reads "Nothing suggested yet" open and "No suggestions yet" closed, naming the patient inside', async () => {
    const { user } = renderCard(<Card lines={[]} />);
    expect(toggle()).toHaveTextContent('Nothing suggested yet');
    expect(card()).toHaveTextContent('Nothing suggested for Dharti yet.');
    await user.click(toggle());
    expect(toggle()).toHaveTextContent('No suggestions yet');
  });
});

describe('OfferingSuggestions — the total and the price eye', () => {
  it('totals Planned and Accepted, with what it saves on list and what is invoiced', () => {
    renderCard(<Card />);
    expect(card()).toHaveTextContent('₹11,200');
    expect(card()).toHaveTextContent('Saves ₹600 on list · ₹3,500 invoiced');
    expect(screen.getByTestId(IDS.prices)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(IDS.prices)).toHaveAccessibleName('Hide prices');
  });

  it('reads "At list price" without a saving and nothing for an empty plan', () => {
    const { unmount } = renderCard(<Card lines={[LINES[1]!]} />);
    expect(card()).toHaveTextContent('₹3,500 invoiced');
    expect(card()).not.toHaveTextContent('At list price');
    unmount();
    renderCard(<Card lines={[{ ...LINES[1]!, invoicedQty: 0, invoicedAmount: 0 }]} />);
    expect(card()).toHaveTextContent('At list price');
  });

  it('masks the plan’s prices behind the eye — an idea keeps its list price — and shows them again', async () => {
    const onPricesShownChange = vi.fn();
    const { user } = renderCard(
      <Card
        pricesShown={false}
        ideas={IDEAS}
        onPricesShownChange={onPricesShownChange}
      />,
    );
    expect(card()).toHaveTextContent('Prices hidden');
    expect(card()).not.toHaveTextContent('₹11,200');
    expect(
      screen.queryByRole('textbox', { name: 'Final price' }),
    ).not.toBeInTheDocument();
    expect(within(row('Hydrafacial')).getByText('₹ ••••')).toBeInTheDocument();
    expect(
      within(row('Hydrafacial')).getByText('Prices hidden · use the eye to show'),
    ).toHaveClass('sr-only');
    expect(within(screen.getByTestId(IDS.idea)).getByText('₹6,000')).toBeInTheDocument();

    await user.click(screen.getByTestId(IDS.prices));
    expect(onPricesShownChange).toHaveBeenCalledWith(true);
    expect(card()).toHaveTextContent('₹11,200');
    expect(screen.getAllByRole('textbox', { name: 'Final price' })).toHaveLength(3);
  });
});

describe('OfferingSuggestions — a suggested row (H:2806–2812)', () => {
  it('steps the quantity, scaling a typed price; Less stops at 1', async () => {
    const onChange = vi.fn();
    const { user } = renderCard(<Card onChange={onChange} />);
    const lhr = within(row('LHR Full Face · B4G7'));
    expect(lhr.getByRole('group', { name: 'Quantity' })).toHaveTextContent('1');
    expect(lhr.getByRole('button', { name: 'Less' })).toBeDisabled();

    await user.click(lhr.getByRole('button', { name: 'More' }));
    expect(onChange).toHaveBeenLastCalledWith(LINES[0], { qty: 2, price: 840_000 });

    await user.click(within(row('Hydrafacial')).getByRole('button', { name: 'Less' }));
    expect(onChange).toHaveBeenLastCalledWith(LINES[1], { qty: 1, price: null });
  });

  it('shows the line’s final price and reports a typed one in paise', async () => {
    const onChange = vi.fn();
    const { user } = renderCard(<Card onChange={onChange} />);
    const price = within(row('Hydrafacial')).getByRole('textbox', {
      name: 'Final price',
    });
    expect(price).toHaveValue('7000');
    await user.clear(price);
    await user.type(price, '6500');
    expect(onChange).toHaveBeenLastCalledWith(LINES[1], { price: 650_000 });
  });

  it('names the lowest price below the floor, or asks for an admin without the discount ability', () => {
    const cheap = { ...LINES[0]!, price: 350_000 };
    const { unmount } = renderCard(<Card lines={[cheap]} />);
    const price = screen.getByRole('textbox', { name: 'Final price' });
    expect(price).toHaveAttribute('aria-invalid', 'true');
    expect(price).toHaveAccessibleDescription('Below the lowest price ₹4,000');
    unmount();

    renderCard(<Card lines={[cheap]} canDiscount={false} />);
    expect(
      screen.getByRole('textbox', { name: 'Final price' }),
    ).toHaveAccessibleDescription('Too much discount · ask an admin');
  });

  it('changes the status from its pill’s picker', async () => {
    const onChange = vi.fn();
    const { user } = renderCard(<Card onChange={onChange} />);
    await user.click(
      within(row('Hydrafacial')).getByRole('button', { name: 'Status · Planned' }),
    );
    const listbox = await screen.findByRole('listbox', { name: 'Status' });
    expect(
      within(listbox)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      expect.stringContaining('Planned'),
      expect.stringContaining('Accepted'),
      expect.stringContaining('Next time'),
      expect.stringContaining('Declined'),
    ]);
    expect(listbox).toHaveTextContent('Interested · bring it up at the next visit');
    await user.click(within(listbox).getByRole('option', { name: /Next time/ }));
    expect(onChange).toHaveBeenLastCalledWith(LINES[1], { status: 'next_time' });
  });

  it('dims a declined line', () => {
    renderCard(<Card />);
    expect(row('Chemical peel')).toHaveAttribute('data-status', 'declined');
    expect(row('Chemical peel').className).toContain('opacity-60');
  });

  it('turns a fully invoiced line into "✓ Invoiced · <n> of <n>", its controls gone', () => {
    const done = { ...LINES[1]!, invoicedQty: 2, invoicedAmount: 700_000 };
    renderCard(<Card lines={[done]} onLinkInvoice={vi.fn()} />);
    const line = within(row('Hydrafacial'));
    expect(line.getByText('Invoiced · 2 of 2')).toBeInTheDocument();
    expect(line.queryByRole('button', { name: /^Status/ })).not.toBeInTheDocument();
    expect(
      line.queryByRole('button', { name: 'Link an invoice' }),
    ).not.toBeInTheDocument();
    expect(line.getByRole('button', { name: 'More' })).toBeDisabled();
    expect(line.getByRole('textbox', { name: 'Final price' })).toHaveAttribute(
      'readonly',
    );
  });

  it('reads "Invoiced" alone for a single unit', () => {
    const done = { ...LINES[0]!, invoicedQty: 1, invoicedAmount: 420_000 };
    renderCard(<Card lines={[done]} />);
    expect(within(row('LHR Full Face · B4G7')).getByText('Invoiced')).toBeInTheDocument();
  });

  it('hands "Link an invoice" to the host', async () => {
    const onLinkInvoice = vi.fn();
    const { user } = renderCard(<Card onLinkInvoice={onLinkInvoice} />);
    await user.click(
      within(row('Hydrafacial')).getByRole('button', { name: 'Link an invoice' }),
    );
    expect(onLinkInvoice).toHaveBeenCalledWith(LINES[1]);
  });

  it('only reads without edit: no stepper, price, status, link, remove or add', () => {
    renderCard(
      <Card
        canEdit={false}
        ideas={IDEAS}
        onLinkInvoice={vi.fn()}
        onAddOffering={vi.fn()}
        onAddIdea={vi.fn()}
      />,
    );
    const line = within(row('Hydrafacial'));
    expect(line.getByRole('button', { name: 'More' })).toBeDisabled();
    expect(line.getByRole('textbox', { name: 'Final price' })).toHaveAttribute(
      'readonly',
    );
    expect(line.queryByRole('button', { name: /^Status/ })).not.toBeInTheDocument();
    expect(line.getByText('Planned')).toBeInTheDocument();
    expect(
      line.queryByRole('button', { name: 'Link an invoice' }),
    ).not.toBeInTheDocument();
    expect(line.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.queryByTestId(IDS.addOffering)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add PRP Hair' }),
    ).not.toBeInTheDocument();
  });
});

describe('OfferingSuggestions — remove (H:4353)', () => {
  it('asks "Remove this record?" for a reason and hands the stored choice over', async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const { user } = renderCard(<Card onRemove={onRemove} />);
    await user.click(
      within(row('LHR Full Face · B4G7')).getByRole('button', { name: 'Remove' }),
    );

    const confirm = await screen.findByTestId(CONFIRM_TEST_IDS.dialog);
    expect(confirm).toHaveTextContent('Remove this record?');
    expect(screen.getByTestId(CONFIRM_TEST_IDS.record)).toHaveTextContent(
      'LHR Full Face · B4G7 from suggestions',
    );
    expect(confirm).toHaveTextContent(
      'It leaves Dharti’s offering suggestions. Use Declined instead to keep a record that it was offered.',
    );
    expect(
      ['mistake', 'duplicate', 'plan_changed', 'other'].map(
        (value) => screen.getByTestId(confirmReasonTestId(value)).textContent,
      ),
    ).toEqual(['Added by mistake', 'Duplicate', 'Plan changed', 'Other']);

    await user.click(screen.getByTestId(confirmReasonTestId('plan_changed')));
    await user.click(screen.getByTestId(CONFIRM_TEST_IDS.accept));
    await waitFor(() =>
      expect(onRemove).toHaveBeenCalledExactlyOnceWith(LINES[0], {
        reason: 'other',
        note: 'Plan changed',
        picked: { value: 'plan_changed', label: 'Plan changed' },
        comment: '',
      }),
    );
  });
});

describe('OfferingSuggestions — ideas and Add offering (H:2814–2818)', () => {
  it('draws an idea with its list price and hands "+ Add" to the host', async () => {
    const onAddIdea = vi.fn();
    const { user } = renderCard(<Card ideas={IDEAS} onAddIdea={onAddIdea} />);
    const idea = within(screen.getByTestId(IDS.idea));
    expect(idea.getByText('PRP Hair')).toBeInTheDocument();
    expect(idea.getByText('₹6,000')).toBeInTheDocument();
    expect(idea.getByText('Idea')).toBeInTheDocument();
    expect(idea.getByRole('button', { name: 'Why this idea' })).toBeInTheDocument();
    await user.click(idea.getByRole('button', { name: 'Add PRP Hair' }));
    expect(onAddIdea).toHaveBeenCalledWith(IDEAS[0]);
  });

  it('opens the host’s offering search from the dashed "Add offering"', async () => {
    const onAddOffering = vi.fn();
    const { user } = renderCard(<Card onAddOffering={onAddOffering} />);
    await user.click(screen.getByTestId(IDS.addOffering));
    expect(onAddOffering).toHaveBeenCalledOnce();
  });
});

describe('OfferingSuggestions — purchases and contact activity (H:2819–2825)', () => {
  it('lists the last purchases with what was paid so far, sessions and the invoice', async () => {
    const onOpenInvoice = vi.fn();
    const { user } = renderCard(
      <Card
        purchases={{
          lines: [{ ...PURCHASES[0]!, onOpenInvoice }, PURCHASES[1]!],
          paidSoFar: 630_000,
        }}
      />,
    );
    const section = screen.getByRole('region', { name: 'Dharti’s last purchases' });
    expect(section).toHaveTextContent('2 lines · ₹6,300 paid so far');
    const [first, second] = screen.getAllByTestId(IDS.purchase);
    expect(first).toHaveTextContent('3 of 6 used');
    expect(second).toHaveTextContent('—');
    expect(within(second!).getByRole('button', { name: '#998' })).toBeDisabled();
    await user.click(within(first!).getByRole('button', { name: '#1042' }));
    expect(onOpenInvoice).toHaveBeenCalledOnce();
  });

  it('lists the contact activity with Sent / Got, the status ink and "Open chat"', async () => {
    const onOpenChat = vi.fn();
    const { user } = renderCard(
      <Card
        activity={{ summary: 'Lead #2363 · Clinic visited', lines: ACTIVITY, onOpenChat }}
      />,
    );
    const section = screen.getByRole('region', { name: 'Contact activity' });
    expect(section).toHaveTextContent('Lead #2363 · Clinic visited');
    const [sent, got] = screen.getAllByTestId(IDS.activity);
    expect(sent).toHaveTextContent('Sent');
    expect(within(sent!).getByText('Not delivered').className).toContain(
      'text-destructive',
    );
    expect(got).toHaveTextContent('Got');
    expect(within(got!).getByText('Received').className).toContain(
      'text-muted-foreground',
    );
    await user.click(within(section).getByRole('button', { name: 'Open chat' }));
    expect(onOpenChat).toHaveBeenCalledOnce();
  });
});

describe('OfferingSuggestions — wraps by its own width (KICKOFF §6.6, H:415–422)', () => {
  it('is a size container whose rows, purchases and activity carry the container breakpoints', () => {
    renderCard(
      <Card
        purchases={{ lines: PURCHASES, paidSoFar: 630_000 }}
        activity={{ summary: 'Lead #2363', lines: ACTIVITY }}
      />,
    );
    expect(card().className).toContain('@container');
    // Under 600px of card width a row takes two lines and the header row hides.
    expect(row('Hydrafacial').className).toContain(
      '@max-[600px]:[grid-template-areas:"n_n_n_act""q_p_st_by"]',
    );
    const head = card().querySelector('[aria-hidden="true"].grid');
    expect(head?.className).toContain('@max-[600px]:hidden');
    // Under 720px purchases and activity go to three columns.
    expect(screen.getAllByTestId(IDS.purchase)[0]!.className).toContain(
      '@max-[720px]:grid-cols-[64px_minmax(0,1fr)_auto]',
    );
    expect(screen.getAllByTestId(IDS.activity)[0]!.className).toContain(
      '@max-[720px]:grid-cols-[64px_minmax(0,1fr)_auto]',
    );
  });
});

describe('OfferingSuggestions — accessibility', () => {
  it('has no axe violations, open with every section', async () => {
    const { container } = renderCard(
      <Card
        ideas={IDEAS}
        purchases={{ lines: PURCHASES, paidSoFar: 630_000 }}
        activity={{ summary: 'Lead #2363', lines: ACTIVITY, onOpenChat: vi.fn() }}
        onLinkInvoice={vi.fn()}
        onAddIdea={vi.fn()}
        onAddOffering={vi.fn()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
