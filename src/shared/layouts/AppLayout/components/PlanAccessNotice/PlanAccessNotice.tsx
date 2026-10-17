import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { settingsHash } from '@/shared/components/SettingsModal/settings-hash-grammar.ts';
import { isSettingsModuleEnabled } from '@/shared/components/SettingsModal/settings-modules.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useCan } from '@/shared/hooks/useCan/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePlanAccess } from '@/shared/hooks/usePlanAccess/index.ts';
import { Clock, Lock } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';

const keys = LAYOUT_KEYS.app.planAccess;

/**
 * The clinic's plan notice in the section bar's notice stack: during a `grace` period, the date
 * its records turn read-only; once `read_only`, that nothing can be changed. Both offer "Choose a
 * plan" (Settings › Billing) to a member who may change the plan. Nothing while the plan is
 * `active` — or unknown.
 *
 * The section bar's system-notice pill (`shell.md:63`), like the email notice: 44px, publishing
 * its height through `data-slot="notice-pill"` so the phone's floating "New" rises above it. Its
 * words take two lines on a phone rather than losing the date to an ellipsis.
 */
export function PlanAccessNotice() {
  const { t } = useTranslation(LAYOUT_NS);
  const navigate = useNavigate();
  const { formatDate } = useLocaleFormat();
  const { state, graceEndsAt } = usePlanAccess();
  // The plan is changed only by a member clinozy-be lets manage the subscription — the gate the
  // billing panel puts on its plan buttons — and only where billing is switched on.
  const canChoosePlan =
    useCan({ permission: 'subscription:manage', teamOrganizationOnly: true }) &&
    isSettingsModuleEnabled({ scope: 'account', section: 'billing' });

  if (state === 'active') return null;
  const isReadOnly = state === 'read_only';
  const Icon = isReadOnly ? Lock : Clock;
  const message = isReadOnly
    ? t(keys.readOnly)
    : t(keys.grace, {
        date: graceEndsAt ? formatDate(graceEndsAt, { dateStyle: 'medium' }) : '',
      });

  return (
    <output
      data-slot="notice-pill"
      data-testid="plan-access-notice"
      data-state={state}
      className="bg-primary text-primary-foreground animate-dropdown-up pointer-events-auto flex h-11 max-w-full items-center gap-2.5 rounded-full ps-3.5 pe-1.5 shadow-(--elevation-menu)"
    >
      <Icon className="size-3.5 flex-none opacity-70" aria-hidden="true" />
      <span className="md:text-body line-clamp-2 min-w-0 text-xs leading-tight font-semibold">
        {message}
      </span>
      {canChoosePlan ? (
        <Button
          variant="ghost"
          size="sm"
          data-slot="pill"
          data-testid="plan-access-choose-plan"
          className="bg-canvas text-foreground hover:bg-border h-8 flex-none rounded-full px-3"
          onClick={() =>
            void navigate({ to: '.', hash: settingsHash('account', 'billing') })
          }
        >
          {t(keys.choosePlan)}
        </Button>
      ) : null}
    </output>
  );
}
