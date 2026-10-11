import { type KeyboardEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { TreatmentTemplate } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';

import { TREATMENT_KEYS, TREATMENT_NS } from '../../treatments.constants.ts';
import { TREATMENT_TEMPLATES } from './treatment-form.ts';

/**
 * The Type switch above the steps (H:4828; `patient-file.md:127`): Skin · laser
 * · Dental · Physio · Gynac · General, each with its tone dot, as one
 * segmented radio group — ← / → move the pick. Switching clears the area and
 * template fields.
 */
export function TreatmentTypeSwitch({
  value,
  onChange,
  disabled = false,
  testId,
}: {
  value: TreatmentTemplate;
  onChange: (template: TreatmentTemplate) => void;
  disabled?: boolean;
  testId: string;
}) {
  const { t } = useTranslation(TREATMENT_NS);
  const buttons = useRef(new Map<TreatmentTemplate, HTMLButtonElement>());
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const forward = (event.key === 'ArrowRight') !== rtl;
    const index = TREATMENT_TEMPLATES.findIndex((entry) => entry.template === value);
    const count = TREATMENT_TEMPLATES.length;
    const next = TREATMENT_TEMPLATES[(index + (forward ? 1 : -1) + count) % count];
    if (!next) return;
    onChange(next.template);
    buttons.current.get(next.template)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={t(TREATMENT_KEYS.type)}
      data-slot="segmented"
      data-testid={testId}
      className="bg-muted flex w-full gap-0.5 rounded-lg p-1"
    >
      {TREATMENT_TEMPLATES.map(({ template, tone }) => {
        const on = template === value;
        return (
          <button // NOSONAR(S6819): styled-button radiogroup; a native radio input cannot hold this dot-and-label pill
            key={template}
            ref={(node) => {
              if (node) buttons.current.set(template, node);
              else buttons.current.delete(template);
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            // The picked one again changes nothing (a switch clears the template's fields).
            onClick={() => {
              if (!on) onChange(template);
            }}
            onKeyDown={onKeyDown}
            data-testid={`${testId}-${template}`}
            className={cn(
              'text-body flex min-h-7.5 flex-1 items-center justify-center gap-1 rounded-md px-1 py-0.5 text-center leading-none font-medium transition-colors disabled:opacity-50 md:gap-1.5 md:px-2',
              on
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              aria-hidden="true"
              data-slot="pill"
              className={cn('size-2 flex-none rounded-full', TONE_CLASSES[tone].dot)}
            />
            {t(TREATMENT_KEYS.templates[template])}
          </button>
        );
      })}
    </div>
  );
}
