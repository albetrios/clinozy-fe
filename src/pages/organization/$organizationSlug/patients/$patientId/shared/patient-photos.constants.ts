import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type {
  PatientPhotoBodyPart,
  PatientPhotoStage,
} from '@/shared/api/clinic/patient-images-contracts.ts';

/** The patient's photos read the patient file's namespace. */
export const PATIENT_PHOTOS_NS = I18N_NAMESPACES.patientFile;

/**
 * The Photos section, the photo viewer and Photo details (`patient-file.md:59–68,
 * 317–331`; KICKOFF §6.6), verbatim; plurals for the counts.
 */
export const PATIENT_PHOTOS_KEYS = {
  albums: {
    general: 'photos.albums.general',
    private: 'photos.albums.private',
    lhr: 'photos.albums.lhr',
  },
  /** "Albums" — the tab strip's name. */
  albumTabs: 'photos.albumTabs',
  /** "3 photos" (plural). */
  count: 'photos.count',
  visitFilter: {
    label: 'photos.visitFilter.label',
    all: 'photos.visitFilter.all',
    /** "3 in General". */
    allSub: 'photos.visitFilter.allSub',
    none: 'photos.visitFilter.none',
    noneSub: 'photos.visitFilter.noneSub',
    /** "24 Sep · Hydrafacial". */
    visit: 'photos.visitFilter.visit',
    /** "#2790 · Completed". */
    visitSub: 'photos.visitFilter.visitSub',
  },
  sizes: {
    label: 'photos.sizes.label',
    small: 'photos.sizes.small',
    medium: 'photos.sizes.medium',
    large: 'photos.sizes.large',
    smallShort: 'photos.sizes.smallShort',
    mediumShort: 'photos.sizes.mediumShort',
    largeShort: 'photos.sizes.largeShort',
  },
  /** "Loading photos" — the skeleton's spoken label. */
  loading: 'photos.loading',
  tile: {
    /** "Open IMG_5100". */
    open: 'photos.tile.open',
    edit: 'photos.tile.edit',
    editHint: 'photos.tile.editHint',
    delete: 'photos.tile.delete',
  },
  /** "Load more · 4 left" (plural). */
  loadMore: 'photos.loadMore',
  empty: {
    /** "No photos in General yet". */
    title: 'photos.empty.title',
    body: 'photos.empty.body',
  },
  upload: 'photos.upload',
  /** "Drop image files" — a drop with no image in it. */
  notImages: 'photos.notImages',
  /** "2 photos uploaded to General" (plural). */
  uploaded: 'photos.uploaded',
  delete: {
    title: 'photos.delete.title',
    reasons: {
      wrongPatient: 'photos.delete.reasons.wrongPatient',
      blurry: 'photos.delete.reasons.blurry',
      duplicate: 'photos.delete.reasons.duplicate',
      other: 'photos.delete.reasons.other',
    },
    deleted: 'photos.delete.deleted',
  },
  /** The API's fifteen `body_part` values (M33), each by its own key. */
  bodyParts: {
    face: 'photos.bodyParts.face',
    upper_lip: 'photos.bodyParts.upperLip',
    chin: 'photos.bodyParts.chin',
    neck: 'photos.bodyParts.neck',
    scalp: 'photos.bodyParts.scalp',
    hair: 'photos.bodyParts.hair',
    chest: 'photos.bodyParts.chest',
    back: 'photos.bodyParts.back',
    underarm: 'photos.bodyParts.underarm',
    arms: 'photos.bodyParts.arms',
    hands: 'photos.bodyParts.hands',
    legs: 'photos.bodyParts.legs',
    body: 'photos.bodyParts.body',
    full_body: 'photos.bodyParts.fullBody',
    other: 'photos.bodyParts.other',
  } satisfies Readonly<Record<PatientPhotoBodyPart, string>>,
  /** Before / After (`stage`). */
  stages: {
    before: 'photos.stages.before',
    after: 'photos.stages.after',
  } satisfies Readonly<Record<PatientPhotoStage, string>>,
  viewer: {
    label: 'photos.viewer.label',
    /** "2 of 6". */
    position: 'photos.viewer.position',
    close: 'photos.viewer.close',
    closeHint: 'photos.viewer.closeHint',
    previous: 'photos.viewer.previous',
    previousHint: 'photos.viewer.previousHint',
    next: 'photos.viewer.next',
    nextHint: 'photos.viewer.nextHint',
    zoom: 'photos.viewer.zoom',
    zoomOut: 'photos.viewer.zoomOut',
    zoomOutHint: 'photos.viewer.zoomOutHint',
    zoomIn: 'photos.viewer.zoomIn',
    zoomInHint: 'photos.viewer.zoomInHint',
    zoomReset: 'photos.viewer.zoomReset',
    hints: {
      browse: 'photos.viewer.hints.browse',
      zoom: 'photos.viewer.hints.zoom',
      pan: 'photos.viewer.hints.pan',
      close: 'photos.viewer.hints.close',
    },
    /** "Preview not available" — the stage shows the file's name when its link is gone or fails (D86). */
    missing: 'photos.viewer.missing',
    /** "Photo" — the record in "Photo not found · it may have been deleted". */
    notFoundRecord: 'photos.viewer.notFoundRecord',
  },
  details: {
    title: 'photos.details.title',
    sub: 'photos.details.sub',
    name: 'photos.details.name',
    namePlaceholder: 'photos.details.namePlaceholder',
    date: 'photos.details.date',
    album: 'photos.details.album',
    bodyPart: 'photos.details.bodyPart',
    stage: 'photos.details.stage',
    optional: 'photos.details.optional',
    visit: 'photos.details.visit',
    visitHint: 'photos.details.visitHint',
    notAttached: 'photos.details.notAttached',
    save: 'photos.details.save',
    saved: 'photos.details.saved',
  },
} as const;
