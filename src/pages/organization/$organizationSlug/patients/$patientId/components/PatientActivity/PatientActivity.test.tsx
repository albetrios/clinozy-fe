import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchPatientFile } from '@/shared/api/clinic/patient-file-api.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { resetOutboxes } from '@/shared/hooks/useThread/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PatientActivity, type PatientActivityProps } from './PatientActivity.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

let file: PatientFile;

function renderActivity(props: Partial<PatientActivityProps> = {}) {
  return renderWithProviders(
    <TooltipProvider>
      <PatientActivity file={file} masked onOpenHistory={vi.fn()} {...props} />
    </TooltipProvider>,
  );
}

beforeEach(async () => {
  viewport.tier = 'desktop';
  useAuthStore.setState({
    user: { id: 'user-1', email: 'riya@cresence.skin', role: 'user', name: 'Riya Shah' },
  });
  resetClinicFixtures();
  resetOutboxes();
  file = await fetchPatientFile(patientRef('Dharti Galani'));
});
afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null });
  resetClinicFixtures();
  resetOutboxes();
});

describe('PatientActivity', () => {
  it('holds the patient’s conversation in its own card', async () => {
    const { container } = renderActivity();
    const column = await screen.findByTestId('patient-file-activity-column');
    expect(column).toHaveAttribute('data-slot', 'card');
    expect(await within(column).findByTestId('chat-column-header')).toHaveTextContent(
      'Dharti Galani',
    );
    expect(await within(column).findByTestId('chat-textarea')).toBeInTheDocument();
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
