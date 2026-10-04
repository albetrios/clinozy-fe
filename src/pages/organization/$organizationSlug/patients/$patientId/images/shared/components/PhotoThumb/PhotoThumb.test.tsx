import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { isPhotoUrl } from './photo-thumb.ts';
import { PhotoThumb } from './PhotoThumb.tsx';

describe('PhotoThumb', () => {
  it('shows a photo that has a URL, covering a tile', async () => {
    const { container } = render(
      <PhotoThumb fileUrl="https://files.example/a.jpg" fit="cover" />,
    );
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', 'https://files.example/a.jpg');
    expect(image).toHaveClass('object-cover');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('stands the glyph in for a stored key, and for a file that fails to load', () => {
    const { container, rerender } = render(
      <PhotoThumb fileUrl="organizations/o1/files/a.jpg" fit="contain" />,
    );
    expect(container.querySelector('img')).toBeNull();

    rerender(
      <PhotoThumb
        fileUrl="https://files.example/b.jpg"
        fit="contain"
        fallback={<span>no file</span>}
      />,
    );
    const image = container.querySelector('img');
    expect(image).toHaveClass('object-contain');
    if (!image) throw new Error('no image');
    fireEvent.error(image);
    expect(screen.getByText('no file')).toBeInTheDocument();
  });

  it('knows which stored files a browser can show', () => {
    expect(isPhotoUrl('https://a/b.jpg')).toBe(true);
    expect(isPhotoUrl('blob:https://a/1')).toBe(true);
    expect(isPhotoUrl('data:image/png;base64,AA')).toBe(true);
    expect(isPhotoUrl('organizations/o1/files/a.jpg')).toBe(false);
    expect(isPhotoUrl('javascript:alert(1)')).toBe(false);
  });
});
