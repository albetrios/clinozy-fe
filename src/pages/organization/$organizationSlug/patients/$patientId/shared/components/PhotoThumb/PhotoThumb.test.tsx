import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PhotoThumb } from './PhotoThumb.tsx';

const LINK =
  'https://uploads.test/organization-files/org_test/img-5100.png?X-Amz-Expires=900';

describe('PhotoThumb', () => {
  it('shows the photo from its link, lazily and as decoration — the button names it', async () => {
    const { container } = render(
      <button type="button" aria-label="Open IMG_5100">
        <PhotoThumb src={LINK} />
      </button>,
    );
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', LINK);
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveClass('object-cover');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the whole photo when asked to contain it (the viewer)', () => {
    const { container } = render(<PhotoThumb src={LINK} fit="contain" />);
    expect(container.querySelector('img')).toHaveClass('object-contain');
  });

  it('shows the image glyph without a link — the upload is gone', async () => {
    const { container } = render(
      <button type="button" aria-label="Open IMG_5100">
        <PhotoThumb src={null} />
      </button>,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('falls back when the link fails to load, and tries a new link again', () => {
    const { container, rerender } = render(<PhotoThumb src={LINK} />);
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
    rerender(<PhotoThumb src={`${LINK}&X-Amz-Signature=next`} />);
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('shows what the caller puts in its place instead', () => {
    const { getByText } = render(<PhotoThumb fallback={<span>IMG_5100.png</span>} />);
    expect(getByText('IMG_5100.png')).toBeInTheDocument();
  });
});
