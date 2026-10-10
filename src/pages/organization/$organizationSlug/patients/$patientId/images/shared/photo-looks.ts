import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  PatientPhotoBodyPart,
  PatientPhotoStage,
} from '@/shared/api/clinic/patient-images-contracts.ts';
import { type AppIcon, ImageIcon, Lock, Sparkles } from '@/shared/icons/index.ts';
import type { PhotoSize } from '@/shared/store/useDevicePrefsStore/index.ts';

import type { PhotoAlbum } from '../images.search.ts';

/**
 * Each album's tab icon (H:828 `seg`: `img`, `lock`, `sparkles`) and its
 * Photo details chip tone (General stone · Private lav · LHR blush).
 */
export const PHOTO_ALBUM_LOOK: Readonly<
  Record<PhotoAlbum, { icon: AppIcon; tone: Tone }>
> = {
  general: { icon: ImageIcon, tone: 'stone' },
  private: { icon: Lock, tone: 'lav' },
  lhr: { icon: Sparkles, tone: 'blush' },
};

/**
 * A body part's pill tone (H:4766 `PT_PT`): Face lav, Chest sky, Underarm
 * blush, Legs mint, Arms sage, Back and Scalp butter; the rest stone — the
 * API's fifteen parts (M33) include the ones the design has no tone for.
 */
export const PHOTO_BODY_PART_TONES: Readonly<Record<PatientPhotoBodyPart, Tone>> = {
  face: 'lav',
  upper_lip: 'stone',
  chin: 'stone',
  neck: 'stone',
  scalp: 'butter',
  hair: 'stone',
  chest: 'sky',
  back: 'butter',
  underarm: 'blush',
  arms: 'sage',
  hands: 'stone',
  legs: 'mint',
  body: 'stone',
  full_body: 'stone',
  other: 'stone',
};

/** Each stage's pill and chip tone: Before butter, After mint (the design has no stage). */
export const PHOTO_STAGE_TONES: Readonly<Record<PatientPhotoStage, Tone>> = {
  before: 'butter',
  after: 'mint',
};

/** The thumbnail sizes, in the radios' order. */
export const PHOTO_SIZES: readonly PhotoSize[] = ['small', 'medium', 'large'];

/** One thumbnail size's look, as full literals so Tailwind sees each one. */
export interface PhotoSizeLook {
  /** The grid: `repeat(auto-fill, minmax(<tile>, 1fr))` and its gap. */
  grid: string;
  /** The caption bar's padding. */
  bar: string;
  name: string;
  date: string;
  /** Edit and Delete on the tile — at M and L only. */
  actions: boolean;
  /** The radio's letter size. */
  letter: string;
}

/**
 * S / M / L (H:4766 `SZC`): 110px tiles gap 6, 160px gap 10 (default), 230px
 * gap 12; the bar's padding and type step up with them.
 */
export const PHOTO_SIZE_LOOK: Readonly<Record<PhotoSize, PhotoSizeLook>> = {
  small: {
    grid: 'grid-cols-[repeat(auto-fill,minmax(6.875rem,1fr))] gap-1.5',
    bar: 'px-1.5 pt-3.5 pb-1.25',
    name: 'text-tiny',
    date: 'text-[length:calc(var(--text-xs)*19/24)]',
    actions: false,
    letter: 'text-tiny',
  },
  medium: {
    grid: 'grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2.5',
    bar: 'px-2 pt-4.5 pb-1.75',
    name: 'text-xs',
    date: 'text-tiny',
    actions: true,
    letter: 'text-caption',
  },
  large: {
    grid: 'grid-cols-[repeat(auto-fill,minmax(14.375rem,1fr))] gap-3',
    bar: 'px-2.5 pt-5.5 pb-2.25',
    name: 'text-body',
    date: 'text-caption',
    actions: true,
    letter: 'text-detail',
  },
};
