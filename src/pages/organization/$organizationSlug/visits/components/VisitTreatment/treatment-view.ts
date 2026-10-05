import type { BodyPart, Room } from '@/shared/api/clinic/clinic-schema.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type { VisitDetail } from '@/shared/api/clinic/visits-contracts.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import type { VisitDraft } from '../../store/useVisitDraftStore/index.ts';

/** The settings a session's params carry that the table does not compare. */
const NOT_SETTINGS: ReadonlySet<string> = new Set(['type', 'areas']);

/** The rows a first session starts from (the skin template's settings). */
const FIRST_SETTINGS = ['machine', 'power'] as const;

/**
 * What the Treatment tab shows of a visit's session (KICKOFF §6.13;
 * `today.md:95–108`): today's session — recorded, or due — against the
 * package and the last session. Before the session is recorded the package
 * counts what came before; after, it counts today's too.
 */
export interface TreatmentView {
  /** "Laser hair reduction" — the session's, else the last one's, else the booking's service. */
  name: string;
  /** Today's session number: the package's next, else the last one's next. */
  session: number;
  /** The package's sessions; null without a package. */
  total: number | null;
  /** Sessions used before today. */
  usedBefore: number;
  /** Sessions left once today's is used. */
  left: number;
  /** The areas: the recorded session's, else the draft's, else the last session's. */
  areas: BodyPart[];
  /** The settings the table compares: the last session's, else the template's first ones. */
  settings: string[];
  /** Today's value of a setting: the recorded session's, else the draft's, else the last one's. */
  todayOf: (key: string) => string;
  /** Who does the session: the recorded one's therapist, else the booking's, else the last one's. */
  therapistId: string | null;
  /** The machine the session runs on (the template's `machine` param). */
  machine: string | null;
  room: Room | null;
}

/** A calendar date in the viewer's words ("28 Aug 2027", "Tue 29 Sep"). */
export function useCivilDay(): (
  date: string,
  options: Intl.DateTimeFormatOptions,
) => string {
  const { formatDate } = useLocaleFormat();
  return (date, options) => formatDate(localDateOf(date), options, { civilDay: true });
}

/** A pack bar segment: a session used, today's (outlined, before it is recorded), or one to come. */
export type PackSegment = 'used' | 'today' | 'later';

/** Which segment a session is — `used` counts today's once it is recorded. */
export function segmentOf(index: number, used: number, recorded: boolean): PackSegment {
  if (index < used) return 'used';
  return !recorded && index === used ? 'today' : 'later';
}

/** The detail the Treatment tab reads. */
type TreatmentDetail = Pick<
  VisitDetail,
  'pack' | 'treatment' | 'lastTreatment' | 'booking'
>;

/** Today's session number and the package's counts — today's used once recorded. */
function sessionCounts({
  pack,
  treatment,
  lastTreatment,
}: TreatmentDetail): Pick<TreatmentView, 'session' | 'total' | 'usedBefore' | 'left'> {
  if (!pack) {
    const session = treatment?.sessionNo ?? (lastTreatment?.sessionNo ?? 0) + 1;
    return { session, total: null, usedBefore: 0, left: 0 };
  }
  const usedBefore = pack.sessionsUsed - (treatment ? 1 : 0);
  return {
    session: treatment?.sessionNo ?? pack.sessionsUsed + 1,
    total: pack.sessionsTotal,
    usedBefore: Math.max(0, usedBefore),
    left: Math.max(0, pack.sessionsTotal - usedBefore - 1),
  };
}

/** The first of the values that is set, else null. */
function firstSet<T>(...values: readonly (T | null | undefined)[]): T | null {
  return values.find((value) => value !== null && value !== undefined) ?? null;
}

/** The session's name, who does it, its machine and room. */
function sessionSetting({
  pack,
  treatment,
  lastTreatment,
  booking,
}: TreatmentDetail): Pick<TreatmentView, 'name' | 'therapistId' | 'machine' | 'room'> {
  const source = treatment ?? lastTreatment;
  return {
    name: firstSet(source?.name, booking?.serviceLabel, pack?.name) ?? '',
    therapistId: firstSet(
      treatment?.therapistId,
      booking?.therapistId,
      lastTreatment?.therapistId,
    ),
    machine: source?.params.machine ?? null,
    room: booking?.room ?? null,
  };
}

/** The Treatment tab's view of a visit and its draft. */
export function treatmentView(
  detail: TreatmentDetail,
  draft: Pick<VisitDraft, 'settings' | 'areas'>,
): TreatmentView {
  const { treatment, lastTreatment } = detail;
  const settings = lastTreatment
    ? Object.keys(lastTreatment.params).filter((key) => !NOT_SETTINGS.has(key))
    : [...FIRST_SETTINGS];
  const todayOf = (key: string): string => {
    if (treatment) return treatment.params[key] ?? '';
    return draft.settings[key] ?? lastTreatment?.params[key] ?? '';
  };
  return {
    ...sessionCounts(detail),
    ...sessionSetting(detail),
    areas: treatment
      ? treatment.bodyParts
      : (draft.areas ?? lastTreatment?.bodyParts ?? []),
    settings,
    todayOf,
  };
}
