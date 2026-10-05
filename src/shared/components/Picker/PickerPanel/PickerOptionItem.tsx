import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { PersonAvatar } from '@/shared/components/Cells/PersonAvatar/index.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { keepFocus } from '@/shared/components/Picker/picker-dom.ts';
import type { PickerOptionRow } from '@/shared/components/Picker/picker-rows.ts';
import { PickerDot, PickerIconTile } from '@/shared/components/Picker/picker-visuals.tsx';
import { CommandItem } from '@/shared/components/ui/command.tsx';
import { Check } from '@/shared/icons/index.ts';

function PickerOptionLeading<T>({ row }: { row: PickerOptionRow<T> }) {
  const leading = row.option.leading ?? { kind: 'dot' };
  switch (leading.kind) {
    case 'dot':
      return <PickerDot tone={row.tone} />;
    case 'avatar':
      return (
        <PersonAvatar
          initials={leading.initials}
          tone={row.tone}
          size="option"
          patient={leading.patient === true}
        />
      );
    case 'icon':
      return <PickerIconTile icon={leading.icon} tone={row.tone} />;
    default:
      return null;
  }
}

function PickerOptionLabel<T>({ row, bold }: { row: PickerOptionRow<T>; bold: boolean }) {
  const { option, match } = row;
  if (option.leading?.kind === 'pill') {
    const Icon = option.leading.icon;
    return (
      <TonePill
        tone={row.tone}
        icon={Icon ? <Icon className="size-3.5 text-current" /> : undefined}
        className="self-start"
      >
        {option.label}
      </TonePill>
    );
  }
  return (
    <span
      dir="auto"
      className={cn(
        'max-w-full min-w-0 truncate [text-align:match-parent]',
        bold && 'font-semibold',
      )}
    >
      {match ? (
        <>
          {match.before}
          <mark className="bg-highlight rounded-xs text-inherit">{match.hit}</mark>
          {match.after}
        </>
      ) : (
        option.label
      )}
    </span>
  );
}

/** The trailing mark: a 16px check in the tone's ink, or an 18px checkbox. */
function PickerOptionMark({
  mode,
  picked,
  tone,
}: {
  mode: 'single' | 'multiple' | 'menu';
  picked: boolean;
  tone: Tone;
}) {
  const classes = TONE_CLASSES[tone];
  if (mode === 'menu') return null;
  if (mode === 'single') {
    return (
      <span
        aria-hidden="true"
        className={cn('flex w-4 shrink-0 justify-center', classes.ink)}
      >
        {picked ? <Check className="size-3 text-current" /> : null}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-4.5 shrink-0 items-center justify-center rounded-md border-[1.5px]',
        picked
          ? cn(classes.ink, 'border-current bg-current')
          : 'border-border-strong bg-background',
      )}
    >
      {picked ? <Check className="text-background size-3" /> : null}
    </span>
  );
}

/** Props for {@link PickerOptionItem}. */
export interface PickerOptionItemProps<T> {
  row: PickerOptionRow<T>;
  picked: boolean;
  /** `single` draws a check, `multiple` a checkbox, `menu` neither. */
  mode: 'single' | 'multiple' | 'menu';
  testId: string;
  /** sr-only word for the patient badge. */
  patientLabel: string;
  onPick: (row: PickerOptionRow<T>) => void;
}

/**
 * One option row (H:2891): min 36px, `rounded-md`, 13px; the leading avatar,
 * dot, tile or pill; the label (600 when picked in a single-select) with the
 * match on `bg-highlight`; the sub and the meta; then a 16px check in the
 * tone's ink or an 18px checkbox. Active rows take the tone at 55%, picked
 * ones at 70%. `aria-checked` carries the pick — cmdk spends `aria-selected`
 * on the active row. The label, the sub and the meta each take their own
 * direction (`dir="auto"`), so a name or "#3508 · +91 98250 44120" stays whole
 * on a right-to-left page, aligned as the row is.
 */
export function PickerOptionItem<T>({
  row,
  picked,
  mode,
  testId,
  patientLabel,
  onPick,
}: PickerOptionItemProps<T>) {
  const { option } = row;
  const tone = TONE_CLASSES[row.tone];
  const isPatient = option.leading?.kind === 'avatar' && option.leading.patient === true;
  return (
    <CommandItem
      value={row.value}
      disabled={option.disabled}
      onSelect={() => onPick(row)}
      onMouseDown={keepFocus}
      aria-checked={mode === 'menu' ? undefined : picked}
      data-testid={testId}
      className={cn(
        'text-body min-h-9 gap-2.5 rounded-md px-2 py-1 leading-[1.3] data-[disabled=true]:opacity-45',
        option.destructive
          ? 'text-destructive data-[selected=true]:text-destructive'
          : 'data-[selected=true]:text-foreground',
        picked && !option.disabled && tone.picked,
        tone.active,
      )}
    >
      <PickerOptionLeading row={row} />
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-px">
        <PickerOptionLabel row={row} bold={picked && mode === 'single'} />
        {isPatient ? <span className="sr-only">{patientLabel}</span> : null}
        {option.sub ? (
          <span
            dir="auto"
            className="text-caption text-muted-foreground min-w-0 flex-[1_1_7.5rem] truncate [text-align:match-parent] tabular-nums"
          >
            {option.sub}
          </span>
        ) : null}
      </span>
      {option.meta ? (
        <span
          dir="auto"
          className="text-caption text-muted-foreground shrink-0 whitespace-nowrap tabular-nums"
        >
          {option.meta}
        </span>
      ) : null}
      <PickerOptionMark mode={mode} picked={picked} tone={row.tone} />
    </CommandItem>
  );
}
