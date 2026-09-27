import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { HttpError } from '@/shared/errors/HttpError.ts';

import { RateLimitNotice } from './RateLimitNotice.tsx';

describe('RateLimitNotice', () => {
  it('renders nothing for non-429 errors', () => {
    const { container } = render(<RateLimitNotice error={new Error('fail')} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a message for 429 with retry_after', async () => {
    const err = new HttpError('HTTP 429', 429, '/x', 'GET', {
      error: { retry_after: 12 },
    });
    const { container } = render(<RateLimitNotice error={err} />);
    expect(screen.getByTestId('rate-limit-notice')).toHaveTextContent('12');
    expect(await axe(container)).toHaveNoViolations();
  });
});
