import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { DrawerPhoneInput } from './drawer-phone-input.tsx';

function Mobile({ initial = '' }: { initial?: string }) {
  const [digits, setDigits] = useState(initial);
  return (
    <>
      <label htmlFor="mobile">Mobile</label>
      <DrawerPhoneInput id="mobile" value={digits} onChange={setDigits} />
      <output>{digits || 'none'}</output>
    </>
  );
}

describe('DrawerPhoneInput — the clinic mobile field (H:3761)', () => {
  it('shows the +91 box and the design’s placeholder, as a numeric phone field', () => {
    render(<Mobile />);
    const field = screen.getByRole('textbox', { name: 'Mobile' });
    expect(field).toHaveAttribute('type', 'tel');
    expect(field).toHaveAttribute('inputmode', 'numeric');
    expect(field).toHaveAttribute('placeholder', '98765 43210');
    expect(screen.getByText('+91')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps digits only, spaced after the fifth, at most ten', async () => {
    const user = userEvent.setup();
    render(<Mobile />);
    const field = screen.getByRole('textbox', { name: 'Mobile' });
    await user.type(field, '98a76-5432109');
    expect(field).toHaveValue('98765 43210');
    expect(screen.getByRole('status')).toHaveTextContent('9876543210');
  });

  it('drops the country code of a pasted number', async () => {
    const user = userEvent.setup();
    render(<Mobile />);
    const field = screen.getByRole('textbox', { name: 'Mobile' });
    await user.click(field);
    await user.paste('+91 98250-44120');
    expect(field).toHaveValue('98250 44120');
    expect(screen.getByRole('status')).toHaveTextContent('9825044120');
  });

  it('outlines the whole frame when the field is invalid', () => {
    render(
      <DrawerPhoneInput
        aria-label="Mobile"
        aria-invalid
        value="98"
        onChange={() => {}}
      />,
    );
    const frame = screen.getByRole('textbox', { name: 'Mobile' }).parentElement;
    expect(frame?.className).toContain(
      'has-[input[aria-invalid=true]]:border-destructive',
    );
  });

  it('has no axe violations', async () => {
    const { container } = render(<Mobile initial="9876543210" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
