import type { PatientPhoto } from '@/shared/api/app/patient-images-contracts.ts';
import type {
  PhotoCompareLayout,
  PhotoCompareZoom,
} from '@/shared/store/useDevicePrefsStore/index.ts';

/** The comparison's layouts, in the switch's order. */
export const PHOTO_COMPARE_LAYOUTS: readonly PhotoCompareLayout[] = ['row', 'grid'];

/** The comparison's zoom modes, in the switch's order (change-photo-compare-zoom D6–D7). */
export const PHOTO_COMPARE_ZOOMS: readonly PhotoCompareZoom[] = ['linked', 'separate'];

/**
 * The key a comparison is remembered under (change-photo-compare-zoom D9): its
 * photo ids sorted, so the same photos — in any order, from any selection —
 * reopen as they were left.
 */
export function photoCompareKey(ids: readonly string[]): string {
  return [...ids].sort((a, b) => a.localeCompare(b)).join(',');
}

/** Up to this many photos open in one row; more open as a grid (`BRIEF.md:41–42`). */
const ROW_MOST = 4;

/** Days between two civil dates (`YYYY-MM-DD`), by the calendar — never a clock. */
export function daysBetween(from: string, to: string): number {
  const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
  return Math.round(day(to) - day(from));
}

/**
 * The photos in the comparison's order (change-patient-overview-photos D13): by
 * the day each was taken, oldest first, so the row reads as progress; photos of
 * one day keep the order they were picked in.
 */
export function comparisonOrder(photos: readonly PatientPhoto[]): PatientPhoto[] {
  return photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => a.photo.takenOn.localeCompare(b.photo.takenOn) || a.index - b.index)
    .map(({ photo }) => photo);
}

/** The layout a comparison opens in: one row up to four photos, a grid from five. */
export function defaultCompareLayout(count: number): PhotoCompareLayout {
  return count <= ROW_MOST ? 'row' : 'grid';
}

/**
 * How many columns the comparison draws: one row → every photo side by side; a
 * grid → two columns up to four photos, three up to six, four up to eight; a
 * phone → at most two, whatever the layout.
 */
export function compareColumns({
  count,
  layout,
  narrow,
}: {
  count: number;
  layout: PhotoCompareLayout;
  narrow: boolean;
}): number {
  const shown = Math.max(count, 1);
  if (narrow) return Math.min(shown, 2);
  if (layout === 'row') return shown;
  if (shown <= 4) return Math.min(shown, 2);
  if (shown <= 6) return 3;
  return 4;
}
