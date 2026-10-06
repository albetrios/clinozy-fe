import { useTranslation } from 'react-i18next';

import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';
import { Check } from '@/shared/icons/index.ts';
import type { OnboardingStep } from '@/shared/store/useOnboardingStore/index.ts';

type StepState = 'done' | 'current' | 'upcoming';

function stepState(index: number, current: number): StepState {
  if (index < current) return 'done';
  if (index === current) return 'current';
  return 'upcoming';
}

/**
 * The drawer step cards' number circle (`_patterns.md:45`; `DrawerSteps`): 24px,
 * 11px/600 — done is the green with "✓", the open step the ink with its number
 * (a section's tone ink in a drawer; the wizard has no section), a later step
 * `border` grey with its number.
 */
const CIRCLE_CLASS: Record<StepState, string> = {
  done: 'bg-success text-success-foreground',
  current: 'bg-primary text-primary-foreground',
  upcoming: 'bg-border text-muted-foreground-strong',
};

/**
 * Numbered progress across the top of the onboarding card: the step circles,
 * joined by hairlines that share the card's width — green behind a done step —
 * so five steps fit a phone without spilling out of the card.
 */
export function StepIndicator({
  current,
  steps,
}: {
  current: number;
  steps: readonly OnboardingStep[];
}) {
  const { t } = useTranslation(LOCALE_NS);
  return (
    <ol
      className="flex w-full items-center"
      aria-label={t(LOCALE_KEYS.onboardingProgress)}
    >
      {steps.map((step, i) => {
        const state = stepState(i, current);
        const last = i === steps.length - 1;
        return (
          <li key={step} className={cn('flex items-center', !last && 'flex-1')}>
            <span
              data-slot="pill"
              data-state={state}
              className={cn(
                'text-micro flex size-6 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums transition-colors duration-200',
                CIRCLE_CLASS[state],
              )}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {state === 'done' ? <Check className="size-3" aria-hidden="true" /> : i + 1}
            </span>
            {last ? null : (
              <span
                className={cn(
                  'mx-2 h-px min-w-3 flex-1 transition-colors duration-300',
                  i < current ? 'bg-success' : 'bg-border',
                )}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
