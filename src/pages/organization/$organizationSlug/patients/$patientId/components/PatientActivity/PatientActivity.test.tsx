import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { fetchContactThread } from '@/shared/api/app/contact-activities-api.ts';
import { fetchLead } from '@/shared/api/app/leads-api.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { resetOutboxes } from '@/shared/hooks/useThread/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { holdPreset, PRESET_CODES } from '@/tests/utils/app-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  patientFile,
  patientRecord,
  TEST_CONTACT_ID,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';
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
// The lead the file came from (`GET /app/leads/:lead_id`).
vi.mock('@/shared/api/app/leads-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchLead: vi.fn(),
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

const LEAD_ID = 'lead_qa02000000000000000000';
/** Priya's file, opened at the check-in of her Google lead (`lead_id`, P10). */
const linkedFile = () => patientFile({ patient: patientRecord({ leadId: LEAD_ID }) });

beforeEach(() => {
  viewport.tier = 'desktop';
  signInTestMember();
  holdPreset('front_desk');
  vi.mocked(fetchLead).mockReset();
  vi.mocked(fetchLead).mockResolvedValue({
    id: LEAD_ID,
    kind: 'enquiry',
    createdAt: '2026-09-28T09:33:00.000Z',
    source: 'google',
    patientId: TEST_PATIENT_ID,
  } as LeadRecord);
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
  useOrganizationStore.getState().clearPermissions();
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

  describe('the divider (QA-02)', () => {
    const divider = async () =>
      within(await screen.findByTestId('patient-file-activity-column')).findByTestId(
        'chat-thread-divider',
      );

    it('names the lead a linked patient came from, for a member who reads leads', async () => {
      renderActivity({ file: linkedFile() });
      const line = await divider();
      await vi.waitFor(() =>
        expect(line.textContent).toMatch(/^Lead created · .+ · via Google$/),
      );
      expect(fetchLead).toHaveBeenCalledWith(LEAD_ID);
    });

    it('says she came from a lead — not "no lead" — to a member who cannot read it', async () => {
      holdPreset('therapist');
      renderActivity({ file: linkedFile() });
      expect(await divider()).toHaveTextContent('Patient · came from a lead');
      expect(fetchLead).not.toHaveBeenCalled();
    });

    it('says the same, quietly, when the lead is another branch’s (404)', async () => {
      vi.mocked(fetchLead).mockRejectedValue(
        new HttpError('Not Found', 404, `/app/leads/${LEAD_ID}`, 'GET'),
      );
      renderActivity({ file: linkedFile() });
      const line = await divider();
      await vi.waitFor(() => expect(fetchLead).toHaveBeenCalled());
      expect(line).toHaveTextContent('Patient · came from a lead');
    });

    it('keeps "no lead" for a patient who never had one', async () => {
      renderActivity();
      expect(await divider()).toHaveTextContent('Patient · chat only · no lead');
      expect(fetchLead).not.toHaveBeenCalled();
    });
  });

  it('reads the thread without a composer for a member who may not write it (QA-07)', async () => {
    useOrganizationStore
      .getState()
      .setPermissions(
        PRESET_CODES.front_desk.filter((code) => code !== 'contact_activity:create'),
      );
    renderActivity();
    const column = await screen.findByTestId('patient-file-activity-column');
    expect(await within(column).findByText('Can I come in on Saturday?')).toBeVisible();
    expect(within(column).queryByTestId('chat-textarea')).not.toBeInTheDocument();
    expect(within(column).queryByTestId('chat-send')).not.toBeInTheDocument();
  });
});
