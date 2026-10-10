import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PhotoThumb } from './PhotoThumb.tsx';

describe('PhotoThumb', () => {
  it('shows the image glyph in the photo’s place — no file can be read back (B1)', async () => {
    const { container } = render(
      <button type="button" aria-label="Open IMG_5100">
        <PhotoThumb />
      </button>,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows what the caller puts in its place instead', () => {
    const { getByText } = render(<PhotoThumb fallback={<span>IMG_5100.png</span>} />);
    expect(getByText('IMG_5100.png')).toBeInTheDocument();
  });
});
