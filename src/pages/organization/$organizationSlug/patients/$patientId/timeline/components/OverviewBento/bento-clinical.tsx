import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import { DrawerInput } from '@/shared/components/DrawerField/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Stethoscope } from '@/shared/icons/index.ts';

import type { ClinicalLists } from '../../../shared/hooks/useClinicalLists/index.ts';
import { CLINICAL_LISTS } from '../../../shared/patient-clinical.ts';
import {
  TIMELINE_KEYS,
  TIMELINE_NS,
  TIMELINE_TEST_IDS,
} from '../../timeline.constants.ts';
import { BentoCard } from './bento-card.tsx';
import type { SmartNote } from './use-smart-note.ts';

const K = TIMELINE_KEYS.clinical;

/** The smart note's most (H:770 `maxLength`). */
const SMART_NOTE_MAX = 300;

/**
 * The four lists as panels (change-patient-overview-photos D9): each its dot,
 * its name and its count over its chips — a chip wraps to two lines rather
 * than being cut to one — or "Nothing added yet". One column, two from 480px
 * of the content column, four from 860px.
 */
function ClinicalGroups({ lists }: { lists: ClinicalLists }) {
  const { t } = useTranslation(TIMELINE_NS);
  return (
    <div className="grid grid-cols-1 gap-2 @min-[480px]:grid-cols-2 @min-[860px]:grid-cols-4">
      {CLINICAL_LISTS.map(({ field, tone }) => {
        const items = lists.items(field);
        return (
          <section
            key={field}
            aria-label={t(K.groups[field])}
            data-testid={TIMELINE_TEST_IDS.clinicalGroup(field)}
            className="bg-canvas flex min-w-0 flex-col gap-2 rounded-lg p-2.5"
          >
            <span className="text-caption text-muted-foreground-strong flex items-center gap-1.5 font-medium">
              <span
                aria-hidden="true"
                data-slot="pill"
                className={cn('size-1.5 flex-none rounded-full', TONE_CLASSES[tone].fill)}
              />
              <span className="min-w-0 truncate">{t(K.groups[field])}</span>
              {items.length > 0 ? (
                <span className="text-muted-foreground ms-auto tabular-nums">
                  {items.length}
                </span>
              ) : null}
            </span>
            {items.length > 0 ? (
              <ul className="flex flex-wrap gap-1">
                {items.map((item) => (
                  <li key={item.id} className="max-w-full min-w-0">
                    <TonePill
                      tone={tone}
                      title={item.text}
                      className="h-auto max-w-full py-0.5 leading-[1.35] whitespace-normal"
                    >
                      <span className="line-clamp-2 [overflow-wrap:anywhere] whitespace-normal">
                        {item.text}
                      </span>
                    </TonePill>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground text-xs">{t(K.empty)}</span>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * The Clinical card (the Overview's first row, full width; H:770, H:4989): the smart note — its
 * input and "Add", for a member who edits the patient — over the four lists
 * as panels: Complaints · Diagnosis · Suggested · Later, each its chips (the
 * patient's clinical notes, api-integration §5.4) or "Nothing added yet". Bars while the
 * notes load; their failed read says so with Retry, and the smart note waits
 * for them. None of it for a member who may not read the clinical record.
 */
export function ClinicalBentoCard({
  lists,
  smart,
  onOpen,
}: {
  lists: ClinicalLists;
  /** The smart note; none for a member who only reads the patient. */
  smart: SmartNote | null;
  onOpen: (() => void) | null;
}) {
  const { t } = useTranslation(TIMELINE_NS);
  if (!lists.readable) return null;
  const title = t(TIMELINE_KEYS.cards.clinical);
  const loaded = !(lists.isLoading || lists.isError);
  return (
    <BentoCard card="clinical" title={title} icon={Stethoscope} onOpen={onOpen}>
      {smart && loaded ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void smart.apply();
          }}
        >
          <DrawerInput
            value={smart.note}
            onChange={(event) => smart.setNote(event.target.value)}
            maxLength={SMART_NOTE_MAX}
            placeholder={t(K.smartPlaceholder, { example: t(K.smartExample) })}
            aria-label={t(K.smartLabel)}
            data-testid={TIMELINE_TEST_IDS.smartInput}
            className="bg-canvas min-w-0 flex-1 px-3"
          />
          <Button
            type="submit"
            data-testid={TIMELINE_TEST_IDS.smartAdd}
            className="text-body h-9 flex-none rounded-lg px-3.5"
          >
            {t(K.add)}
          </Button>
        </form>
      ) : null}
      {lists.isLoading ? <SkeletonRows rows={2} label={title} /> : null}
      {lists.isError ? (
        <RetryError
          message={t(ERRORS_KEYS.frontend.query.loadFailed, { ns: ERRORS_NS })}
          onRetry={lists.retry}
        />
      ) : null}
      {loaded ? <ClinicalGroups lists={lists} /> : null}
    </BentoCard>
  );
}
