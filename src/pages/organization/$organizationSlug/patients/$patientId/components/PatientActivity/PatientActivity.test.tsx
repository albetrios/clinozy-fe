import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { fetchContactThread } from '@/shared/api/app/contact-activities-api.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { resetOutboxes } from '@/shared/hooks/useThread/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { patientFile, TEST_CONTACT_ID } from '@/tests/utils/patient-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PatientActivity, type PatientActivityProps } from './PatientActivity.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));
// The person's stream is clinozy-be's (`/app/contacts/:contact_id/activities`).
vi.mock('@/shared/api/app/contact-activities-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchContactThread: vi.fn(),
  fetchContactMessagingStatus: vi.fn(async () => ({
    whatsappDown: false,
    isConnected: false,
  })),
  fetchContactTemplateValues: vi.fn(async () => ({
    clinicName: 'Cresence Skin',
    address: '',
    mapsLink: '',
    reviewLink: '',
    freeSlots: [],
  })),
}));
// The chat names offerings from the one catalogue: none here.
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllOfferings: vi.fn(async () => []),
}));

function renderActivity(props: Partial<PatientActivityProps> = {}) {
  return renderWithProviders(
    <TooltipProvider>
      <PatientActivity
        file={patientFile({ instagram: 'priya.shah' })}
        masked
        onOpenHistory={vi.fn()}
        {...props}
      />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  viewport.tier = 'desktop';
  signInTestMember();
  resetOutboxes();
  vi.mocked(fetchContactThread).mockResolvedValue({
    thread: null,
    messages: [
      {
        id: 'msg_priya0000000000000001',
        channel: 'whatsapp',
        direction: 'received',
        body: 'Can I come in on Saturday?',
        deliveryStatus: 'delivered',
        isSystem: false,
        authorId: null,
        taskId: null,
        sentAt: '2026-10-02T05:10:00.000Z',
      },
    ],
    authors: {},
  });
});
afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null });
  resetOutboxes();
});

describe('PatientActivity', () => {
  it('holds the person’s conversation in its own card, read from their contact', async () => {
    const { container } = renderActivity();
    const column = await screen.findByTestId('patient-file-activity-column');
    expect(column).toHaveAttribute('data-slot', 'card');
    expect(await within(column).findByTestId('chat-column-header')).toHaveTextContent(
      'Priya Shah',
    );
    expect(await within(column).findByTestId('chat-textarea')).toBeInTheDocument();
    expect(await within(column).findByText('Can I come in on Saturday?')).toBeVisible();
    expect(fetchContactThread).toHaveBeenCalledWith(TEST_CONTACT_ID);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('drops the card’s elevation on a phone, where it takes the whole body', async () => {
    viewport.tier = 'phone';
    renderActivity();
    expect(await screen.findByTestId('patient-file-activity-column')).toHaveAttribute(
      'data-slot',
      'patient-activity',
    );
  });

  it('books from the composer only when the member may', async () => {
    const user = userEvent.setup();
    const onBookAppointment = vi.fn();
    const without = renderActivity();
    await screen.findByTestId('chat-textarea');
    expect(screen.queryByTestId('chat-book')).not.toBeInTheDocument();
    without.unmount();

    renderActivity({ onBookAppointment });
    await user.click(await screen.findByTestId('chat-book'));
    expect(onBookAppointment).toHaveBeenCalledOnce();
  });
});
