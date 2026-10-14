import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { PatientPhoto } from '@/shared/api/app/patient-images-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import { photoDouble } from '../../__tests__/integration/photo-api-double.ts';
import { PhotoCompare } from './PhotoCompare.tsx';

const read = vi.hoisted(() => ({
  photos: [] as PatientPhoto[],
  pending: [] as string[],
}));
vi.mock('@/shared/hooks/usePatientPhotos/index.ts', () => ({
  usePatientPhotosByIds: () => ({ photos: read.photos, pending: read.pending }),
}));
vi.mock('../../../shared/patient-file-context.ts', () => ({
  usePatientFileContext: () => ({ patientId: 'pat_priya0000000000000000' }),
}));
const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

const photo = (id: string, takenOn: string, overrides: Partial<PatientPhoto> = {}) =>
  photoDouble({ id, displayName: id, takenOn, ...overrides });

function renderCompare(ids: readonly string[]) {
  const handlers = { onRemove: vi.fn(), onClose: vi.fn() };
  const view = render(
    <PhotoCompare ids={ids} dayLabel={(date) => `day ${date}`} {...handlers} />,
  );
  return { ...view, ...handlers };
}

beforeEach(() => {
  viewport.tier = 'desktop';
  read.pending = [];
});

describe('PhotoCompare', () => {
  it('lays the photos out oldest first with their place, day and distance from the first', async () => {
    read.photos = [
      photo('pimg_c', '2026-09-24', { stage: 'after', bodyPart: 'face' }),
      photo('pimg_a', '2026-09-03', { stage: 'before' }),
    ];
    renderCompare(['pimg_c', 'pimg_a']);
    const compare = await screen.findByTestId('patient-photo-compare');
    expect(within(compare).getByText('Compare photos')).toBeInTheDocument();
    expect(compare).toHaveTextContent('2 photos · day 2026-09-03 – day 2026-09-24');
    const panels = within(compare).getAllByTestId('patient-photo-compare-panel');
    expect(panels.map((panel) => panel.getAttribute('data-photo'))).toEqual([
      'pimg_a',
      'pimg_c',
    ]);
    expect(panels[1]).toHaveTextContent('+21 days');
    expect(panels[1]).toHaveTextContent('After');
    // Two photos: one row, no layout switch, no ×.
    expect(
      within(compare).queryByTestId('patient-photo-compare-layout'),
    ).not.toBeInTheDocument();
    expect(
      within(compare).queryByTestId('patient-photo-compare-remove'),
    ).not.toBeInTheDocument();
    expect(await axe(compare)).toHaveNoViolations();
  });

  it('holds a panel for a photo still being read', async () => {
    read.photos = [photo('pimg_a', '2026-09-03')];
    read.pending = ['pimg_b'];
    renderCompare(['pimg_a', 'pimg_b']);
    expect(
      await screen.findByTestId('patient-photo-compare-pending'),
    ).toBeInTheDocument();
  });

  it('removes a photo, zooms with the keys and closes', async () => {
    const user = userEvent.setup();
    read.photos = ['a', 'b', 'c'].map((id, index) =>
      photo(`pimg_${id}`, `2026-09-0${index + 1}`),
    );
    const { onRemove, onClose } = renderCompare(['pimg_a', 'pimg_b', 'pimg_c']);
    const compare = await screen.findByTestId('patient-photo-compare');
    const [remove] = within(compare).getAllByTestId('patient-photo-compare-remove');
    await user.click(remove!);
    expect(onRemove).toHaveBeenCalledWith('pimg_a');
    compare.focus();
    await user.keyboard('+');
    expect(
      within(compare).getByTestId('patient-photo-compare-zoom-reset'),
    ).toHaveTextContent('125%');
    await user.keyboard('0');
    expect(
      within(compare).getByTestId('patient-photo-compare-zoom-reset'),
    ).toHaveTextContent('100%');
    await user.click(within(compare).getByTestId('patient-photo-compare-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows two columns on a phone', async () => {
    viewport.tier = 'phone';
    read.photos = ['a', 'b', 'c', 'd'].map((id) => photo(`pimg_${id}`, '2026-09-03'));
    renderCompare(['pimg_a', 'pimg_b', 'pimg_c', 'pimg_d']);
    expect(await screen.findByTestId('patient-photo-compare-stage')).toHaveAttribute(
      'data-columns',
      '2',
    );
  });
});
