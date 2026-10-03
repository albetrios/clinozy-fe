import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { AppointmentPage } from './AppointmentPage.tsx';

describe('AppointmentPage', () => {
  it('renders nothing — the Appointments page opens the drawer over itself', async () => {
    const { container } = render(<AppointmentPage />);
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
