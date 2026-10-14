import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { cn } from '@/lib/utils.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { EmailVerificationBanner } from '@/shared/components/EmailVerificationBanner/index.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useRoleLabel, useRolesInForce } from '@/shared/hooks/useAppRoles/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useAccessResolved, useCan } from '@/shared/hooks/useCan/index.ts';
import { Eye, Info } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { notify } from '@/shared/notify/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

const keys = LAYOUT_KEYS.app.sectionBar.viewAs;

/** "Previewing as <role>" with the sections that role can view and "Exit preview" (H:554). */
function ViewAsPill() {
  const { t } = useTranslation(LAYOUT_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const setPreviewRole = useUIStore((state) => state.setPreviewRole);
  const { previewRole, viewableSections, isResolved } = useAppAccess();
  const label = useRoleLabel();
  const [role] = useRolesInForce();
  if (!previewRole) return null;
  const sections = viewableSections
    .map((section) => tApp(APP_KEYS.sections[section].label))
    .join(' · ');
  return (
    <output
      data-slot="notice-pill"
      data-testid="view-as-bar"
      className="bg-primary text-primary-foreground animate-dropdown-up pointer-events-auto flex h-11 max-w-full items-center gap-2.5 rounded-full ps-3.5 pe-1.5 shadow-(--elevation-fab)"
    >
      <Eye className="text-border-strong size-3.5 flex-none" aria-hidden />
      <span
        aria-hidden
        data-slot="pill"
        className={cn(
          'ring-primary-foreground size-2 flex-none rounded-full ring-2',
          TONE_CLASSES[role?.tone ?? 'stone'].dot,
        )}
      />
      <span className="text-body font-semibold whitespace-nowrap">
        {t(keys.previewing, { role: role ? label(role) : '' })}
      </span>
      <span className="text-disabled min-w-0 truncate text-xs">
        {isResolved ? sections || t(keys.noSections) : null}
      </span>
      <button
        type="button"
        data-testid="view-as-exit"
        onClick={() => {
          setPreviewRole(null);
          notify.success(t(keys.exitToast));
        }}
        data-slot="pill"
        className="bg-canvas text-foreground hover:bg-border h-8 flex-none rounded-full px-3 text-xs font-medium transition-colors"
      >
        {t(keys.exit)}
      </button>
    </output>
  );
}

/**
 * "Your clinic is still being set up — bookings open once it's ready." (feat-clinic-setup KICKOFF
 * §3; BRIEF.md:117–121): for a member of a team clinic who cannot manage it, while the clinic has
 * no open branch. Managers get the setup drawer and the ring instead.
 */
function SetupMemberNotice() {
  const { t } = useTranslation(LAYOUT_NS);
  const isResolved = useAccessResolved();
  const isTeam = useCan({ teamOrganizationOnly: true });
  const canManage = useCan({ permission: 'organization:update' });
  const { openBranches, isPending } = useBranches();
  if (!isResolved || !isTeam || canManage || isPending || openBranches.length > 0)
    return null;
  return (
    <output
      data-slot="notice-pill"
      data-testid="setup-member-notice"
      className="bg-primary text-primary-foreground animate-dropdown-up pointer-events-auto flex h-11 max-w-full items-center gap-2.5 rounded-full px-3.5 shadow-(--elevation-menu)"
    >
      <Info className="size-3.5 flex-none opacity-70" aria-hidden />
      <span className="text-body min-w-0 truncate font-semibold">
        {t(LAYOUT_KEYS.app.setup.memberNotice)}
      </span>
    </output>
  );
}

/**
 * The section bar's bottom-centre notices (`shell.md:63`; H:554): the email
 * verification notice and, under it, the View-as pill. 72px up on desktop and
 * tablet; on a phone 14px above the tab bar, each pill publishing its height
 * (`data-slot="notice-pill"`) so a floating "New" rises above it (§3.5, D33).
 */
export function NoticeStack() {
  const { t } = useTranslation(ERRORS_NS);
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--floating-bottom-offset,0rem)+0.875rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 md:bottom-18">
      <SectionErrorBoundary
        title={t(ERRORS_KEYS.widget.emailBanner)}
        testId="email-banner-error"
        variant="inline"
      >
        <EmailVerificationBanner />
      </SectionErrorBoundary>
      <SetupMemberNotice />
      <ViewAsPill />
    </div>
  );
}
