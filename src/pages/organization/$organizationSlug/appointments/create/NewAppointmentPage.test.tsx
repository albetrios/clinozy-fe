import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { NewAppointmentPage } from './NewAppointmentPage.tsx';

describe('NewAppointmentPage', () => {
  it('renders nothing — the Appointments page opens the form over itself', async () => {
    const { container } = render(<NewAppointmentPage />);
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
