import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { useOnboardingStore } from '@/shared/store/useOnboardingStore/index.ts';

import { ONBOARDING_KEYS, ONBOARDING_NS } from '../../onboarding.constants.ts';
import type { OnboardingStep } from '../../onboarding-flow.ts';

/**
 * One summary tile — a collapsed drawer step's peek tile (`_patterns.md:46`;
 * `DrawerSteps`): the 10.5px/600 uppercase label over the 12.5px value,
 * clamped to two lines; a value not given reads on a dashed tile in the
 * disabled ink.
 */
function SummaryTile({
  label,
  value,
  empty,
}: {
  label: string;
  value: string;
  empty: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-background flex min-w-0 flex-col gap-0.5 rounded-lg border px-2.5 py-1.5',
        empty && 'border-dashed',
      )}
    >
      <dt className="text-tiny text-muted-foreground truncate font-semibold tracking-[0.04em] uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          'text-detail line-clamp-2 wrap-anywhere',
          empty ? 'text-disabled' : 'text-foreground',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Review summary shown before the final "Enter workspace" action: the name, and
 * the clinic name when this flow asked for it. `organizationName` exists only
 * when the `workspace` step ran (team-only mode) — rendering it unconditionally
 * showed a dangling "Organization: —" in personal/hybrid flows that never asked
 * for one.
 *
 * `steps` arrives as a prop rather than being re-derived here. This component
 * used to call `deriveOnboardingSteps` a second time off its own `useMeContext`,
 * which meant a missing context would have fallen back to the permissive
 * deployment flags and summarised the WRONG flow — the same latent hazard the
 * page's gate exists to prevent (ONB-9). One derivation, passed down.
 */
export function DoneStep({ steps }: { steps: readonly OnboardingStep[] }) {
  const { t } = useTranslation(ONBOARDING_NS);
  /*
   * Field-level selectors (ONB-13). `useOnboardingStore()` with no selector
   * subscribes to the whole store, so this summary re-rendered on every
   * keystroke anywhere in the wizard.
   */
  const firstName = useOnboardingStore((s) => s.data.firstName);
  const lastName = useOnboardingStore((s) => s.data.lastName);
  const organizationName = useOnboardingStore((s) => s.data.organizationName);
  const empty = t(ONBOARDING_KEYS.done.emptyValue);
  const name = [firstName, lastName].filter(Boolean).join(' ');

  return (
    // The peek's grid: auto-fit tiles at least 150px wide, 6px apart.
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(9.375rem,1fr))] gap-1.5">
      <SummaryTile
        label={t(ONBOARDING_KEYS.done.nameLabel)}
        value={name || empty}
        empty={!name}
      />
      {steps.includes('workspace') ? (
        <SummaryTile
          label={t(ONBOARDING_KEYS.done.organizationLabel)}
          value={organizationName || empty}
          empty={!organizationName}
        />
      ) : null}
    </dl>
  );
}
