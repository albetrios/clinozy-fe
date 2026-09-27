import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { TotpCodeInput } from './TotpCodeInput.tsx';

function ControlledTotp({ onComplete }: { onComplete?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <TotpCodeInput
      value={value}
      onChange={setValue}
      onComplete={onComplete}
      testId="totp-input"
    />
  );
}

describe('TotpCodeInput', () => {
  it('renders six digit slots', () => {
    render(<TotpCodeInput value="" onChange={vi.fn()} testId="totp-input" />);
    expect(screen.getByTestId('totp-input')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="input-otp-slot"]')).toHaveLength(6);
  });

  it('calls onComplete when six digits are entered', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<ControlledTotp onComplete={onComplete} />);
    await user.type(screen.getByTestId('totp-input'), '123456');
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('123456'));
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <TotpCodeInput value="" onChange={vi.fn()} aria-label="Authenticator code" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
