import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import { DrawerInput } from '@/shared/components/DrawerField/index.ts';
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
 * The Clinical card (two columns wide; H:770, H:4989): the smart note — its
 * input and "Add", for a member who edits the patient — over the four lists
 * as groups: Complaints · Diagnosis · Suggested · Later, each its chips or
 * "—".
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
  return (
    <BentoCard
      card="clinical"
      title={t(TIMELINE_KEYS.cards.clinical)}
      icon={Stethoscope}
      wide
      onOpen={onOpen}
    >
      {smart ? (
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-4 gap-y-3">
        {CLINICAL_LISTS.map(({ field, tone }) => {
          const items = lists.items(field);
          return (
            <div key={field} className="flex min-w-0 flex-col gap-1.5">
              <span className="text-caption text-muted-foreground flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn('size-1.5 rounded-full', TONE_CLASSES[tone].fill)}
                />
                {t(K.groups[field])}
              </span>
              <div className="flex flex-wrap gap-1">
                {items.length > 0 ? (
                  items.map((item) => (
                    <TonePill key={item} tone={tone} className="max-w-full truncate">
                      {item}
                    </TonePill>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}
