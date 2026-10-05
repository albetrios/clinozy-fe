import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  BODY_PART_VALUES,
  type BodyPart,
  type Room,
} from '@/shared/api/clinic/clinic-schema.ts';
import {
  VISIT_SETTING_MAX,
  type VisitPack,
} from '@/shared/api/clinic/visits-contracts.ts';
import { Input } from '@/shared/components/ui/input.tsx';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';

import { VISIT_KEYS, VISIT_NS, VISIT_TEST_IDS } from '../../visits.constants.ts';
import {
  type PackSegment,
  segmentOf,
  type TreatmentView,
  useCivilDay,
} from './treatment-view.ts';

const K = VISIT_KEYS.treatment;
const ids = VISIT_TEST_IDS.treatment;

/** Each stored room's name — Today's own words (`card.rooms`, the same namespace). */
const ROOM_KEYS: Readonly<Partial<Record<Room, string>>> = {
  room_1: 'card.rooms.roomOne',
  room_2: 'card.rooms.roomTwo',
  laser_room: 'card.rooms.laserRoom',
};

/** The pack bar's segments (H:2586): used sage, today outlined 1.5px sage, the rest grey. */
const SEGMENT: Readonly<Record<PackSegment, string>> = {
  used: 'bg-tone-sage-dot',
  today: 'border-tone-sage-dot border-[1.5px]',
  later: 'bg-border',
};

/**
 * The session's head (H:2583–2590): "<treatment> · <areas>" (16px/600) with
 * "<therapist> · <machine> · <room>"; with a package, its bar — one segment a
 * session: used sage, today outlined, the rest grey — and its line; the
 * doctor's instruction (the consult's plan) when there is one.
 */
export function SessionHead({
  view,
  pack,
  recorded,
  therapist,
  instruction,
}: {
  view: TreatmentView;
  pack: VisitPack | null;
  recorded: boolean;
  therapist: string | null;
  instruction: string | null;
}) {
  const { t } = useTranslation(VISIT_NS);
  const clock = useClinicClock();
  const civilDay = useCivilDay();
  const roomKey = view.room ? ROOM_KEYS[view.room] : undefined;
  const team = [therapist, view.machine, roomKey ? t(roomKey) : null]
    .filter(Boolean)
    .join(' · ');
  const title =
    view.areas.length > 0
      ? t(K.title, {
          treatment: view.name,
          area: view.areas.map((part) => t(K.bodyParts[part])).join(', '),
        })
      : view.name;
  const used = pack?.sessionsUsed ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-heading text-base font-semibold tracking-[-0.02em]">
          {title}
        </h3>
        {team ? (
          <span className="text-detail text-muted-foreground-strong">{team}</span>
        ) : null}
      </div>
      {pack ? (
        <>
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: pack.sessionsTotal }, (_, index) => index + 1).map(
              (session) => {
                const segment = segmentOf(session - 1, used, recorded);
                return (
                  <span
                    key={session}
                    data-segment={segment}
                    className={cn('h-2 flex-1 rounded-lg', SEGMENT[segment])}
                  />
                );
              },
            )}
          </div>
          <p className="text-detail text-foreground-soft">
            {t(K.pack, {
              total: pack.sessionsTotal,
              bought: clock.date(pack.soldOn),
              used: view.usedBefore,
              session: view.session,
              until: civilDay(pack.validUntil, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
            })}
          </p>
        </>
      ) : null}
      {instruction ? (
        <p className="bg-canvas text-detail rounded-lg border px-3 py-2.5 leading-[1.5]">
          <span className="font-medium">{t(K.instruction)}</span> {instruction}
        </p>
      ) : null}
    </>
  );
}

/** A setting's label: the template's word when the sheet has one, else its key. */
function useSettingLabel() {
  const { t } = useTranslation(VISIT_NS);
  return (key: string) =>
    key in K.settings ? t(K.settings[key as keyof typeof K.settings]) : key;
}

/**
 * The settings table (H:2592–2598): "Setting · Session <k−1> · Today" — the
 * last session's values and today's 90px inputs (≤ 20), read-only once the
 * session is recorded.
 */
export function SettingsTable({
  view,
  lastSession,
  lastValue,
  readOnly,
  onChange,
}: {
  view: TreatmentView;
  lastSession: number | null;
  lastValue: (key: string) => string | null;
  readOnly: boolean;
  onChange: (key: string, value: string) => void;
}) {
  const { t } = useTranslation(VISIT_NS);
  const settingLabel = useSettingLabel();
  return (
    <table className="text-detail w-full border-collapse tabular-nums">
      <thead>
        <tr className="text-muted-foreground-strong">
          <th scope="col" className="border-b py-1.25 text-start font-medium">
            {t(K.setting)}
          </th>
          <th scope="col" className="border-b py-1.25 text-start font-medium">
            {lastSession === null ? '' : t(K.session, { session: lastSession })}
          </th>
          <th scope="col" className="border-b py-1.25 text-start font-medium">
            {t(K.today)}
          </th>
        </tr>
      </thead>
      <tbody>
        {view.settings.map((key) => (
          <tr key={key}>
            <th scope="row" className="border-b py-1.5 text-start font-normal">
              {settingLabel(key)}
            </th>
            <td className="border-b">{lastValue(key) ?? '—'}</td>
            <td className="border-b py-1">
              <Input
                value={view.todayOf(key)}
                maxLength={VISIT_SETTING_MAX}
                disabled={readOnly}
                aria-label={t(K.settingToday, { setting: settingLabel(key) })}
                onChange={(event) => onChange(key, event.target.value)}
                data-testid={ids.setting(key)}
                className="bg-canvas dark:bg-canvas text-detail md:text-detail border-border h-auto w-[90px] rounded-lg px-1.5 py-0.75 shadow-none disabled:opacity-100"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** "Areas treated" (H:2599–2601): the contract's body parts as pills, picked sage (`S:409`). */
export function AreaPills({
  areas,
  readOnly,
  onChange,
}: {
  areas: readonly BodyPart[];
  readOnly: boolean;
  onChange: (areas: BodyPart[]) => void;
}) {
  const { t } = useTranslation(VISIT_NS);
  return (
    <div
      className="flex flex-wrap items-center gap-1.25"
      role="group"
      aria-label={t(K.areas)}
    >
      <span className="text-muted-foreground-strong text-xs">{t(K.areas)}</span>
      {BODY_PART_VALUES.map((part) => {
        const on = areas.includes(part);
        return (
          <button
            key={part}
            type="button"
            aria-pressed={on}
            disabled={readOnly}
            onClick={() =>
              onChange(on ? areas.filter((value) => value !== part) : [...areas, part])
            }
            data-testid={ids.area}
            data-value={part}
            data-slot="pill"
            className={cn(
              'rounded-full border px-2.5 py-0.75 text-xs disabled:cursor-default',
              on
                ? 'bg-tone-sage border-tone-sage-border text-tone-sage-foreground'
                : 'text-foreground bg-transparent',
            )}
          >
            {t(K.bodyParts[part])}
          </button>
        );
      })}
    </div>
  );
}
