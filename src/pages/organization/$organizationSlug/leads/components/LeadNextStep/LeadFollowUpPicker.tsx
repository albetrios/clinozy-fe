import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { appToday } from '@/shared/api/app/app-time.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { TimePicker } from '@/shared/components/Picker/TimePicker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';

import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from '../../leads.constants.ts';
import {
  followUpInstant,
  type FollowUpParts,
  followUpPartsOf,
  followUpPicks,
} from './lead-follow-up.ts';

const K = LEADS_KEYS.drawer.nextStep.picker;

/** Props of {@link LeadFollowUpPicker}. */
export interface LeadFollowUpPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The follow-up as read (`follow_up_at`), or null. */
  value: string | null;
  /** The picked time, as the instant `follow_up_at` stores. */
  onSet: (followUpAt: string) => void;
  /** The control it opens from — the When chip, or Reopen — or, `asAnchor`, the line it sits on. */
  children: ReactNode;
  /** Opened only from the track (New has no chip): `children` is where it sits, not a control. */
  asAnchor?: boolean;
}

/**
 * "When to follow up?" (D25): the quick picks — Later today (while 5 pm is ahead), Tomorrow,
 * In 3 days, Next week, each at 11:00 but Later today — then the day and the clock to set any
 * other, and Set follow-up. It opens on the follow-up still ahead, else tomorrow at 11:00.
 */
export function LeadFollowUpPicker({
  open,
  onOpenChange,
  value,
  onSet,
  children,
  asAnchor = false,
}: LeadFollowUpPickerProps) {
  const { t } = useTranslation(LEADS_NS);
  const [parts, setParts] = useState<FollowUpParts>(() => followUpPartsOf(value));
  const [wasOpen, setWasOpen] = useState(open);
  // Each opening starts again from the lead's follow-up.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setParts(followUpPartsOf(value));
  }
  const id = LEADS_TEST_IDS.drawerFollowUp;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {asAnchor ? (
        <PopoverAnchor asChild>{children}</PopoverAnchor>
      ) : (
        <PopoverTrigger asChild>{children}</PopoverTrigger>
      )}
      <PopoverContent
        align="start"
        sideOffset={6}
        aria-label={t(K.title)}
        data-testid={id}
        className="flex w-[min(340px,calc(100vw-2rem))] flex-col gap-3 rounded-xl p-3.5 shadow-(--elevation-lg)"
      >
        <h4 className="text-field font-semibold">{t(K.title)}</h4>
        <div className="flex flex-wrap gap-1.5">
          {followUpPicks().map((pick) => {
            const picked =
              pick.parts.date === parts.date && pick.parts.time === parts.time;
            return (
              <Button
                key={pick.id}
                type="button"
                size="sm"
                variant={picked ? 'default' : 'secondary'}
                aria-pressed={picked}
                data-testid={`${id}-pick-${pick.id}`}
                onClick={() => setParts(pick.parts)}
              >
                {t(K[pick.id])}
              </Button>
            );
          })}
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">
          <DatePicker
            value={parts.date}
            onChange={(date) => {
              if (date) setParts((current) => ({ ...current, date }));
            }}
            label={t(K.date)}
            min={appToday()}
            size="md"
            testId={`${id}-date`}
          />
          <TimePicker
            value={parts.time}
            onChange={(time) => setParts((current) => ({ ...current, time }))}
            label={t(K.time)}
            from="07:00"
            to="21:00"
            size="md"
            testId={`${id}-time`}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t(K.cancel)}
          </Button>
          <Button
            type="button"
            size="sm"
            data-testid={`${id}-set`}
            onClick={() => onSet(followUpInstant(parts))}
          >
            {t(K.set)}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
