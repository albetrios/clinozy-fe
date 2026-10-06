import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationPicker } from '@/lib/routes/index.ts';
import { EmptyState, EmptyStateAction } from '@/shared/components/EmptyState/index.ts';
import { ShieldAlert } from '@/shared/icons/index.ts';

/**
 * Blocked state for a suspended / lapsed organization. Reading data is
 * blocked at the guard layer; the user can switch organization or contact
 * an administrator about billing. The design's empty state in the butter
 * tone — the warning pair — with the way out as its 36px primary button.
 */
export function SuspendedPage() {
  const { t } = useTranslation(ERRORS_NS);

  return (
    <div
      data-testid="suspended-page"
      className="flex min-h-[60vh] flex-col justify-center"
    >
      <EmptyState
        tone="butter"
        icon={<ShieldAlert />}
        headingLevel={1}
        title={t(ERRORS_KEYS.suspended.title)}
        description={t(ERRORS_KEYS.suspended.message)}
        action={
          <EmptyStateAction asChild data-testid="suspended-switch-organization">
            <Link {...organizationPicker()}>
              {t(ERRORS_KEYS.suspended.switchOrganization)}
            </Link>
          </EmptyStateAction>
        }
      />
    </div>
  );
}
