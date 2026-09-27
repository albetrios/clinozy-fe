import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { OptimizedImage } from './OptimizedImage.tsx';

describe('OptimizedImage', () => {
  it('renders img with correct alt, width, height', () => {
    render(<OptimizedImage src="/test.png" alt="Test image" width={100} height={50} />);
    const img = screen.getByRole('img', { name: 'Test image' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('width', '100');
    expect(img).toHaveAttribute('height', '50');
  });

  it('has lazy loading attribute', () => {
    render(<OptimizedImage src="/test.png" alt="Test" width={50} height={50} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('has async decoding', () => {
    render(<OptimizedImage src="/test.png" alt="Test" width={50} height={50} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <OptimizedImage
        src="/test.png"
        alt="Descriptive alt text"
        width={100}
        height={100}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
