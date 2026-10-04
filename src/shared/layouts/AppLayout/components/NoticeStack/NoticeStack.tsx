import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { cn } from '@/lib/utils.ts';
import {
  type ClinicRoleKey,
  isPresetRole,
} from '@/shared/api/clinic/access-contracts.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { ROLE_TONES, TONE_CLASSES, toneForLabel } from '@/shared/clinic/clinic-tones.ts';
import { EmailVerificationBanner } from '@/shared/components/EmailVerificationBanner/index.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import {
  useClinicAccess,
  useClinicAccessMatrix,
} from '@/shared/hooks/useClinicAccess/index.ts';
import { usePlatformRoles } from '@/shared/hooks/useTeam/index.ts';
import { Eye } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { notify } from '@/shared/notify/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

const keys = LAYOUT_KEYS.app.sectionBar.viewAs;

/**
 * The previewed role's name and tone: a contract role's clinic name and tone,
 * or a custom role's clinozy-be name and its matrix tone (Users › Roles &
 * access) — the name's hash while the matrix has none (Appendix F).
 */
function usePreviewRoleBadge(key: ClinicRoleKey | null): { label: string; tone: Tone } {
  const { t } = useTranslation(CLINIC_NS);
  // Read only while a custom role is previewed: the shell never lists roles otherwise.
  const { roles } = usePlatformRoles(key !== null && !isPresetRole(key));
  const { data: matrix } = useClinicAccessMatrix();
  if (key === null) return { label: '', tone: 'stone' };
  if (isPresetRole(key))
    return { label: t(CLINIC_KEYS.roles[key]), tone: ROLE_TONES[key] };
  const name = roles.find((role) => role.id === key)?.name ?? '';
  return { label: name, tone: matrix?.customRoleTones[key] ?? toneForLabel(name) };
}

/** "Previewing as <role>" with the sections that role can view and "Exit preview" (H:554). */
function ViewAsPill() {
  const { t } = useTranslation(LAYOUT_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const setPreviewRole = useUIStore((state) => state.setPreviewRole);
  const { previewRole, viewableSections, isResolved } = useClinicAccess();
  const role = usePreviewRoleBadge(previewRole);
  if (!previewRole) return null;
  const sections = viewableSections
    .map((section) => tClinic(CLINIC_KEYS.sections[section].label))
    .join(' · ');
  return (
    <div
      role="status"
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
          TONE_CLASSES[role.tone].dot,
        )}
      />
      <span className="text-body font-semibold whitespace-nowrap">
        {t(keys.previewing, { role: role.label })}
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
    </div>
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
        <EmailVerificationBanner variant="pill" />
      </SectionErrorBoundary>
      <ViewAsPill />
    </div>
  );
}
