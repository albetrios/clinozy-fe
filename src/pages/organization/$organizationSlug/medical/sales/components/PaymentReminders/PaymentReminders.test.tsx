import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  TEST_BUYER_CONTACT_ID,
  TEST_BUYER_PATIENT_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { listSaleReminders } from '../../../shared/medical-api.ts';
import type { SaleReminder } from '../../../shared/medical-contracts.ts';
import { PaymentReminders } from './PaymentReminders.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

vi.mock('../../../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listSaleReminders: vi.fn(),
}));

const TRIGGER = 'medical-sales-view-action-reminders';
const PANEL = 'payment-reminders';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** A sale a reminder names. */
const sale = (seq: number, due: number) => ({
  id: `msal_sale${seq}0000000000000000`,
  seq,
  due,
  soldAt: '2026-10-01T05:30:00.000Z',
});

const DHARTI: SaleReminder = {
  customer: {
    id: TEST_BUYER_CONTACT_ID,
    name: 'Dharti Galani',
    phone: '+919825044120',
    patientId: TEST_BUYER_PATIENT_ID,
  },
  due: 563,
  sales: [sale(978, 563)],
};
const WALK_IN: SaleReminder = {
  customer: {
    id: 'con_meera0000000000000000',
    name: 'Meera Joshi',
    phone: null,
    patientId: null,
  },
  due: 1226,
  sales: [sale(971, 600), sale(975, 626)],
};

/** The panel, opened from its view action. */
async function openPanel() {
  const user = setup();
  const view = renderMedicalDrawer(<PaymentReminders params={{}} />);
  const trigger = await screen.findByTestId(TRIGGER);
  await user.click(trigger);
  return { user, view, trigger, panel: await screen.findByTestId(PANEL) };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  vi.mocked(listSaleReminders).mockResolvedValue({
    clinicName: 'Cresence Skin',
    customers: [WALK_IN, DHARTI],
  });
});
afterEach(async () => {
  resetMedicalRoutes();
  vi.mocked(listSaleReminders).mockReset();
  await i18n.changeLanguage('en');
});

describe('PaymentReminders (medical.md:17, Q-M6)', () => {
  it('lists who owes the store: the total, each due and its sales (the server’s dues)', async () => {
    const user = setup();
    const { container } = renderMedicalDrawer(<PaymentReminders params={{}} />);
    const trigger = await screen.findByTestId(TRIGGER);
    expect(trigger).toHaveAccessibleName('Send payment reminders');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(trigger);
    const panel = await screen.findByTestId(PANEL);
    expect(panel).toHaveTextContent('Payment reminders');
    expect(within(panel).getByTestId(`${PANEL}-summary`)).toHaveTextContent(
      '2 customers owe ₹1,789',
    );
    expect(panel).toHaveTextContent('WhatsApp opens with the reminder typed');
    const [walkIn, dharti] = within(panel).getAllByTestId(`${PANEL}-row`);
    expect(walkIn).toHaveTextContent('Meera Joshi');
    expect(walkIn).toHaveTextContent('₹1,226 due · 2 sales · No phone saved');
    expect(dharti).toHaveTextContent('Dharti Galani');
    expect(dharti).toHaveTextContent('₹563 due · Sale #978');
    expect(await axeForDialog(panel)).toHaveNoViolations();
    expect(listSaleReminders).toHaveBeenCalledWith({});
  });

  it('opens WhatsApp with the reminder typed and rings the customer — nothing is sent from here', async () => {
    const { panel } = await openPanel();
    const [, dharti] = within(panel).getAllByTestId(`${PANEL}-row`);
    const row = within(dharti as HTMLElement);
    const message =
      'Hi Dharti, this is a reminder from Cresence Skin that ₹563 is due for your medicines. Reply here if you have any questions. Thank you!';
    const whatsApp = row.getByRole('link', { name: 'Remind Dharti on WhatsApp' });
    expect(whatsApp).toHaveAttribute(
      'href',
      `https://wa.me/919825044120?text=${encodeURIComponent(message)}`,
    );
    expect(whatsApp).toHaveAttribute('target', '_blank');
    expect(row.getByRole('link', { name: 'Call Dharti' })).toHaveAttribute(
      'href',
      'tel:+919825044120',
    );
    expect(notifyMock.success).not.toHaveBeenCalled();
  });

  it('copies the reminder — the one way to reach a customer with no phone', async () => {
    const { user, panel } = await openPanel();
    const [walkIn] = within(panel).getAllByTestId(`${PANEL}-row`);
    const row = within(walkIn as HTMLElement);
    expect(row.queryAllByRole('link')).toHaveLength(0);
    await user.click(row.getByRole('button', { name: 'Copy the reminder for Meera' }));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Reminder for Meera copied'),
    );
    expect(await navigator.clipboard.readText()).toBe(
      'Hi Meera, this is a reminder from Cresence Skin that ₹1,226 is due for your medicines. Reply here if you have any questions. Thank you!',
    );
  });

  it('writes the reminder in English whatever the screen speaks (Q-X2)', async () => {
    await ensureNamespace('de', 'medical');
    await i18n.changeLanguage('de');
    const { panel } = await openPanel();
    expect(panel).toHaveTextContent('Zahlungserinnerungen');
    const [, dharti] = within(panel).getAllByTestId(`${PANEL}-row`);
    const whatsApp = within(dharti as HTMLElement).getByRole('link', {
      name: 'Dharti per WhatsApp erinnern',
    });
    await waitFor(() =>
      expect(decodeURIComponent(whatsApp.getAttribute('href') ?? '')).toContain(
        'Hi Dharti, this is a reminder from Cresence Skin',
      ),
    );
  });

  it('hides while no one can be reminded, and while the read is out', async () => {
    vi.mocked(listSaleReminders).mockResolvedValue({
      clinicName: 'Cresence Skin',
      customers: [],
    });
    const view = renderMedicalDrawer(<PaymentReminders params={{}} />);
    await waitFor(() => expect(listSaleReminders).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId(TRIGGER)).not.toBeInTheDocument());
    view.unmount();
    vi.mocked(listSaleReminders).mockReturnValue(new Promise(() => undefined));
    renderMedicalDrawer(<PaymentReminders params={{}} />);
    await waitFor(() => expect(screen.queryByTestId(TRIGGER)).not.toBeInTheDocument());
  });
});
