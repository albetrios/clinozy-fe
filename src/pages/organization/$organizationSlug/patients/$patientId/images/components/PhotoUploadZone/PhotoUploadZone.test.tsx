import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PhotoUploadZone } from './PhotoUploadZone.tsx';

describe('PhotoUploadZone', () => {
  it('says how to upload and where to, with Choose photos and Take photo', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const onCamera = vi.fn();
    const { container } = render(
      <PhotoUploadZone
        variant="strip"
        album="General"
        onChoose={onChoose}
        onCamera={onCamera}
      />,
    );
    const strip = screen.getByTestId('patient-photos-upload');
    expect(strip).toHaveTextContent('Drop photos here');
    expect(strip).toHaveTextContent(
      'or paste a copied image · JPG or PNG up to 10 MB · Adds to General',
    );
    await user.click(screen.getByTestId('patient-photos-choose'));
    expect(onChoose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId('patient-photos-take'));
    expect(onCamera).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the touch-only Take photo through a coarse-pointer class', () => {
    render(
      <PhotoUploadZone
        variant="strip"
        album="General"
        onChoose={vi.fn()}
        onCamera={vi.fn()}
      />,
    );
    expect(screen.getByTestId('patient-photos-take').className).toContain(
      '[@media(pointer:coarse)]:inline-flex',
    );
  });

  it('turns the empty album into the drop zone', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const { container } = render(
      <PhotoUploadZone
        variant="empty"
        album="LHR"
        onChoose={onChoose}
        onCamera={vi.fn()}
      />,
    );
    const zone = screen.getByTestId('patient-photos-empty');
    expect(zone).toHaveTextContent('No photos in LHR yet');
    expect(zone).toHaveTextContent('Adds to LHR');
    await user.click(screen.getByRole('button', { name: 'Choose photos' }));
    expect(onChoose).toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });
});
