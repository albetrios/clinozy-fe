import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { PatientPhoto } from '@/shared/api/app/patient-images-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

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
  useDevicePrefsStore.setState({
    photoCompareZoom: 'linked',
    photoCompareLayout: null,
    photoCompareFramings: {},
  });
});

/** A panel's photo transform: its zoom and its pan (a percentage of the panel). */
function framingOf(compare: HTMLElement, photoId: string) {
  const panel = within(compare)
    .getAllByTestId('patient-photo-compare-panel')
    .find((candidate) => candidate.getAttribute('data-photo') === photoId);
  const box = panel?.querySelector<HTMLElement>('[style]');
  return {
    zoom: box?.style.getPropertyValue('--photo-zoom'),
    x: box?.style.getPropertyValue('--photo-x'),
    y: box?.style.getPropertyValue('--photo-y'),
  };
}

const threePhotos = () =>
  ['a', 'b', 'c'].map((id, index) => photo(`pimg_${id}`, `2026-09-0${index + 1}`));

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

  it('opens Linked: the bar zooms every photo, no photo has its own group', async () => {
    const user = userEvent.setup();
    read.photos = threePhotos();
    renderCompare(['pimg_a', 'pimg_b', 'pimg_c']);
    const compare = await screen.findByTestId('patient-photo-compare');
    expect(compare).toHaveAttribute('data-zoom', 'linked');
    expect(within(compare).getByRole('radio', { name: 'Linked' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(
      within(compare).queryByTestId('patient-photo-compare-panel-zoom-in'),
    ).not.toBeInTheDocument();
    await user.click(within(compare).getByTestId('patient-photo-compare-zoom-in'));
    expect(
      ['pimg_a', 'pimg_b', 'pimg_c'].map((id) => framingOf(compare, id).zoom),
    ).toEqual(['1.25', '1.25', '1.25']);
  });

  it('Separate: each photo zooms on its own, Reset all brings them back', async () => {
    const user = userEvent.setup();
    read.photos = threePhotos();
    renderCompare(['pimg_a', 'pimg_b', 'pimg_c']);
    const compare = await screen.findByTestId('patient-photo-compare');
    await user.click(
      within(compare).getByTestId('patient-photo-compare-zoom-mode-separate'),
    );
    expect(useDevicePrefsStore.getState().photoCompareZoom).toBe('separate');
    expect(
      within(compare).queryByTestId('patient-photo-compare-zoom-in'),
    ).not.toBeInTheDocument();
    const resetAll = within(compare).getByTestId('patient-photo-compare-reset-all');
    expect(resetAll).toBeDisabled();
    const groups = within(compare).getAllByRole('group', { name: /^Zoom of / });
    expect(groups).toHaveLength(3);
    await user.click(within(groups[1]!).getByRole('button', { name: 'Zoom in' }));
    expect(framingOf(compare, 'pimg_a').zoom).toBe('1');
    expect(framingOf(compare, 'pimg_b').zoom).toBe('1.25');
    expect(
      within(groups[1]!).getByTestId('patient-photo-compare-panel-zoom-reset'),
    ).toHaveTextContent('125%');
    // A wheel on one photo moves that photo only.
    const stage = within(compare)
      .getAllByTestId('patient-photo-compare-panel')[2]!
      .querySelector<HTMLElement>('.touch-none');
    fireEvent.wheel(stage!, { deltaY: -100 });
    expect(framingOf(compare, 'pimg_c').zoom).toBe('1.12');
    expect(framingOf(compare, 'pimg_a').zoom).toBe('1');
    await user.click(resetAll);
    expect(
      ['pimg_a', 'pimg_b', 'pimg_c'].map((id) => framingOf(compare, id).zoom),
    ).toEqual(['1', '1', '1']);
  });

  it('keeps the alignment when Separate turns Linked: each photo zooms from its own level', async () => {
    const user = userEvent.setup();
    read.photos = threePhotos();
    renderCompare(['pimg_a', 'pimg_b', 'pimg_c']);
    const compare = await screen.findByTestId('patient-photo-compare');
    await user.click(
      within(compare).getByTestId('patient-photo-compare-zoom-mode-separate'),
    );
    const [, second] = within(compare).getAllByRole('group', { name: /^Zoom of / });
    await user.click(within(second!).getByRole('button', { name: 'Zoom in' }));
    await user.click(
      within(compare).getByTestId('patient-photo-compare-zoom-mode-linked'),
    );
    // The bar shows the first photo's level.
    expect(
      within(compare).getByTestId('patient-photo-compare-zoom-reset'),
    ).toHaveTextContent('100%');
    compare.focus();
    await user.keyboard('+');
    expect(
      ['pimg_a', 'pimg_b', 'pimg_c'].map((id) => framingOf(compare, id).zoom),
    ).toEqual(['1.25', '1.56', '1.25']);
  });

  it('remembers where each photo stands, the mode and the layout, for the next opening', async () => {
    const user = userEvent.setup();
    read.photos = threePhotos();
    const first = renderCompare(['pimg_a', 'pimg_b', 'pimg_c']);
    let compare = await screen.findByTestId('patient-photo-compare');
    await user.click(
      within(compare).getByTestId('patient-photo-compare-zoom-mode-separate'),
    );
    await user.click(within(compare).getByTestId('patient-photo-compare-layout-grid'));
    const [, second] = within(compare).getAllByRole('group', { name: /^Zoom of / });
    await user.click(within(second!).getByRole('button', { name: 'Zoom in' }));
    first.unmount();
    expect(useDevicePrefsStore.getState().photoCompareFramings).toEqual({
      'pimg_a,pimg_b,pimg_c': { pimg_b: { zoom: 1.25, x: 0, y: 0 } },
    });
    // The same photos, picked in another order.
    renderCompare(['pimg_c', 'pimg_a', 'pimg_b']);
    compare = await screen.findByTestId('patient-photo-compare');
    expect(compare).toHaveAttribute('data-zoom', 'separate');
    expect(compare).toHaveAttribute('data-layout', 'grid');
    expect(framingOf(compare, 'pimg_b').zoom).toBe('1.25');
    expect(framingOf(compare, 'pimg_a').zoom).toBe('1');
  });

  it('places a remembered pan as a share of the panel, and drags by that share', async () => {
    read.photos = threePhotos();
    useDevicePrefsStore.setState({
      photoCompareZoom: 'separate',
      photoCompareFramings: {
        'pimg_a,pimg_b,pimg_c': { pimg_a: { zoom: 2, x: 0.25, y: -0.1 } },
      },
    });
    renderCompare(['pimg_a', 'pimg_b', 'pimg_c']);
    const compare = await screen.findByTestId('patient-photo-compare');
    expect(framingOf(compare, 'pimg_a')).toEqual({ zoom: '2', x: '25%', y: '-10%' });
    const stage = within(compare)
      .getAllByTestId('patient-photo-compare-panel')[0]!
      .querySelector<HTMLElement>('.touch-none')!;
    Object.defineProperties(stage, {
      clientWidth: { value: 400, configurable: true },
      clientHeight: { value: 200, configurable: true },
    });
    act(() => {
      fireEvent.pointerDown(stage, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
      });
      fireEvent.pointerMove(stage, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 100,
        clientY: 20,
      });
    });
    expect(framingOf(compare, 'pimg_a')).toEqual({ zoom: '2', x: '50%', y: '0%' });
    // Mid-drag nothing is written; at rest it is.
    expect(
      useDevicePrefsStore.getState().photoCompareFramings['pimg_a,pimg_b,pimg_c'],
    ).toEqual({
      pimg_a: { zoom: 2, x: 0.25, y: -0.1 },
    });
    act(() => {
      fireEvent.pointerUp(stage, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 100,
        clientY: 20,
      });
    });
    expect(
      useDevicePrefsStore.getState().photoCompareFramings['pimg_a,pimg_b,pimg_c'],
    ).toEqual({
      pimg_a: { zoom: 2, x: 0.5, y: 0 },
    });
  });

  it('names the modes in words, explains each, and leaves Reset all off a phone', async () => {
    const user = userEvent.setup();
    viewport.tier = 'phone';
    read.photos = threePhotos();
    renderCompare(['pimg_a', 'pimg_b', 'pimg_c']);
    const compare = await screen.findByTestId('patient-photo-compare');
    const separate = within(compare).getByRole('radio', { name: 'Separate' });
    expect(separate).toHaveAttribute('title', 'Zoom and place each photo on its own');
    expect(within(compare).getByRole('radio', { name: 'Linked' })).toHaveAttribute(
      'title',
      'Every photo follows the same zoom and position',
    );
    await user.click(separate);
    expect(within(compare).getByTestId('patient-photo-compare-reset-all')).toHaveClass(
      'max-md:hidden',
    );
    expect(await axe(compare)).toHaveNoViolations();
  });
});
