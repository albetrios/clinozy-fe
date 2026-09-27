import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { QrCode } from './QrCode.tsx';

vi.mock('qrcode', () => ({
  default: {
    toString: vi.fn().mockResolvedValue('<svg><rect /></svg>'),
  },
}));

describe('QrCode', () => {
  it('renders generated SVG', async () => {
    render(<QrCode data="otpauth://totp/test?secret=ABC" />);
    await waitFor(() => expect(screen.getByTestId('qr-code')).toBeInTheDocument());
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<QrCode data="otpauth://totp/test?secret=ABC" />);
    await waitFor(() => expect(screen.getByTestId('qr-code')).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });
});
